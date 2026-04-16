const jwt = require('jsonwebtoken');

let cachedPublicKey = null;

async function fetchJwtPublicKey() {
  const authServiceUrl = process.env.AUTH_SERVICE_URL;
  if (!authServiceUrl) {
    console.warn('AUTH_SERVICE_URL not set — JWT verification unavailable');
    return;
  }

  try {
    const response = await fetch(`${authServiceUrl}/jwt/public-key`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    cachedPublicKey = await response.text();
    console.log('JWT public key fetched from AuthService');
  } catch (err) {
    console.error('Failed to fetch JWT public key:', err.message);
  }
}

function verifyJwt(token) {
  if (!cachedPublicKey) {
    throw new Error('JWT public key not available');
  }
  return jwt.verify(token, cachedPublicKey, { algorithms: ['RS256'] });
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer token required' });
  }
  try {
    req.user = verifyJwt(authHeader.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user?.roles?.includes('admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = verifyJwt(authHeader.slice(7));
    } catch {
      // invalid token — proceed as unauthenticated
    }
  }
  next();
}

module.exports = { fetchJwtPublicKey, verifyJwt, requireAuth, requireAdmin, optionalAuth };
