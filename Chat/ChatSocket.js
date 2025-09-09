const socketIo = require("socket.io");
const ChatModel = require("../models/ChatModel");
const OdinCircledbModel = require("../models/odincircledb"); // Adjust the path as needed
const icon = "../assets/images/logoapp.png";

const rooms = {};
const messageHistory = {};
const activeUsersInRoom = {};

const { Expo } = require("expo-server-sdk");

// Create a new Expo SDK client
let expo = new Expo();

const initializeSocket = (server) => {
  const io = socketIo(server);

  // Socket.IO connection handler
  io.on("connection", (socket) => {
    console.log("New client connected");


    io.use((socket, next) => {
      const loggedInUserId = socket.handshake.query.loggedInUserId; // Fetch logged-in user ID
      const otherUserId = socket.handshake.query.otherUserId; // Fetch other user ID
    
      if (loggedInUserId) {
        socket.loggedInUserId = loggedInUserId;
        console.log(`Socket connected with LoggedInUser ID: ${loggedInUserId}`);
      } else {
        console.error('LoggedInUser ID is missing.');
        return next(new Error('Authentication error'));
      }
    
      if (otherUserId) {
        socket.otherUserId = otherUserId;
      }
    
      next();
    });
    
    // Event listener for joining a room
    socket.on("joinRoom", async ({ roomId, loggedInUserId, otherUserId }) => {
      if (!roomId || !loggedInUserId || !otherUserId) {
        console.error(
          `Invalid data received: roomId=${roomId}, loggedInUserId=${loggedInUserId}, otherUserId=${otherUserId}`
        );
        return;
      }

      // Add the user to the room
      socket.join(roomId);
      console.log(`User ${loggedInUserId} joined room ${roomId}`);

      // Track socket IDs for both users in the room
      if (!rooms[roomId]) {
        rooms[roomId] = [];
      }
      rooms[roomId].push(socket.id);

      // Track the logged-in user and the other user in the activeUsers object
      // activeUsers[loggedInUserId] = socket.id;
      // if (!activeUsers[otherUserId]) {
      //   activeUsers[otherUserId] = [];
      // }
      // activeUsers[otherUserId].push(socket.id);

    
      console.log(
        `Room ${roomId} status: ${rooms[roomId].length} active connections`
      );

       // Track the user in the activeUsers object
  if (!activeUsers[otherUserId]) {
    activeUsers[otherUserId] = []; // Initialize as an array if it doesn't exist
  }
  activeUsers[otherUserId].push(socket.id);

      // Retrieve message history from the database
      try {
        const history = await ChatModel.find({ roomId }).sort({ createdAt: 1 });
        socket.emit("messageHist", history); // Emit message history to the client
      } catch (err) {
        //console.error("Error fetching message history:", err);
      }
    });

    socket.on("join_room", (data) => {
      // Add user to room tracking
      addToRoom(data.roomId, socket.id);
      io.to(data.roomId).emit("update_active_users", getActiveUsersInRoom(data.roomId));
    });
    
    socket.on("leave_room", (data) => {
      // Remove user from room tracking
      removeFromRoom(data.roomId, socket.id);
      io.to(data.roomId).emit("update_active_users", getActiveUsersInRoom(data.roomId));
    });
    
    socket.on("typing", ({ roomId, userId, typing, fullName }) => {
      //console.log("Received typing event:", { roomId, userId, typing });
      // Emit the typing event to all users in the room except the one who is typing
      socket.to(roomId).emit("typing", { userId, typing, fullName });
    });


    io.on("connection", (socket) => {
      socket.on("checkOtherUserInRoom", ({ roomId, loggedInUserId, otherUserId }) => {
        // Broadcast an event to check if the other user is in the room
        socket.to(roomId).emit("otherUserInRoomCheck", { loggedInUserId });
      });
    
      socket.on("otherUserInRoomCheck", ({ loggedInUserId }) => {
        // Here, socket.handshake.query.userId or similar could be used if stored upon connection
        const currentUserId = socket.handshake.query.userId; // This assumes the userId was sent when the socket connected
    
        if (loggedInUserId === currentUserId) {
          // Confirm to the server that this user is in the room
          const roomId = Array.from(socket.rooms)[1]; // Get the room ID the user is currently in
          socket.emit("confirmUserInRoom", { userId: loggedInUserId, roomId });
        }
      });
    });
    
    
    

    // Handle leaving a room
// Handle leaving a room
socket.on("leaveRoom", (roomId) => {
  socket.leave(roomId);
  console.log(`User ${socket.otherUserId} left room ${roomId}`);

  // Remove the socket ID from the room
  if (rooms[roomId]) {
    rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
    if (rooms[roomId].length === 0) {
      delete rooms[roomId]; // Remove the room if no more clients are connected
    }
  }

  // Remove the user from the active user tracking
  if (socket.otherUserId) {
    delete activeUsers[socket.otherUserId]; // Remove the user from active users
  }
});


   
    const activeUsers = {}; // Store active users with their socket IDs


    // Handle message delivery
socket.on('delivered_message', async ({ messageId, recipientId }) => {
  try {
    // Update the message in the database as delivered, and set the delivery timestamp
    const updatedMessage = await ChatModel.findByIdAndUpdate(
      messageId,
      {
        delivered: true,
        deliveredAt: new Date(), // Add a timestamp for when the message was delivered
      },
      { new: true } // Return the updated document
    );

    if (updatedMessage) {
      // Emit the messageDelivered event to the sender and the recipient for real-time updates
      io.to(recipientId).emit('messageDelivered', {
        messageId: updatedMessage._id,
        deliveredAt: updatedMessage.deliveredAt,
      });
    }
  } catch (error) {
    console.error('Error delivering message:', error);
  }
});

// Handle message seen
socket.on('seen_message', async ({ messageId, recipientId }) => {
  try {
    // Update the message in the database as seen, and set the seen timestamp
    const updatedMessage = await ChatModel.findByIdAndUpdate(
      messageId,
      {
        seen: true,
        seenAt: new Date(), // Add a timestamp for when the message was seen
      },
      { new: true } // Return the updated document
    );

    if (updatedMessage) {
      // Emit the messageSeen event to the sender and the recipient for real-time updates
      io.to(recipientId).emit('messageSeen', {
        messageId: updatedMessage._id,
        seenAt: updatedMessage.seenAt,
      });
    }
  } catch (error) {
    console.error('Error marking message as seen:', error);
  }
});

// Listen for the "markMessagesAsRead" event
socket.on("markMessagesAsRead", async ({ roomId, userId }) => {
  try {
    // Log the request for debugging
    console.log(`Marking messages as read for room: ${roomId} and user: ${userId}`);

    // Find all unread messages for the user in the room and update them to read
    const updatedMessages = await ChatModel.updateMany(
      {
        roomId: roomId,
        recipientId: userId,
        seen: false, // Only update unseen messages
      },
      {
        $set: { seen: true, seenAt: new Date() },
      },
      { new: true }
    );

    console.log(`${updatedMessages.nModified} messages marked as read for user ${userId} in room ${roomId}`);

    // Emit an event to the client with the updated unread message count
    // Fetch the new unread messages count for the user
    const unreadMessagesCount = await ChatModel.countDocuments({
      recipientId: userId,
      seen: false,
    });

    // Send the updated unread message count to the client
    io.to(socket.id).emit("unreadMessagesCountUpdated", {
      userId,
      unreadMessagesCount,
    });

    console.log(`Unread messages count updated for user ${userId}: ${unreadMessagesCount}`);

    // Optionally broadcast that messages in the room have been marked as read
    io.to(roomId).emit("messagesReadInRoom", {
      userId,
      roomId,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
});
 

// Initialize messageHistory object to store messages temporarily by roomId
const messageHistory = {};

//New socket listener
socket.on("send_message", async (messageData) => {
  const {
    roomId,
    author,
    message,
    timestamp,
    recipientId,
    senderFullName,
    loggedInUserId,
    otherUserId,
  } = messageData;

  console.log("Received messageData:", messageData);

  try {
    // Store the message temporarily in messageHistory
    if (!messageHistory[roomId]) {
      messageHistory[roomId] = [];
    }
    messageHistory[roomId].push({ author, message, roomId, timestamp });

    // Emit the message to all clients in the room
    io.to(roomId).emit("message", {
      author,
      message,
      roomId,
      timestamp,
      delivered: false,
      seen: false,
    });

    console.log(`Message emitted to room ${roomId}`);

    // Save the message to the database
    const newMessage = new ChatModel({
      roomId,
      author,
      message,
      timestamp,
      delivered: false,
      seen: false,
    });
    await newMessage.save();

    console.log("Message saved to the database");

    // Optionally, remove the message from temporary history after saving
    if (messageHistory[roomId]) {
      delete messageHistory[roomId];
    }

    // Check if the recipient is in the room
    const recipientInRoom = rooms[roomId] && rooms[roomId].some((socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      return socket && socket.otherUserId !== recipientId;
    });

    if (recipientInRoom) {
      console.log(`Recipient ${recipientId} is in the room ${roomId}. Marking message as delivered.`);

      // Mark as delivered
      newMessage.delivered = true;
      newMessage.deliveredAt = new Date();
      // await newMessage.save();

      // Verify if the document was updated successfully
console.log('New Message after save:', newMessage);

         // Emit 'delivered' and 'seen' events immediately
     // Emit 'delivered' and 'seen' events immediately
console.log(`Emitting 'messageDelivered' event for message ID: ${newMessage._id} at ${newMessage.deliveredAt}`);
io.to(roomId).emit('messageDelivered', {
  messageId: newMessage._id,
  deliveredAt: newMessage.deliveredAt,
});
console.log(`'messageDelivered' event emitted successfully for message ID: ${newMessage._id}`);

const updatedMessage = await ChatModel.findByIdAndUpdate(
  newMessage._id,
  { delivered: true, deliveredAt: new Date() },
  { new: true }
);

console.log('Updated Message:', updatedMessage);

        // if (newMessage.seen) {
        //   io.to(roomId).emit('messageSeen', {
        //     messageId: newMessage._id,
        //     seenAt: newMessage.seenAt,
        //   });
        // }
        try {
          const updatedMessage = await ChatModel.findByIdAndUpdate(
            newMessage._id,
            { seen: true, seenAt: new Date() },
            { new: true } // Return the updated document
          );
        
          console.log('Updated Message (seen):', updatedMessage);
        
          if (updatedMessage.seen) {
            io.to(roomId).emit('messageSeen', {
              messageId: updatedMessage._id,
              seenAt: updatedMessage.seenAt,
            });
        
            console.log('messageSeen event emitted:', updatedMessage._id);
          }
        } catch (error) {
          console.error('Error updating seen status:', error);
        }
        
        
         // Send message to recipient
      io.to(roomId).emit("messageDelivered", newMessage._id);

      // Schedule a background job to reset the delivered status after a certain period
      setTimeout(async () => {
        newMessage.delivered = false;
        newMessage.deliveredAt = null;
        await newMessage.save();
        io.to(roomId).emit("messageDelivered", newMessage._id);
      }, 10000); // 30 seconds
    } else {
      console.log(`Recipient ${recipientId} is not in the room ${roomId}. Sending notification.`);

      // Retrieve the recipient's Expo push token from the database
      const recipient = await OdinCircledbModel.findById(recipientId);
      if (recipient && recipient.expoPushToken) {
        console.log(`Sending push notification to ${recipient.expoPushToken}`);
        await sendPushNotification(
          recipient.expoPushToken,
          author,
          senderFullName,
          message
        );
      } else {
        console.warn(`No Expo push token found for recipient with ID: ${recipientId}`);
      }
    }
  } catch (error) {
    console.error("Error processing send_message event:", error);
  }
});

    
    
    socket.on('disconnect', () => {
      console.log(`Client disconnected: Socket ID ${socket.id}, LoggedInUser ID: ${socket.loggedInUserId}, OtherUser ID: ${socket.otherUserId}`);
    
      // Remove the socket ID from all rooms it's connected to
      for (const roomId in rooms) {
        if (rooms[roomId] && rooms[roomId].includes(socket.id)) {
          // Ensure rooms[roomId] is defined and filter out the socket ID
          rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
          
          // If no more clients are connected to this room, delete the room
          if (rooms[roomId].length === 0) {
            delete rooms[roomId];
          }
        }
      }
    
      // Remove the user from active users
      if (socket.userId) {
        delete activeUsers[socket.userId];
      }
      if (socket.otherUserId) {
        const userSockets = activeUsers[socket.otherUserId];
        if (userSockets) {
          const index = userSockets.indexOf(socket.id);
          if (index > -1) {
            userSockets.splice(index, 1);
            // Clean up if no more sockets for this user
            if (userSockets.length === 0) {
              delete activeUsers[socket.otherUserId];
            }
          }
        }
      }
    });
  })    
};

async function sendPushNotification(
  expoPushToken,
  author,
  message,
  senderFullName,
  userId // Add userId to track which user should receive the notification
) {
  try {
    // Check if the push token is a valid Expo push token
    if (!Expo.isExpoPushToken(expoPushToken)) {
      console.error(
        `Push token ${expoPushToken} is not a valid Expo push token`
      );
      return;
    }

    const messages = [{
      to: expoPushToken,
      sound: "default",
      title: `New message from ${senderFullName}`,
      body: message,
      data: {
        message,
        author,
        userId, // Include userId in the data payload
      },
      icon: "logoapp", // Include the icon URL
    }];

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    // Send the notifications in chunks
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
      }
    }

    console.log("Push notification tickets:", tickets);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

async function sendPushNotification(
  expoPushToken,
  author,
  message,
  senderFullName
) {
  try {
    // Check if the push token is a valid Expo push token
    if (!Expo.isExpoPushToken(expoPushToken)) {
      console.error(
        `Push token ${expoPushToken} is not a valid Expo push token`
      );
      return;
    }

    const messages = [];
    messages.push({
      to: expoPushToken,
      sound: "default",
      title: `New message from [${message}]`,
      body: ` ${senderFullName}`,
      data: { message },
      icon: "logoapp", // Include the icon URL
    });

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    // Send the notifications in chunks
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
      }
    }

    console.log("Push notification tickets:", tickets);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

module.exports = initializeSocket;
