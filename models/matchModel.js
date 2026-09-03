/**
 * Match database operations.
 */

const db = require('../config/db');

const matchModel = {
  /**
   * Save a completed match.
   */
  create({ mode, teamSize, players, winnerTeam, durationSec, mmrDeltas }) {
    const result = db.prepare(`
      INSERT INTO matches (mode, team_size, players_json, winner_team, duration_sec, mmr_delta_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      mode,
      teamSize,
      JSON.stringify(players),
      winnerTeam,
      durationSec,
      JSON.stringify(mmrDeltas),
      Date.now()
    );
    const id = typeof result.lastInsertRowid === 'bigint'
      ? Number(result.lastInsertRowid)
      : result.lastInsertRowid;
    return id;
  },

  /**
   * Get a user's last N matches.
   */
  getMatchHistory(userId, limit = 20) {
    const rows = db.prepare(`
      SELECT id, mode, team_size, players_json, winner_team, duration_sec, mmr_delta_json, created_at
      FROM matches
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit * 2);  // Pull a few extra, then filter

    return rows.filter(row => {
      const players = JSON.parse(row.players_json);
      return players.some(p => p.userId === userId);
    }).slice(0, limit).map(row => {
      const players = JSON.parse(row.players_json);
      const mmrDeltas = JSON.parse(row.mmr_delta_json);
      const me = players.find(p => p.userId === userId);
      return {
        id: row.id,
        mode: row.mode,
        teamSize: row.team_size,
        winnerTeam: row.winner_team,
        myTeam: me ? me.team : null,
        myMmrDelta: mmrDeltas[userId] || 0,
        won: !!(me && row.winner_team === me.team),
        durationSec: row.duration_sec,
        createdAt: row.created_at
      };
    });
  },

  getById(matchId) {
    const row = db.prepare(`SELECT * FROM matches WHERE id = ?`).get(matchId);
    if (!row) return null;
    return {
      ...row,
      players: JSON.parse(row.players_json),
      mmrDeltas: JSON.parse(row.mmr_delta_json)
    };
  }
};

module.exports = matchModel;
