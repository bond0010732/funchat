const mongoose = require('mongoose');

const BetRockSchema = new mongoose.Schema({
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

const BetModelRock = mongoose.model('BetRock', BetRockSchema);

module.exports = BetModelRock;
