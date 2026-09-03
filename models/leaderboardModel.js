/**
 * Leaderboard queries.
 * Uses the node:sqlite API.
 */

const db = require('../config/db');
const cfg = require('../config/gameConfig');

let cache = { ts: 0, data: null, key: null };
const CACHE_MS = cfg.LEADERBOARD_CACHE_MS;

const leaderboardModel = {
  getTopPlayers(mode = 'overall', limit = cfg.LEADERBOARD_DEFAULT_LIMIT) {
    limit = Math.min(limit, cfg.LEADERBOARD_MAX_LIMIT);
    const cacheKey = `${mode}:${limit}`;
    if (cache.key === cacheKey && Date.now() - cache.ts < CACHE_MS) {
      return cache.data;
    }

    let rows;
    if (mode === 'overall') {
      rows = db.prepare(`
        SELECT id, username, mmr, rank_tier, wins, losses, games_played
        FROM users
        WHERE games_played > 0
        ORDER BY mmr DESC, wins DESC
        LIMIT ?
      `).all(limit);
    } else {
      if (!cfg.MODES[mode]) return [];
      // Mode-specific: filter players who have played in this mode
      rows = db.prepare(`
        SELECT DISTINCT u.id, u.username, u.mmr, u.rank_tier, u.wins, u.losses, u.games_played
        FROM users u
        INNER JOIN matches m ON m.players_json LIKE '%' || u.id || '%'
        WHERE m.mode = ? AND u.games_played > 0
        ORDER BY u.mmr DESC, u.wins DESC
        LIMIT ?
      `).all(mode, limit);
    }

    const result = rows.map((row, idx) => ({
      rank: idx + 1,
      id: row.id,
      username: row.username,
      mmr: row.mmr,
      tier: row.rank_tier,
      wins: row.wins,
      losses: row.losses,
      gamesPlayed: row.games_played,
      winRate: row.games_played > 0
        ? Math.round((row.wins / row.games_played) * 100)
        : 0
    }));

    cache = { ts: Date.now(), data: result, key: cacheKey };
    return result;
  },

  invalidate() {
    cache = { ts: 0, data: null, key: null };
  }
};

module.exports = leaderboardModel;
