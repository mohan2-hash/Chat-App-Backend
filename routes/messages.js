const express = require('express');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get messages for a chat
router.get('/:chatId', authenticateToken, async (req, res) => {
    try {
        const chatId = parseInt(req.params.chatId, 10);
        const userId = req.user.userId;

        // Security check: Must be a participant in this chat
        const isParticipant = await Chat.isParticipant(chatId, userId);
        if (!isParticipant) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this chat' });
        }

        const messages = await Message.getChatMessages(chatId);

        // Mark messages as read
        const updatedCount = await Message.markAsRead(chatId, userId);

        // Notify via socket if messages were marked as read
        const io = req.app.get('io');
        if (io && updatedCount > 0) {
            io.to(`chat_${chatId}`).emit('messages_read', {
                chatId,
                readByUserId: userId
            });
        }

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send a message via REST
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { chatId, content } = req.body;
        const userId = req.user.userId;

        if (!chatId || !content || !content.trim()) {
            return res.status(400).json({ error: 'Chat ID and message content are required' });
        }

        const parsedChatId = parseInt(chatId, 10);

        // Security check: Must be a participant
        const isParticipant = await Chat.isParticipant(parsedChatId, userId);
        if (!isParticipant) {
            return res.status(403).json({ error: 'Access denied: You cannot send messages to this chat' });
        }

        const message = await Message.create({
            chat_id: parsedChatId,
            sender_id: userId,
            content: content.trim()
        });

        // Broadcast to socket room
        const io = req.app.get('io');
        if (io) {
            io.to(`chat_${parsedChatId}`).emit('receive_message', message);

            // Also notify the other participant in their personal room (for chat list update / unread counter)
            const chat = await Chat.findById(parsedChatId);
            if (chat) {
                const recipientId = chat.user1_id === userId ? chat.user2_id : chat.user1_id;
                io.to(`user_${recipientId}`).emit('new_message_notification', {
                    chatId: parsedChatId,
                    message
                });
            }
        }

        res.status(201).json({
            message: 'Message sent successfully',
            data: message
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Explicitly mark chat messages as read
router.put('/:chatId/read', authenticateToken, async (req, res) => {
    try {
        const chatId = parseInt(req.params.chatId, 10);
        const userId = req.user.userId;

        const isParticipant = await Chat.isParticipant(chatId, userId);
        if (!isParticipant) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updatedCount = await Message.markAsRead(chatId, userId);

        const io = req.app.get('io');
        if (io && updatedCount > 0) {
            io.to(`chat_${chatId}`).emit('messages_read', {
                chatId,
                readByUserId: userId
            });
        }

        res.json({
            message: 'Messages marked as read',
            updatedCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
