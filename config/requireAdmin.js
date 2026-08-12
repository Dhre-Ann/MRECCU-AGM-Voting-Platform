function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required' });
}

module.exports = requireAdmin;
