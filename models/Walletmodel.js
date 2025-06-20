const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WalletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'Register'
    },
    balance: Number,
    cashoutbalance: Number,
    transactions: [{
        amount: Number,
        timestamp: Date
    }]
});

const WalletModel = mongoose.model('WalletModel', WalletSchema);
module.exports = WalletModel;
