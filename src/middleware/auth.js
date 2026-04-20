const jwt = require('jsonwebtoken');

let cachedPublicKey = null;

async function fetchJwtPublicKey() {
  const authServiceUrl = process.env.AUTH_SERVICE_URL;
  if (!authServiceUrl) {
    console.warn('[auth] AUTH_SERVICE_URL not set — JWT verification unavailable');
    return;
  }

  const url = `${authServiceUrl}/jwt/public-key`;
  console.log(`[auth] Fetching JWT public key from ${url}`);

  try {
    const response = await fetch(url);
    console.log(`[auth] GET ${url} → HTTP ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = await response.json();
    console.log(`[auth] Public key response: status=${body.status} algorithm=${body.algorithm}`);

    if (!body.public_key) {
      throw new Error('Response missing public_key field');
    }

    cachedPublicKey = body.public_key;
    console.log(`[auth] JWT public key cached successfully (length=${cachedPublicKey.length})`);
  } catch (err) {
    console.error(`[auth] Failed to fetch JWT public key from ${url}:`, err.message);
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
  const token = authHeader.slice(7);
  try {
    req.user = verifyJwt(token);
    console.log(`[auth] JWT verified — sub=${req.user.sub} email=${req.user.email} roles=${JSON.stringify(req.user.roles)}`);
    next();
  } catch (err) {
    console.warn(`[auth] JWT verification failed — ${err.message}`);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user?.roles?.includes('admin')) {
      console.warn(`[auth] Admin access denied — sub=${req.user?.sub} roles=${JSON.stringify(req.user?.roles)}`);
      return res.status(403).json({ error: 'Admin role required' });
    }
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = verifyJwt(token);
      console.log(`[auth] Optional JWT verified — sub=${req.user.sub} email=${req.user.email}`);
    } catch (err) {
      console.warn(`[auth] Optional JWT invalid, proceeding unauthenticated — ${err.message}`);
    }
  }
  next();
}

module.exports = { fetchJwtPublicKey, verifyJwt, requireAuth, requireAdmin, optionalAuth };
