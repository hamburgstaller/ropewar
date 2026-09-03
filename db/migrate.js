/**
 * Database migration.
 * Runs automatically at server.js startup.
 * Can also be run standalone: `npm run migrate`
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const logger = require('../utils/logger');

function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    db.exec(schema);
    logger.info('Database migration successful', { path: process.env.DB_PATH });
  } catch (err) {
    logger.error('Migration error', { error: err.message });
    throw err;
  }
}

// Standalone execution
if (require.main === module) {
  migrate();
  process.exit(0);
}

module.exports = migrate;
