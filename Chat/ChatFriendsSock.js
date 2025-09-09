
// module.exports = ChatFriendsSocketIo;
const socketIo = require('socket.io');

const ChatFriendsSocketIo = (server) => {
  const io = socketIo(server);

  const onlineUsers = new Set();
  const userSocketMap = new Map();

  io.on('connection', (socket) => {
    socket.emit('onlineUsers', Array.from(onlineUsers));

    socket.on('setUserId', (userId) => {
      onlineUsers.add(userId);
      userSocketMap.set(socket.id, userId);
      
      io.emit('userConnected', { userId });
    });

    socket.on('getOnlineUsers', () => {
      socket.emit('onlineUsers', Array.from(onlineUsers)); 
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      const disconnectedUserId = userSocketMap.get(socket.id); 

      if (disconnectedUserId) {
        onlineUsers.delete(disconnectedUserId);
        userSocketMap.delete(socket.id);

        console.log(`User ID ${disconnectedUserId} disconnected`);

        // Notify all clients about the user disconnection
        io.emit('userDisconnected', { userId: disconnectedUserId });
      }
    });
  });

  return io;
};

module.exports = ChatFriendsSocketIo;
