const mongoose = require('mongoose');

// Define the schema for the chat message
const chatSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the user who sent the message
    ref: 'User', // Reference to the User model
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the user who received the message
    ref: 'User', // Reference to the User model
  },
  roomId: {
    type: String,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to a User model.
  },
  message: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now, // Defaults to the current date/time.
  },
    status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  delivered: {
    type: Boolean,
    default: false, // Initially set to false, can be updated when message is delivered.
  },
  seen: {
    type: Boolean,
    default: false, // Initially set to false, can be updated when message is seen.
  },
  deliveredAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,  // Automatically set `createdAt` field to the current date
    expires: 57600    // Messages will be deleted automatically 1 hour after creation
  },
  seenAt: Date,
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the recipient User model.
  },
  recipientPushToken: {
    type: String, // The push notification token for the recipient.
  },
},  { timestamps: true });

// Define the Chat model
const ChatModel = mongoose.model('Chat', chatSchema);

module.exports = ChatModel;
