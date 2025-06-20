const socketIo = require('socket.io');

const FriendListIo = (server) => {
  const io = socketIo(server);

  // Store the online status of users
    // Store the online status of users
    const onlineUsers = new Set(); // Use a Set to store online user IDs
    const userSocketMap = new Map(); // Map to track userId by socket.id
  
    io.on('connection', (socket) => {
      // When a client connects, send them the list of online users
      socket.emit('onlineUsers', Array.from(onlineUsers)); // Send the current online users to the new client
  
      // Handle setting the userId when a client connects
      socket.on('setUserId', (userId) => {
        onlineUsers.add(userId); // Add the userId to the Set
        userSocketMap.set(socket.id, userId); // Map socket.id to userId
        
        // Notify all clients about the new connection
        io.emit('userConnected', { userId });
      });
      
      socket.on('getOnlineUsers', () => {
        socket.emit('onlineUsers', Array.from(onlineUsers)); // Send the list of online users
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        const disconnectedUserId = userSocketMap.get(socket.id); // Get the userId associated with the disconnected socket
  
        if (disconnectedUserId) {
          onlineUsers.delete(disconnectedUserId); // Remove the userId from the Set
          userSocketMap.delete(socket.id); // Remove the socketId to userId mapping
  
          console.log(`User ID ${disconnectedUserId} disconnected`);
  
          // Notify all clients about the user disconnection
          io.emit('userDisconnected', { userId: disconnectedUserId });
        }
      });
    });

  // Optionally, return the io instance if needed elsewhere
  return io;
};

module.exports = FriendListIo;





