


const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reportUserSchema = new Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reported: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
    // Add other fields as needed
});

const reportUser = mongoose.model('ReportFriends', reportUserSchema);
module.exports = reportUser;
