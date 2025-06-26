const express = require("express");
const router = express.Router();
const User = require("../models/User");
const CallHistory = require("../models/CallHistory");
const authRoutes = require("./auth");
const SECRET = process.env.JWT_SECRET || "your_secret_key_here";
const app = express();
const path = require("path");
const authMiddleware2 = require("../middleware/auth");
app.use("/api/auth", authRoutes);

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.query.userId;
  if (!token) return res.redirect("/api/auth/login");
  
  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error("Invalid token:", err.message);
    return res.redirect("/api/auth/login");
  }
};
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client/pages/dashboard.html"));
});
// Dashboard Route
router.get("/data", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const onlineUsers = await User.find({
      _id: { $ne: currentUserId },
      isOnline: true,
    }).select("name email");

    // 2. Call history for current user
    const callHistory = await CallHistory.find({uid: currentUserId
    })
      .populate("callerId", "name")
      .populate("calleeId", "name")
      .sort({ startedAt: -1 });
    await User.updateOne(
      { _id: { $eq: currentUserId } },
      { $set: { isOnline: true } }
    );
    const currentUserName = await User.findOne(
      { _id: currentUserId },
      { isOnline: true }
    ).select("name");
    res.json({
      users: onlineUsers,
      callHistory,
      currentUserName: currentUserName,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    //Serve the error.html file with message
    res.status(500).json({ message: "Server error" });
  }
});
// DELETE all call history for current user
router.delete("/clear", authMiddleware2, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const msg = await CallHistory.deleteMany({uid: currentUserId},{$or: [{ callerId: currentUserId }, { calleeId: currentUserId }]});
    res.status(200).json({ message: "Call history deleted successfully." });
  } catch (err) {
    console.error("Error deleting call history:", err);
    res
      .status(500)
      .json({ message: "Server error while deleting call history." });
  }
});
module.exports = router;
