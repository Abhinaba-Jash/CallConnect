// server/models/CallHistory.js
const mongoose = require("mongoose");

const callHistorySchema = new mongoose.Schema({
  uid: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  callerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  calleeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  callType: { type: String, enum: ["audio", "video"], required: true },
  status: { type: String, enum: ["missed", "completed"], required: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

module.exports = mongoose.model("CallHistory", callHistorySchema);
