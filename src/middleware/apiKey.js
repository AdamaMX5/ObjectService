const { requireAuth } = require('./auth');

function requireApiKey(req, res, next) {
  const expectedKey = process.env.API_KEY;
  if (!expectedKey) {
    return res.status(503).json({ error: 'API key authentication not configured' });
  }
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  req.isApiKeyAuth = true;
  next();
}

// Accepts either X-API-Key (internal) or Bearer JWT (user)
function requireApiKeyOrAuth(req, res, next) {
  if (req.headers['x-api-key']) {
    return requireApiKey(req, res, next);
  }
  return requireAuth(req, res, next);
}

module.exports = { requireApiKey, requireApiKeyOrAuth };
