const ObjectDocument = require('../models/ObjectDocument');

// Names of indexes that must never be dropped
const PROTECTED_INDEXES = new Set(['_id_']);

async function getObject(collection, id) {
  return ObjectDocument.findOne({ _id: id, collectionName: collection });
}

async function listObjects(collection, { page = 1, limit = 20, isPublic, app, tags, refs } = {}) {
  const filter = { collectionName: collection };
  if (isPublic !== undefined) filter.isPublic = isPublic;
  if (app) filter.app = app;
  if (tags?.length) filter.tags = { $all: tags };
  // refs filters hit the wildcard index on refs.$**
  if (refs && Object.keys(refs).length) {
    for (const [key, value] of Object.entries(refs)) {
      filter[`refs.${key}`] = value;
    }
  }

  const skip = (page - 1) * limit;
  const [objects, total] = await Promise.all([
    ObjectDocument.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ObjectDocument.countDocuments(filter),
  ]);

  return { objects, total, page, limit, pages: Math.ceil(total / limit) };
}

// Searches data fields with equality filters.
// For indexed lookups on foreign keys use listObjects with refs instead.
async function searchObjects(collection, query, { page = 1, limit = 20, isPublicOnly = false } = {}) {
  const filter = { collectionName: collection };
  if (isPublicOnly) filter.isPublic = true;

  for (const [key, value] of Object.entries(query)) {
    filter[`data.${key}`] = value;
  }

  const skip = (page - 1) * limit;
  const [objects, total] = await Promise.all([
    ObjectDocument.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ObjectDocument.countDocuments(filter),
  ]);

  return { objects, total, page, limit, pages: Math.ceil(total / limit) };
}

async function createObject(collection, { data, refs = {}, isPublic = false, app, tags = [], createdBy }) {
  const doc = new ObjectDocument({
    collectionName: collection,
    data,
    refs,
    isPublic,
    app,
    tags,
    createdBy,
    updatedBy: createdBy,
  });
  return doc.save();
}

async function updateObject(id, { data, refs, isPublic, app, tags, updatedBy }) {
  const set = { updatedBy };
  if (data !== undefined) set.data = data;
  if (refs !== undefined) set.refs = refs;
  if (isPublic !== undefined) set.isPublic = isPublic;
  if (app !== undefined) set.app = app;
  if (tags !== undefined) set.tags = tags;

  return ObjectDocument.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true });
}

async function patchObject(id, { data, refs, merge = true, updatedBy }) {
  const doc = await ObjectDocument.findById(id);
  if (!doc) return null;

  if (data !== undefined) {
    doc.data = merge ? { ...doc.data, ...data } : data;
  }
  if (refs !== undefined) {
    doc.refs = merge ? { ...doc.refs, ...refs } : refs;
  }
  doc.updatedBy = updatedBy;
  return doc.save();
}

async function deleteObject(id) {
  const result = await ObjectDocument.findByIdAndDelete(id);
  return !!result;
}

async function listCollections() {
  return ObjectDocument.distinct('collectionName');
}

async function dropCollection(collectionName) {
  const result = await ObjectDocument.deleteMany({ collectionName });
  return result.deletedCount;
}

// --- Index management ---

async function listIndexes() {
  const indexes = await ObjectDocument.collection.indexes();
  return indexes.map(({ name, key, unique }) => ({ name, key, unique: unique ?? false }));
}

// Creates a compound index { collectionName: 1, "data.<field>": 1 } for efficient data queries.
// field supports dot-notation, e.g. "address.city"
async function createDataIndex(field, { unique = false } = {}) {
  const keyPath = `data.${field}`;
  const safeName = `data_${field.replace(/\./g, '_')}_1`;

  await ObjectDocument.collection.createIndex(
    { collectionName: 1, [keyPath]: 1 },
    { name: safeName, background: true, sparse: true, unique }
  );
  return safeName;
}

async function dropIndex(name) {
  if (PROTECTED_INDEXES.has(name)) {
    throw Object.assign(new Error(`Index "${name}" is protected and cannot be dropped`), { status: 400 });
  }
  await ObjectDocument.collection.dropIndex(name);
  return true;
}

module.exports = {
  getObject,
  listObjects,
  searchObjects,
  createObject,
  updateObject,
  patchObject,
  deleteObject,
  listCollections,
  dropCollection,
  listIndexes,
  createDataIndex,
  dropIndex,
};
