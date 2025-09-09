
const socketIo = require('socket.io');
const { Expo } = require('expo-server-sdk'); // Add Expo SDK for push notifications

const expo = new Expo(); // Create a new Expo SDK client
const ChatModel = require("../models/ChatModel");

const OdinCircledbModel = require("../models/odincircledb"); 
const Device = require('../models/Device');
const rooms = {}; 
const messages = {}; 
const unreadMessages = {};


// Create a function to initialize Socket.IO
const initializeSocketOne = (server) => {
    const io = socketIo(server);
    // const rooms = {}; // Object to track users in rooms

    // When a client connects
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Join a chat

       // User joins a room
    socket.on('joinRoom', ({ roomId, userId}) => {
        // Join the room
        socket.join(roomId);
        console.log(`User ${userId} joined room ${roomId} with socket ID: ${socket.id}`);

        // Store user IDs in the room
        if (!rooms[roomId]) {
            rooms[roomId] = [];  // Initialize the room in rooms object
            // console.log(`Room ${roomId} initialized.`);
        }
 
        rooms[roomId].push(socket.id);
        // console.log(`Socket ${socket.id} joined room ${roomId}`);

        // Ensure both userId and otherUserId are part of the room
        if (!rooms[roomId].includes(userId)) {
            rooms[roomId].push(userId);
            // console.log(`User ${userId} added to room ${roomId}`);
        }

        // if (!rooms[roomId].includes(otherUserId)) {
        //     rooms[roomId].push(otherUserId);
        //     console.log(`User ${otherUserId} added to room ${roomId}`);
        // }

        // Emit to the room that a new user has joined
        io.to(roomId).emit('userJoined', { userId });

        // Emit the current list of users in the room
        socket.emit('currentUsersInRoom', rooms[roomId]);

        // Send existing messages to the new user (if any)
        if (messages[roomId]) {
            socket.emit('previousMessages', messages[roomId]);
        }

        // console.log(`Users in room ${roomId}:`, rooms[roomId]);
    });

        
        


const ChatsFriends = require('../../backend/models/ChatsFriends'); // Import your Mongoose unread message model


socket.on('send_message', async (messageData) => {
    const { roomId, message, senderFullName, author, senderImage, recipientId } = messageData;

    // Add unique ID and delivery status
    const messageWithId = {
        ...messageData,
        id: Date.now(),
        delivered: false,
        isRead: false,
    };

    // console.log('Preparing to store the message:', messageWithId);

    // console.log('Received roomId:', roomId);

    // Ensure room exists in memory (rooms object)
    if (!rooms[roomId]) {
        rooms[roomId] = [];  // Initialize room if not present
        console.log(`Room ${roomId} initialized in rooms object.`);
    }

    // Log the rooms object after sending a message
    // console.log('Updated rooms object after message:', JSON.stringify(rooms, null, 2));

    // Store the message in memory for the room
    if (!messages[roomId]) {
        messages[roomId] = [];
    }
    messages[roomId].push(messageWithId);
    // console.log('Message stored in memory for room:', roomId);

    // Save the message to MongoDB
    try {
        const newMessage = new ChatModel(messageWithId);
        await newMessage.save();
        // console.log('Message saved to database:', newMessage);
    } catch (error) {
        console.error('Error saving message to database:', error);
    }

    // Emit the message to all users in the room
    io.to(roomId).emit('receive_message', messageWithId);
    // console.log(`Message emitted to room ${roomId}:`, messageWithId);

    // Check if the recipient is in the room using our custom rooms object
    const usersInRoom = rooms[roomId] || [];
    // console.log(`Users currently in room ${roomId}:`, usersInRoom);

    if (usersInRoom.includes(recipientId)) {
        // console.log(`Recipient with ID ${recipientId} is in room ${roomId}`);

        // Mark the message as delivered
        messageWithId.delivered = true;
        io.to(roomId).emit('messageDelivered', {
            roomId,
            messageId: messageWithId.id,
            deliveredAt: new Date(),
        });
        // console.log(`Message marked as delivered for recipient ${recipientId}`);
    } else {
        // console.log(`Recipient with ID ${recipientId} is NOT in room ${roomId}. Proceeding with push notification.`);

        // Handle the case where the recipient is not in the room (e.g., send push notification)
        try {
            const recipientDevice = await Device.findOne({ 'users._id': recipientId });
            if (recipientDevice?.expoPushToken) {
                // console.log(`Recipient's push token found: ${recipientDevice.expoPushToken}`);
                // console.log(`Sending push notification to ${recipientDevice.expoPushToken}`);

                // Send the push notification
                await sendPushNotification(
                    recipientDevice.expoPushToken,
                    author,
                    message,
                    senderFullName
                );
                // console.log(`Push notification sent to recipient with ID: ${recipientId}`);
            } else {
                // console.warn(`No Expo push token found for recipient with ID: ${recipientId}`);
            }
        } catch (error) {
            console.error("Error retrieving recipient's push token:", error);
        }
    }

    // Handle unread messages if the recipient is not in the room
    try {
        const existingUnreadMessage = await ChatsFriends.findOne({
            recipientId,
            author,
            messageId: messageWithId.id,
        });

        if (existingUnreadMessage) {
            existingUnreadMessage.unreadCount += 1;
            await existingUnreadMessage.save();
            // console.log(`Unread message count updated for recipient ${recipientId}`);
        } else {
            const unreadMessage = new ChatsFriends({
                recipientId,
                senderFullName,
                author,
                senderImage,
                messageId: messageWithId.id,
                unreadCount: 1,
            });
            await unreadMessage.save();
            // console.log(`Unread message created for recipient ${recipientId}`);
        }

        io.to(recipientId).emit('unreadMessages', {
            senderFullName,
            author,
            senderImage,
            unreadCount: 1,
            messageId: messageWithId.id,
        });

        // console.log(`Updated unread messages for ${recipientId}`);
    } catch (error) {
        console.error('Error saving unread message:', error);
    }
});





        socket.on('typing', ({ roomId, userId, typing, fullName }) => {
            io.to(roomId).emit('typing', { userId, typing, fullName });
        });

      // Handle socket joining rooms
socket.on('join_room', (roomId) => {
    if (!rooms[roomId]) {
        rooms[roomId] = [];  // Initialize room if not present
        console.log(`Room ${roomId} initialized in rooms object.`);
    }
    rooms[roomId].push(socket.id);
    socket.join(roomId);  // Ensure the socket joins the room in socket.io
    console.log(`Socket ${socket.id} joined room ${roomId}`);
});

// Handle socket leaving rooms
socket.on('leaveRoom', ({ roomId, userId }) => {
    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(id => id !== userId);
      socket.to(roomId).emit('userLeft', userId);
      console.log(`User ${userId} left room ${roomId}`);
  
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} is now empty and removed`);
      }
    }
  });
  
        // Handle user disconnect
       // Handle user disconnect
       socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        console.log('roomId:', socket.roomId);
        console.log('userId:', socket.userId);
    
        const { roomId, userId } = socket;
    
        if (roomId && userId && rooms[roomId]) {
            rooms[roomId] = rooms[roomId].filter(id => id !== userId);
            console.log(`User ${userId} disconnected and left room ${roomId} sockid ${socket.id}`);
    
            socket.to(roomId).emit('userOffline', userId);
            socket.leave(roomId);
    
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
                console.log(`Room ${roomId} is now empty and removed`);
            }
        } else {
            console.error('Room or User ID not found during disconnect');
        }
    });
    

    });
}

// Push Notification Function
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
                // `Push token ${expoPushToken} is not a valid Expo push token`
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
            icon: "logoapp", // Include the icon URL if available
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

        // console.log("Push notification tickets:", tickets);
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
}

// Export the initialization function
module.exports = initializeSocketOne;
