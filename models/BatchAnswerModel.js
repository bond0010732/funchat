const mongoose = require('mongoose');
const User = require('../models/User'); // Import the User model

const BatchAnswerSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Batch', // Reference to the Batch collection
    },
    batchName: {
      type: String,
      required: true,
    },
    totalBetAmount: {
      type: String,
      required: true,
    },
    userId: {
      type: [mongoose.Schema.Types.ObjectId],
      required: true,
      ref: 'User', // Reference to the User collection
    },
    userAnswers: [{
        userId: { type: String, required: true },
        correctAnswers: { type: Number, required: true },  // Total correct answers as a number
        timestamp: {
          type: Date,
          default: Date.now,
        },
      }],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true } // Automatically adds `createdAt` and `updatedAt` fields
);

const BatchAnswer = mongoose.model('BatchAnswer', BatchAnswerSchema);

module.exports = BatchAnswer;
