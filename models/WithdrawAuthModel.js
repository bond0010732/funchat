
const mongoose = require('mongoose');


// Define the BankSchema
const WithdrawSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      bvn: {
        type: String,
        required: true,
        minlength: 11,
        maxlength: 11,
      },
      nin: {
        type: String,
        required: true,
        minlength: 11,
        maxlength: 11,
      },
      phone: {
        type: String,
        required: true,
        minlength: 11,
        maxlength: 11,
      },
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    });

const WithdrawAuthModel = mongoose.model('withdrawauth', WithdrawSchema);

module.exports = WithdrawAuthModel;
