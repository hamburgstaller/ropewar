/**
 * Tug of War - Server Entry Point
 * Express + Socket.io + node:sqlite
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const logger = require('./utils/logger');
const migrate = require('./db/migrate');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const leaderboardRouter = require('./routes/leaderboard');
const matchRouter = require('./routes/match');
const registerGameHandlers = require('./sockets/gameHandlers');
const SqliteSessionStore = require('./utils/sqliteSessionStore');
const db = require('./config/db');

// === MIGRATION ===
migrate();

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

// === MIDDLEWARE ===
app.use(helmet({
  contentSecurityPolicy: false,  // Simple for dev; tighten in production
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false  // Required for socket.io polling
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// === SESSION (SQLite) ===
app.use(session({
  store: new SqliteSessionStore(db),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

// === ROUTES ===
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/match', matchRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// === STATIC FILES (frontend) ===
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === SOCKET.IO ===
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true
  }
});

// Run the session middleware on engine.io polling requests as well.
// Express middleware does not run for /socket.io/* by default; this makes
// req.session available during the socket handshake.
io.engine.use(session({
  store: new SqliteSessionStore(db),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

// Pass the io reference to the match router (avoids circular dependency)
matchRouter.setIo(io);

// Socket auth middleware
io.use((socket, next) => {
  const sess = socket.request.session;
  if (!sess || !sess.userId) {
    logger.warn('Socket auth failed', {
      hasSession: !!sess,
      hasUserId: !!(sess && sess.userId),
      cookie: socket.request.headers.cookie ? 'present' : 'missing',
      origin: socket.request.headers.origin
    });
    return next(new Error('Unauthorized'));
  }
  socket.data.userId = sess.userId;
  socket.data.username = sess.username;
  next();
});

io.on('connection', (socket) => {
  logger.info('Socket connected', { userId: socket.data.userId, socketId: socket.id });
  registerGameHandlers(io, socket);
  socket.on('disconnect', (reason) => {
    logger.info('Socket disconnected', { userId: socket.data.userId, reason });
  });
});

// === ERROR HANDLER ===
app.use(require('./middleware/errorHandler'));

// === START ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 Server ready: http://localhost:${PORT}`);
  logger.info(`📦 Mode: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };
