const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema({
  batch: {
    type: String,
    required: true,
  },
  betAmount: {
    type: String,
    required: true,
  },
  prizeAmount: {
    type: String,
    required: true,
  },
  NumberPlayers: {
    type: Number,
    required: true,
    default: 0,
  },
  timer: {
    type: Number,
    required: true,
    default: 0,
  },
  PlayersInRoom: {
    type: Number,
    default: 0,
  },
  joinedUsers: [
    {
      userId: { type: String },
      correctAnswers: { type: Number, default: 0 },
    },
  ],
  betsAmountPlayer: [
    {
      userId: { type: String },
      betsAmount: { type: Number, default: 0 },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// module.exports = mongoose.model('Batch', BatchSchema);

const BatchModel = mongoose.model('Batch', BatchSchema);

module.exports = BatchModel;