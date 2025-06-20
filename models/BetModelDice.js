const mongoose = require('mongoose');

const BetDiceSchema = new mongoose.Schema({
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

const BetModelDice = mongoose.model('BetDice', BetDiceSchema);

module.exports = BetModelDice;