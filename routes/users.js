const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all users (excluding current user)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const users = await User.getAllUsers(currentUserId);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Search users
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || !q.trim()) {
            return res.json([]);
        }
        const users = await User.searchUsers(q.trim(), req.user.userId);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user profile (current user)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user by specific ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(parseInt(req.params.id, 10));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update own status
router.put('/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }
        await User.updateStatus(req.user.userId, status);
        res.json({ message: 'Status updated successfully', status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
