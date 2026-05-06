const jwt = require('jsonwebtoken');

// Middleware that protects routes requiring a valid JWT.
// Expects the client to send: Authorization: Bearer <token>
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  // Split "Bearer <token>" and grab the token portion
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // jwt.verify throws for expired, malformed, or wrong-secret tokens
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded payload (e.g. { userId, role }) so route handlers
    // can use req.user without re-querying the token
    req.user = decoded;
    next();
  } catch (err) {
    // Return the same generic error for all JWT failure modes so callers
    // can't probe which specific check failed (expired vs. bad signature, etc.)
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware factory that restricts access to routes by role.
// Usage: router.get('/admin', authenticate, authorize(['admin']), handler)
// Must run AFTER authenticate so req.user is already populated.
const authorize = (roles) => {
  return (req, res, next) => {
    // roles.includes() checks whether the user's role is in the allowed list
    if (!roles.includes(req.user.role)) {
      // 403 Forbidden — authenticated but not permitted
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
