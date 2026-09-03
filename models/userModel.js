/**
 * User database operations.
 * Uses the node:sqlite API.
 */

const db = require('../config/db');

function rowToUser(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return rest;
}

const userModel = {
  /**
   * Create a new user.
   * @returns {object|null}
   */
  create({ email, username, passwordHash }) {
    try {
      const result = db.prepare(`
        INSERT INTO users (email, username, password_hash, created_at)
        VALUES (?, ?, ?, ?)
      `).run(email, username, passwordHash, Date.now());
      // node:sqlite: lastInsertRowid is a BigInt
      const id = typeof result.lastInsertRowid === 'bigint'
        ? Number(result.lastInsertRowid)
        : result.lastInsertRowid;
      return this.findById(id);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE')) return null;
      throw err;
    }
  },

  findById(id) {
    const row = db.prepare(`
      SELECT id, email, username, mmr, rank_tier, wins, losses, games_played, created_at
      FROM users WHERE id = ?
    `).get(id);
    return rowToUser(row);
  },

  findByIdWithHash(id) {
    return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) || null;
  },

  findByEmail(email) {
    return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) || null;
  },

  findByUsername(username) {
    const row = db.prepare(`
      SELECT id, email, username, mmr, rank_tier, wins, losses, games_played, created_at
      FROM users WHERE username = ?
    `).get(username);
    return rowToUser(row);
  },

  /**
   * Apply match result. Must be called inside a transaction.
   * @param {object} tx - the transaction handle
   */
  applyMatchResult(tx, { userId, mmrDelta, won, newTier, newMmr }) {
    tx.prepare(`
      UPDATE users
      SET mmr = ?,
          rank_tier = ?,
          wins = wins + ?,
          losses = losses + ?,
          games_played = games_played + 1
      WHERE id = ?
    `).run(newMmr, newTier, won ? 1 : 0, won ? 0 : 1, userId);
  },

  findByIds(ids) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`
      SELECT id, username, mmr, rank_tier FROM users WHERE id IN (${placeholders})
    `).all(...ids);
  },

  searchByUsername(query, limit = 10) {
    return db.prepare(`
      SELECT id, username, mmr, rank_tier
      FROM users
      WHERE username LIKE ?
      ORDER BY mmr DESC
      LIMIT ?
    `).all(`${query}%`, limit);
  }
};

module.exports = userModel;
