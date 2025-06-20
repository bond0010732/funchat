

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserFriendsSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference to the user model
  },
  selectedUsers: [{
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    fullName: String,
    image: String,
  }],
  });


const UserFriendsModel = mongoose.model('UserFriendsList', UserFriendsSchema);
module.exports = UserFriendsModel;
