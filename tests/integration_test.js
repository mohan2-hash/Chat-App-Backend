const http = require('http');
const { io: Client } = require('socket.io-client');
require('dotenv').config();

// Ensure test uses SQLite for guaranteed local isolation
process.env.DB_ENGINE = 'sqlite';

const { app, server } = require('../server');

async function runTests() {
    console.log('--- Starting Integration Test Suite ---');
    const port = 5099;

    await new Promise((resolve) => {
        server.listen(port, () => {
            console.log(`Test server listening on port ${port}`);
            resolve();
        });
    });

    const baseUrl = `http://localhost:${port}`;

    try {
        // 1. Health check test
        console.log('\n[1] Testing Health Check Route...');
        const healthRes = await fetch(`${baseUrl}/api/test`);
        const healthJson = await healthRes.json();
        if (healthJson.status !== 'online') throw new Error('Health check failed');
        console.log('✅ Health check passed:', healthJson.message);

        // 2. User Registration (Mohan)
        console.log('\n[2] Testing User 1 Registration (Mohan)...');
        const reg1Res = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Mohan Hash',
                email: 'mohan@test.com',
                password: 'password123',
                confirmPassword: 'password123'
            })
        });
        const reg1Data = await reg1Res.json();
        if (!reg1Res.ok) throw new Error(`User 1 registration failed: ${reg1Data.error}`);
        const token1 = reg1Data.token;
        const user1 = reg1Data.user;
        console.log(`✅ User 1 created: ID ${user1.id}, Name: ${user1.full_name}`);

        // 3. User Registration (Alex)
        console.log('\n[3] Testing User 2 Registration (Alex)...');
        const reg2Res = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Alex Johnson',
                email: 'alex@test.com',
                password: 'password123',
                confirmPassword: 'password123'
            })
        });
        const reg2Data = await reg2Res.json();
        if (!reg2Res.ok) throw new Error(`User 2 registration failed: ${reg2Data.error}`);
        const token2 = reg2Data.token;
        const user2 = reg2Data.user;
        console.log(`✅ User 2 created: ID ${user2.id}, Name: ${user2.full_name}`);

        // 4. Test User Profile /me
        console.log('\n[4] Testing GET /api/auth/me...');
        const meRes = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token1}` }
        });
        const meData = await meRes.json();
        if (!meRes.ok || meData.user.email !== 'mohan@test.com') throw new Error('Profile fetch failed');
        console.log('✅ /me verification passed for:', meData.user.email);

        // 5. Test Get Users list
        console.log('\n[5] Testing GET /api/users...');
        const usersRes = await fetch(`${baseUrl}/api/users`, {
            headers: { 'Authorization': `Bearer ${token1}` }
        });
        const usersList = await usersRes.json();
        if (!Array.isArray(usersList) || usersList.length === 0) throw new Error('Users list empty');
        console.log(`✅ Users list retrieved (${usersList.length} user(s) found excluding requester)`);

        // 6. Create Chat between User 1 and User 2
        console.log('\n[6] Testing POST /api/chats/create...');
        const chatRes = await fetch(`${baseUrl}/api/chats/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token1}`
            },
            body: JSON.stringify({ otherUserId: user2.id })
        });
        const chatData = await chatRes.json();
        if (!chatRes.ok || !chatData.id) throw new Error(`Chat creation failed: ${chatData.error}`);
        const chatId = chatData.id;
        console.log(`✅ Chat created: ID ${chatId} between User ${user1.id} and User ${user2.id}`);

        // 7. Send Message via REST
        console.log('\n[7] Testing POST /api/messages (REST)...');
        const msgRes = await fetch(`${baseUrl}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token1}`
            },
            body: JSON.stringify({
                chatId,
                content: 'Hey Alex! Welcome to the new chat app backend!'
            })
        });
        const msgData = await msgRes.json();
        if (!msgRes.ok || !msgData.data) throw new Error(`Send message failed: ${msgData.error}`);
        console.log('✅ Message sent via REST. ID:', msgData.data.id, 'Content:', msgData.data.content);

        // 8. Fetch Messages
        console.log('\n[8] Testing GET /api/messages/:chatId...');
        const getMsgsRes = await fetch(`${baseUrl}/api/messages/${chatId}`, {
            headers: { 'Authorization': `Bearer ${token2}` }
        });
        const messages = await getMsgsRes.json();
        if (!Array.isArray(messages) || messages.length === 0) throw new Error('Failed to retrieve messages');
        console.log(`✅ Messages retrieved successfully. Count: ${messages.length}`);

        // 9. Real-Time Socket.io Connection & Exchange Test
        console.log('\n[9] Testing Socket.io Real-Time bi-directional exchange...');
        const socket1 = Client(`http://localhost:${port}`, {
            auth: { token: token1 }
        });

        const socket2 = Client(`http://localhost:${port}`, {
            auth: { token: token2 }
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Socket test timed out')), 5000);

            socket2.on('connect', () => {
                socket2.emit('join_chat', { chatId });
            });

            socket1.on('connect', () => {
                socket1.emit('join_chat', { chatId });

                // Socket 2 listens for receive_message
                socket2.on('receive_message', (receivedMsg) => {
                    console.log('⚡ Socket 2 received message instantly over WebSocket:');
                    console.log(`   Sender: ${receivedMsg.sender_name} | Content: "${receivedMsg.content}"`);
                    if (receivedMsg.content === 'Hello from WebSocket real-time!') {
                        clearTimeout(timeout);
                        socket1.disconnect();
                        socket2.disconnect();
                        resolve();
                    }
                });

                // Socket 1 sends message
                setTimeout(() => {
                    socket1.emit('send_message', {
                        chatId,
                        content: 'Hello from WebSocket real-time!'
                    });
                }, 300);
            });
        });

        console.log('\n=========================================');
        console.log('🎉 ALL INTEGRATION TESTS PASSED 100%!');
        console.log('=========================================');
    } catch (err) {
        console.error('❌ Test failed with error:', err);
        process.exitCode = 1;
    } finally {
        server.close();
        process.exit();
    }
}

runTests();
