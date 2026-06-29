const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const PORT = process.env.PORT || 5500;

const cors = require("cors");

app.use(cors({
  origin: "https://your-netlify-site.netlify.app"
}));

// Store active socket connections
const userSockets = {}; // userId -> socket.id
const adminSockets = {}; // userId -> set of admin socket ids

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname)));
app.use('/admin', express.static(path.join(__dirname)));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Auth page
app.get('/auth', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend/auth.html'));
});

// Catch-all for auth.html static file
app.get('/auth.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend/auth.html'));
});

// Admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.resolve(__dirname, './admin.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, './admin.html'));
});

// Database
const db = new sqlite3.Database('./chatbot.db', (err) => {
    if (err) {
        console.error('DB Error:', err);
    } else {
        console.log('Connected to DB');
        initializeDatabase();
    }
});

// ================= DATABASE =================

function initializeDatabase() {

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT,
            is_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, () => {
        // Check if admin user exists, create if not
        db.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1', (err, row) => {
            if (err) {
                console.error('Error checking admin user:', err);
            } else if (row && row.count === 0) {
                const adminPassword = hashPassword('admin123');
                db.run(
                    'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
                    ['admin', 'admin@chatbot.com', adminPassword, 1],
                    (err) => {
                        if (err) {
                            console.error('Error creating admin user:', err);
                        } else {
                            console.log('Admin user created (username: admin, password: admin123)');
                        }
                    }
                );
            }
        });
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS faqs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT,
            answer TEXT,
            category TEXT,
            keywords TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            user_message TEXT,
            bot_response TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS escalations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT UNIQUE,
            user_id INTEGER NOT NULL,
            username TEXT,
            initial_question TEXT,
            status TEXT DEFAULT 'pending',
            assigned_admin_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS escalation_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            escalation_id INTEGER NOT NULL,
            sender_type TEXT DEFAULT 'user',
            sender_id INTEGER,
            message_text TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (escalation_id) REFERENCES escalations(id)
        )
    `);
}

// ================= HELPERS =================

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, hash) {
    return hashPassword(password) === hash;
}

// ================= REGISTER =================

app.post('/api/register', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({ error: 'All fields required' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    const passwordHash = hashPassword(password);

    db.run(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [username, email, passwordHash],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'User registered', userId: this.lastID });
        }
    );
});

// ================= LOGIN =================

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    db.get(
        'SELECT id, username, email, password_hash, is_admin FROM users WHERE username = ?',
        [username],
        (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Login failed' });
            } else if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            } else if (!verifyPassword(password, user.password_hash)) {
                return res.status(401).json({ error: 'Invalid credentials' });
            } else {
                res.json({
                    message: 'Login successful',
                    userId: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.is_admin
                });
            }
        }
    );
});

// ================= ADMIN =================

app.get('/api/admin/users', (req, res) => {
    db.all(
        `SELECT u.id, u.username, u.email, u.created_at, COUNT(ch.id) as message_count
         FROM users u
         LEFT JOIN chat_history ch ON u.id = ch.user_id
         WHERE u.is_admin = 0
         GROUP BY u.id
         ORDER BY u.created_at DESC`,
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }
            res.json({ users: rows || [] });
        }
    );
});

app.get('/api/admin/user-chat/:userId', (req, res) => {
    const { userId } = req.params;
    
    db.all(
        `SELECT ch.id, u.username, ch.user_message, ch.bot_response, ch.timestamp
         FROM chat_history ch
         JOIN users u ON ch.user_id = u.id
         WHERE ch.user_id = ?
         ORDER BY ch.timestamp DESC`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch user chat' });
            }
            res.json({ chatHistory: rows || [] });
        }
    );
});

// ================= CHAT =================

app.post('/api/chat', (req, res) => {
    const { message, userId } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    const lowerMessage = message.toLowerCase();

    db.get(
        `SELECT answer, category FROM faqs 
         WHERE LOWER(question) LIKE ? OR LOWER(category) LIKE ?`,
        [`%${lowerMessage}%`, `%${lowerMessage}%`],
        (err, row) => {

            let botResponse;
            let category = null;
            let isHardQuestion = false;

            if (err) {
                console.error(err);
                botResponse = 'Error occurred';
            } else if (row) {
                botResponse = row.answer;
                category = row.category;
            } else {
                isHardQuestion = true;
                botResponse = 'I couldn\'t find an answer to that. Would you like to chat with a human agent?';
            }

            db.run(
                'INSERT INTO chat_history (user_id, user_message, bot_response) VALUES (?, ?, ?)',
                [userId ? parseInt(userId) : 1, message, botResponse],
                function(err) {
                    if (err) console.error('Chat storage error:', err);
                    else console.log('Chat stored for user:', userId);
                }
            );

            res.json({ response: botResponse, category, isHardQuestion });
        }
    );
});

// ================= CHAT HISTORY =================

// FIXED: correct table name
app.get('/api/chat-history', (req, res) => {
    db.all(
        'SELECT user_message, bot_response FROM chat_history ORDER BY id ASC',
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ history: rows });
        }
    );
});

// USER history
app.get('/api/chat-history/:userId', (req, res) => {
    const { userId } = req.params;

    db.all(
        'SELECT user_message, bot_response FROM chat_history WHERE user_id = ?',
        [userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ history: rows });
        }
    );
});

// CLEAR history
app.delete('/api/chat-history', (req, res) => {
    db.run('DELETE FROM chat_history', (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Chat history cleared' });
    });
});

// CLEAR user-specific history
app.delete('/api/chat-history/:userId', (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    db.run('DELETE FROM chat_history WHERE user_id = ?', [userId], function(err) {
        if (err) {
            console.error('Error deleting chat history:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'User chat history cleared', deleted: this.changes });
    });
});

// ================= FAQ =================

// GET all FAQs
app.get('/api/faqs', (req, res) => {
    db.all(
        'SELECT id, question, answer, category FROM faqs',
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ faqs: rows || [] });
        }
    );
});

// FIXED: removed undefined "keywords"
app.post('/api/faqs', (req, res) => {
    const { question, answer, category } = req.body;

    db.run(
        'INSERT INTO faqs (question, answer, category, keywords) VALUES (?, ?, ?, ?)',
        [question, answer, category, ""],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'FAQ added', id: this.lastID });
        }
    );
});

app.put('/api/faqs/:id', (req, res) => {
    const { id } = req.params;
    const { question, answer, category } = req.body;

    db.run(
        'UPDATE faqs SET question=?, answer=?, category=? WHERE id=?',
        [question, answer, category, id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Updated' });
        }
    );
});

app.delete('/api/faqs/:id', (req, res) => {
    db.run('DELETE FROM faqs WHERE id=?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Deleted' });
    });
});

// ================= ESCALATIONS =================

// Generate unique ticket ID
function generateTicketId() {
    return 'TKT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Create escalation ticket
app.post('/api/escalations', (req, res) => {
    const { userId, username, initialQuestion } = req.body;

    if (!userId || !username || !initialQuestion) {
        return res.status(400).json({ error: 'userId, username, and initialQuestion required' });
    }

    const ticketId = generateTicketId();

    db.run(
        'INSERT INTO escalations (ticket_id, user_id, username, initial_question, status) VALUES (?, ?, ?, ?, ?)',
        [ticketId, userId, username, initialQuestion, 'pending'],
        function(err) {
            if (err) {
                console.error('Escalation creation error:', err);
                return res.status(500).json({ error: 'Failed to create escalation' });
            }
            res.json({ message: 'Escalation created', ticketId, escalationId: this.lastID });
        }
    );
});

// Get all escalations (for admin)
app.get('/api/escalations', (req, res) => {
    db.all(
        `SELECT * FROM escalations ORDER BY created_at DESC`,
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch escalations' });
            }
            res.json({ escalations: rows || [] });
        }
    );
});

// Get escalation details with messages
app.get('/api/escalations/:escalationId', (req, res) => {
    const { escalationId } = req.params;

    db.get(
        'SELECT * FROM escalations WHERE id = ?',
        [escalationId],
        (err, escalation) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch escalation' });
            }
            if (!escalation) {
                return res.status(404).json({ error: 'Escalation not found' });
            }

            db.all(
                'SELECT * FROM escalation_messages WHERE escalation_id = ? ORDER BY timestamp ASC',
                [escalationId],
                (err, messages) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to fetch messages' });
                    }
                    res.json({ escalation, messages: messages || [] });
                }
            );
        }
    );
});

// Send message in escalation
app.post('/api/escalations/:escalationId/messages', (req, res) => {
    const { escalationId } = req.params;
    const { senderId, senderType, messageText } = req.body;

    if (!senderId || !senderType || !messageText) {
        return res.status(400).json({ error: 'senderId, senderType, and messageText required' });
    }

    db.run(
        'INSERT INTO escalation_messages (escalation_id, sender_id, sender_type, message_text) VALUES (?, ?, ?, ?)',
        [escalationId, senderId, senderType, messageText],
        function(err) {
            if (err) {
                console.error('Error sending escalation message:', err);
                return res.status(500).json({ error: 'Failed to send message' });
            }
            res.json({ message: 'Message sent', messageId: this.lastID });
        }
    );
});

// Update escalation status and assign to admin
app.put('/api/escalations/:escalationId', (req, res) => {
    const { escalationId } = req.params;
    const { status, assignedAdminId } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'status required' });
    }

    db.run(
        'UPDATE escalations SET status = ?, assigned_admin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, assignedAdminId || null, escalationId],
        (err) => {
            if (err) {
                console.error('Error updating escalation:', err);
                return res.status(500).json({ error: 'Failed to update escalation' });
            }
            res.json({ message: 'Escalation updated' });
        }
    );
});

// Get escalation for user
app.get('/api/user-escalation/:userId', (req, res) => {
    const { userId } = req.params;

    db.get(
        'SELECT * FROM escalations WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId],
        (err, escalation) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch escalation' });
            }
            res.json({ escalation });
        }
    );
});

// ================= SERVER & WEBSOCKET =================

// WebSocket connection handler
io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // User joins their channel
    socket.on('user-join', (userId) => {
        userSockets[userId] = socket.id;
        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined with socket ${socket.id}`);
    });

    // Admin joins to listen to escalations
    socket.on('admin-join', (adminId) => {
        socket.join('admin-room');
        if (!adminSockets[adminId]) {
            adminSockets[adminId] = new Set();
        }
        adminSockets[adminId].add(socket.id);
        console.log(`Admin ${adminId} joined with socket ${socket.id}`);
        
        // Send all escalations to admin
        db.all(
            'SELECT * FROM escalations WHERE status = ? ORDER BY created_at DESC',
            ['pending'],
            (err, escalations) => {
                if (!err) {
                    socket.emit('escalations-update', escalations || []);
                }
            }
        );
    });

    // Handle escalation message from user or admin
    socket.on('escalation-message', (data) => {
        const { escalationId, userId, adminId, senderType, messageText } = data;
        const senderId = senderType === 'user' ? userId : adminId;

        // Save message to DB
        db.run(
            'INSERT INTO escalation_messages (escalation_id, sender_id, sender_type, message_text) VALUES (?, ?, ?, ?)',
            [escalationId, senderId, senderType, messageText],
            function(err) {
                if (err) {
                    console.error('Error saving escalation message:', err);
                    socket.emit('error', 'Failed to send message');
                } else {
                    // Broadcast message to both user and admin
                    io.to(`user-${userId}`).emit('escalation-message', {
                        messageId: this.lastID,
                        escalationId,
                        senderType,
                        senderId,
                        messageText,
                        timestamp: new Date().toISOString()
                    });

                    // Also send to all admins listening
                    io.to('admin-room').emit('escalation-message', {
                        messageId: this.lastID,
                        escalationId,
                        senderType,
                        senderId,
                        messageText,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        );
    });

    // Handle escalation status update
    socket.on('escalation-status-update', (data) => {
        const { escalationId, status, assignedAdminId } = data;

        db.run(
            'UPDATE escalations SET status = ?, assigned_admin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, assignedAdminId || null, escalationId],
            (err) => {
                if (err) {
                    console.error('Error updating escalation:', err);
                    socket.emit('error', 'Failed to update escalation');
                } else {
                    // Notify all admins and relevant user
                    io.to('admin-room').emit('escalation-status-changed', {
                        escalationId,
                        status,
                        assignedAdminId
                    });
                }
            }
        );
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        // Remove user from userSockets
        for (let userId in userSockets) {
            if (userSockets[userId] === socket.id) {
                delete userSockets[userId];
            }
        }
        // Remove admin from adminSockets
        for (let adminId in adminSockets) {
            adminSockets[adminId].delete(socket.id);
            if (adminSockets[adminId].size === 0) {
                delete adminSockets[adminId];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Close DB
process.on('SIGINT', () => {
    db.close();
    process.exit();
});