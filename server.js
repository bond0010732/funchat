const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { Expo } = require('expo-server-sdk');
const ChatModel = require("./models/ChatModel");
const OdinCircledbModel = require("./models/odincircledb");
const Device = require('./models/Device');
const AddTimeLog = require('./models/AddTimeLog');
const AddFeature = require('./models/AddFeature');
const ChatsFriends = require('./models/ChatsFriends');
const blockedUser = require('./models/BlockedModel')
const UnlockAccess = require("./models/UnlockAccessModel");
const reportUser = require('./models/ReportModel')
require("dotenv").config();

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = socketIo(server);
const expo = new Expo();

const apn = require("apn");

// APNs provider setup (p12-based)
const apnProvider = new apn.Provider({
  cert: "publicnew_cert.pem",         // Apple-issued certificate
  key: "privatenew_keys.pem",
  production: true,              // set true for TestFlight / App Store builds
});


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


// Express route example
app.post('/register-device', async (req, res) => {
  const { token, userId } = req.body;

  // Check if token and userId are not null
  if (!token || !userId) {
    return res.status(400).json({ success: false, message: 'token and userId are required' });
  }

  try {
    let device = await Device.findOne({ token });

    if (!device) {
      // If no document found, log that a new device is being created
      console.log('No existing device found, creating a new one.');
      device = new Device({
        token,
        users: [{ _id: userId }], // Initialize with the first user
      });
    } else {
      // Ensure device.users is not null or undefined
      if (device.users && !device.users.some(user => user._id?.toString() === userId.toString())) {
        device.users.push({ _id: userId }); // Add new userId if not already present
      }
    }

    await device.save();
    res.status(200).json({ success: true, message: 'User and token saved successfully' });
  } catch (error) {
    console.error('Error saving token:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

const saveDevice = async (token, userId) => {
  try {
    let device = await Device.findOne({ token });

    if (!device) {
      console.log('No existing device found, creating a new one.');
      device = new Device({
        token,
        users: [{ _id: userId }],
      });
    } else {
      if (device.users && !device.users.some(user => user._id.toString() === userId.toString())) {
        device.users.push({ _id: userId });
      }
    }

    await device.save();
    return true;
  } catch (error) {
    console.error('Error saving token:', error);
    return false;
  }
};



app.get('/api/usersVisibleTo/:userId', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  
  try {
    const requestingUser = await OdinCircledbModel.findById(req.params.userId)
      .select('unlockedCount');
    
    if (!requestingUser) {
      return res.status(404).json({ message: 'Requesting user not found' });
    }

    const unlockedCount = requestingUser.unlockedCount ?? 10;

    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    // Ensure you don't fetch beyond unlockedCount
    const effectiveLimit = Math.min(
      limitInt, 
      unlockedCount - (pageInt - 1) * limitInt
    );

    const users = await OdinCircledbModel.find({ _id: { $ne: req.params.userId } })
      .select('fullName email image')
      .skip((pageInt - 1) * limitInt)
      .limit(effectiveLimit);

    const hasMore = pageInt * limitInt < unlockedCount;

    // ✅ Add online status here
    const usersWithStatus = users.map(u => ({
      ...u.toObject(),
      isOnline: onlineUsers.has(u._id.toString())
    }));

    res.json({ items: usersWithStatus, hasMore });
  } catch (err) {
    console.error('Error fetching visible users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


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
// app.post('/block', async (req, res) => {
//   console.log('📥 Incoming block request:', req.body);

//   const { blockerId, blockedId } = req.body || {};

//   if (!blockerId || !blockedId) {
//     console.log('❌ Missing blockerId or blockedId');
//     return res.status(400).json({ error: 'Missing blockerId or blockedId' });
//   }

//   try {
//     const exists = await blockedUser.findOne({ blocker: blockerId, blocked: blockedId });
//     if (exists) {
//       return res.status(400).json({ error: 'Already blocked' });
//     }

//     await blockedUser.create({ blocker: blockerId, blocked: blockedId });
//     res.json({ message: 'User blocked successfully' });
//   } catch (err) {
//     console.error('❌ Block failed:', err);
//     res.status(500).json({ error: 'Failed to block user' });
//   }
// });

// POST /api/block
app.post('/block', async (req, res) => {
  console.log('📥 Incoming block request:', req.body);

  const { blockerId, blockedId } = req.body || {};

  if (!blockerId || !blockedId) {
    console.log('❌ Missing blockerId or blockedId');
    return res.status(400).json({ error: 'Missing blockerId or blockedId' });
  }

  try {
    const exists = await blockedUser.findOne({ blocker: blockerId, blocked: blockedId });
    if (exists) {
      return res.status(400).json({ error: 'Already blocked' });
    }

    // Create block
    await blockedUser.create({ blocker: blockerId, blocked: blockedId });

    // 🔒 Remove any unlocks between these two users (block overrides unlock)
    await UnlockAccess.deleteMany({
      $or: [
        { userA: blockerId, userB: blockedId },
        { userA: blockedId, userB: blockerId },
      ],
    });

    res.json({ message: 'User blocked successfully, unlocks removed' });
  } catch (err) {
    console.error('❌ Block failed:', err);
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

    // Note: we do NOT auto-unlock here. Users must pay again if needed.
    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});


// GET /api/block/list?userId=abc
app.get('/block/list', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const blocks = await blockedUser.find({ blocker: userId });
  const blockedUserIds = blocks.map(b => b.blocked.toString());

  res.json({ blockedUserIds });
});


app.get('/block/eitherBlocked', async (req, res) => {
  const { userA, userB } = req.query;

  if (!userA || !userB) {
    return res.status(400).json({ message: 'Missing user IDs' });
  }

  try {
    const isEitherBlocked = await blockedUser.exists({
      $or: [
        { blocker: userA, blocked: userB },
        { blocker: userB, blocked: userA },
      ],
    });

    return res.json({ eitherBlocked: !!isEitherBlocked });
  } catch (err) {
    console.error('Error checking block status:', err);
    return res.status(500).json({ message: 'Server error' });
  }
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


app.get('/check/:userA/:userB', async (req, res) => {
  try {
    const { userA, userB } = req.params;

    const isUnlocked = await UnlockAccess.exists({
      $or: [
        { userA, userB },
        { userA: userB, userB: userA }, // swap order to allow either to unlock
      ],
    });

    res.json({ unlocked: !!isUnlocked }); // returns true/false
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


// POST /unlock/pay
// POST /unlock/pay
app.post('/pay', async (req, res) => {
  try {
    const { userA, userB, cost, type } = req.body; // 👈 include type from frontend

    if (!userA || !userB || !cost) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // 1️⃣ Fetch payer's wallet balance
    const payer = await OdinCircledbModel.findById(userA).select('wallet');
    if (!payer) return res.status(404).json({ success: false, message: 'User not found' });

    console.log(`User ${userA} current balance: ₦${payer.wallet?.balance || 0}`);

    if ((payer.wallet?.balance || 0) < cost) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // 2️⃣ Deduct the cost
    payer.wallet.balance -= cost;
    await payer.save();

    console.log(`User ${userA} new balance after deducting ₦${cost}: ₦${payer.wallet.balance}`);

    // 3️⃣ Create UnlockAccess record (if not already exists)
    const existing = await UnlockAccess.findOne({
      $or: [
        { userA, userB },
        { userA: userB, userB: userA },
      ],
    });

    if (!existing) {
      await UnlockAccess.create({
        userA,
        userB,
        unlockedBy: userA,
        cost,
      });

      // 👇 Log in AddTimeLog with payer + type
      await AddTimeLog.create({
        userId: userA,
        cost,
        type: type || "unlock_access" // default type if frontend didn’t pass one
      });

        await AddFeature.create({
        userId: userA,
        cost,
        type: type || "unlock_access" // default type if frontend didn’t pass one
      });

      console.log(`UnlockAccess + AddTimeLog created for ${userA} -> ${userB}`);
    } else {
      console.log(`UnlockAccess record already exists for ${userA} and ${userB}`);
    }

    return res.json({ 
      success: true, 
      message: 'Access unlocked successfully', 
      newBalance: payer.wallet.balance 
    });
  } catch (err) {
    console.error('Error in /unlock/pay:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// app.get('/api/messages/:roomId', async (req, res) => {
//   const { roomId } = req.params;
//   const { before, limit = 50, currentUserId } = req.query;

//   try {
//     const query = { roomId };

//     if (before) {
//       query.timestamp = { $lt: new Date(before) };
//     }

//     const messages = await ChatMessage.find(query)
//       .sort({ timestamp: -1 })
//       .limit(parseInt(limit));

//     const deliveredMessages = [];

//     for (const msg of messages) {
//       // ✅ Only update if current user is the receiver
//       if (
//         msg.receiverId?.toString() === currentUserId &&
//         msg.status === 'sent'
//       ) {
//         msg.status = 'delivered';
//         await msg.save();
//         deliveredMessages.push(msg._id);

//         // ✅ Notify sender that message was delivered
//         const senderSocket = onlineUsers.get(msg.senderId?.toString());
//         if (senderSocket) {
//           io.to(senderSocket).emit('message-delivered', {
//             messageId: msg._id,
//             roomId: msg.roomId,
//           });
//         }
//       }
//     }

//     res.json(messages.reverse()); // Send oldest → newest
//   } catch (err) {
//     console.error('❌ Error fetching messages:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

app.get('/api/messages/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const { before, limit = 50, currentUserId } = req.query;

  try {
    // Build query
    const query = { roomId };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    // Fetch messages sorted by newest first
    const messages = await ChatModel.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('senderId receiverId author message timestamp status delivered seen deliveredAt seenAt roomId');

    // Bulk update 'delivered' status if current user is receiver
    const toDeliver = messages.filter(
      msg => msg.receiverId?.toString() === currentUserId && msg.status === 'sent'
    );

    if (toDeliver.length > 0) {
      const ids = toDeliver.map(m => m._id);

      // Update messages in bulk
      await ChatModel.updateMany(
        { _id: { $in: ids } },
        { 
          $set: { 
            status: 'delivered', 
            delivered: true, 
            deliveredAt: new Date() 
          } 
        }
      );

      // Notify senders via WebSocket
      toDeliver.forEach(msg => {
        const senderSocket = onlineUsers.get(msg.senderId?.toString());
        if (senderSocket) {
          io.to(senderSocket).emit('message-delivered', {
            messageId: msg._id,
            roomId: msg.roomId,
          });
        }
      });
    }

    // Return messages oldest → newest
    res.json(messages.reverse());
  } catch (err) {
    console.error('❌ Error fetching messages:', err);
    res.status(500).json({ error: 'Server error' });
  }
});





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


socket.on('userJoin', (userId) => {
    if (userId) {
      onlineUsers.set(userId, socket.id); // store both ID and socket
      io.emit('onlineUsers', Array.from(onlineUsers.keys())); // send IDs only
    }
  });

  socket.on('userLeave', (userId) => {
    if (userId) {
      onlineUsers.delete(userId);
      io.emit('onlineUsers', Array.from(onlineUsers.keys()));
    }
  });

  // When a user explicitly leaves
  // socket.on('userLeave', (userId) => {
  //   if (userId) {
  //     onlineUsers.delete(userId);
  //     io.emit('onlineUsers', Array.from(onlineUsers));
  //   }
  // });


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



// socket.on('sendMessage', async ({ roomId, msg }) => {
//   try {
//     if (!msg) {
//       console.error('❌ Invalid message payload: msg is missing');
//       return;
//     }

//     const senderId = msg.senderId;
//     const receiverId = msg.receiverId;

//     // Save message to DB
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

//     // Emit to room
//     io.to(roomId).emit('newMessage', savedMsg);

//     // Check if receiver is online
//     const receiverSocketId = onlineUsers.get(msg.receiverId);

//     if (receiverSocketId) {
//       // ✅ Receiver is online -> deliver
//       io.to(receiverSocketId).emit('message-received', savedMsg);
//     } else {
//       // ❌ Receiver is offline -> send push notification
//       const receiverUser = await OdinCircledbModel.findById(msg.receiverId);
//       const senderUser = await OdinCircledbModel.findById(msg.senderId);

//       if (receiverUser?.apnsToken) {
//         // 🔔 Send via APNs
//         const notification = new apn.Notification();
//         notification.alert = {
//           title: `New message from ${senderUser?.fullName || "Someone"}`,
//           body: msg.text || "[Media Message]",
//         };
//         notification.sound = "default";
//         notification.topic = "com.bond0011.betxcircleapp"; // 👈 your bundle ID
//         notification.payload = {
//           message: msg.text || "[Media Message]",
//           senderFullName: senderUser?.fullName || "Someone",
//           screen: "UnreadMessagesList",
//         };

//         try {
//           const response = await apnProvider.send(notification, receiverUser.apnsToken);
//           console.log("📱 APNs response:", response);
//         } catch (apnErr) {
//           console.error("❌ Error sending APNs notification:", apnErr);
//         }
//       } else if (receiverUser?.expoPushToken) {
//         // 🔔 Fallback to Expo
//         await sendPushNotification(
//           receiverUser.expoPushToken,
//           msg.text || "[Media Message]",
//           senderUser?.fullName || "Someone"
//         );
//       }
//     }
//   } catch (err) {
//     console.error("❌ Error saving message:", err.message);
//   }
// });


socket.on('sendMessage', async ({ roomId, msg }) => {
  try {
    if (!msg) {
      console.error('❌ Invalid message payload: msg is missing');
      return;
    }

    const senderId = msg.senderId;
    const receiverId = msg.receiverId;

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
        timestamp: new Date()   // 👈 add this
    });

    // Emit to room
    io.to(roomId).emit('newMessage', savedMsg);

    // Check if receiver is online
    const receiverSocketId = onlineUsers.get(msg.receiverId);

    if (receiverSocketId) {
      // ✅ Receiver is online -> deliver and update status
      io.to(receiverSocketId).emit('message-delivered', savedMsg._id);
      io.to(receiverSocketId).emit('message-received', savedMsg);

      await ChatMessage.findByIdAndUpdate(savedMsg._id, { status: 'delivered' });
    } else {
      // ❌ Receiver is offline -> send push notification
      const receiverUser = await OdinCircledbModel.findById(msg.receiverId);
      const senderUser = await OdinCircledbModel.findById(msg.senderId);

      if (receiverUser) {
        await sendPushNotification(
          receiverUser,
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
  
});


// 📲 Unified Push Notification Function (APNs + Expo)
async function sendPushNotification(receiverUser, message, senderFullName) {
  try {
    console.log("🔔 Preparing to send notification...");
    console.log("Receiver:", receiverUser?._id);
    console.log("Message Body:", message);
    console.log("Sender Name:", senderFullName);

    // ✅ If user has APNs token (iOS)
    if (receiverUser?.apnsToken) {
      console.log("📱 Sending APNs notification...");

      const notification = new apn.Notification();
      notification.alert = {
        title: `New message from ${senderFullName}`,
        body: message,
      };
      notification.sound = "default";
      notification.topic = "com.bond0011.betxcircleapp"; // 👈 your iOS bundle ID
      notification.payload = {
        message,
        senderFullName,
        screen: "UnreadMessagesList",
      };

      try {
        const response = await apnProvider.send(notification, receiverUser.apnsToken);
        console.log("📱 APNs response:", response);
      } catch (apnErr) {
        console.error("❌ Error sending APNs notification:", apnErr);
      }
    }

    // ✅ If user has Expo push token (Android / iOS fallback)
    else if (receiverUser?.expoPushToken) {
      console.log("📲 Sending Expo notification...");

      if (!Expo.isExpoPushToken(receiverUser.expoPushToken)) {
        console.error(`❌ Invalid Expo push token: ${receiverUser.expoPushToken}`);
        return;
      }

      const messages = [{
        to: receiverUser.expoPushToken,
        sound: "default",
        title: `New message from ${senderFullName}`,
        body: message,
        data: { message, senderFullName, screen: "UnreadMessagesList" },
      }];

      console.log("📦 Messages to send:", messages);

      const chunks = expo.chunkPushNotifications(messages);
      console.log(`🔹 Split into ${chunks.length} chunk(s).`);

      for (const [index, chunk] of chunks.entries()) {
        try {
          console.log(`🚀 Sending Expo chunk ${index + 1}:`, chunk);
          const receipts = await expo.sendPushNotificationsAsync(chunk);
          console.log(`✅ Expo chunk ${index + 1} receipts:`, receipts);
        } catch (chunkError) {
          console.error(`❌ Error sending Expo push chunk ${index + 1}:`, chunkError);
        }
      }
    } else {
      console.log("⚠️ No push token available for this user.");
    }

  } catch (error) {
    console.error("❌ Error in sendPushNotification:", error);
  }
}




const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
