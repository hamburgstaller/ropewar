/**
 * Leaderboard routes.
 */

const express = require('express');
const leaderboardModel = require('../models/leaderboardModel');

const router = express.Router();

router.get('/', (req, res) => {
  const mode = req.query.mode || 'overall';
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);

  if (mode !== 'overall' && !['1v1', '3v3', '5v5'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  const entries = leaderboardModel.getTopPlayers(mode, limit);
  res.json({ mode, entries });
});

module.exports = router;
