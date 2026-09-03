/**
 * node:sqlite (Node 24+ built-in) connection (singleton).
 * No build step required, pure native.
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './db/halat.db';

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// PRAGMAs
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Transaction helper. Runs the callback inside a transaction.
 * If the callback throws, ROLLBACK; otherwise COMMIT.
 */
db.transaction = function(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
      throw err;
    }
  };
};

module.exports = db;
