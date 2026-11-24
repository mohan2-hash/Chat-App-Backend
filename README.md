# 💬 Modern Real-Time Chat App Backend

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black.svg)](https://socket.io/)
[![Database](https://img.shields.io/badge/Database-MySQL%20%7C%20SQLite-orange.svg)](https://github.com/mohan2-hash/Chat-App-Backend)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

A production-ready, feature-rich real-time Chat Application Backend built with **Node.js**, **Express**, **Socket.io**, and a **dual-engine Database system (MySQL + built-in SQLite)**.

Includes a **built-in interactive Web Chat Test Client** served automatically at `http://localhost:5000` for testing all features right in your browser!

---

## 🌟 Key Features

- 🔐 **Secure JWT Authentication**: User registration, login with encrypted passwords (`bcryptjs`), session verification (`/api/auth/me`), and logout.
- ⚡ **Real-Time WebSockets (Socket.io)**:
  - Instant 1-on-1 bi-directional message delivery.
  - Live typing indicators ("User is typing...").
  - Live online/offline user status broadcasting.
  - Real-time read receipts.
- 🛡️ **Role & Participant Protection**: Full security validation preventing unauthorized users from accessing or sending messages to chats they are not part of.
- 🔄 **Resilient Dual Database Engine (MySQL & SQLite)**:
  - Configurable between **MySQL** and **SQLite** (`node:sqlite`).
  - Automatic fallback: If remote/local MySQL is unavailable or blocked, it seamlessly falls back to local SQLite with zero downtime!
- 🎨 **Built-In Live Chat Web Client**: Test everything out-of-the-box by visiting `http://localhost:5000` across two browser windows or tabs.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
Create or edit `.env` in the root directory:
```env
PORT=5000
JWT_SECRET=your_super_secret_jwt_key

# Options: 'auto' (tries MySQL, falls back to SQLite), 'mysql', or 'sqlite'
DB_ENGINE=auto

# MySQL credentials (if using MySQL or auto)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=chat_app
```

### 3. Start the Server
```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

### 4. Open in Browser
Visit **[http://localhost:5000](http://localhost:5000)** in your browser!
- Register User A (e.g. `mohan@test.com`)
- Open an Incognito window or another browser tab and register User B (e.g. `alex@test.com`)
- Start chatting in real-time!

---

## 📡 Socket.io Events Reference

### Client-to-Server
| Event | Payload | Description |
|---|---|---|
| `join_chat` | `{ chatId }` | Joins a chat room |
| `leave_chat` | `{ chatId }` | Leaves a chat room |
| `send_message` | `{ chatId, content }` | Sends a message into chat |
| `typing` | `{ chatId }` | Notifies others that user is typing |
| `stop_typing` | `{ chatId }` | Notifies typing stopped |
| `mark_as_read` | `{ chatId }` | Marks messages in chat as read |

### Server-to-Client
| Event | Payload | Description |
|---|---|---|
| `receive_message` | `Message object` | New message delivered to active chat |
| `new_message_notification` | `{ chatId, message }` | Direct alert to recipient for badge/preview |
| `user_typing` | `{ chatId, userId, userName }` | Someone is typing |
| `user_stop_typing` | `{ chatId, userId }` | Typing indicator cleared |
| `user_status_changed` | `{ userId, status }` | User went `'online'` or `'offline'` |
| `messages_read` | `{ chatId, readByUserId }` | Messages marked as read |

---

## 🔌 REST API Endpoints

### 🔑 Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Register new user account |
| `POST` | `/api/auth/login` | No | Login and obtain JWT token |
| `GET` | `/api/auth/me` | Bearer | Get current logged-in user profile |
| `POST` | `/api/auth/logout` | Bearer | Logout user and set status to offline |
| `POST` | `/api/auth/forgot-password` | No | Password recovery |

### 👥 Users (`/api/users`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | Bearer | Get all other registered users |
| `GET` | `/api/users/profile` | Bearer | Get profile of logged-in user |
| `GET` | `/api/users/search?q=name` | Bearer | Search users by name or email |
| `PUT` | `/api/users/status` | Bearer | Update user status (`online`, `away`, `offline`) |

### 💬 Chats (`/api/chats`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/chats` | Bearer | Get all active chats with latest message & unread count |
| `GET` | `/api/chats/:id` | Bearer | Get chat details (participant check enforced) |
| `POST` | `/api/chats/create` | Bearer | Find or create a 1-on-1 chat with `{ otherUserId }` |

### 📨 Messages (`/api/messages`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/messages/:chatId` | Bearer | Fetch message history for a chat (auto-marks as read) |
| `POST` | `/api/messages` | Bearer | Send message via REST `{ chatId, content }` |
| `PUT` | `/api/messages/:chatId/read` | Bearer | Explicitly mark messages as read |

---

## 🛠️ Project Structure

```text
Chat-App-Backend/
├── config/
│   └── database.js         # Resilient dual MySQL + SQLite database manager
├── middleware/
│   └── auth.js             # JWT authentication middleware
├── models/
│   ├── User.js             # User queries and bcrypt password hashing
│   ├── Chat.js             # 1-on-1 chat relationships and listings
│   └── Message.js          # Message storage and retrieval
├── routes/
│   ├── auth.js             # Register, Login, Me, Logout
│   ├── users.js            # User listings, search, and status
│   ├── chats.js            # Chat creation and management
│   └── messages.js         # Message queries and REST sending
├── socket/
│   └── chatSocket.js       # Real-time WebSockets event handling
├── public/
│   └── index.html          # Interactive Live Chat Test Client
├── utils/
│   └── helpers.js          # API and validation utilities
├── .env.example            # Example configuration
├── server.js               # Application entry point
└── package.json
```
