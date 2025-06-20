const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for device registration
const deviceSchema = new Schema({
  expoPushToken: {
    type: String,
    required: true,
    unique: true // Ensure that each device has a unique token
  },
  users: [{
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  }]
});

// Create a model from the schema
const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;


// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// // Define the schema for device registration
// const deviceSchema = new Schema({
//   userId: {
//     type: String,
//   },
//   expoPushToken: {
//     type: String,
//   }
// });

// // Create a compound index to ensure the combination of userId and expoPushToken is unique
// //deviceSchema.index({ userId: 1, expoPushToken: 1 });

// // Create a model from the schema
// const Device = mongoose.model('Device', deviceSchema);

// module.exports = Device;