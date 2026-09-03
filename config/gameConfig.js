/**
 * All game constants live here.
 * Single source of truth for balance tuning.
 */

module.exports = {
  // === ROPE / GAMEPLAY ===
  ROPE_MAX: 50,                 // Half-length of the rope (total 100 units)
  CLICK_UNIT: 3.0,              // Rope movement per click-difference per second
  TICK_MS: 1000,                // Tick interval (ms)
  COUNTDOWN_SEC: 3,             // Pre-match countdown
  MATCH_MAX_SEC: 60,            // Maximum match duration (1 minute)
  MAX_CLICKS_PER_SEC: 30,       // Anti-cheat: per-player clicks-per-second cap
  DISCONNECT_GRACE_MS: 15000,   // Time given to a disconnected player to return
  BOT_FILLER_DELAY_MS: 3000,    // Delay before filling the queue with bots (3s)

  // === MODES ===
  MODES: {
    '1v1': { teamSize: 1, totalPlayers: 2 },
    '3v3': { teamSize: 3, totalPlayers: 6 },
    '5v5': { teamSize: 5, totalPlayers: 10 }
  },
  VALID_MODES: ['1v1', '3v3', '5v5'],

  // === MMR / RANK ===
  MMR_START: 1000,
  MMR_K_FACTOR: 32,             // For MMR < 1800
  MMR_K_HIGH: 16,               // For MMR >= 1800
  MMR_HIGH_THRESHOLD: 1800,
  MMR_FLOOR: 0,                 // MMR never drops below this

  TIERS: [
    { name: 'Bronze',   min: 0,    max: 1199, color: '#CD7F32' },
    { name: 'Silver',   min: 1200, max: 1399, color: '#C0C0C0' },
    { name: 'Gold',     min: 1400, max: 1599, color: '#FFD700' },
    { name: 'Platinum', min: 1600, max: 1799, color: '#00CED1' },
    { name: 'Diamond',  min: 1800, max: 9999, color: '#B9F2FF' }
  ],

  // === BOT AI ===
  BOT_DIFFICULTY: {
    easy:   { meanCps: 4,  jitter: 1.5, misfireRate: 0.05 },
    normal: { meanCps: 7,  jitter: 2.0, misfireRate: 0.02 },
    hard:   { meanCps: 10, jitter: 2.5, misfireRate: 0.01 }
  },
  BOT_DEFAULT_DIFFICULTY: 'normal',

  // === LEADERBOARD ===
  LEADERBOARD_DEFAULT_LIMIT: 100,
  LEADERBOARD_MAX_LIMIT: 500,
  LEADERBOARD_CACHE_MS: 30000
};
