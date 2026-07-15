const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const dotenv = require('dotenv');
const { generalLimiter } = require('./middleware/rateLimiter');

// Load environment variables
dotenv.config();

// Connect Database
const connectDB = require('./config/db');
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.IO configuration
// In production, restrict origin to FRONTEND_URL from .env
// In development (no env set), fall back to '*' for convenience
const allowedOrigin = process.env.FRONTEND_URL || '*';
const io = socketio(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
  },
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Configure Helmet with CSP relaxed enough for Google APIs, ZXing CDNs, and Dicebear avatars
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", 'https:', 'http:', 'data:', 'blob:', "'unsafe-inline'", "'unsafe-eval'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        connectSrc: ["'self'", 'https:', 'http:', 'ws:', 'wss:'],
      },
    },
  })
);

// Prevent MongoDB Injection
app.use(mongoSanitize());

// Serve Static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Apply global rate limiter to all API routes (200 req / 15 min per IP)
app.use('/api', generalLimiter);

// Mount Backend API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

// Redirect all unhandled GET requests to index.html (supports SPA routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Socket.IO Realtime Connection Logic
// Socket.IO Realtime Connection Logic
const getRoomId = (uid1, uid2) => {
  return [uid1.toString(), uid2.toString()].sort().join('_');
};

io.on('connection', (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  // User joins with their user ID
  socket.on('join_user', (userId) => {
    if (userId) {
      const uid = userId.toString();
      socket.join(uid);
      socket.data.userId = uid;
      console.log(`User ${uid} registered online with socket ${socket.id}`);
      io.emit('user_status_change', { userId: uid, status: 'online' });
    }
  });

  // User joins a room with a specific recipient
  socket.on('join_room', ({ userId, recipientId }) => {
    const room = getRoomId(userId, recipientId);
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  // User sends a chat message
  socket.on('send_msg', async ({ senderId, recipientId, text, imageUrl }) => {
    const room = getRoomId(senderId, recipientId);
    
    try {
      const Message = require('./models/Message');
      
      // Save Message to DB
      const newMsg = await Message.create({
        sender: senderId,
        receiver: recipientId,
        text,
        imageUrl,
        room,
        isRead: false,
      });

      const populatedMsg = await newMsg.populate('sender', 'name avatar');

      // Emit message inside the private room
      io.to(room).emit('receive_msg', populatedMsg);

      // Push real-time notification/badge alerts if the recipient is online
      // io.to(roomId) natively broadcasts to all tabs/sockets joined to that room
      const recipientIdStr = recipientId.toString();
      io.to(recipientIdStr).emit('msg_badge_update', { senderId });
      
      io.to(recipientIdStr).emit('push_notification', {
        type: 'MESSAGE',
        title: `New message from ${populatedMsg.sender.name}`,
        message: text || 'Sent an image attachment',
        relatedLink: `/chat.html?recipient=${senderId}`,
      });

      // Automatically create a persistent notification in the DB as well
      // We are commenting this out because chat messages are now separate from system notifications
      /*
      const Notification = require('./models/Notification');
      await Notification.create({
        user: recipientId,
        type: 'MESSAGE',
        title: 'New Chat Message',
        message: text ? `${populatedMsg.sender.name}: "${text.substring(0, 30)}..."` : `${populatedMsg.sender.name} sent an image.`,
        relatedLink: `/chat.html?recipient=${senderId}`,
      });
      */

    } catch (err) {
      console.error('Socket message save error:', err.message);
    }
  });

  // Typing Indicators
  socket.on('typing', ({ senderId, recipientId, isTyping }) => {
    const room = getRoomId(senderId, recipientId);
    socket.to(room).emit('typing_status', { senderId, isTyping });
  });

  // Handle manual disconnect
  socket.on('disconnect', async () => {
    console.log(`Socket Disconnected: ${socket.id}`);
    
    // Find and clean user status
    const uid = socket.data.userId;
    if (uid) {
      // Check if user still has other connected tabs/sockets
      const sockets = await io.in(uid).fetchSockets();
      if (sockets.length === 0) {
        console.log(`User ${uid} logged off.`);
        io.emit('user_status_change', { userId: uid, status: 'offline' });
      }
    }
  });
});

// Run server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`VeriBook server running on port ${PORT}`);
});
