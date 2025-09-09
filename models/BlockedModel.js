

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const blockedUserSchema = new Schema({
     blocker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blocked: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blockedAt: { type: Date, default: Date.now },
    // Add other fields as needed
});

const blockedUser = mongoose.model('BlockedFriends', blockedUserSchema);
module.exports = blockedUser;
