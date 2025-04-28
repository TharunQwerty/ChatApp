const mongoose = require("mongoose");

const messageSchema = mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    content: { type: String, trim: true },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    scheduledFor: { type: Date, default: null },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema, "messages");
module.exports = Message;
