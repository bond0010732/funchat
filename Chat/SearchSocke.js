const socketIo = require('socket.io');

const SearchSocketIo = (server) => {
  const io = socketIo(server);

  const onlineUsers = new Set(); 
  const userSocketMap = new Map(); 

  io.on('connection', (socket) => {
    socket.emit('onlineUsers', Array.from(onlineUsers));


    socket.on('setUserId', (userId) => {
      onlineUsers.add(userId); // Add the userId to the Set
      userSocketMap.set(socket.id, userId); // Map socket.id to userId
      
      // Notify all clients about the new connection
      io.emit('userConnected', { userId });
    });
    
    socket.on('getOnlineUsers', () => {
      socket.emit('onlineUsers', Array.from(onlineUsers)); // Send the list of online users
    });
    
    socket.on('disconnect', () => {
      const disconnectedUserId = userSocketMap.get(socket.id); // Get the userId associated with the disconnected socket
    
      if (disconnectedUserId) {
        onlineUsers.delete(disconnectedUserId); // Remove the userId from the onlineUsers Set
        userSocketMap.delete(socket.id); // Remove the socketId to userId mapping
    
        // Notify all clients about the user disconnection
        io.emit('userDisconnected', { userId: disconnectedUserId });
      }
    });
    
    
  });

  return io;
};

module.exports = SearchSocketIo;