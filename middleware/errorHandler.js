/**
 * Central error handler.
 * Mounted with app.use() after all routes.
 */

const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error('HTTP error', {
    method: req.method,
    url: req.url,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  const status = err.status || 500;
  res.status(status).json({
    error: err.expose ? err.message : 'Server error'
  });
};
