const mongoose = require('mongoose');

const blockedUserSchema = new mongoose.Schema({
  blocker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blocked: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blockedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('BlockedUser', blockedUserSchema);
