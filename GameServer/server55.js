const socketIO = require('socket.io');
const OdinCircledbModel = require('../models/odincircledb');
const BetModel = require('../models/BetModel');
const WinnerModel = require('../models/WinnerModel');
const BetModelRock = require('../models/BetModelRock');
const BetCashModel = require('../models/BetCashModel');
const Device = require('../models/Device');
const mongoose = require('mongoose');

const { Expo } = require('expo-server-sdk'); // Import expo-server-sdk

const expo = new Expo(); // Initialize Expo SDK

function startSocketServer55 (httpServer){
  const io = socketIO(httpServer);

  const rooms = {};

  io.on('connection', (socket) => {
    console.log('A user connectedssss:', socket.id);
  
    
    socket.on('joinRoom', async (data) => {
      const { roomId, playerName, userId, totalBet, expoPushToken } = data;
    
      // Log the received data
      console.log('Received joinRoom event with data:', data);
    
      // Validate required fields
      if (!roomId || !playerName || !userId) {
        console.error('Missing roomId, playerName, or userId:', { roomId, playerName, userId });
        socket.emit('error', 'Missing roomId, playerName, or userId');
        return;
      }
    
      // Initialize the room if it doesn't exist
      if (!rooms[roomId]) {
        rooms[roomId] = {
          players: [],
          choices: {},
          round: 1,
          scores: {},
        };
        console.log(`Created room ${roomId} with initial data`, rooms[roomId]);
      }
    
      const room = rooms[roomId];
    
      // Add the new player to the room
      // const playerId = socket.id;
      //   const playerNumber = room.players.length + 1;
      //   const playerData = {
      //   id: playerId,
      //    name: playerName,
      //    playerNumber,
      //   };
      // Check if the room is full
      if (room.players.length >= 2) {
        console.log(`Room ${roomId} is full. Player ${playerName} cannot join.`);
        socket.emit('message', 'Room is full');
        return;
      }
    
      // Assign the player number dynamically based on the number of players in the room
      const playerNumber = room.players.length + 1;
      const playerData = { id: socket.id, name: playerName, userId, playerNumber, totalBet };
      room.players.push(playerData);
    
      // Initialize player's score
      room.scores[socket.id] = 0;
    
      // Join the socket to the room
      socket.join(roomId);
      console.log(`Player ${playerName} (userId: ${userId}) joined room ${roomId} as Player ${playerNumber}`);
    
       // Notify the specific player of their details
      socket.emit('playerJoined', {
      playerNumber,
      playerName,
      roomId,
      totalBet: totalBet,
      round: room.round,
      expoPushToken,
     });

    //  io.to(roomId).emit('playerInfo', {
    //   roomId,
    //   players: room.players.map((player) => ({
    //     id: player.id,
    //     playerName: player.name,
    //     playerNumber: player.playerNumber,
    //   })),
    //   totalBet: totalBet,
    // });
    
    io.to(roomId).emit('playerInfo', {
      roomId,
      player1Name: room.players[0]?.name || null, // Assign player1Name based on the first player
      player2Name: room.players[1]?.name || null, // Assign player2Name based on the second player
      players: room.players.map((player, index) => ({
        id: player.id,
        playerName: player.name,
        // playerNumber: index + 1,
        playerNumber: player.playerNumber, // Assign player numbers based on their position
      })),
      totalBet: room.totalBet,
    });
    
      // Notify all clients in the room about the new player
      // io.to(roomId).emit('playerInfo', {
      //   roomId,
      //   players: room.players, 
      //   totalBet: room.totalBet,
      //   playerNumber: room.playerNumber,
      // });
    
      // Welcome message for the player
      socket.emit('message', `Welcome to the game, ${playerName}!`);
      io.to(roomId).emit('message', `Player ${playerNumber} (${playerName}) has joined the room.`);
    
      // Check if both players have joined
      if (room.players.length === 2) {
        console.log(`Both players have joined room ${roomId}`, room.players);
        io.to(roomId).emit('bothPlayersJoined', {
          message: 'Both players have joined the room.',
          roomData: room,
        });
      }

      const firstPlayer = room.players[0]; // Retrieve the first player's info
      console.log('First Player Info:', firstPlayer);
  
      // Fetch first player's push token from the database
      const recipient = await OdinCircledbModel.findById(firstPlayer.userId); // Assuming `userId` matches DB _id
      console.log('Fetched recipient from DB:', recipient);
  

    if (recipient && recipient.expoPushToken) {
    console.log(`Preparing to send push notification to: ${recipient.expoPushToken}`);

    // Notification details
    const notificationTitle = 'Game Ready!';
    const notificationBody = `${playerName} has joined. The game is ready to start!`;
    const notificationData = { roomId, playerName };

    // Send the push notification
    await sendPushNotification(
      recipient.expoPushToken,
      notificationTitle,
      notificationBody,
      notificationData
    );

    console.log('Push notification sent successfully to the first player.');
  } else {
    console.log('No valid Expo push token found for the first player.');
  }
    
    });

// Listen for incoming chat messages from clients


        // Function to send push notifications
async function sendPushNotification(expoPushToken, title, body, data = {}) {
  try {
    // Validate if the token is a valid Expo push token
    if (!Expo.isExpoPushToken(expoPushToken)) {
      console.error(
        `Push token ${expoPushToken} is not a valid Expo push token`
      );
      return;
    }

    // Create the notification payload
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      icon: 'https://as1.ftcdn.net/v2/jpg/03/06/02/06/1000_F_306020649_Kx1nsIMTl9FKwF0jyYruImTY5zV6mnzw.jpg', // Include the icon if required
    };

    console.log('Sending notification with message:', message);

    // Split messages into chunks for sending
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    // Send the notification in chunks
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    console.log('Push notification tickets:', tickets);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

   // Add this inside the io.on('connection', ...) block
   socket.on('chatText', ({ roomId, playerName, text }) => {
    // Log the data being received
    console.log(`Received chat message from ${playerName} in room ${roomId}: ${text}`);

    // Broadcast the chat text to all clients in the room
    io.to(roomId).emit('receiveText', { playerName, text });
  });


socket.on('choice', async (data) => {
  console.log("Incoming choice data:", data);
  const { roomId, choice, playerName } = data;
  const roomID = roomId.roomId || roomId;  // Correctly handle roomId
  
  if (!rooms[roomID]) {
    console.log(`Room ${roomID} does not exist`);
    return;
  }
  
  console.log(`Received choice from ${playerName} in room ${roomID}:`, choice);
  
  if (rooms[roomID]) {
    const playerInRoom = rooms[roomID].players.find(player => player.id === socket.id);
    if (playerInRoom) {
      rooms[roomID].choices[socket.id] = choice;  // Store the choice
      
      // Emit back to player for confirmation
      socket.emit('playersChoice', { playerName, choice });
      
      // Check if both players have made their choices
      if (Object.keys(rooms[roomID].choices).length === 1) {
        // Notify the first player that they're waiting for the second player's choice
        socket.emit('waitingForOpponent');
        
        // Notify the second player that the first player has made their choice
        const otherPlayer = rooms[roomID].players.find(player => player.id !== socket.id);
        io.to(otherPlayer.id).emit('waitingForOpponent');
      }
      
      if (Object.keys(rooms[roomID].choices).length === 2) {
        console.log(`Both players have made their choices in room ${roomID}. Processing the round...`);
        
        // Process the round as usual
        const roundWinner = determineRoundWinner(roomID);
        if (roundWinner) {
          rooms[roomID].scores[roundWinner] = (rooms[roomID].scores[roundWinner] || 0) + 1;
        }
        
        // Increment round number
        rooms[roomID].round = (rooms[roomID].round || 1) + 1;
        
        // Emit the updated scores
        io.to(roomID).emit('scoreUpdate', {
          scores: rooms[roomID].scores,
          round: rooms[roomID].round,
        });

        // Check if the game has reached the maximum number of rounds
        if (rooms[roomID].round > MAX_ROUNDS) {
          // Determine overall winner after all rounds
          const overallWinnerMessage = determineOverallWinner(roomID);
          
          if (overallWinnerMessage.includes("tie")) {
            console.log(`Game tie in room ${roomID}. Resetting for another round.`);
            io.to(roomID).emit('tieGame', { roomID, message: overallWinnerMessage });

            // Reset game data, but not the room itself
            resetGame(roomID);
          } else {
            console.log(`Game over in room ${roomID}`);
            io.to(roomID).emit('gameOver', { roomID, scores: rooms[roomID].scores, overallWinner: overallWinnerMessage });

            // After determining the winner, update the winner's balance
            const winnerUserId = overallWinnerMessage.includes('Player 1') ? rooms[roomID].players[0].userId : rooms[roomID].players[1].userId;
            const totalBet = rooms[roomID].totalBet || 0;

            try {
              if (!winnerUserId) {
                console.log('Invalid winner user ID:', winnerUserId);
                return;
              }

              const winnerUser = await OdinCircledbModel.findById(winnerUserId);
              if (winnerUser) {
                winnerUser.wallet.cashoutbalance += totalBet;
                await winnerUser.save();
                console.log(`${winnerUser.name}'s balance updated`);

                // Save the winner information in the WinnerModel
                const newWinner = new WinnerModel({
                  roomId: roomID,
                  winnerName: winnerUser._id,
                  totalBet: totalBet,
                });
                await newWinner.save();
                console.log('Winner saved to database:', newWinner);
              } else {
                console.log('Winner user not found');
              }
            } catch (error) {
              console.error('Error updating winner balance or saving to database:', error.message);
            }

            // Clear room data if no longer needed
            delete rooms[roomID];
          }
        } else {
          // Reset choices for the next round
          rooms[roomID].choices = {};
          io.to(roomID).emit('nextRound', { round: rooms[roomID].round });
        }
      }
    } else {
      console.error(`Player with socket ID ${socket.id} is not in room ${roomID}`);
    }
  } else {
    console.error(`Players array is undefined for room ${roomID}`);
  }
});


socket.on('placeBet', async ({ roomId, userId, playerNumber, betAmount }) => {
  console.log(`Room ${roomId} - Player ${playerNumber} bets: ${betAmount}`);

  // Initialize room if it doesn't exist
  rooms[roomId] = rooms[roomId] || {};

  if (!playerNumber) {
      socket.emit('betError', { message: 'Player number is required to place a bet.' });
      return;
  }

  // Assign bet and user ID based on player number
  if (playerNumber === 1) {
      rooms[roomId].player1Bet = betAmount;
      rooms[roomId].player1UserId = userId;

      // Save the first player's bet to BetRockModel
      try {
          const newBetRock = new BetModelRock({
              roomId,
              playerName: userId,
              betAmount,
          });
          await newBetRock.save();
          console.log('Player 1 bet saved to BetRockModel:', newBetRock);

          const maskedName = maskPlayerName(userId);
     
        const notificationTitle = 'New Bet Placed!';
        const notificationMessage = `Player ${maskedName} has placed a bet of ${betAmount} Naira`;
        await sendNotificationsToDevices(notificationTitle, notificationMessage);

      } catch (error) {
          console.error('Error saving Player 1 bet to BetRockModel:', error.message);
          socket.emit('betError', { message: 'Error saving Player 1 bet. Please try again.' });
          return;
      }
  } else if (playerNumber === 2) {
      rooms[roomId].player2Bet = betAmount;
      rooms[roomId].player2UserId = userId;
  }

  // Save both players' bets to BetCashModel
  try {
      const newBetCash = new BetCashModel({
          roomId,
          playerName: userId,
          betAmount,
      });
      await newBetCash.save();
      console.log('Both players\' bets saved to BetCashModel:', newBetCash);
  } catch (error) {
      console.error('Error saving bets to BetCashModel:', error.message);
      socket.emit('betError', { message: 'Error saving bets to BetCashModel. Please try again.' });
      return;
  }

  // Emit updated bet info
  const { player1Bet, player2Bet } = rooms[roomId];
  io.to(roomId).emit('betUpdated', {
      playerNumber,
      betAmount,
      player1Bet: player1Bet || 0,
      player2Bet: player2Bet || 0,
  });

  // If both players have placed their bets
  if (player1Bet > 0 && player2Bet > 0) {
      const totalBet = player1Bet + player2Bet;
      rooms[roomId].totalBet = totalBet;

      if (player1Bet === player2Bet) {
          io.to(roomId).emit('equalBet', { player1Bet, player2Bet, totalBet });
          try {
              const [player1, player2] = await Promise.all([
                  OdinCircledbModel.findById(rooms[roomId].player1UserId),
                  OdinCircledbModel.findById(rooms[roomId].player2UserId),
              ]);
              if (!player1 || !player2) throw new Error('User not found');
              player1.wallet.balance -= player1Bet;
              player2.wallet.balance -= player2Bet;
              await Promise.all([player1.save(), player2.save()]);
              console.log(`Deducted bets: Player1: ${player1Bet}, Player2: ${player2Bet}`);
          } catch (err) {
              console.error('Error deducting bets:', err.message);
          }
      } else {
          io.to(roomId).emit('unequalBet', { player1Bet, player2Bet });
          // Reset bets in the room
          rooms[roomId].player1Bet = 0;
          rooms[roomId].player2Bet = 0;
          rooms[roomId].player1UserId = null;
          rooms[roomId].player2UserId = null;
      }
  }
});





 // Handle socket disconnection
 socket.on('disconnect', async () => {
  console.log('A user disconnected:', socket.id);

  // Iterate through the rooms to find the disconnected player's room
  for (const roomId in rooms) {
    const room = rooms[roomId];
    const playerIndex = room.players.findIndex(player => player.id === socket.id);

    if (playerIndex !== -1) {
      const disconnectedPlayer = room.players[playerIndex];
      room.players.splice(playerIndex, 1); // Remove the player from the room

      io.to(roomId).emit('message', `${disconnectedPlayer.name} has left the game`);

      if (room.players.length === 0) {
        // Delete the room if no players are left
        delete rooms[roomId];
        console.log(`Room ${roomId} deleted from memory.`);

        // Attempt to delete the room from BetModelRock in the database
        try {
          const result = await BetModelRock.deleteOne({ roomId });
          if (result.deletedCount > 0) {
            console.log(`Room ${roomId} successfully deleted from BetModelRock in the database.`);
          } else {
            console.warn(`Room ${roomId} not found in BetModelRock in the database.`);
          }
        } catch (error) {
          console.error(`Error deleting room ${roomId} from BetModelRock in the database:`, error.message);
        }
      } else {
        io.to(roomId).emit('opponentLeft', `${disconnectedPlayer.name} has left the game. Waiting for a new player...`);
        room.choices = {}; // Reset choices if a player leaves mid-game
      }
      break;
    }
  }
});


const determineRoundWinner = (roomID) => {
  const room = rooms[roomID];
  const [player1, player2] = room.players;
  const choice1 = room.choices[player1.id];
  const choice2 = room.choices[player2.id];

  let result;
  let winner = null;

  // Determine the round winner
  if (choice1 === choice2) {
      result = "It's a draw!";
  } else if (
      (choice1 === 'Rock' && choice2 === 'Scissors') ||
      (choice1 === 'Scissors' && choice2 === 'Paper') ||
      (choice1 === 'Paper' && choice2 === 'Rock')
  ) {
      result = `${player1.name} wins! ${choice1} beats ${choice2}`;
      winner = player1;
  } else {
      result = `${player2.name} wins! ${choice2} beats ${choice1}`;
      winner = player2;
  }

  // Update scores
  if (winner) {
      room.scores[winner.id] = (room.scores[winner.id] || 0) + 1;
  }

  // // Emit round result
  // io.to(roomID).emit('result', { winner: winner ? winner.name : null, scores: room.scores });
   // Emit round result with updated scores
   io.to(roomID).emit('result', { 
    winner: winner ? winner.name : null, 
    scores: {
      player1: room.scores[player1.id] || 0,
      player2: room.scores[player2.id] || 0,
    }
  });
};


const determineOverallWinner = (roomID) => {
  const room = rooms[roomID];
  const [player1, player2] = room.players;

  const player1Score = room.scores[player1.id] || 0;
  const player2Score = room.scores[player2.id] || 0;

  console.log(`Player 1: ${player1.name}, Score: ${player1Score}`);
  console.log(`Player 2: ${player2.name}, Score: ${player2Score}`);

  let result;
  if (player1Score > player2Score) {
      result = `${player1.name} is the winner!`;
  } else if (player2Score > player1Score) {
      result = `${player2.name} is the winner!`;
  } else {
      result = "It's a tie! The game will reset.";
      resetGame(roomID);
  }

  io.to(roomID).emit('gameResult', { message: result });
  return result;  // Make sure to return the result
};



const resetGame = (roomID) => {
  const room = rooms[roomID];
  room.choices = {};
  room.round = 1;
  console.log(`Game in room ${roomID} has been reset.`);
};

function maskPlayerName(name) {
  if (name.length <= 2) {
    // If the name is very short, mask it entirely
    return '*'.repeat(name.length);
  }
  const firstChar = name[0]; // First character remains visible
  const lastChar = name[name.length - 1]; // Last character remains visible
  const maskedMiddle = '*'.repeat(name.length - 2); // Mask the middle characters
  return `${firstChar}${maskedMiddle}${lastChar}`;
}

// Function to send notifications to registered devices
async function sendNotificationsToDevices(title, message) {
  try {
    // Fetch all devices from the database
    const devices = await Device.find({});
    console.log('Fetched devices:', devices);

    // Extract the expoPushToken from each device
    const tokens = devices.map((device) => device.expoPushToken);
    console.log('Extracted tokens:', tokens);

    if (tokens.length === 0) {
      console.warn('No devices registered for notifications');
      return;
    }

    // Filter out invalid tokens and prepare messages
    const messages = tokens
      .filter((token) => Expo.isExpoPushToken(token)) // Ensure token is valid
      .map((token) => ({
        to: token,
        sound: 'default',
        title,
        body: message,
      }));

    console.log('Prepared messages:', messages);

    if (messages.length === 0) {
      console.warn('No valid Expo push tokens found');
      return;
    }

    // Chunk messages into batches to send with Expo
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    // Send notifications in chunks
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        console.log('Sent notification chunk:', ticketChunk);
      } catch (error) {
        console.error('Error sending notification chunk:', error);
      }
    }

    // Log tickets for debugging
    console.log('Notification tickets:', tickets);
  } catch (error) {
    console.error('Error sending notifications:', error.message);
    console.error('Error stack:', error.stack);
  }
}

function generateUniqueRoomName() {
  return Math.random().toString(36).substr(2, 9); // Generate a random alphanumeric string
}

const MAX_ROUNDS = 4;
});



    

    

};  

module.exports = startSocketServer55;


