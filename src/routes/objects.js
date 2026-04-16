const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const svc = require('../services/objectService');

// GET /objects/:collection
// Query params:
//   page, limit, app, tags (comma-separated), isPublic
//   ref[key]=value  — foreign-key filter via indexed refs field
//                     e.g. ?ref[carId]=abc123&ref[userId]=xyz
router.get('/:collection', optionalAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, app, tags, isPublic, ref } = req.query;
    const filter = {};

    if (!req.user) {
      filter.isPublic = true;
    } else if (isPublic !== undefined) {
      filter.isPublic = isPublic === 'true';
    }
    if (app) filter.app = app;
    if (tags) filter.tags = tags.split(',');
    if (ref && typeof ref === 'object') filter.refs = ref;

    const result = await svc.listObjects(req.params.collection, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      ...filter,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /objects/:collection/:id
router.get('/:collection/:id', optionalAuth, async (req, res, next) => {
  try {
    const doc = await svc.getObject(req.params.collection, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Object not found' });
    if (!doc.isPublic && !req.user) {
      return res.status(403).json({ error: 'Authentication required to access private objects' });
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// POST /objects/:collection
// Body: { data, refs?, isPublic?, app?, tags? }
router.post('/:collection', requireApiKeyOrAuth, async (req, res, next) => {
  try {
    const { data, refs, isPublic, app, tags } = req.body;
    if (!data) return res.status(400).json({ error: '"data" is required' });

    const doc = await svc.createObject(req.params.collection, {
      data,
      refs,
      isPublic,
      app,
      tags,
      createdBy: req.user?.sub ?? null,
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// PUT /objects/:collection/:id — full replacement
router.put('/:collection/:id', requireApiKeyOrAuth, async (req, res, next) => {
  try {
    const { data, refs, isPublic, app, tags } = req.body;
    if (!data) return res.status(400).json({ error: '"data" is required' });

    const doc = await svc.updateObject(req.params.id, {
      data,
      refs,
      isPublic,
      app,
      tags,
      updatedBy: req.user?.sub ?? null,
    });
    if (!doc) return res.status(404).json({ error: 'Object not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// PATCH /objects/:collection/:id — partial update
// merge=true (default): shallow-merges data and refs into existing values
// merge=false: replaces data/refs entirely
router.patch('/:collection/:id', requireApiKeyOrAuth, async (req, res, next) => {
  try {
    const { data, refs, merge = true } = req.body;
    if (!data && !refs) return res.status(400).json({ error: '"data" or "refs" is required' });

    const doc = await svc.patchObject(req.params.id, {
      data,
      refs,
      merge,
      updatedBy: req.user?.sub ?? null,
    });
    if (!doc) return res.status(404).json({ error: 'Object not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// DELETE /objects/:collection/:id
router.delete('/:collection/:id', requireApiKeyOrAuth, async (req, res, next) => {
  try {
    const deleted = await svc.deleteObject(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Object not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
