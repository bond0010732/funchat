const mongoose = require('mongoose');

const DeleteSchema = new mongoose.Schema({
    userId: {
        type: String,
    },
    fullName: {
        type: String,
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    phone: {
        type: Number,
        required: true,
    },
    confirmationText: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const DeleteRequestModel = mongoose.model('Delete', DeleteSchema);

module.exports = DeleteRequestModel;