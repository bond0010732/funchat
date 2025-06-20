const mongoose = require('mongoose');

const WinnerSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
    },
    winnerName: {
        type: String,
        required: true,
    },
    betAmount: {
        type: Number,
    },
    totalBet: {
        type: Number,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const WinnerModel = mongoose.model('Winner', WinnerSchema);

module.exports = WinnerModel;