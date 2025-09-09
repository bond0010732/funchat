const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const unlockSchema = new Schema({
  userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  unlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who paid
  cost: { type: Number, default: 0 },
  unlockedAt: { type: Date, default: Date.now },
});

const UnlockAccess = mongoose.model('UnlockAccess', unlockSchema);
module.exports = UnlockAccess;
