const mongoose = require('mongoose');

// Referral Schema
const referralSchema = new mongoose.Schema({
    referredUserId: {
      type: mongoose.Schema.Types.ObjectId, // The ID of the referred user
      required: true,
      ref: "User", // Refers to the User model
    },
    codeUsed: {
      type: String, // The referral code used during registration
      required: true,
    },
    email: {
      type: String, // Email of the referred user
      required: true,
    },
    phone: {
      type: String, // Phone number of the referred user
    },
    status: {
      type: String, // The status of the referral
      enum: ["UnPaid", "Paid"], // Allowed values
      default: "UnPaid", // Default status
    },
    referralDate: {
      type: Date, // Date when the referral occurred
      default: Date.now,
    },
  });
  
const ReferralModel = mongoose.model('referral', referralSchema);

module.exports = ReferralModel;