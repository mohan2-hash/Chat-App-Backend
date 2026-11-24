const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
require('dotenv').config();

const { setupSocket } = require('./socket/chatSocket');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Setup Socket.io
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// Attach socket.io to app so REST controllers can broadcast events
app.set('io', io);
setupSocket(io);

// Middleware
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend test client
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Health check / Test route
app.get('/api/test', (req, res) => {
    res.json({
        status: 'online',
        message: 'Chat Application Backend is running smoothly!',
        timestamp: new Date().toISOString()
    });
});

// 404 Route handler for API
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Fallback to index.html for web client
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath);
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Server Error]', err.stack || err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`=========================================`);
        console.log(`🚀 Chat Backend Server running on port ${PORT}`);
        console.log(`📡 WebSocket / Socket.io initialized`);
        console.log(`🌐 Web Client accessible at http://localhost:${PORT}`);
        console.log(`=========================================`);
    });
}

module.exports = { app, server };
