/**
 * Auth middleware for protected routes.
 * Returns 401 if userId is not present in the session.
 */

module.exports = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'You must be logged in' });
  }
  next();
};
