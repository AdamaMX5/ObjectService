const mongoose = require('mongoose');

const objectDocumentSchema = new mongoose.Schema(
  {
    collectionName: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Dedicated foreign-key store — always indexed via wildcard index below.
    // Use refs instead of data for any field you filter/join on frequently.
    refs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: String,
      default: null,
    },
    updatedBy: {
      type: String,
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    app: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// --- Static indexes (always present) ---
objectDocumentSchema.index({ collectionName: 1, createdAt: -1 });
objectDocumentSchema.index({ collectionName: 1, isPublic: 1 });
objectDocumentSchema.index({ collectionName: 1, app: 1 });
objectDocumentSchema.index({ collectionName: 1, tags: 1 });

// Wildcard index covers ALL keys under refs (carId, userId, …) automatically.
// MongoDB 7.0+ supports compound wildcard indexes; on older versions MongoDB
// combines this index with the collectionName index via index intersection.
objectDocumentSchema.index({ 'refs.$**': 1 });

module.exports = mongoose.model('ObjectDocument', objectDocumentSchema);
