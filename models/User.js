const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    static async create(userData) {
        const { full_name, email, password } = userData;
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.execute(
            'INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)',
            [full_name.trim(), email.trim().toLowerCase(), hashedPassword]
        );

        return result.insertId;
    }

    static async findByEmail(email) {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
            [email.trim()]
        );
        return rows[0] || null;
    }

    static async findById(id) {
        const [rows] = await db.execute(
            'SELECT id, full_name, email, status, created_at FROM users WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    static async getAllUsers(excludeId = 0) {
        const [rows] = await db.execute(
            'SELECT id, full_name, email, status, updated_at FROM users WHERE id != ? ORDER BY full_name ASC',
            [excludeId]
        );
        return rows;
    }

    static async searchUsers(query, excludeId = 0) {
        const pattern = `%${query.trim().toLowerCase()}%`;
        const [rows] = await db.execute(
            'SELECT id, full_name, email, status FROM users WHERE id != ? AND (LOWER(full_name) LIKE ? OR LOWER(email) LIKE ?) ORDER BY full_name ASC',
            [excludeId, pattern, pattern]
        );
        return rows;
    }

    static async updateStatus(userId, status) {
        const validStatuses = ['online', 'offline', 'away'];
        const finalStatus = validStatuses.includes(status) ? status : 'offline';
        await db.execute(
            'UPDATE users SET status = ? WHERE id = ?',
            [finalStatus, userId]
        );
    }

    static async validatePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;
