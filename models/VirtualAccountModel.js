
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the BankSchema
const  virtualAccountSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
      },
      tx_ref: {
        type: String,
        required: true,
        unique: true,
      },
      virtual_account_id: {
        type: String,
        unique: true,
        required: false,  // This can be optional initially if it's created later
      },
      bvn: {
        type: String,
        required: function () { return this.is_permanent; }, // Required if the account is permanent
      },
      phonenumber: {
        type: String,
      },
      firstname: {
        type: String,
        required: true,
      },
      lastname: {
        type: String,
        required: true,
      },
      narration: {
        type: String,
      },
      is_permanent: {
        type: Boolean,
        default: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ['pending', 'active', 'failed'],
        default: 'pending',
      },
    });

const VirtualAccountModel = mongoose.model('VirtualAccount', virtualAccountSchema);

module.exports = VirtualAccountModel;