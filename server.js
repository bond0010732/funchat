const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { Expo } = require('expo-server-sdk');
const ChatModel = require("./models/ChatModel");
const OdinCircledbModel = require("./models/odincircledb");
const Device = require('./models/Device');
const ChatsFriends = require('./models/ChatsFriends');
const blockedUser = require('./models/BlockedModel')
const reportUser = require('./models/ReportModel')
require("dotenv").config();

const app = express();
app.use(express.json());
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


app.get('/api/messages/status', async (req, res) => {
  const { roomId, userId } = req.query;

  if (!roomId || !userId) {
    return res.status(400).json({ error: 'roomId and userId are required' });
  }

  try {
    const senderId = new mongoose.Types.ObjectId(userId);
    console.log(`🔍 Polling message statuses for senderId ${senderId} in room ${roomId}`);

    const updatedMessages = await ChatMessage.find({
      roomId,
      senderId, // ✅ Corrected field name
      status: { $in: ['delivered', 'read'] },
    });

    console.log(`✅ Found ${updatedMessages.length} message(s) with updated status for user ${userId}`);
    res.json(updatedMessages);
  } catch (err) {
    console.error('❌ Polling status error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// POST /api/block
app.post('/block', async (req, res) => {
  const { blockerId, blockedId } = req.body;

  console.log(`🔒 Block request: blockerId=${blockerId}, blockedId=${blockedId}`);

  try {
    const exists = await blockedUser.findOne({ blocker: blockerId, blocked: blockedId });

    if (exists) {
      console.log(`⚠️ User ${blockedId} is already blocked by ${blockerId}`);
      return res.status(400).json({ error: 'Already blocked' });
    }

    await blockedUser.create({ blocker: blockerId, blocked: blockedId });
    console.log(`✅ User ${blockedId} blocked by ${blockerId}`);

    res.json({ message: 'User blocked successfully' });
  } catch (err) {
    console.error(`❌ Error blocking user ${blockedId} by ${blockerId}:`, err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});


// POST /api/unblock
app.post('/unblock', async (req, res) => {
  const { blockerId, blockedId } = req.body;

  try {
    const result = await blockedUser.deleteOne({ blocker: blockerId, blocked: blockedId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User is not currently blocked' });
    }

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});


// GET /api/block/list?userId=abc
app.get('/list', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const blocks = await blockedUser.find({ blocker: userId });
  const blockedUserIds = blocks.map(b => b.blocked.toString());

  res.json({ blockedUserIds });
});


// GET /api/block/status?blockerId=abc&blockedId=xyz
app.get('/status', async (req, res) => {
  const { blockerId, blockedId } = req.query;

  if (!blockerId || !blockedId) return res.status(400).json({ error: 'Missing params' });

  const isBlocked = await blockedUser.findOne({ blocker: blockerId, blocked: blockedId });
  res.json({ blocked: !!isBlocked });
});



// POST /api/report
app.post('/report', async (req, res) => {
  const { reporterId, reportedId, reason } = req.body;

  try {
    await reportUser.create({ reporter: reporterId, reported: reportedId, reason });
    res.json({ message: 'User reported successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to report user' });
  }
});

// GET /api/blocked?userId=xxx&otherUserId=yyy
app.get('/blocked', async (req, res) => {
  const { userId, otherUserId } = req.query;

  const isBlocked = await blockedUser.findOne({
    blocker: userId,
    blocked: otherUserId,
  });

  res.json({ isBlocked: !!isBlocked });
});



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


// app.get('/api/messages/:roomId', async (req, res) => {
//   const { roomId } = req.params;
//   const { before, limit = 50 } = req.query;

//   try {
//     const query = { roomId };

//     if (before) {
//       query.timestamp = { $lt: new Date(before) };
//     }

//     const messages = await ChatMessage.find(query)
//       .sort({ timestamp: -1 }) // latest first
//       .limit(parseInt(limit));

//     // Send oldest → newest
//     res.json(messages.reverse());
//   } catch (err) {
//     console.error('❌ Error fetching messages:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

app.get('/api/messages/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const { before, limit = 50, currentUserId } = req.query;

  try {
    const query = { roomId };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await ChatMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    const deliveredMessages = [];

    for (const msg of messages) {
      // ✅ Only update if current user is the receiver
      if (
        msg.receiverId?.toString() === currentUserId &&
        msg.status === 'sent'
      ) {
        msg.status = 'delivered';
        await msg.save();
        deliveredMessages.push(msg._id);

        // ✅ Notify sender that message was delivered
        const senderSocket = onlineUsers.get(msg.senderId?.toString());
        if (senderSocket) {
          io.to(senderSocket).emit('message-delivered', {
            messageId: msg._id,
            roomId: msg.roomId,
          });
        }
      }
    }

    res.json(messages.reverse()); // Send oldest → newest
  } catch (err) {
    console.error('❌ Error fetching messages:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// app.get('/api/messages/status', async (req, res) => {
//   const { roomId, userId } = req.query;

//   if (!roomId || !userId) {
//     return res.status(400).json({ error: 'roomId and userId are required' });
//   }

//   try {
//     // Step 1: Find all messages that were sent to this user but not yet marked as delivered or read
//     const undeliveredMessages = await ChatMessage.find({
//       roomId,
//       receiverId: userId,
//       status: 'sent', // only those still in 'sent' state
//     }).select('_id senderId');

//     if (undeliveredMessages.length === 0) {
//       return res.status(200).json({ updated: 0 });
//     }

//     const messageIds = undeliveredMessages.map((msg) => msg._id);
//     const senderIds = [...new Set(undeliveredMessages.map((msg) => msg.senderId.toString()))];

//     // Step 2: Update messages to "delivered"
//     const result = await ChatMessage.updateMany(
//       { _id: { $in: messageIds } },
//       { status: 'delivered' }
//     );

//     // Step 3: Notify sender(s) that their message was delivered
//     for (const senderId of senderIds) {
//       const socketId = onlineUsers.get(senderId);
//       if (socketId) {
//         io.to(socketId).emit('message-status-updated', {
//           messageIds,
//           status: 'delivered',
//         });
//       }
//     }

//     return res.status(200).json({ updated: result.modifiedCount });
//   } catch (err) {
//     console.error('❌ Error in /api/messages/status:', err);
//     return res.status(500).json({ error: 'Internal server error' });
//   }
// });









// Initialize Socket.IO
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

  socket.on('register-user', (userId) => {
  if (!userId) {
    console.log('⚠️ register-user: No userId provided');
    return;
  }

  // Check if user is already registered with another socket
  const existingSocket = onlineUsers.get(userId);
  if (existingSocket && existingSocket !== socket.id) {
    console.log(`♻️ Updating socket for user ${userId}: ${existingSocket} → ${socket.id}`);
  } else if (existingSocket === socket.id) {
    console.log(`🔁 Duplicate registration attempt for user ${userId} with same socket: ${socket.id}`);
  }

  // ✅ Save userId → socket.id
  onlineUsers.set(userId, socket.id);
  socket.userId = userId;

  console.log(`✅ Registered user ${userId} with socket ${socket.id}`);

  // ✅ Notify others this user is online
  socket.broadcast.emit('user-online', userId);
});


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



// socket.on('register-user', async (userId) => {
//   socket.userId = userId;
//   onlineUsers.set(userId, socket.id);
//   console.log(`${userId} is now online`);

//   // Notify others
//   socket.broadcast.emit('user-online', userId);

//   // Check if there are undelivered messages for this user (user is receiver)
//   const undeliveredMessages = await ChatMessage.find({
//     receiver: userId,
//     delivered: false
//   });

//   if (undeliveredMessages.length > 0) {
//     // Send them to the user (if needed)
//     socket.emit('undelivered-messages', undeliveredMessages);

//     // Mark messages as delivered
//     await ChatMessage.updateMany(
//       { receiver: userId, delivered: false },
//       { $set: { delivered: true, deliveredAt: new Date() } }
//     );

//     // Send 'message-delivered' event to senders
//     undeliveredMessages.forEach((msg) => {
//       const senderSocketId = onlineUsers.get(msg.sender.toString());
//       if (senderSocketId) {
//         io.to(senderSocketId).emit('message-delivered', msg._id);
//       }
//     });
//   }
// });



socket.on('sendMessage', async ({ roomId, msg }) => {
  try {
    if (!msg) {
      console.error('❌ Invalid message payload: msg is missing');
      return;
    }

    // Save message to DB
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

    // Check if receiver is online
    const receiverSocketId = onlineUsers.get(msg.receiverId);

    if (receiverSocketId) {
      // ✅ Receiver is online -> deliver and update status
      //io.to(receiverSocketId).emit('message-delivered', savedMsg._id);
       io.to(receiverSocketId).emit('message-received', savedMsg); // optional event
      // await ChatMessage.findByIdAndUpdate(savedMsg._id, { status: 'delivered' });
    } else {
      // ❌ Receiver is offline -> send push notification
      const receiverUser = await OdinCircledbModel.findById(msg.receiverId);
      const senderUser = await OdinCircledbModel.findById(msg.senderId);

      if (receiverUser?.expoPushToken) {
        await sendPushNotification(
          receiverUser.expoPushToken,
          msg.text || '[Media Message]',
          senderUser?.fullName || 'Someone'
        );
      }
    }
  } catch (err) {
    console.error('❌ Error saving message:', err.message);
  }
});


socket.on('message-delivered', async ({ messageId }) => {
  await ChatMessage.findByIdAndUpdate(messageId, { status: 'delivered', deliveredAt: Date.now() });
});

  // Server updates all relevant messages
socket.on('mark-as-read', async ({ roomId, userId }) => {
  await ChatMessage.updateMany(
    { roomId, receiverId: userId, status: { $ne: 'read' } },
    { status: 'read', seenAt: Date.now() }
  );
});
  


// socket.on('markAsRead', async ({ roomId, userId }) => {
//   try {
//     const result = await ChatMessage.updateMany(
//       {
//         roomId,
//         receiverId: userId, // ✅ fixed field name
//         status: { $ne: 'read' },
//       },
//       {
//         status: 'read',
//         readAt: new Date(),
//       }
//     );

//     if (result.modifiedCount > 0) {
//       io.to(roomId).emit('messages-read', { userId });
//       console.log(`✅ Marked ${result.modifiedCount} messages as read by user ${userId}`);
//     }
//   } catch (err) {
//     console.error('❌ Error marking messages as read:', err);
//   }
// });


//   socket.on('mark-messages-delivered', async ({ from, to }) => {
//   try {
//     const result = await ChatMessage.updateMany(
//       {
//         senderId: from, // original sender
//         receiverId: to,
//         status: 'sent',
//       },
//       {
//         status: 'delivered',
//         deliveredAt: new Date(),
//       }
//     );

//     if (result.modifiedCount > 0) {
//       const deliveredMessages = await ChatMessage.find({
//         senderId: from,
//         receiverId: to,
//         status: 'delivered',
//       }).select('_id');

//       const messageIds = deliveredMessages.map((msg) => msg._id);

//       // 🔥 Send real-time update to the sender
//       io.to(from).emit('message-status-updated', {
//         messageIds,
//         status: 'delivered',
//       });

//       console.log(`✅ Marked ${result.modifiedCount} messages as delivered`);
//     }
//   } catch (err) {
//     console.error('❌ Error marking messages as delivered:', err);
//   }
// });



// socket.on('markAsRead', async ({ roomId, userId }) => {
//   try {
//     console.log(`📩 markAsRead triggered for room: ${roomId}, user: ${userId}`);

//     // ✅ Only mark messages that have been delivered (not just sent)
//     const unreadMessages = await ChatMessage.find({
//       roomId,
//       receiverId: userId,
//       status: 'delivered', // ✅ Only mark delivered messages as read
//     }).select('_id senderId');

//     if (unreadMessages.length === 0) {
//       console.log('📭 No delivered messages to mark as read.');
//       return;
//     }

//     const messageIds = unreadMessages.map((msg) => msg._id);
//     const senderIds = [...new Set(unreadMessages.map((msg) => msg.senderId.toString()))];

//     console.log(`🧾 Marking ${messageIds.length} messages as read.`);

//     // ✅ Step 2: Mark them as read
//     const result = await ChatMessage.updateMany(
//       { _id: { $in: messageIds } },
//       {
//         status: 'read',
//         readAt: new Date(),
//       }
//     );

//     // ✅ Step 3: Notify each sender
//     for (const senderId of senderIds) {
//       io.to(senderId).emit('message-status-updated', {
//         messageIds,
//         status: 'read',
//       });
//       console.log(`📤 Emitted 'message-status-updated' to sender: ${senderId}`);
//     }

//     console.log(`✅ Marked ${result.modifiedCount} messages as read`);

//   } catch (err) {
//     console.error('❌ Error marking messages as read:', err);
//   }
// });




    // On connection
// socket.on('check-online', (userId) => {
//   const isUserOnline = onlineUsers.includes(userId); // however you track this
//   socket.emit('user-online-status', isUserOnline);
// });
     // Handle online check

socket.on('check-online', (receiverId) => {
  const isOnline = onlineUsers.has(receiverId);
  console.log(`🧠 [Server] ${receiverId} is ${isOnline ? '🟢 online' : '🔴 offline'}`);
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
    onlineUsers.delete(socket.userId);
    console.log(`${socket.userId} is now offline`);
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
async function sendPushNotification(expoPushToken, message, senderFullName) {
  try {
    console.log("🔔 Preparing to send notification...");
    console.log("Expo Push Token:", expoPushToken);
    console.log("Message Body:", message);
    console.log("Sender Name:", senderFullName);

    // Validate token
    if (!Expo.isExpoPushToken(expoPushToken)) {
      console.error(`❌ Invalid Expo push token: ${expoPushToken}`);
      return;
    }

    const messages = [{
      to: expoPushToken,
      sound: "default",
      title: `New message from ${senderFullName}`,
      body: message,
      data: { message, senderFullName },
    }];

    console.log("📦 Messages to send:", messages);

    const chunks = expo.chunkPushNotifications(messages);
    console.log(`🔹 Split into ${chunks.length} chunk(s).`);

    for (const [index, chunk] of chunks.entries()) {
      try {
        console.log(`🚀 Sending chunk ${index + 1}:`, chunk);
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        console.log(`✅ Chunk ${index + 1} receipts:`, receipts);
      } catch (chunkError) {
        console.error(`❌ Error sending push notification chunk ${index + 1}:`, chunkError);
      }
    }

  } catch (error) {
    console.error("❌ Error sending push notification:", error);
  }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
