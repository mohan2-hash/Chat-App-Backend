const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { isValidEmail } = require('../utils/helpers');

const router = express.Router();

const generateToken = (user) => {
    return jwt.sign(
        { userId: user.id, id: user.id, email: user.email, full_name: user.full_name },
        process.env.JWT_SECRET || 'your_jwt_secret_key',
        { expiresIn: '7d' }
    );
};

// Register
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password, confirmPassword } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ error: 'Full name, email, and password are required' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        // Check if user exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }

        const userId = await User.create({ full_name, email, password });
        const newUser = await User.findById(userId);
        const token = generateToken(newUser);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: newUser.id,
                full_name: newUser.full_name,
                email: newUser.email,
                status: newUser.status
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message || 'Error registering user' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isValid = await User.validatePassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update user status to online
        await User.updateStatus(user.id, 'online');

        const token = generateToken(user);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                status: 'online'
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message || 'Error logging in' });
    }
});

// Get current user profile (/me)
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        await User.updateStatus(req.user.userId, 'offline');
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Forgot Password (simulation)
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'User with this email not found' });
        }

        res.json({ message: 'Password reset link sent to your email (simulated)' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
