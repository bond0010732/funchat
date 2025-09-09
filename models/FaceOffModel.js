const mongoose = require('mongoose');

const FaceOffSchema = new mongoose.Schema({
  batch: {
    type: String,
    required: true,
  },
  userIds: {
    type: [mongoose.Schema.Types.ObjectId],
    required: true,
    ref: 'User', // Reference to the User collection
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
  joinedUsers: [{
    type: [mongoose.Schema.Types.ObjectId],
    required: true,
    ref: 'User', // Reference to the User collection
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// module.exports = mongoose.model('Batch', BatchSchema);

const FaceOffModel = mongoose.model('faceoff', FaceOffSchema);

module.exports = FaceOffModel;