/**
 * Profile routes.
 */

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const userModel = require('../models/userModel');
const matchModel = require('../models/matchModel');
const ranking = require('../services/rankingService');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const user = userModel.findById(req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const winRate = user.games_played > 0
    ? Math.round((user.wins / user.games_played) * 100)
    : 0;

  res.json({
    user: {
      ...user,
      winRate,
      tierColor: ranking.colorFor(user.rank_tier)
    }
  });
});

router.get('/matches', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const history = matchModel.getMatchHistory(req.session.userId, limit);
  res.json({ matches: history });
});

module.exports = router;
