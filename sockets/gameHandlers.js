/**
 * Socket.io game event handlers.
 */

const logger = require('../utils/logger');
const cfg = require('../config/gameConfig');
const gameService = require('../services/gameService');
const matchmakingService = require('../services/matchmakingService');

function registerGameHandlers(io, socket) {
  const userId = socket.data.userId;
  const username = socket.data.username;

  // If there is a pending match (e.g. user created a bot match before the
  // socket connected), immediately add the player to the match room.
  const pending = gameService.consumePendingMatch(userId);
  if (pending) {
    const room = `match:${pending.id}`;
    socket.join(room);
    // Update the player's socketId on the team
    for (const p of [...pending.teamA, ...pending.teamB]) {
      if (!p.isBot && p.userId === userId) {
        p.socketId = socket.id;
      }
    }
    // Find which team the player is on
    const myTeam = pending.teamA.some(p => p.userId === userId) ? 'A' : 'B';
    socket.emit('server:match_found', {
      matchId: pending.id,
      mode: pending.mode,
      teamA: pending.teamA.map(pl => ({ userId: pl.userId, username: pl.username, isBot: !!pl.isBot })),
      teamB: pending.teamB.map(pl => ({ userId: pl.userId, username: pl.username, isBot: !!pl.isBot })),
      youAreTeam: myTeam
    });
    logger.info('Pending match resumed', { userId, matchId: pending.id });
  }

  // Join queue
  socket.on('client:join_queue', (payload) => {
    try {
      const { mode } = payload || {};
      if (!cfg.VALID_MODES.includes(mode)) {
        return socket.emit('server:error', { message: 'Invalid mode' });
      }
      const result = matchmakingService.joinQueue(userId, username, socket.id, mode, io);
      socket.emit('server:queue_joined', {
        mode: result.mode,
        position: result.position,
        totalNeeded: result.totalNeeded
      });
    } catch (err) {
      logger.error('join_queue error', { error: err.message });
      socket.emit('server:error', { message: err.message });
    }
  });

  // Leave queue
  socket.on('client:leave_queue', () => {
    matchmakingService.leaveQueue(userId);
    socket.emit('server:queue_left', {});
  });

  // Click
  socket.on('client:click', (payload) => {
    const { matchId } = payload || {};
    if (!matchId) return;
    gameService.handleClick(matchId, userId);
  });

  // Player signals they are ready to start the countdown (game page loaded)
  socket.on('client:match_ready', (payload) => {
    console.log('[gameHandler] client:match_ready received', { userId, payload });
    const { matchId } = payload || {};
    if (!matchId) {
      console.log('[gameHandler] No matchId in ready payload');
      return;
    }

    const match = gameService.getActiveMatch(matchId);
    console.log('[gameHandler] Match found?', !!match, 'state:', match?.state);
    if (!match) return;

    // Mark this player as ready (only humans need to signal)
    const playerOnTeamA = match.teamA.some(p => p.userId === userId && !p.isBot);
    const playerOnTeamB = match.teamB.some(p => p.userId === userId && !p.isBot);
    console.log('[gameHandler] Is human player on A or B?', playerOnTeamA, playerOnTeamB);
    if (playerOnTeamA || playerOnTeamB) {
      match.readyPlayers.add(userId);

      // Check if all human players are ready
      const totalHumans = [...match.teamA, ...match.teamB].filter(p => !p.isBot).length;
      const readyHumans = match.readyPlayers.size;

      logger.info('Player ready', { userId, matchId, ready: readyHumans, total: totalHumans });

      if (readyHumans >= totalHumans) {
        // All humans ready, start countdown
        console.log('[gameHandler] Starting countdown for match', matchId);
        gameService._startCountdown(match);
      }
    }
  });

  // Leave match (currently only logs)
  socket.on('client:leave_match', (payload) => {
    const { matchId } = payload || {};
    logger.info('Player left match', { userId, matchId });
  });

  // Reconnect: query match state
  socket.on('client:resume_match', () => {
    const match = gameService.getActiveMatchByUser(userId);
    if (!match) {
      return socket.emit('server:match_state', { active: false });
    }
    const room = `match:${match.id}`;
    socket.join(room);
    socket.emit('server:match_state', {
      active: true,
      matchId: match.id,
      mode: match.mode,
      state: match.state,
      ropePos: match.ropePos,
      timeLeft: Math.max(0, Math.floor((match.endsAt - Date.now()) / 1000)),
      teamA: match.teamA.map(p => ({ userId: p.userId, username: p.username, isBot: !!p.isBot })),
      teamB: match.teamB.map(p => ({ userId: p.userId, username: p.username, isBot: !!p.isBot })),
      yourTeam: match.teamA.some(p => p.userId === userId) ? 'A' : 'B'
    });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    gameService.handleDisconnect(userId);
  });
}

module.exports = registerGameHandlers;
