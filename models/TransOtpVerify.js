const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TransOtpVerificationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Assuming a User model is defined
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '1m' // Set an expiration time (e.g., 5 minutes)
    },
});

const TransOtpVerificationModel = mongoose.model(
    "TransOtpVerification",
    TransOtpVerificationSchema
);

module.exports = TransOtpVerificationModel;