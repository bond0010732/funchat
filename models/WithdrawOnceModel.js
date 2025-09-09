const mongoose = require('mongoose');

// Define the WithdrawOnceSchema
const WithdrawOnceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  withdrawConfirmed: { type: Boolean, default: false },
  expireAt: { 
    type: Date, 
    expires: '1d', // Set to 1 day (or adjust as needed)
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const WithdrawOnceModel = mongoose.model('withdrawonce', WithdrawOnceSchema);

module.exports = WithdrawOnceModel;

