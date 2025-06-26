// middleware/auth.js
const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "your_secret_key_here";

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
      const decoded = jwt.verify(token, SECRET);
      req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Forbidden" });
  }
};
