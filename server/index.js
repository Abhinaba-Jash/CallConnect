// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// require("dotenv").config();
// const path = require("path");
// const authRoutes = require("./routes/auth");
// const dashboardRoutes = require('./routes/dashboard');

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json());

// // Routes
// app.use("/api/auth", authRoutes);
// app.use("/api/dashboard", dashboardRoutes);
// async function connectDB() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/callconnect");
//     console.log("MongoDB connected");
//   } catch (error) {
//     console.error("MongoDB connection error:", error);
//   }
// }

// connectDB();
// app.get('/', (req, res) => {
//   res.redirect('/api/auth/login');
// });
// app.get('/api/auth/login', (req, res) => {
//   res.sendFile(path.join(__dirname,"../client/pages/login.html"));
// });
// // Start the server
// app.listen(PORT, () => {
//   console.log(`Express server listening at http://localhost:${PORT}`);
// });

const express = require("express");
const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { Server } = require("socket.io");
require("dotenv").config();
const router = express.Router();
const CallHistory = require("./models/CallHistory"); // ✅ import
const Notification = require("./models/Notification");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const callRouter = require("./routes/callRouter");
const chatRouter = require("./routes/chatRouter");
const verifyRouter = require("./routes/verify");
const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "your_secret_key_here";
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json());
// 📂 Static files from client/
app.use(express.static(path.join(__dirname, "../client")));

// Use routers
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/call", callRouter);
app.use("/api/chat", chatRouter);
app.use("/api/verify", verifyRouter);

// 🔗 MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// 🧩 Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔽 Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/pages/redirection.html"));
});

app.get("/api/verify", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/pages/verify.html"));
});

app.get("/api/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/pages/dashboard.html"));
});

app.get("/api/auth/login", async (req, res) => {
  res.sendFile(path.join(__dirname, "../client/pages/login.html"));
});
app.get("/api/auth/register", async (req, res) => {
  res.sendFile(path.join(__dirname, "../client/pages/register.html"));
});
app.get("/api/auth/register", async (req, res) => {
  res.sendFile(path.join(__dirname, "../client/pages/register.html"));
});
app.use((req, res) => {
  res.status(404).send("404 - Page not found");
});

const connectedUsers = new Map(); 
const userSocketMap = {};
io.on("connection", (socket) => {
  // Register user
  socket.on("register", async ({ userId, currentUserId }) => {
    const decoded = jwt.verify(userId, SECRET);

    if (decoded.userId !== currentUserId) {
      throw new Error("Invalid userId in token.");
    }
    connectedUsers.set(currentUserId, socket.id);
    userSocketMap[currentUserId] = socket.id;
    socket.userId = currentUserId;
    // Deliver missed notifications
    const missed = await Notification.find({
      toUserId: currentUserId,
      isRead: false,
    });
    missed.forEach((n) => {
      io.to(socket.id).emit("incoming_notification", {
        type: n.type,
        fromUserId: n.fromUserId,
        fromUsername: n.fromUsername,
      });
    });

    await Notification.updateMany(
      { toUserId: currentUserId, isRead: false },
      { isRead: true }
    );
  });

  // Caller initiates a call to target user
  socket.on("initiate-call", ({ toUserId }) => {
    const targetSocketId = connectedUsers.get(toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("user-joined", { socketId: socket.id });
    } else {
      console.log(`User ${toUserId} not online`);
    }
  });

  // Offer relay
  socket.on("offer", ({ to, offer, from }) => {
    io.to(to).emit("offer", { offer, from });
  });

  // Answer relay
  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { answer });
  });

  // ICE candidate relay
  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { candidate });
  });
  socket.on("call-ended", async ({from, to, callType }) => {
    const targetSocketId = userSocketMap[to];
    const callerId = socket.userId;
    const calleeId = to;

    // Inform the callee (if online)
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-ended");
    }

    // Save call history to DB
    try {
      await CallHistory.create({
        uid: from,
        callerId,
        calleeId,
        callType, 
        status: "completed",
        startedAt: new Date(Date.now() - 5 * 60 * 1000),
        endedAt: new Date(),
      });
      await CallHistory.create({
        uid: to,
        callerId,
        calleeId,
        callType,
        status: "completed",
        startedAt: new Date(Date.now() - 5 * 60 * 1000),
        endedAt: new Date(),
      });
      console.log("📁 Call history saved successfully");
    } catch (err) {
      console.error("❌ Failed to save call history:", err.message);
    }
  });
  // Handle sending message
  socket.on("private_message", ({ from, to, message }) => {
    const targetSocketId = connectedUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("private_message", {
        from,
        message,
      });
    }
  });
  // Send or store a notification
  socket.on(
    "notify_user",
    async ({ type, fromUserId, toUserId, fromUsername }) => {
      const targetSocketId = connectedUsers.get(toUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("incoming_notification", {
          type,
          fromUserId,
          fromUsername,
        });
      } else {
        await Notification.create({
          type,
          fromUserId,
          toUserId,
          fromUsername,
        });
      }
    }
  );
  // Cleanup on disconnect
  socket.on("disconnect", () => {
    for (const userId in userSocketMap) {
      if (userSocketMap[userId] === socket.id) {
        delete userSocketMap[userId];
        break;
      }
    }
  });
});

// 🚀 Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
