const mongoose = require('mongoose');

const AddFeatureSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "OdinCircledbModel", required: true },
  cost: { type: Number, required: true },
  type: { type: String, enum: ["50", "call", "unlock_access","image","video","giphy","other"], required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AddFeature', AddFeatureSchema);
