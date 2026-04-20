require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3009;

app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected for ObjectService'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Object Schema
const objectSchema = new mongoose.Schema({
  appId: { type: String, required: true, index: true },
  objectId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdBy: { type: String },
  updatedBy: { type: String },
  tags: [String],
  metadata: mongoose.Schema.Types.Mixed,
  isPublic: { type: Boolean, default: true }
}, {
  timestamps: true
});

const ObjectModel = mongoose.model('Object', objectSchema);

// API Key Middleware (optional for GET, required for others)
const apiKeyMiddleware = (req, res, next) => {
  // GET requests don't require API key (public reads)
  if (req.method === 'GET') {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API Key' });
  }
  next();
};

// Routes
app.get('/', (req, res) => {
  res.json({
    service: 'ObjectService',
    status: 'running',
    version: '1.0.0',
    endpoints: [
      'GET /objects',
      'GET /objects/:id',
      'POST /objects',
      'PUT /objects/:id',
      'DELETE /objects/:id',
      'GET /objects/app/:appId',
      'GET /objects/type/:type'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Get all objects (with filters) - PUBLIC
app.get('/objects', async (req, res) => {
  try {
    const { appId, type, tag, limit = 100, skip = 0 } = req.query;
    const filter = {};
    if (appId) filter.appId = appId;
    if (type) filter.type = type;
    if (tag) filter.tags = tag;
    filter.isPublic = true; // Only public objects
    
    const objects = await ObjectModel.find(filter)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ updatedAt: -1 });
    
    res.json({ objects, count: objects.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get objects by collection (for VirtualOffice compatibility)
app.get('/objects/:collection', async (req, res) => {
  try {
    const { app, limit = 200 } = req.query;
    const filter = { type: req.params.collection, isPublic: true };
    if (app) filter.appId = app;
    
    const objects = await ObjectModel.find(filter)
      .limit(Math.min(parseInt(limit), 500))
      .sort({ updatedAt: -1 });
    
    // Transform to VirtualOffice format
    const items = objects.map(obj => ({
      _id: obj._id,
      data: obj.data,
      app: obj.appId,
      isPublic: obj.isPublic
    }));
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get object by ID - PUBLIC if isPublic=true
app.get('/objects/:id', async (req, res) => {
  try {
    const object = await ObjectModel.findById(req.params.id);
    if (!object) {
      return res.status(404).json({ error: 'Object not found' });
    }
    if (!object.isPublic) {
      return res.status(403).json({ error: 'Private object' });
    }
    res.json(object);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create object - REQUIRES API KEY
app.post('/objects', apiKeyMiddleware, async (req, res) => {
  try {
    const { appId, objectId, type, data, createdBy, tags, metadata, isPublic = true } = req.body;
    
    const object = new ObjectModel({
      appId,
      objectId: objectId || new mongoose.Types.ObjectId().toString(),
      type,
      data,
      createdBy,
      tags,
      metadata,
      isPublic
    });
    
    await object.save();
    res.status(201).json(object);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update object - REQUIRES API KEY
app.put('/objects/:id', apiKeyMiddleware, async (req, res) => {
  try {
    const { data, updatedBy, tags, metadata } = req.body;
    
    const object = await ObjectModel.findByIdAndUpdate(
      req.params.id,
      {
        data,
        updatedBy,
        tags,
        metadata,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!object) {
      return res.status(404).json({ error: 'Object not found' });
    }
    
    res.json(object);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete object - REQUIRES API KEY
app.delete('/objects/:id', apiKeyMiddleware, async (req, res) => {
  try {
    const object = await ObjectModel.findByIdAndDelete(req.params.id);
    if (!object) {
      return res.status(404).json({ error: 'Object not found' });
    }
    res.json({ message: 'Object deleted', id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get objects by app - PUBLIC
app.get('/objects/app/:appId', async (req, res) => {
  try {
    const objects = await ObjectModel.find({ appId: req.params.appId, isPublic: true })
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json({ objects, count: objects.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get objects by type - PUBLIC
app.get('/objects/type/:type', async (req, res) => {
  try {
    const objects = await ObjectModel.find({ type: req.params.type, isPublic: true })
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json({ objects, count: objects.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`ObjectService running on port ${PORT}`);
});
