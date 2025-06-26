const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "your_secret_key_here";
const crypto = require('crypto');
const sendVerificationEmail = require('../utils/sendVerificationEmail');
const path = require("path");
// Register
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      verificationToken,
      isVerified: false,
    });

    await user.save();

    // Send verification email
    await sendVerificationEmail(email, verificationToken);
    res.status(201).json({ message: 'Verification email sent. Please verify before login.' });

  } catch (err) {
    res
      .status(500)
      .json({ message: "Error registering user", error: err.message });
  }
};
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).send('Invalid or expired verification token');
    user.isVerified = true;
    user.verificationToken = null;
    await user.save();
    res.sendFile(path.join(__dirname, '../../client/pages/verify.html'));
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).send('Error verifying email');
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    // if (!user.isVerified) {
    //   return res.status(403).json({ message: 'Please verify your email first from signing again (GO TO SIGN UP PAGE)' });
    // }
    if (!user) return res.status(401).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ userId: user._id }, SECRET, { expiresIn: "2h" });
    return res.json({
      message: "Login successful",
      token,
      user: { _id: user._id, name: user.name, email: user.email },
    });
    //res.redirect("/api/dashboard");
  } catch (err) {
    res.status(500).json({ message: "Error logging in", error: err.message });
  }
};
exports.logout = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Missing userId" });
    }

    try {
      await User.findByIdAndUpdate(userId, { isOnline: false });
      res.json({ message: "Logout successful" });
    } catch (err) {
      console.error("Logout error:", err.message);
      res.status(500).json({ message: "Logout failed" });
    }
  } catch (err) {
    res.status(500).json({ message: "Error logging out", error: err.message });
  }
};
