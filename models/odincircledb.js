const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for the chat message
const chatSchema = new Schema({
  sender: {
    type: Schema.Types.ObjectId, // Reference to the user who sent the message
    ref: 'User', // Reference to the User model
  },
  receiver: {
    type: Schema.Types.ObjectId, // Reference to the user who received the message
    ref: 'User', // Reference to the User model
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to a User model.
  },
  message: {
    type: String,
  },
  roomId: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now, // Defaults to the current date/time.
  },
  delivered: {
    type: Boolean,
    default: false, // Initially set to false, can be updated when message is delivered.
  },
  seen: {
    type: Boolean,
    default: false, // Initially set to false, can be updated when message is seen.
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the recipient User model.
  },
  recipientPushToken: {
    type: String, // The push notification token for the recipient.
  },
});

// Define the schema for the OdinCircle
const OdinCircleSchema = new Schema({
    fullName: String,
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    password: String,
    verified: Boolean,
    withdrawConfirmed: { type: Boolean, default: false },
    expireAt: { type: Date, expires: 0 }, // TTL index
    image: String,
    otp: String,
    otpTrans: String,
    expoPushToken: String,
    referralCode: { type: String, unique: true },
    referrals: [{
      referredUserId: mongoose.Schema.Types.ObjectId, // user ID who signed up using the referral code
      codeUsed: String, // the referral code they used
      email: String,
      phone: String,
      // status: {
      //   type: String,
      //   enum: ['Paid', 'UnPaid'], // Tracks the status of the referral
      //   default: 'UnPaid',
      // },
      referralDate: { type: Date, default: Date.now },
    }],
    wallet: {
        balance: {
            type: Number,
            default: 0
        },
        cashoutbalance: {
          type: Number,
          default: 0
      },
        transactions: [{
            amount: Number,
            timestamp: {
                type: Date,
                default: Date.now
            }
        }]
    },
    bankDetails: { // Changed to singular and camelCase for consistency
      bankName: {
        type: String,
        default: null,
      },
      accountName: {
        type: String,
        default: null,
      },
      accountNumber: {
        type: String,
        default: null // Allow null values for accountNumber
      }
    },
    // Add the chat field to the OdinCircle schema
    chat: [chatSchema] // Array of chat messages
});

// Define the model for the OdinCircle
const OdinCircledbModel = mongoose.model("odincircledbname", OdinCircleSchema)

module.exports = OdinCircledbModel;
