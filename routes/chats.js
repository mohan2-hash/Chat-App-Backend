const express = require('express');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user's chats
router.get('/', authenticateToken, async (req, res) => {
    try {
        const chats = await Chat.getUserChats(req.user.userId);
        res.json(chats);
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get a specific chat
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const chatId = parseInt(req.params.id, 10);
        const isParticipant = await Chat.isParticipant(chatId, req.user.userId);
        if (!isParticipant) {
            return res.status(403).json({ error: 'Access denied: You are not a participant in this chat' });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        // Include other user's info
        const otherUserId = chat.user1_id === req.user.userId ? chat.user2_id : chat.user1_id;
        const otherUser = await User.findById(otherUserId);

        res.json({
            ...chat,
            other_user: otherUser
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create or get chat with another user
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { otherUserId } = req.body;

        if (!otherUserId) {
            return res.status(400).json({ error: 'Other user ID is required' });
        }

        const targetId = parseInt(otherUserId, 10);
        if (targetId === req.user.userId) {
            return res.status(400).json({ error: 'Cannot create a chat with yourself' });
        }

        const otherUser = await User.findById(targetId);
        if (!otherUser) {
            return res.status(404).json({ error: 'Target user does not exist' });
        }

        const chat = await Chat.findOrCreate(req.user.userId, targetId);

        res.json({
            ...chat,
            other_user_id: otherUser.id,
            other_user_name: otherUser.full_name,
            other_user_email: otherUser.email,
            other_user_status: otherUser.status
        });
    } catch (error) {
        console.error('Error creating chat:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
