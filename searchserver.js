const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors()); // Allow connections from your React Native app

const server = http.createServer(app);

const SearchSocketIo = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Replace with your frontend's URL if needed
      methods: ["GET", "POST"],
    },
  });

  const onlineUsers = new Set();
  const userSocketMap = new Map();

  io.on("connection", (socket) => {
    console.log(`🔵 New user connected: ${socket.id}`);

    // Send the current online users list to the newly connected user
    socket.emit("onlineUsers", Array.from(onlineUsers));
    console.log(`📤 Sent online users list to ${socket.id}:`, Array.from(onlineUsers));

    socket.on("setUserId", (userId) => {
      onlineUsers.add(userId);
      userSocketMap.set(socket.id, userId);
      console.log(`✅ User set ID: ${userId} (Socket: ${socket.id})`);
      
      // Notify all clients about the new user
      io.emit("userConnected", { userId });
      console.log(`📢 Broadcast: User ${userId} connected.`);
    });

    socket.on("getOnlineUsers", () => {
      socket.emit("onlineUsers", Array.from(onlineUsers));
      console.log(`📤 Sent online users list to ${socket.id}:`, Array.from(onlineUsers));
    });

    socket.on("disconnect", () => {
      const disconnectedUserId = userSocketMap.get(socket.id);
      if (disconnectedUserId) {
        onlineUsers.delete(disconnectedUserId);
        userSocketMap.delete(socket.id);
        console.log(`❌ User disconnected: ${disconnectedUserId} (Socket: ${socket.id})`);
        
        // Notify all clients about the user disconnection
        io.emit("userDisconnected", { userId: disconnectedUserId });
        console.log(`📢 Broadcast: User ${disconnectedUserId} disconnected.`);
      } else {
        console.log(`⚠️ Unknown user disconnected: ${socket.id}`);
      }
    });
  });

  return io;
};

// Initialize Socket.IO with the server
const io = SearchSocketIo(server);

server.listen(3001, () => {
  console.log("🚀 Socket.io server running on port 3001");
});
