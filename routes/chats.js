const express = require('express');
const Chat = require('../models/Chat');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get user's chats
router.get('/', authenticateToken, async (req, res) => {
    try {
        const chats = await Chat.getUserChats(req.user.userId);
        res.json(chats);
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
        
        const chat = await Chat.findOrCreate(req.user.userId, parseInt(otherUserId));
        res.json(chat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
