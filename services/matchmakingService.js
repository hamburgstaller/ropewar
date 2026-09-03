/**
 * Matchmaking service.
 * One FIFO queue per mode.
 * Starts a match when enough players are queued; fills with bots otherwise.
 */

const cfg = require('../config/gameConfig');
const logger = require('../utils/logger');
const gameService = require('./gameService');
const botService = require('./botService');

const queues = {
  '1v1': [],
  '3v3': [],
  '5v5': []
};

// Periodic queue check timers
const queueTimers = {
  '1v1': null,
  '3v3': null,
  '5v5': null
};

const matchmakingService = {
  /**
   * Add a player to the queue.
   * @returns {object} { position, mode }
   */
  joinQueue(userId, username, socketId, mode, io) {
    if (!cfg.VALID_MODES.includes(mode)) {
      throw new Error('Invalid mode');
    }
    const queue = queues[mode];
    const config = cfg.MODES[mode];
    const totalNeeded = config.totalPlayers;

    // Check if already in queue
    const existing = queue.find(p => p.userId === userId);
    if (existing) {
      return { position: queue.indexOf(existing) + 1, mode, totalNeeded };
    }

    const player = { userId, username, socketId, io, joinedAt: Date.now() };
    queue.push(player);

    logger.info('Joined queue', { userId, mode, queueSize: queue.length });

    // Try to match immediately
    this._tryMatch(mode, io);

    // If enough players, no timer needed
    if (queue.length >= totalNeeded) {
      return { position: queue.length, mode, totalNeeded };
    }

    // Otherwise schedule bot-fill timer (guaranteed match start)
    if (queueTimers[mode]) {
      clearTimeout(queueTimers[mode]);
    }
    queueTimers[mode] = setTimeout(() => {
      queueTimers[mode] = null;
      this._fillWithBots(mode, io);
    }, cfg.BOT_FILLER_DELAY_MS);

    logger.info('Bot filler timer scheduled', { mode, delayMs: cfg.BOT_FILLER_DELAY_MS });

    return { position: queue.length, mode, totalNeeded };
  },

  leaveQueue(userId) {
    for (const mode of cfg.VALID_MODES) {
      const queue = queues[mode];
      const idx = queue.findIndex(p => p.userId === userId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        logger.info('Left queue', { userId, mode });
        return true;
      }
    }
    return false;
  },

  /**
   * Check the queue; start a match if enough players.
   * Silently exits otherwise (bot filler is scheduled from joinQueue).
   */
  _tryMatch(mode, io) {
    const queue = queues[mode];
    const config = cfg.MODES[mode];
    const totalNeeded = config.totalPlayers;
    const teamSize = config.teamSize;

    if (queue.length < totalNeeded) {
      return;  // Not enough, bot filler already scheduled
    }

    // Enough players
    const teamAPlayers = queue.splice(0, teamSize);
    const teamBPlayers = queue.splice(0, teamSize);

    // Cancel pending timer
    if (queueTimers[mode]) {
      clearTimeout(queueTimers[mode]);
      queueTimers[mode] = null;
    }

    // Assign team to each player
    const teamA = teamAPlayers.map(p => ({ ...p, team: 'A' }));
    const teamB = teamBPlayers.map(p => ({ ...p, team: 'B' }));

    const match = gameService.createMatch({ mode, teamA, teamB, io });

    // Notify each player
    const allPlayers = [...teamA, ...teamB];
    for (const p of allPlayers) {
      io.to(p.socketId).emit('server:match_found', {
        matchId: match.id,
        mode,
        teamA: teamA.map(pl => ({ userId: pl.userId, username: pl.username, isBot: false })),
        teamB: teamB.map(pl => ({ userId: pl.userId, username: pl.username, isBot: false })),
        youAreTeam: p.team
      });
    }

    logger.info('Match found', { matchId: match.id, mode, players: allPlayers.length });
  },

  /**
   * Fill remaining slots with bots and start the match.
   */
  _fillWithBots(mode, io) {
    const queue = queues[mode];
    const config = cfg.MODES[mode];
    const totalNeeded = config.totalPlayers;
    const teamSize = config.teamSize;

    if (queue.length === 0) return;
    if (queue.length >= totalNeeded) {
      this._tryMatch(mode, io);
      return;
    }

    // Take the queued players
    const humans = queue.splice(0, Math.min(queue.length, totalNeeded));
    const humanCount = humans.length;
    const botCount = totalNeeded - humanCount;

    // Distribute players across teams (simple: alternate A, B, A, B...)
    const teamA = [];
    const teamB = [];

    for (let i = 0; i < humans.length; i++) {
      const player = { ...humans[i], team: i % 2 === 0 ? 'A' : 'B' };
      if (player.team === 'A') teamA.push(player);
      else teamB.push(player);
    }

    // Fill with bots
    let botA = teamSize - teamA.length;
    let botB = teamSize - teamB.length;

    if (botA > 0) {
      const bots = botService.createTeam(botA, 'A');
      teamA.push(...bots);
    }
    if (botB > 0) {
      const bots = botService.createTeam(botB, 'B');
      teamB.push(...bots);
    }

    const match = gameService.createMatch({ mode, teamA, teamB, io });

    // Notify human players
    for (const p of humans) {
      io.to(p.socketId).emit('server:match_found', {
        matchId: match.id,
        mode,
        teamA: teamA.map(pl => ({ userId: pl.userId, username: pl.username, isBot: pl.isBot })),
        teamB: teamB.map(pl => ({ userId: pl.userId, username: pl.username, isBot: pl.isBot })),
        youAreTeam: p.team
      });
    }

    logger.info('Bot-filled match', { matchId: match.id, mode, humans: humanCount, bots: botCount });
  },

  /**
   * Instantly play against a bot (for local testing).
   * Works even if the socket is not connected; a pending match is created.
   * The player auto-resumes when their socket connects (via gameHandlers).
   * @returns {object} the created match
   */
  createBotMatch(userId, username, socketId, mode, io) {
    if (!cfg.VALID_MODES.includes(mode)) {
      throw new Error('Invalid mode');
    }
    const config = cfg.MODES[mode];
    const teamSize = config.teamSize;

    // Random team for the human
    const humanTeam = Math.random() < 0.5 ? 'A' : 'B';
    const oppTeam = humanTeam === 'A' ? 'B' : 'A';

    const humanTeamArr = [{ userId, username, socketId: socketId || null, team: humanTeam, isBot: false }];
    const oppTeamArr = botService.createTeam(teamSize, oppTeam);

    // Fill the human's team with bots too
    const fillerTeam = humanTeam === 'A'
      ? botService.createTeam(teamSize - 1, 'A')
      : botService.createTeam(teamSize - 1, 'B');

    const teamA = humanTeam === 'A'
      ? [...humanTeamArr, ...fillerTeam]
      : oppTeamArr;
    const teamB = humanTeam === 'A'
      ? oppTeamArr
      : [...humanTeamArr, ...fillerTeam];

    const match = gameService.createMatch({ mode, teamA, teamB, io });

    // Notify directly if socket is connected
    if (socketId) {
      try {
        io.to(socketId).emit('server:match_found', {
          matchId: match.id,
          mode,
          teamA: teamA.map(p => ({ userId: p.userId, username: p.username, isBot: p.isBot })),
          teamB: teamB.map(p => ({ userId: p.userId, username: p.username, isBot: p.isBot })),
          youAreTeam: humanTeam
        });
      } catch (e) {
        logger.warn('Bot match emit error (socket may have closed)', { err: e.message });
      }
    }

    logger.info('Bot match created', { matchId: match.id, mode, humanTeam, socketProvided: !!socketId });

    return match;
  },

  getQueueSizes() {
    return {
      '1v1': queues['1v1'].length,
      '3v3': queues['3v3'].length,
      '5v5': queues['5v5'].length
    };
  }
};

module.exports = matchmakingService;
