const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the BankSchema
const BankSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    bankName: {
        type: String,
        required: true,
    },
    accountName: {
        type: String,
        required: true,
    },
    accountNumber: {
        type: String,
        required: true, // Allow null values
        unique: true // Ensure account numbers are unique
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt timestamps
});

// Define a pre-save hook to generate a unique account number if not provided
// BankSchema.pre('save', async function(next) {
//     try {
//         // If accountNumber is not provided, generate a unique one
//         if (!this.accountNumber) {
//             const BankModel = mongoose.model('Bank'); // Retrieve the model
//             const userCount = await BankModel.countDocuments({}); // Count existing documents
//             this.accountNumber = (userCount + 1).toString(); // Assign unique account number based on total user count
//         }
//         next();
//     } catch (error) {
//         next(error);
//     }
// });

const BankModel = mongoose.model('Bank', BankSchema);

module.exports = BankModel;

