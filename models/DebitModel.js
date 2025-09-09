const mongoose = require('mongoose');

const DebitSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    WithdrawStatus: {
        type: String,
        default: 'pending', // Add a default status of "pending"
    },
});

const DebitModel = mongoose.model('Debit', DebitSchema);

module.exports = DebitModel;
