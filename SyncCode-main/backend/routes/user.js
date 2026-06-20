const express = require("express");
const router = express.Router();
const { login, signup } = require("../Controller/Auth");
const { auth } = require("../middleware/auth");

const isProduction = process.env.NODE_ENV === "production";

router.post("/login", login);
router.post("/signup", signup);

// ✅ Changed GET to POST
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,                        // ✅ env-aware
    sameSite: isProduction ? "None" : "Lax",     // ✅ env-aware
  });
  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Protected test route
router.get("/test", auth, (req, res) => {
    res.json({
        success: true,
        message: "Token verified. Protected route access successful.",
        user: req.user
    });
});

module.exports = router;