const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const path = require("path");
const Message = require("./models/messageModel");
const Chat = require("./models/chatModel");
const User = require("./models/userModel");

dotenv.config();
connectDB();
const app = express();

app.use(express.json()); // to accept json data

// app.get("/", (req, res) => {
//   res.send("API Running!");
// });

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// --------------------------deployment------------------------------

const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

// --------------------------deployment------------------------------

// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT;

const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: "*", // Allow connections from any origin
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e8,  // 100 MB
});

console.log("Socket.io server initialized");

io.on("connection", (socket) => {
  console.log("Connected to socket.io, Socket ID:", socket.id);
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;

    if (!chat.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;

      socket.in(user._id).emit("message recieved", newMessageRecieved);
    });
  });

  socket.off("setup", () => {
    console.log("USER DISCONNECTED");
    socket.leave(userData._id);
  });
});

// Scheduled message processor
const checkScheduledMessages = async () => {
  try {
    const now = new Date();
    console.log(`[${now.toISOString()}] Checking for scheduled messages...`);
    
    // Find messages scheduled for delivery that are due
    const scheduledMessages = await Message.find({
      scheduledFor: { $lte: now, $ne: null }
    })
      .populate("sender", "name pic")
      .populate("chat")
      .populate({
        path: "chat.users",
        select: "name pic email",
      });

    console.log(`Found ${scheduledMessages.length} scheduled messages to deliver`);
    
    for (const message of scheduledMessages) {
      console.log(`Processing scheduled message: ${message._id}, scheduled for: ${message.scheduledFor}`);
      
      try {
        // Update the message to mark it as delivered
        const updatedMessage = await Message.findByIdAndUpdate(
          message._id,
          { scheduledFor: null },
          { new: true }
        );
        
        console.log(`Updated message scheduled status: ${updatedMessage._id}`);

        // Update the latest message in the chat
        await Chat.findByIdAndUpdate(
          message.chat._id, 
          { latestMessage: message }
        );

        console.log(`Emitting message to chat users: ${message.chat._id}`);
        
        // Emit the message to all users in the chat
        if (message.chat.users) {
          message.chat.users.forEach((user) => {
            if (user._id == message.sender._id) return;
            console.log(`Emitting message to user: ${user._id}`);
            io.in(user._id).emit("message recieved", message);
          });
        }
      } catch (msgError) {
        console.error(`Error processing individual message ${message._id}:`, msgError);
      }
    }

  } catch (error) {
    console.error("Error processing scheduled messages:", error);
  }
};

// Check for scheduled messages more frequently (every 10 seconds)
setInterval(checkScheduledMessages, 10000);

// Run once at startup to process any pending scheduled messages
setTimeout(checkScheduledMessages, 5000);
