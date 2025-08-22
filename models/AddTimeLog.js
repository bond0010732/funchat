const mongoose = require('mongoose');

const AddTimeLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OdinCircledb', // Make sure this matches your user model name
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AddTimeLog', AddTimeLogSchema);
