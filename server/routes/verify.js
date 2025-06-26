const User = require("../models/User");
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
router.get("/verify", authMiddleware, async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(400).send("Invalid token");
    user.isVerified = true;
    await user.save();
    window.location.href="/api/auth/login";
  } catch (err) {
    res.status(400).send("❌ Invalid or expired verification link.");
  }
});
module.exports= router;