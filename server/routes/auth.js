const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.register);
router.post("/login", authController.login);
// router.get("/login", authController.alreadyLogin);
router.post("/logout", authController.logout);
router.get("/verify-email", authController.verifyEmail);


module.exports = router;
