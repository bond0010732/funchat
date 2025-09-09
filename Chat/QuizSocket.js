const socketIO = require('socket.io');
const { getQuestions } = require('../Questions/Questions');

module.exports = (server) => {
  const io = socketIO(server);

  io.on('connection', (socket) => {
    console.log('New user connected');

    socket.on('joinGame', (userData) => {
      const { userId, username } = userData;
      // Handle joining logic here (e.g., store user data)

      const numQuestions = 5; // Number of questions to send to each user
      const userQuestions = getQuestions(userId, numQuestions);
      socket.emit('receiveQuestions', userQuestions);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
      // Handle disconnect logic (e.g., remove user data)
    });

    // Handle user answers
    socket.on('submitAnswer', (answerData) => {
      // Handle answer submission logic
    });
  });
};
