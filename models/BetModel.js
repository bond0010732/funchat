const mongoose = require('mongoose');

const BetSchema = new mongoose.Schema({
    roomId: {
        type: String,
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

const BetModel = mongoose.model('Bet', BetSchema);

module.exports = BetModel;
