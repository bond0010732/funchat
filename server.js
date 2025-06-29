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

//const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const rooms = {};
const messages = {};
const unreadMessages = {};

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

// const videoStorage = new CloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: 'chat_videos',
//     resource_type: 'video',
//     format: 'mp4',
//   },
// });


// Multer setup (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });
const videoUpload = multer({ storage });

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
  imageUrl: String, // ✅ New field for image
  gifUrl: { type: String },
  videoUrl: { type: String },
  senderId: String,
  receiverId: String,
  roomId: String,
  timestamp: { type: Date, default: Date.now },

  // ✅ Status tracking
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  readAt: Date
});


const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

const onlineUsers = new Map(); // userId -> socketId

// app.get('/api/messages/:roomId', async (req, res) => {
//   const { roomId } = req.params;

//   try {
//     const messages = await ChatMessage.find({ roomId }).sort({ timestamp: 1 }).limit(50);
//     res.json(messages);
//   } catch (err) {
//     console.error('Error fetching messages:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

app.post('/api/upload/video', videoUpload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No video uploaded' });

  const stream = cloudinary.uploader.upload_stream(
    {
      resource_type: 'video',
      folder: 'chat_videos',
    },
    (error, result) => {
      if (error) {
        console.error('❌ Cloudinary upload failed:', error);
        return res.status(500).json({ error: 'Cloudinary upload failed' });
      }

      res.json({ videoUrl: result.secure_url });
    }
  );

  stream.end(req.file.buffer);
});


app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No image file received' });
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: 'chat_images' }, // Optional: put in a folder
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload failed:', error);
          return res.status(500).json({ error: 'Cloudinary upload failed' });
        }

        return res.json({ imageUrl: result.secure_url });
      }
    );

    stream.end(req.file.buffer);
  } catch (err) {
    console.error('❌ Upload route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/messages/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const { before, limit = 50 } = req.query;

  try {
    const query = { roomId };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await ChatMessage.find(query)
      .sort({ timestamp: -1 }) // latest first
      .limit(parseInt(limit));

    // Send oldest → newest
    res.json(messages.reverse());
  } catch (err) {
    console.error('❌ Error fetching messages:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Initialize Socket.IO
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

  socket.on('joinRoom', ({ roomId, userId }) => {
  socket.userId = userId; // Attach to socket
  socket.join(roomId);
  console.log(`✅ ${userId} joined room ${roomId}`);
});

socket.on('leaveRoom', ({ roomId, userId }) => {
  socket.leave(roomId);
  console.log(`${userId} left room ${roomId}`);

  // Remove from online users if you're using room-level presence
  onlineUsers.delete(userId); // ✅ optional: if room defines "online"

  // Notify others
  socket.broadcast.emit('user-offline', userId);
});



socket.on('register-user', (userId) => {
  socket.userId = userId; // Attach userId to the socket
  onlineUsers.set(userId, socket.id);
  console.log(`${userId} is now online`);

  // Notify others
  socket.broadcast.emit('user-online', userId);
});


  socket.on('sendMessage', async ({ roomId, msg }) => {
  try {
    if (!msg) {
      console.error('❌ Invalid message payload: msg is missing');
      return;
    }

    // Save the message
    const savedMsg = await ChatMessage.create({
      text: msg.text || '',
      imageUrl: msg.imageUrl || '',
      gifUrl: msg.gifUrl,
      videoUrl: msg.videoUrl,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      roomId,
      status: 'sent',
    });

    // Emit to room
    io.to(roomId).emit('newMessage', savedMsg);

    // Handle delivery
    const receiverSocketId = onlineUsers.get(msg.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('message-delivered', savedMsg._id);
      await ChatMessage.findByIdAndUpdate(savedMsg._id, { status: 'delivered' });
    }

    // 🔔 Fetch receiver's push token
    const receiverUser = await User.findById(msg.receiverId);
    const senderUser = await User.findById(msg.senderId); // for full name

    if (receiverUser?.expoPushToken) {
      await sendPushNotification(
        receiverUser.expoPushToken,
        msg.text || 'You have a new message',
        msg.text || '[Media Message]',
        senderUser?.fullName || 'Someone'
      );
    }

  } catch (err) {
    console.error('❌ Error saving message:', err.message);
  }
});


//     socket.on('sendMessage', async ({ roomId, msg }) => {
//   try {
//     if (!msg) {
//       console.error('❌ Invalid message payload: msg is missing');
//       return;
//     }

//     const savedMsg = await ChatMessage.create({
//       text: msg.text || '',
//       imageUrl: msg.imageUrl || '',
//       gifUrl: msg.gifUrl,
//       videoUrl: msg.videoUrl,
//       senderId: msg.senderId,
//       receiverId: msg.receiverId,
//       roomId,
//       status: 'sent',
//     });

//     io.to(roomId).emit('newMessage', savedMsg);

//     const receiverSocketId = onlineUsers.get(msg.receiverId);
//     if (receiverSocketId) {
//       io.to(receiverSocketId).emit('message-delivered', savedMsg._id);
//       await ChatMessage.findByIdAndUpdate(savedMsg._id, { status: 'delivered' });
//     }
//   } catch (err) {
//     console.error('❌ Error saving message:', err.message);
//   }
// });


  
//     socket.on('sendMessage', async ({ roomId, msg }) => {
//   try {
//     const savedMsg = await ChatMessage.create({
//       text: msg.text,
//       imageUrl:  msg.imageUrl,
//       senderId: msg.senderId,
//       receiverId: msg.receiverId,
//       roomId,
//       status: 'sent'
//     });

//     // Emit to everyone in room (both users should have joined)
//     io.to(roomId).emit('newMessage', savedMsg);

//     // If receiver is online (optional)
//     const receiverSocketId = onlineUsers.get(msg.receiverId);
//     if (receiverSocketId) {
//       io.to(receiverSocketId).emit('message-delivered', savedMsg._id);

//       await ChatMessage.findByIdAndUpdate(savedMsg._id, {
//         status: 'delivered'
//       });
//     }

//   } catch (err) {
//     console.error('❌ Error saving message:', err.message);
//   }
// });



socket.on('markAsRead', async ({ roomId, userId }) => {
  try {
    const result = await ChatMessage.updateMany(
      {
        roomId,
        receiverId: userId,      // sent to me
        status: { $ne: 'read' },
      },
      {
        status: 'read',
        readAt: new Date(),
      }
    );

    io.to(roomId).emit('messages-read', { userId });

  } catch (err) {
    console.error('❌ Error marking messages as read:', err);
  }
});


    // On connection
// socket.on('check-online', (userId) => {
//   const isUserOnline = onlineUsers.includes(userId); // however you track this
//   socket.emit('user-online-status', isUserOnline);
// });
     // Handle online check

socket.on('check-online', (receiverId) => {
  const isOnline = onlineUsers.has(receiverId);
  socket.emit('user-online-status', { userId: receiverId, isOnline });
});

// When user starts typing
// Example: user A is typing to user B
socket.on('typing', ({ to, from }) => {
  const toSocket = onlineUsers.get(to);
  if (toSocket) {
    io.to(toSocket).emit('typing', from); // send sender userId
  }
});

socket.on('stop-typing', ({ to, from }) => {
  const toSocket = onlineUsers.get(to);
  if (toSocket) {
    io.to(toSocket).emit('stop-typing', from);
  }
});


  socket.on('logout-user', userId => {
  onlineUsers.delete(userId);
  console.log(`${userId} logged out manually`);

  // ✅ Emit offline event too
  socket.broadcast.emit('user-offline', userId);
});


  socket.on('disconnect', () => {
  if (socket.userId) {
    console.log(`⚠️ ${socket.userId} disconnected`);
    socket.broadcast.emit('user-offline', socket.userId);
  }
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
async function sendPushNotification(expoPushToken, author, message, senderFullName) {
    try {
        if (!Expo.isExpoPushToken(expoPushToken)) {
            console.error(`Invalid Expo push token: ${expoPushToken}`);
            return;
        }

        const messages = [{
            to: expoPushToken,
            sound: "default",
            title: `New message from ${senderFullName}`,
            body: message,
            data: { message, author },
        }];

        const chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
            try {
                await expo.sendPushNotificationsAsync(chunk);
            } catch (error) {
                console.error("Error sending push notification chunk:", error);
            }
        }
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
