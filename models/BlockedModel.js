

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const unlockSchema = new Schema({
  //    blocker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // blocked: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // blockedAt: { type: Date, default: Date.now }
      userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  unlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who paid
  cost: { type: Number, default: 0 },
  unlockedAt: { type: Date, default: Date.now },
    // Add other fields as needed
});

// const blockedUser = mongoose.model('BlockedFriends', blockedUserSchema);
// module.exports = blockedUser;

const UnlockAccess = mongoose.model('UnlockAccess', unlockSchema);
module.exports = UnlockAccess;
