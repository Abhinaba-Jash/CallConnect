const express = require("express");
const path = require("path");
const router = express.Router();
let user_id = null;

router.get("/audio", (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).send("Missing userId in query");
  }
  res.sendFile(path.join(__dirname, "../../client/pages/audioCall.html"));
});

// Serve video call page
router.get("/video", (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).send("Missing userId in query");
  }

  res.sendFile(path.join(__dirname, "../../client/pages/videoCall.html"));
});


module.exports = router;
