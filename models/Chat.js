const db = require('../config/database');

class Chat {
    static async findOrCreate(user1Id, user2Id) {
        const u1 = parseInt(user1Id, 10);
        const u2 = parseInt(user2Id, 10);

        if (u1 === u2) {
            throw new Error('Cannot start a chat with yourself');
        }

        const minId = Math.min(u1, u2);
        const maxId = Math.max(u1, u2);

        // Find existing chat
        const [existing] = await db.execute(`
            SELECT id, user1_id, user2_id, created_at, updated_at
            FROM chats 
            WHERE user1_id = ? AND user2_id = ?
        `, [minId, maxId]);

        if (existing && existing.length > 0) {
            return existing[0];
        }

        // Create new chat
        const [result] = await db.execute(
            'INSERT INTO chats (user1_id, user2_id) VALUES (?, ?)',
            [minId, maxId]
        );

        return {
            id: result.insertId,
            user1_id: minId,
            user2_id: maxId
        };
    }

    static async findById(chatId) {
        const [rows] = await db.execute(
            'SELECT id, user1_id, user2_id, created_at, updated_at FROM chats WHERE id = ?',
            [parseInt(chatId, 10)]
        );
        return rows[0] || null;
    }

    static async isParticipant(chatId, userId) {
        const chat = await this.findById(chatId);
        if (!chat) return false;
        const uid = parseInt(userId, 10);
        return chat.user1_id === uid || chat.user2_id === uid;
    }

    static async getUserChats(userId) {
        const uid = parseInt(userId, 10);
        const [rows] = await db.execute(`
            SELECT 
                c.id,
                c.updated_at,
                c.user1_id,
                c.user2_id,
                CASE 
                    WHEN c.user1_id = ? THEN u2.id 
                    ELSE u1.id 
                END as other_user_id,
                CASE 
                    WHEN c.user1_id = ? THEN u2.full_name 
                    ELSE u1.full_name 
                END as other_user_name,
                CASE 
                    WHEN c.user1_id = ? THEN u2.email 
                    ELSE u1.email 
                END as other_user_email,
                CASE 
                    WHEN c.user1_id = ? THEN u2.status 
                    ELSE u1.status 
                END as other_user_status,
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC, id DESC LIMIT 1) as last_message,
                (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC, id DESC LIMIT 1) as last_message_time,
                (SELECT COUNT(*) FROM messages WHERE chat_id = c.id AND sender_id != ? AND (is_read = 0 OR is_read = FALSE)) as unread_count
            FROM chats c
            JOIN users u1 ON c.user1_id = u1.id
            JOIN users u2 ON c.user2_id = u2.id
            WHERE c.user1_id = ? OR c.user2_id = ?
            ORDER BY c.updated_at DESC
        `, [uid, uid, uid, uid, uid, uid, uid]);

        return rows;
    }
}

module.exports = Chat;
