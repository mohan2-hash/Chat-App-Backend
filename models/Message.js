const db = require('../config/database');

class Message {
    static async create(messageData) {
        const { chat_id, sender_id, content } = messageData;
        const chatId = parseInt(chat_id, 10);
        const senderId = parseInt(sender_id, 10);

        const [result] = await db.execute(
            'INSERT INTO messages (chat_id, sender_id, content, is_read) VALUES (?, ?, ?, 0)',
            [chatId, senderId, content.trim()]
        );

        const messageId = result.insertId;

        // Update chat's updated_at
        await db.execute(
            'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [chatId]
        );

        // Fetch and return the newly created message with sender info
        const message = await this.findById(messageId);
        return message;
    }

    static async findById(id) {
        const [rows] = await db.execute(`
            SELECT 
                m.id,
                m.chat_id,
                m.content,
                m.sender_id,
                m.is_read,
                m.created_at,
                u.full_name as sender_name,
                u.email as sender_email
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
        `, [parseInt(id, 10)]);

        return rows[0] || null;
    }

    static async getChatMessages(chatId, limit = 100) {
        const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 50, 500));
        const [rows] = await db.execute(`
            SELECT 
                m.id,
                m.chat_id,
                m.content,
                m.sender_id,
                m.is_read,
                m.created_at,
                u.full_name as sender_name,
                u.email as sender_email
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT ${safeLimit}
        `, [parseInt(chatId, 10)]);

        return rows;
    }

    static async markAsRead(chatId, userId) {
        const [result] = await db.execute(
            'UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_id != ? AND (is_read = 0 OR is_read = FALSE)',
            [parseInt(chatId, 10), parseInt(userId, 10)]
        );
        return result.affectedRows || result.changes || 0;
    }
}

module.exports = Message;
