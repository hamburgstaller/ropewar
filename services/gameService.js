/**
 * Game Service - Match lifecycle manager.
 * Server-authoritative: all rope/click calculations happen here.
 */

const cfg = require('../config/gameConfig');
const logger = require('../utils/logger');
const botService = require('./botService');
const matchModel = require('../models/matchModel');
const userModel = require('../models/userModel');
const mmrService = require('./mmrService');
const leaderboardModel = require('../models/leaderboardModel');
const db = require('../config/db');

let matchIdCounter = 0;
function nextMatchId() {
  return `m_${Date.now()}_${++matchIdCounter}`;
}

// Active matches
const activeMatches = new Map();

// User -> pending match (before socket connects)
const pendingMatchesByUser = new Map();

const gameService = {
  /**
   * Create a new match (not yet started).
   */
  createMatch({ mode, teamA, teamB, io }) {
    if (!cfg.VALID_MODES.includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    const config = cfg.MODES[mode];
    if (teamA.length !== config.teamSize || teamB.length !== config.teamSize) {
      throw new Error(`Wrong team size: ${mode} requires ${config.teamSize}`);
    }

    const match = {
      id: nextMatchId(),
      mode,
      teamSize: config.teamSize,
      teamA,
      teamB,
      state: 'countdown',     // countdown -> active -> ended
      stateSince: Date.now(),
      ropePos: 0,
      ropeMax: cfg.ROPE_MAX,
      clickUnit: cfg.CLICK_UNIT,
      clicksThisSecond: { A: 0, B: 0 },
      currentSecond: 0,
      startTime: null,
      endsAt: null,
      countInterval: null,
      tickInterval: null,
      countdownRemaining: cfg.COUNTDOWN_SEC,
      // Per-player click count for the current second (for rate limiting)
      perPlayerClicks: new Map(),
      io
    };

    activeMatches.set(match.id, match);

    // Add all players to the room
    const room = `match:${match.id}`;
    for (const p of [...teamA, ...teamB]) {
      if (p.socketId && io) io.sockets.sockets.get(p.socketId)?.join(room);
    }

    logger.info('Match created', { matchId: match.id, mode, teamA: teamA.length, teamB: teamB.length });

    // Add human players to pendingMatchesByUser (for resume on reconnect)
    for (const p of [...teamA, ...teamB]) {
      if (!p.isBot) {
        pendingMatchesByUser.set(p.userId, match.id);
      }
    }

    this._startCountdown(match);
    return match;
  },

  _startCountdown(match) {
    const room = `match:${match.id}`;
    match.state = 'countdown';
    match.countdownRemaining = cfg.COUNTDOWN_SEC;
    match.stateSince = Date.now();
    match.io.to(room).emit('server:countdown', {
      matchId: match.id,
      secondsRemaining: match.countdownRemaining
    });

    match.countInterval = setInterval(() => {
      match.countdownRemaining--;
      match.io.to(room).emit('server:countdown', {
        matchId: match.id,
        secondsRemaining: match.countdownRemaining
      });
      if (match.countdownRemaining <= 0) {
        clearInterval(match.countInterval);
        match.countInterval = null;
        this._startActive(match);
      }
    }, 1000);
  },

  _startActive(match) {
    const room = `match:${match.id}`;
    match.state = 'active';
    match.stateSince = Date.now();
    match.startTime = Date.now();
    match.endsAt = match.startTime + cfg.MATCH_MAX_SEC * 1000;
    match.perPlayerClicks = new Map();

    match.io.to(room).emit('server:match_start', {
      matchId: match.id,
      ropePos: 0,
      mode: match.mode,
      teamA: this._publicTeam(match.teamA),
      teamB: this._publicTeam(match.teamB),
      durationSec: cfg.MATCH_MAX_SEC
    });

    logger.info('Match started', { matchId: match.id });

    match.tickInterval = setInterval(() => {
      this._tick(match);
    }, cfg.TICK_MS);
  },

  /**
   * Triggered every second.
   * 1) Add bot clicks
   * 2) Calculate delta
   * 3) Update rope
   * 4) Broadcast tick event
   * 5) Check win condition
   */
  _tick(match) {
    if (match.state !== 'active') return;

    // Add bot clicks (only for active connected bots)
    const botClicksA = botService.teamClicksForNextTick(match.teamA);
    const botClicksB = botService.teamClicksForNextTick(match.teamB);

    // Get human clicks
    const humanA = match.clicksThisSecond.A;
    const humanB = match.clicksThisSecond.B;

    // Real numbers (for broadcast)
    const totalA = humanA + botClicksA;
    const totalB = humanB + botClicksB;

    // Team A is on the left. To win, A must pull the rope to its own side (ropePos -50).
    // If A clicks more, delta is negative -> rope moves left -> A wins.
    const delta = (totalB - totalA) * match.clickUnit;
    let newRope = match.ropePos + delta;
    if (newRope > match.ropeMax) newRope = match.ropeMax;
    if (newRope < -match.ropeMax) newRope = -match.ropeMax;

    match.ropePos = newRope;
    match.currentSecond++;
    const timeLeft = Math.max(0, Math.floor((match.endsAt - Date.now()) / 1000));

    const room = `match:${match.id}`;
    match.io.to(room).emit('server:tick', {
      second: match.currentSecond,
      ropePos: match.ropePos,
      clicksA: totalA,
      clicksB: totalB,
      delta,
      timeLeft
    });

    // Reset
    match.clicksThisSecond = { A: 0, B: 0 };
    match.perPlayerClicks = new Map();

    // Win check (rope crossed a limit)
    if (Math.abs(match.ropePos) >= match.ropeMax) {
      this._endMatch(match, match.ropePos < 0 ? 'A' : 'B');
      return;
    }

    // Timeout: whoever is ahead wins (rope direction decides)
    // No draws: if exactly centered, A wins.
    if (Date.now() >= match.endsAt) {
      const timeoutWinner = match.ropePos <= 0 ? 'A' : 'B';
      this._endMatch(match, timeoutWinner);
    }
  },

  /**
   * Is this a draw? (null winnerTeam)
   */
  isDraw(winnerTeam) {
    return winnerTeam !== 'A' && winnerTeam !== 'B';
  },

  /**
   * Player click event (from socket).
   */
  handleClick(matchId, userId) {
    const match = activeMatches.get(matchId);
    if (!match || match.state !== 'active') return;

    // Find player's team
    const team = this._getTeam(match, userId);
    if (!team) return;

    // Rate limit
    const count = match.perPlayerClicks.get(userId) || 0;
    if (count >= cfg.MAX_CLICKS_PER_SEC) return;
    match.perPlayerClicks.set(userId, count + 1);

    match.clicksThisSecond[team]++;
  },

  _getTeam(match, userId) {
    if (match.teamA.some(p => p.userId === userId)) return 'A';
    if (match.teamB.some(p => p.userId === userId)) return 'B';
    return null;
  },

  /**
   * End the match, save results, broadcast.
   */
  _endMatch(match, winnerTeam) {
    if (match.state === 'ended') return;
    match.state = 'ended';
    match.stateSince = Date.now();

    if (match.tickInterval) clearInterval(match.tickInterval);
    if (match.countInterval) clearInterval(match.countInterval);
    match.tickInterval = null;
    match.countInterval = null;

    const durationSec = (match.stateSince - match.startTime) / 1000;

    // Calculate MMR
    const userMmrMap = {};
    for (const p of [...match.teamA, ...match.teamB]) {
      if (!p.isBot) {
        const u = userModel.findById(p.userId);
        if (u) userMmrMap[p.userId] = u.mmr;
      }
    }
    const mmrResults = mmrService.applyMatchResult({
      teamA: match.teamA,
      teamB: match.teamB,
      winnerTeam,
      userMmrMap
    });

    // Update DB (transaction)
    const tx = db.transaction((results) => {
      for (const r of results) {
        userModel.applyMatchResult(db, {
          userId: r.userId,
          mmrDelta: r.mmrDelta,
          won: r.won,
          newTier: r.rankAfter,
          newMmr: r.mmrAfter
        });
      }
    });
    try {
      tx(mmrResults);
    } catch (err) {
      logger.error('Transaction error', { error: err.message });
    }

    // Save to match history
    const players = [...match.teamA, ...match.teamB].map(p => ({
      userId: p.userId,
      username: p.username,
      team: p.team,
      isBot: !!p.isBot
    }));
    const mmrDeltaMap = {};
    for (const r of mmrResults) mmrDeltaMap[r.userId] = r.mmrDelta;

    try {
      matchModel.create({
        mode: match.mode,
        teamSize: match.teamSize,
        players,
        winnerTeam,
        durationSec,
        mmrDeltas: mmrDeltaMap
      });
    } catch (err) {
      logger.error('Match record error', { error: err.message });
    }

    // Invalidate leaderboard cache
    leaderboardModel.invalidate();

    // Broadcast results
    const room = `match:${match.id}`;
    match.io.to(room).emit('server:match_end', {
      matchId: match.id,
      mode: match.mode,
      winnerTeam,
      finalRopePos: match.ropePos,
      durationSec,
      results: mmrResults,
      teamA: players.filter(p => p.team === 'A'),
      teamB: players.filter(p => p.team === 'B')
    });

    logger.info('Match ended', { matchId: match.id, winnerTeam, durationSec, players: players.length });

    // Room cleanup (after 5 seconds)
    setTimeout(() => {
      for (const p of players) {
        if (p.socketId) match.io.sockets.sockets.get(p.socketId)?.leave(room);
      }
      activeMatches.delete(match.id);
    }, 5000);
  },

  _publicTeam(team) {
    return team.map(p => ({
      userId: p.userId,
      username: p.username,
      isBot: !!p.isBot,
      difficulty: p.difficulty
    }));
  },

  getMatch(matchId) {
    return activeMatches.get(matchId);
  },

  /**
   * Find a player's active match (for reconnect).
   */
  getActiveMatchByUser(userId) {
    for (const match of activeMatches.values()) {
      const all = [...match.teamA, ...match.teamB];
      if (all.some(p => p.userId === userId && !p.isBot)) {
        return match;
      }
    }
    return null;
  },

  /**
   * Get a player's pending match (not yet connected via socket).
   */
  consumePendingMatch(userId) {
    const matchId = pendingMatchesByUser.get(userId);
    if (!matchId) return null;
    const match = activeMatches.get(matchId);
    pendingMatchesByUser.delete(userId);
    return match;
  },

  /**
   * Called when a player disconnects.
   * Currently only logs; bot substitution is a future feature.
   */
  handleDisconnect(userId) {
    const match = this.getActiveMatchByUser(userId);
    if (!match) return null;
    logger.info('Player disconnected from match', { matchId: match.id, userId });
    return match;
  }
};

module.exports = gameService;
