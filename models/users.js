const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  bio: {
    type: String
  },
  location: {
    type: String
  },
  photo: {
    type: String
  },
  verifiedIdentity: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('User', userSchema);


