const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserOtpVerificationSchema = new Schema({
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
        expires: '5m' // Set an expiration time (e.g., 5 minutes)
    },
});

const UserOtpVerificationModel = mongoose.model(
    "UserOtpVerification",
    UserOtpVerificationSchema
);

module.exports = UserOtpVerificationModel;
