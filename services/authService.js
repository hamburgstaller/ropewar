/**
 * Authentication service.
 * Password hash/verify with bcrypt.
 */

const bcrypt = require('bcryptjs');
const { z } = require('zod');
const userModel = require('../models/userModel');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = 10;

const registerSchema = z.object({
  email: z.string().email('Invalid email').max(120),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(24, 'Username must be at most 24 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128)
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required')
});

const authService = {
  /**
   * Register a new user.
   * @returns {Promise<{user: object} | {error: string}>}
   */
  async register({ email, username, password }) {
    const parsed = registerSchema.safeParse({ email, username, password });
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = userModel.create({ email, username, passwordHash });
    if (!user) {
      return { error: 'This email or username is already taken' };
    }
    logger.info('New user registered', { userId: user.id, username });
    return { user };
  },

  /**
   * Login.
   * @returns {Promise<{user: object} | {error: string}>}
   */
  async login({ email, password }) {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const user = userModel.findByEmail(email);
    if (!user) {
      return { error: 'Invalid email or password' };
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return { error: 'Invalid email or password' };
    }

    // Strip password_hash from user object
    const { password_hash, ...safeUser } = user;
    return { user: safeUser };
  }
};

module.exports = authService;
