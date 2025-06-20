const mongoose = require('mongoose');

const BetCoinSchema = new mongoose.Schema({
    roomName: {
        type: String,
        required: true,
    },
    playerName: {
        type: String,
        required: true,
    },
    betAmount: {
        type: Number,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const BetModelCoin = mongoose.model('BetCoin', BetCoinSchema);

module.exports = BetModelCoin;