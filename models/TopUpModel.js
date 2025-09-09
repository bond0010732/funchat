const mongoose = require('mongoose');

const TopUpSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    txRef: {
        type: String,
        required: true,
    },
    transactionId: {
        type: Number,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    // customer: {
    //     email: String,
    //     phone: String,
    //     name: String,
    // },
});

const TopUpModel = mongoose.model('TopUp', TopUpSchema);

module.exports = TopUpModel;