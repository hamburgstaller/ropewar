/**
 * Auth routes: register, login, logout, me
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const userModel = require('../models/userModel');
const requireAuth = require('../middleware/requireAuth');
const logger = require('../utils/logger');

const router = express.Router();

// Brute-force protection for login and register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,    // 15 minutes
  max: 30,                      // 30 requests per IP
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const result = await authService.register({ email, username, password });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    // Explicitly save the session
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error (register)', { error: err.message });
        return next(err);
      }
      res.json({ user: result.user });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await authService.login({ email, password });
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }
    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    // Explicitly save the session
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error (login)', { error: err.message });
        return next(err);
      }
      res.json({ user: result.user });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = userModel.findById(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

module.exports = router;
