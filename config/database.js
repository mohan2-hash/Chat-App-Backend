const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

let pool = null;
let sqliteDb = null;
let activeEngine = 'mysql';

// Helper to convert MySQL ? placeholders and syntax for SQLite compatibility if needed
function adaptSqlForSqlite(sql) {
    let converted = sql
        .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
        .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
        .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
        .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
        .replace(/ENUM\([^)]+\)/gi, 'TEXT');
    return converted;
}

const initSqlite = () => {
    try {
        const { DatabaseSync } = require('node:sqlite');
        const dbDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        const dbPath = path.join(dbDir, 'chat_app.sqlite');
        sqliteDb = new DatabaseSync(dbPath);

        // Enable foreign keys and WAL mode
        sqliteDb.exec('PRAGMA foreign_keys = ON;');
        sqliteDb.exec('PRAGMA journal_mode = WAL;');

        // Create tables
        sqliteDb.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                status TEXT DEFAULT 'offline',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        sqliteDb.exec(`
            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user1_id INTEGER NOT NULL,
                user2_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user1_id, user2_id)
            );
        `);

        sqliteDb.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL,
                sender_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        activeEngine = 'sqlite';
        console.log(`[Database] Initialized local SQLite database successfully at: ${dbPath}`);
        return true;
    } catch (err) {
        console.error('[Database] Failed to initialize SQLite:', err.message);
        throw err;
    }
};

const initMysql = async () => {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'chat_app',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5000
    };

    pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();

    try {
        // Attempt create database (ignore errors if permission is denied, e.g. shared cPanel/Hostinger)
        try {
            await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
        } catch (e) {
            // Permission denied or already exists; continue
        }

        await connection.execute(`USE \`${dbConfig.database}\``);

        // Create users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                status ENUM('online', 'offline', 'away') DEFAULT 'offline',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create chats table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS chats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user1_id INT NOT NULL,
                user2_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_chat (user1_id, user2_id)
            )
        `);

        // Create messages table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                chat_id INT NOT NULL,
                sender_id INT NOT NULL,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        activeEngine = 'mysql';
        console.log(`[Database] Connected to MySQL database "${dbConfig.database}" at ${dbConfig.host}`);
    } finally {
        connection.release();
    }
};

const initDatabase = async () => {
    const preferredEngine = (process.env.DB_ENGINE || '').toLowerCase();

    if (preferredEngine === 'sqlite') {
        initSqlite();
        return;
    }

    try {
        await initMysql();
    } catch (mysqlErr) {
        console.warn(`[Database] MySQL connection failed (${mysqlErr.message}). Falling back to built-in SQLite engine...`);
        initSqlite();
    }
};

// Initialize DB immediately
const initPromise = initDatabase();

/**
 * Universal query execution supporting both MySQL2 and node:sqlite.
 * Always returns [rows] or [result] to preserve mysql2 promise signature.
 */
async function execute(sql, params = []) {
    await initPromise;

    if (activeEngine === 'mysql') {
        return pool.execute(sql, params);
    }

    // SQLite Execution
    let sqliteSql = adaptSqlForSqlite(sql);
    const trimmed = sqliteSql.trim();
    const isSelect = /^SELECT\b/i.test(trimmed) || /^PRAGMA\b/i.test(trimmed);

    try {
        const stmt = sqliteDb.prepare(sqliteSql);
        // Normalize params (e.g. booleans to 1/0, undefined to null)
        const sanitizedParams = params.map(p => {
            if (typeof p === 'boolean') return p ? 1 : 0;
            if (p === undefined) return null;
            return p;
        });

        if (isSelect) {
            const rows = stmt.all(...sanitizedParams);
            return [rows, []];
        } else {
            const info = stmt.run(...sanitizedParams);
            const result = {
                insertId: Number(info.lastInsertRowid),
                affectedRows: Number(info.changes),
                changes: Number(info.changes)
            };
            return [result, []];
        }
    } catch (err) {
        console.error('[Database Query Error]', err.message, 'SQL:', sqliteSql, 'Params:', params);
        throw err;
    }
}

module.exports = {
    execute,
    getEngine: () => activeEngine,
    initPromise
};
