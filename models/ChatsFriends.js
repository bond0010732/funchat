const mongoose = require('mongoose');

const ChatsFriendsSchema = new mongoose.Schema({
    recipientId: { type: String, required: true },
    senderFullName: { type: String, required: true },
    author: { type: String, required: true },
    senderImage: { type: String, required: true },
    messageId: { type: Number, required: true },
    unreadCount: { type: Number, default: 1 },
    isRead: { type: Boolean, default: false }      
}, {
    timestamps: true,
});

const ChatsFriends = mongoose.model('UnreadMessage', ChatsFriendsSchema);
module.exports = ChatsFriends;
