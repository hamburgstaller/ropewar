/**
 * MMR (Elo) calculations.
 * In team play, each player gets a delta based on the team average vs.
 * the opponent team average.
 */

const cfg = require('../config/gameConfig');
const ranking = require('./rankingService');

/**
 * Calculate the team average MMR (bots count as MMR_START).
 */
function teamAvgMmr(team, userMmrMap) {
  const mmrs = team.map(p => {
    if (p.isBot) return cfg.MMR_START;
    return userMmrMap[p.userId] ?? cfg.MMR_START;
  });
  return mmrs.reduce((a, b) => a + b, 0) / mmrs.length;
}

/**
 * Expected score (Elo formula).
 */
function expected(myMmr, oppMmr) {
  return 1 / (1 + Math.pow(10, (oppMmr - myMmr) / 400));
}

/**
 * K factor: lower for higher MMR (more stable ratings for veterans).
 */
function kFactor(mmr) {
  return mmr >= cfg.MMR_HIGH_THRESHOLD ? cfg.MMR_K_HIGH : cfg.MMR_K_FACTOR;
}

/**
 * Apply a match result and compute new MMR / tier for each user.
 * @returns {Array<{userId, mmrBefore, mmrAfter, mmrDelta, rankBefore, rankAfter}>}
 */
function applyMatchResult({ teamA, teamB, winnerTeam, userMmrMap }) {
  const avgA = teamAvgMmr(teamA, userMmrMap);
  const avgB = teamAvgMmr(teamB, userMmrMap);
  const isDraw = winnerTeam !== 'A' && winnerTeam !== 'B';
  const results = [];

  // actualScore: 1 for the winner, 0 for the loser, 0.5 for a draw
  const scoreA = winnerTeam === 'A' ? 1 : (isDraw ? 0.5 : 0);
  const scoreB = winnerTeam === 'B' ? 1 : (isDraw ? 0.5 : 0);
  const wonA = winnerTeam === 'A';
  const wonB = winnerTeam === 'B';

  const processTeam = (team, isWinner, actualScore, myAvg, oppAvg) => {
    for (const p of team) {
      if (p.isBot) continue;  // Bots are not ranked
      const mmrBefore = userMmrMap[p.userId];
      const exp = expected(myAvg, oppAvg);
      const k = kFactor(mmrBefore);
      const delta = Math.round(k * (actualScore - exp));
      let mmrAfter = mmrBefore + delta;
      if (mmrAfter < cfg.MMR_FLOOR) mmrAfter = cfg.MMR_FLOOR;

      const rankBefore = ranking.tierFor(mmrBefore);
      const rankAfter = ranking.tierFor(mmrAfter);

      results.push({
        userId: p.userId,
        mmrBefore,
        mmrAfter,
        mmrDelta: delta,
        rankBefore,
        rankAfter,
        won: isWinner
      });
    }
  };

  processTeam(teamA, wonA, scoreA, avgA, avgB);
  processTeam(teamB, wonB, scoreB, avgB, avgA);

  return results;
}

module.exports = { applyMatchResult, teamAvgMmr, expected, kFactor };
