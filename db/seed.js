/**
 * Test data seeder.
 * Inserts a few test users across different ranks.
 * Usage: `npm run seed`
 */

const bcrypt = require('bcryptjs');
const db = require('../config/db');
const logger = require('../utils/logger');

async function seed() {
  const BCRYPT_ROUNDS = 10;
  const passwordHash = await bcrypt.hash('password123', BCRYPT_ROUNDS);

  const testUsers = [
    { email: 'test1@example.com', username: 'tester1' },
    { email: 'test2@example.com', username: 'tester2' },
    { email: 'test3@example.com', username: 'tester3' },
    { email: 'test4@example.com', username: 'tester4' }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (email, username, password_hash, mmr, rank_tier, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const baseMmr = 1000;
  for (let i = 0; i < testUsers.length; i++) {
    const u = testUsers[i];
    const mmr = baseMmr + (i - 2) * 200;  // 600, 800, 1000, 1200
    const tier = mmr < 1200 ? 'Bronze'
              : mmr < 1400 ? 'Silver'
              : mmr < 1600 ? 'Gold'
              : mmr < 1800 ? 'Platinum' : 'Diamond';
    stmt.run(u.email, u.username, passwordHash, mmr, tier, Date.now());
  }

  const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
  logger.info(`Seed complete. Total users: ${count.c}`);
  logger.info('Test accounts: test1@example.com ... test4@example.com (password: password123)');
  process.exit(0);
}

seed().catch(err => {
  logger.error('Seed error', { error: err.message });
  process.exit(1);
});
