const express = require('express');
const router = express.Router();
const { requireAdmin, fetchJwtPublicKey } = require('../middleware/auth');
const svc = require('../services/objectService');

// GET /admin/collections
router.get('/collections', requireAdmin, async (req, res, next) => {
  try {
    const collections = await svc.listCollections();
    res.json({ collections });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/collections/:collection
router.delete('/collections/:collection', requireAdmin, async (req, res, next) => {
  try {
    const deletedCount = await svc.dropCollection(req.params.collection);
    res.json({ message: `Dropped ${deletedCount} object(s) from "${req.params.collection}"`, deletedCount });
  } catch (err) {
    next(err);
  }
});

// GET /admin/indexes — list all indexes on the ObjectDocument collection
router.get('/indexes', requireAdmin, async (req, res, next) => {
  try {
    const indexes = await svc.listIndexes();
    res.json({ indexes });
  } catch (err) {
    next(err);
  }
});

// POST /admin/indexes — create a compound index on data.<field>
// Body: { field: "brand", unique?: false }
// Creates: { collectionName: 1, "data.brand": 1 }
// Supports dot-notation: field="address.city" → "data.address.city"
router.post('/indexes', requireAdmin, async (req, res, next) => {
  try {
    const { field, unique = false } = req.body;
    if (!field) return res.status(400).json({ error: '"field" is required' });

    const name = await svc.createDataIndex(field, { unique });
    res.status(201).json({ message: `Index "${name}" created`, name });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/indexes/:name — drop index by name
router.delete('/indexes/:name', requireAdmin, async (req, res, next) => {
  try {
    await svc.dropIndex(req.params.name);
    res.json({ message: `Index "${req.params.name}" dropped` });
  } catch (err) {
    next(err);
  }
});

// POST /admin/refresh-key
router.post('/refresh-key', requireAdmin, async (req, res, next) => {
  try {
    await fetchJwtPublicKey();
    res.json({ message: 'JWT public key refreshed successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
