const mongoose = require('mongoose');

const BetQuizSchema = new mongoose.Schema({
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

const BetModelQuiz = mongoose.model('BetQuiz', BetQuizSchema);

module.exports = BetModelQuiz;