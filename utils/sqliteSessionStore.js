/**
 * Simple SQLite-backed session store.
 * Implements the interface required by express-session.
 * Uses node:sqlite.
 */

const session = require('express-session');
const db = require('../config/db');

class SqliteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.db = database;
    this._init();
  }

  _init() {
    // The table is already created by the migration. Just set up cleanup.
    this._cleanupInterval = setInterval(() => {
      try {
        this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
      } catch (e) {
        // ignore
      }
    }, 15 * 60 * 1000);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  get(sid, callback) {
    try {
      if (!sid) return callback();
      const row = this.db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?').get(sid);
      if (!row) return callback();
      if (row.expires_at < Date.now()) {
        this.destroy(sid, () => callback());
        return;
      }
      callback(null, JSON.parse(row.data));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const expiresAt = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + (30 * 24 * 60 * 60 * 1000);

      this.db.prepare(`
        INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
      `).run(sid, JSON.stringify(sessionData), expiresAt);

      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }

  destroy(sid, callback) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    try {
      const expiresAt = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + (30 * 24 * 60 * 60 * 1000);

      this.db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?').run(expiresAt, sid);
      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

module.exports = SqliteSessionStore;
