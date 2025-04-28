const express = require("express");
const {
  allMessages,
  sendMessage,
  getScheduledMessages,
  translateMessage,
} = require("../controllers/messageControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/translate").post(protect, translateMessage);
router.route("/scheduled").get(protect, getScheduledMessages);
router.route("/:chatId").get(protect, allMessages);
router.route("/").post(protect, sendMessage);

module.exports = router;
