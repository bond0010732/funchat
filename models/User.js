const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    fullName: { type: String, required: true },
    image: { type: String, default: null },
    // Add other fields as needed
});

const User = mongoose.model('User', UserSchema);
module.exports = User;