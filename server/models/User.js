const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
   isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);
