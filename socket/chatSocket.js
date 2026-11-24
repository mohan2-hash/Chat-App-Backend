const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Store active connections: Map<userId, Set<socketId>>
const userSockets = new Map();

const setupSocket = (io) => {
    // Socket authentication middleware
    io.use((socket, next) => {
        let token = socket.handshake.auth?.token || socket.handshake.query?.token;

        if (!token) {
            return next(new Error('Authentication error: Token is required'));
        }

        if (token.startsWith('Bearer ') || token.startsWith('bearer ')) {
            token = token.slice(7).trim();
        }

        jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key', (err, decoded) => {
            if (err) {
                return next(new Error('Authentication error: Invalid or expired token'));
            }
            const userId = decoded.userId || decoded.id;
            socket.user = {
                ...decoded,
                userId,
                id: userId
            };
            next();
        });
    });

    io.on('connection', async (socket) => {
        const userId = socket.user.userId;
        console.log(`[Socket] User connected: ID ${userId} (Socket: ${socket.id})`);

        // Track active socket
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Join personal user room for direct alerts
        socket.join(`user_${userId}`);

        // Update status to online and broadcast
        try {
            await User.updateStatus(userId, 'online');
            io.emit('user_status_changed', {
                userId,
                status: 'online'
            });
        } catch (e) {
            console.error('Error updating status on socket connect:', e.message);
        }

        // Join specific chat room
        socket.on('join_chat', async ({ chatId }) => {
            try {
                const parsedChatId = parseInt(chatId, 10);
                const isParticipant = await Chat.isParticipant(parsedChatId, userId);
                if (isParticipant) {
                    socket.join(`chat_${parsedChatId}`);
                    console.log(`[Socket] User ${userId} joined room chat_${parsedChatId}`);
                }
            } catch (err) {
                console.error('Error joining chat room:', err.message);
            }
        });

        // Leave chat room
        socket.on('leave_chat', ({ chatId }) => {
            const parsedChatId = parseInt(chatId, 10);
            socket.leave(`chat_${parsedChatId}`);
            console.log(`[Socket] User ${userId} left room chat_${parsedChatId}`);
        });

        // Send real-time message
        socket.on('send_message', async (data, callback) => {
            try {
                const { chatId, content } = data;
                if (!chatId || !content || !content.trim()) {
                    if (callback) callback({ error: 'Chat ID and content are required' });
                    return;
                }

                const parsedChatId = parseInt(chatId, 10);
                const isParticipant = await Chat.isParticipant(parsedChatId, userId);
                if (!isParticipant) {
                    if (callback) callback({ error: 'Access denied: not a participant' });
                    return;
                }

                const message = await Message.create({
                    chat_id: parsedChatId,
                    sender_id: userId,
                    content: content.trim()
                });

                // Broadcast to everyone in the chat room
                io.to(`chat_${parsedChatId}`).emit('receive_message', message);

                // Also notify the other participant in their personal room (for conversation list preview)
                const chat = await Chat.findById(parsedChatId);
                if (chat) {
                    const otherUserId = chat.user1_id === userId ? chat.user2_id : chat.user1_id;
                    io.to(`user_${otherUserId}`).emit('new_message_notification', {
                        chatId: parsedChatId,
                        message
                    });
                }

                if (callback) {
                    callback({ success: true, message });
                }
            } catch (err) {
                console.error('Error handling send_message in socket:', err);
                if (callback) callback({ error: err.message });
            }
        });

        // Typing indicators
        socket.on('typing', ({ chatId }) => {
            socket.to(`chat_${chatId}`).emit('user_typing', {
                chatId: parseInt(chatId, 10),
                userId,
                userName: socket.user.full_name || 'Someone'
            });
        });

        socket.on('stop_typing', ({ chatId }) => {
            socket.to(`chat_${chatId}`).emit('user_stop_typing', {
                chatId: parseInt(chatId, 10),
                userId
            });
        });

        // Mark messages as read
        socket.on('mark_as_read', async ({ chatId }) => {
            try {
                const parsedChatId = parseInt(chatId, 10);
                const updated = await Message.markAsRead(parsedChatId, userId);
                if (updated > 0) {
                    io.to(`chat_${parsedChatId}`).emit('messages_read', {
                        chatId: parsedChatId,
                        readByUserId: userId
                    });
                }
            } catch (err) {
                console.error('Error in mark_as_read socket event:', err.message);
            }
        });

        // Disconnect
        socket.on('disconnect', async () => {
            console.log(`[Socket] Socket disconnected: ${socket.id} (User: ${userId})`);
            const userSet = userSockets.get(userId);
            if (userSet) {
                userSet.delete(socket.id);
                if (userSet.size === 0) {
                    userSockets.delete(userId);
                    // User is now offline
                    try {
                        await User.updateStatus(userId, 'offline');
                        io.emit('user_status_changed', {
                            userId,
                            status: 'offline'
                        });
                    } catch (e) {
                        console.error('Error setting user status offline:', e.message);
                    }
                }
            }
        });
    });
};

module.exports = { setupSocket };
