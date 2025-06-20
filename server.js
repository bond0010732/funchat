const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { Expo } = require('expo-server-sdk');
const ChatModel = require("./models/ChatModel");
const OdinCircledbModel = require("./models/odincircledb");
const Device = require('./models/Device');
const ChatsFriends = require('./models/ChatsFriends');
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const expo = new Expo();

const rooms = {};
const messages = {};
const unreadMessages = {};

const mongoUsername = process.env.MONGO_USERNAME;
const mongoPassword = process.env.MONGO_PASSWORD;
const mongoDatabase = process.env.MONGO_DATABASE;
const mongoCluster = process.env.MONGO_CLUSTER;

const uri = `mongodb+srv://${mongoUsername}:${mongoPassword}@${mongoCluster}.kbgr5.mongodb.net/${mongoDatabase}?retryWrites=true&w=majority`;


// MongoDB Connection
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));

    // ✅ Message Schema
const chatMessageSchema = new mongoose.Schema({
  text: String,
  senderId: String,
  receiverId: String,
  roomId: String,
  timestamp: { type: Date, default: Date.now },
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// ✅ REST endpoint to get message history
app.get('/api/messages/:roomId', async (req, res) => {
  try {
    const messages = await ChatMessage.find({ roomId: req.params.roomId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Initialize Socket.IO
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);


    socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room ${roomId}`);
  });

   socket.on('sendMessage', async ({ roomId, msg }) => {
    try {
      // Save message to MongoDB
      const savedMsg = await ChatMessage.create({
        text: msg.text,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        roomId,
      });

      // Emit to clients in room
      io.to(roomId).emit('newMessage', savedMsg);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

    // socket.on('joinRoom', ({ roomId, userId }) => {
    //     socket.join(roomId);
    //     console.log(`User ${userId} joined room ${roomId} with socket ID: ${socket.id}`);

    //     if (!rooms[roomId]) rooms[roomId] = [];
    //     rooms[roomId].push(socket.id);

    //     io.to(roomId).emit('userJoined', { userId });
    //     socket.emit('currentUsersInRoom', rooms[roomId]);

    //     if (messages[roomId]) {
    //         socket.emit('previousMessages', messages[roomId]);
    //     }
    // });

    // socket.on('send_message', async (messageData) => {
    //     const { roomId, message, senderFullName, author, senderImage, recipientId } = messageData;

    //     const messageWithId = {
    //         ...messageData,
    //         id: Date.now(),
    //         delivered: false,
    //         isRead: false,
    //     };

    //     if (!rooms[roomId]) rooms[roomId] = [];
    //     if (!messages[roomId]) messages[roomId] = [];
    //     messages[roomId].push(messageWithId);

    //     try {
    //         const newMessage = new ChatModel(messageWithId);
    //         await newMessage.save();
    //     } catch (error) {
    //         console.error('Error saving message to database:', error);
    //     }

    //     io.to(roomId).emit('receive_message', messageWithId);

    //     if (!rooms[roomId].includes(recipientId)) {
    //         try {
    //             const recipientDevice = await Device.findOne({ 'users._id': recipientId });
    //             if (recipientDevice?.expoPushToken) {
    //                 await sendPushNotification(
    //                     recipientDevice.expoPushToken,
    //                     author,
    //                     message,
    //                     senderFullName
    //                 );
    //             }
    //         } catch (error) {
    //             console.error("Error retrieving recipient's push token:", error);
    //         }

    //         try {
    //             const existingUnreadMessage = await ChatsFriends.findOne({
    //                 recipientId,
    //                 author,
    //                 messageId: messageWithId.id,
    //             });

    //             if (existingUnreadMessage) {
    //                 existingUnreadMessage.unreadCount += 1;
    //                 await existingUnreadMessage.save();
    //             } else {
    //                 const unreadMessage = new ChatsFriends({
    //                     recipientId,
    //                     senderFullName,
    //                     author,
    //                     senderImage,
    //                     messageId: messageWithId.id,
    //                     unreadCount: 1,
    //                 });
    //                 await unreadMessage.save();
    //             }

    //             io.to(recipientId).emit('unreadMessages', {
    //                 senderFullName,
    //                 author,
    //                 senderImage,
    //                 unreadCount: 1,
    //                 messageId: messageWithId.id,
    //             });
    //         } catch (error) {
    //             console.error('Error saving unread message:', error);
    //         }
    //     }
    // });

    // socket.on('typing', ({ roomId, userId, typing, fullName }) => {
    //     io.to(roomId).emit('typing', { userId, typing, fullName });
    // });

    // socket.on('join_room', (roomId) => {
    //     if (!rooms[roomId]) rooms[roomId] = [];
    //     rooms[roomId].push(socket.id);
    //     socket.join(roomId);
    //     console.log(`Socket ${socket.id} joined room ${roomId}`);
    // });

    // socket.on('leaveRoom', ({ roomId, userId }) => {
    //     if (rooms[roomId]) {
    //         rooms[roomId] = rooms[roomId].filter(id => id !== userId);
    //         socket.to(roomId).emit('userLeft', userId);
    //         console.log(`User ${userId} left room ${roomId}`);

    //         if (rooms[roomId].length === 0) {
    //             delete rooms[roomId];
    //             console.log(`Room ${roomId} is now empty and removed`);
    //         }
    //     }
    // });

    // socket.on('disconnect', () => {
    //     console.log('User disconnected:', socket.id);
    // });
});

// Push Notification Function
// async function sendPushNotification(expoPushToken, author, message, senderFullName) {
//     try {
//         if (!Expo.isExpoPushToken(expoPushToken)) {
//             console.error(`Invalid Expo push token: ${expoPushToken}`);
//             return;
//         }

//         const messages = [{
//             to: expoPushToken,
//             sound: "default",
//             title: `New message from ${senderFullName}`,
//             body: message,
//             data: { message, author },
//         }];

//         const chunks = expo.chunkPushNotifications(messages);
//         for (let chunk of chunks) {
//             try {
//                 await expo.sendPushNotificationsAsync(chunk);
//             } catch (error) {
//                 console.error("Error sending push notification chunk:", error);
//             }
//         }
//     } catch (error) {
//         console.error("Error sending push notification:", error);
//     }
// }

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
