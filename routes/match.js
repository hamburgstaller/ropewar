/**
 * Match routes - create bot match.
 *
 * The io reference is attached via module.exports.setIo from server.js to
 * avoid a circular dependency.
 */

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const matchmakingService = require('../services/matchmakingService');
const matchModel = require('../models/matchModel');

const router = express.Router();

let ioRef = null;
function setIo(io) { ioRef = io; }

router.post('/bot', requireAuth, (req, res) => {
  try {
    const { mode } = req.body;
    if (!['1v1', '3v3', '5v5'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    if (!ioRef) {
      return res.status(500).json({ error: 'Socket.io is not ready yet' });
    }
    const userId = req.session.userId;
    const username = req.session.username;

    // Find the user's active socket (if any)
    let actualSocketId = null;
    for (const [, sock] of ioRef.sockets.sockets) {
      if (sock.data && sock.data.userId === userId && sock.connected) {
        actualSocketId = sock.id;
        break;
      }
    }

    // Create the match as a pending match even if no socket is connected.
    // When the player connects, the game handler will auto-resume.
    const match = matchmakingService.createBotMatch(
      userId, username, actualSocketId, mode, ioRef
    );

    res.json({ matchId: match.id });
  } catch (err) {
    console.error('Bot match error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/queue-sizes', (req, res) => {
  res.json(matchmakingService.getQueueSizes());
});

// Fetch the details of a finished match (for the results screen)
router.get('/:matchId', requireAuth, (req, res) => {
  const match = matchModel.getById(req.params.matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json(match);
});

module.exports = router;
module.exports.setIo = setIo;
