const express = require("express");
const router = express.Router();
const ChatMessage = require("../models/ChatMessage");
const path = require("path");
const authMiddleware = require("../middleware/auth"); // Make sure this exists

// ✅ Get chat history between two users
router.get("/:targetUserId", authMiddleware,  async (req, res) => {
  try {
    if (!req.userId) {
      return res
        .status(401)
        .json({ message: "Missing userId from auth middleware" });
    }
    const currentUserId = req.userId;
    const targetUserId = req.params.targetUserId;
    const messages = await ChatMessage.find({
      $or: [
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId },
      ],
    }).sort("timestamp");

    res.json(messages);
  } catch (err) {
    console.error("Error fetching chat history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Save a chat message
router.post("/",authMiddleware, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const newMessage = new ChatMessage({
      senderId: req.userId,
      receiverId,
      message,
    });

    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (err) {
    console.error("Error saving chat message:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// DELETE all chat history for current user
router.delete("/clear", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.userId;
    await ChatMessage.deleteMany({ senderId: currentUserId });
    res.status(200).json({ message: "Chat history deleted successfully." });
  } catch (err) {
    console.error("Error deleting chat history:", err);
    res
      .status(500)
      .json({ message: "Server error while deleting chat history." });
  }
});

// ✅ Serve chat dashboard page
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client/pages/chatDashboard.html"));
});

module.exports = router;
