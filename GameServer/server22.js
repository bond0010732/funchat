const socketIO = require('socket.io');
const OdinCircledbModel = require('../models/odincircledb');
const BetModel = require('../models/BetModel');
const WinnerModel = require('../models/WinnerModel');
const BetModelDice = require('../models/BetModelDice');
const BetCashModel = require('../models/BetCashModel');

//const rooms = {};
let rooms = {};

function startSocketServer22(httpServer) {
    const io = socketIO(httpServer)

    io.on('connection', (socket) => {
        console.log('A user connected dice22');


        socket.on('joinRoom', ({ playerName, userId, roomId, totalBet, playerNumber, player1Bet, player2Bet }) => {
            console.log('Received joinRoom event with:', { playerName, userId, roomId, totalBet, playerNumber });
        
            // Initialize the rooms object if it hasn't been initialized
            if (!rooms) {
                rooms = {};
                console.log('Initialized rooms object.');
            }
        
            // Check if the roomId is already being used
            let room = rooms[roomId];
        
            if (!room) {
                // Create a new room using the provided roomId
                roomId,
                console.log(`Creating new room with roomId: ${roomId}`);
                room = {
                    roomId,
                    players: [],
                    turn: null,
                    totalBet: totalBet || 0,
                    cards: Array(9)
                        .fill(null)
                        .map((_, index) => ({
                            id: index + 1,
                            value: Math.floor(Math.random() * 6) + 1, // Random card value (1 to 6)
                            flipped: false,
                            hidden: false,
                        }))
                        .sort(() => Math.random() - 0.5), // Shuffle cards
                };
                rooms[roomId] = room;
                console.log(`New room created with roomId: ${roomId}`);
            } else {
                console.log(`Found existing room with roomId: ${roomId}`);
            }
        
            console.log(`Joining room with roomId: ${roomId}`);
        
            // Join the room with the specified name
            try {
                socket.join(roomId);
                console.log(`${playerName} (userId: ${userId}) joined room ${roomId}`);
            } catch (error) {
                console.error(`Failed to join room ${roomId}:`, error);
                return;
            }
        
            // Track the number of players in the room and their turns
            if (!room.players) room.players = [];
        
            if (room.players.length < 2) {
                room.players.push({
                    name: playerName,
                    userId,
                    id: socket.id,
                    totalBet,
                    playerNumber,
                });
                console.log(`Player added to room ${roomId}:`, room.players);
        
                // Emit the current player information to the client
                socket.emit('playerInfo', {
                    roomId,
                    playerNumber: room.players.length,
                    totalBet,
                    playerName,
                });
                console.log(`Player info emitted for room ${roomId}`);
        
                // Set the turn if it's the first player joining
                if (room.players.length === 2) {
                    room.turn = socket.id;
                    io.to(socket.id).emit('yourTurn');
                    console.log('It\'s your turn:', socket.id);
                }
        
                // Emit the current players in the room and the current turn to all players
                io.to(roomId).emit('updateGame', {
                    players: room.players,
                    roomId,
                    turn: room.turn,
                    cards: room.cards.map((card) => ({
                        id: card.id,
                        flipped: card.flipped,
                        hidden: card.hidden,
                    })), // Only send non-sensitive card information
                });
                console.log(`Game updated for room ${roomId}`);
        
                // Check if both players are connected
                if (room.players.length === 2) {
                    console.log('Both players are connected in room:', roomId);
                    io.to(roomId).emit('bothPlayersConnected');
                }
            } else {
                // Handle the case when the room is already full
                socket.emit('roomFull', 'The room is already full.');
                console.log('Room full, cannot join:', roomId);
            }
        });


     
      socket.on('flipCard', async ({ roomId, cardId }) => {
        const room = rooms[roomId];
      
        // Ensure it's the current player's turn
        if (socket.id !== room.turn) {
          io.to(socket.id).emit('notYourTurn');
          return;
        }
      
        // Find the card in the room's deck
        const card = room.cards.find((c) => c.id === cardId);
      
        if (!card || card.flipped || card.hidden) {
          io.to(socket.id).emit('invalidMove');
          return;
        }
      
        // Flip the card
        card.flipped = true;
      
        // Check for the winning condition (if card value is 6)
        let winner = null;
        if (card.value === 6) {
          winner = room.players.find((player) => player.id === socket.id).name;
      
          // Handle winner logic (cashout, save winner details, etc.)
          try {
            const winnerUserId = room.players.find((player) => player.id === socket.id).userId;
            const winnerUser = await OdinCircledbModel.findById(winnerUserId);
      
            if (!winnerUser) throw new Error('Winner user not found');
      
            winnerUser.wallet.cashoutbalance += room.totalBet;
            await winnerUser.save();
      
            const newWinner = new WinnerModel({
              roomId,
              winnerName: winner,
              totalBet: room.totalBet,
            });
            await newWinner.save();
      
            console.log(`Winner ${winner} awarded total bet: ${room.totalBet}`);
          } catch (error) {
            console.error('Error processing winner:', error.message);
          }
        }
      
        // Switch to the next player's turn
        const currentPlayerIndex = room.players.findIndex((player) => player.id === socket.id);
        const nextPlayer = room.players[(currentPlayerIndex + 1) % room.players.length];
        room.turn = nextPlayer.id;
      
        // Broadcast updated game state to all players
        io.to(roomId).emit('updateGame', {
          
          cards: room.cards,
          turn: room.turn,
          winner: winner,
        });
      
        // If there's a winner, game over
        if (winner) {
          io.to(roomId).emit('gameOver', `${winner} wins!`);
        }
      });



        socket.on('acknowledgeGameOver', ({ winnerUserId, totalBet, message }) => {
            console.log('Acknowledgment received from client:', winnerUserId, message, totalBet);
            // Process the acknowledgment or send further updates as needed
        });

        // Handle chat message event
        socket.on('chatMessage', ({ roomId, playerName, message }) => {
            // Broadcast the chat message to all clients in the room
            io.to(roomId).emit('chatMessage', { playerName, message });
        });

      socket.on('placeBet', async ({ roomId, userId, playerNumber, betAmount }) => {
    console.log(`Room ${roomId} - Player ${playerNumber} bets: ${betAmount}`);
    
    // Ensure the room object exists
    rooms[roomId] = rooms[roomId] || {};

    // Store the bet amount and user ID based on player number
    if (playerNumber === 1) {
        rooms[roomId].player1Bet = betAmount;
        rooms[roomId].player1UserId = userId;

        // Save Player 1's bet to BetModelDice
        try {
            const newBetDice = new BetModelDice({
                roomId,
                playerName: userId,
                betAmount,
            });
            await newBetDice.save();
            console.log('Player 1 bet saved to BetModelDice:', newBetDice);
        } catch (error) {
            console.error('Error saving Player 1 bet to BetModelDice:', error.message);
        }
    } else if (playerNumber === 2) {
        rooms[roomId].player2Bet = betAmount;
        rooms[roomId].player2UserId = userId;
    }

    // Check if both players have placed their bets
    const { player1Bet, player2Bet, player1UserId, player2UserId } = rooms[roomId];

    if (player1Bet > 0 && player2Bet > 0) {
        const totalBet = player1Bet + player2Bet;
        rooms[roomId].totalBet = totalBet;

        console.log(`Total Bet: ${totalBet}`);

        // Save both players' bets to BetModelCash
        try {
            const newBetCash = new BetCashModel({
                roomId,
                playerName: userId,
                betAmount,
                
            });
            await newBetCash.save();
            console.log('Both players\' bets saved to BetModelCash:', newBetCash);
        } catch (error) {
            console.error('Error saving bets to BetModelCash:', error.message);
        }

        // Emit 'betPlaced' event to all clients in the room with updated bet information
        io.to(roomId).emit('betPlaced', {
            player1UserId,
            player1Bet,
            player2UserId,
            player2Bet,
            totalBet,
        });

        // If the bets are equal
        if (player1Bet === player2Bet) {
            io.to(roomId).emit('equalBet', { player1UserId, player1Bet, player2UserId, player2Bet });

            try {
                // Deduct the bet amounts from both players' balances
                const [player1, player2] = await Promise.all([
                    OdinCircledbModel.findById(player1UserId),
                    OdinCircledbModel.findById(player2UserId),
                ]);

                if (!player1 || !player2) {
                    throw new Error('User not found');
                }

                player1.wallet.balance -= player1Bet;
                player2.wallet.balance -= player2Bet;

                await Promise.all([player1.save(), player2.save()]);

                console.log(`Bet amounts deducted: Player 1 (${player1UserId}): ${player1Bet}, Player 2 (${player2UserId}): ${player2Bet}`);
            } catch (error) {
                console.error('Error deducting bet amounts from user balances:', error.message);
            }
        } else {
            // If the bets are unequal, notify the clients and reset the bet amounts
            io.to(roomId).emit('unequalBet', {
                player1UserId,
                player1Bet,
                player2UserId,
                player2Bet,
            });

            console.log('Bets are unequal. Resetting bet amounts.');

            // Reset the bet amounts and user IDs
            rooms[roomId].player1Bet = 0;
            rooms[roomId].player2Bet = 0;
            rooms[roomId].player1UserId = null;
            rooms[roomId].player2UserId = null;
        }
    }
});


      
      socket.on('disconnect', async () => {
        console.log('User disconnected');
      
        const roomId = Object.keys(rooms).find((roomId) => {
          const room = rooms[roomId];
          return room && Array.isArray(room.players) && room.players.some((player) => player.id === socket.id);
        });
      
        if (roomId) {
          console.log(`Player disconnected from room ${roomId}`);
          const room = rooms[roomId];
      
          // Remove the player
          room.players = room.players.filter((player) => player.id !== socket.id);
      
          if (room.players.length === 0) {
            // Room is empty, delete it
            delete rooms[roomId];
            console.log(`Room ${roomId} removed from memory`);
      
            try {
              const result = await BetModelDice.findOneAndDelete({ roomId });
              if (result) {
                console.log(`Room ${roomId} successfully deleted from the database.`);
              } else {
                console.warn(`Room ${roomId} not found in the database.`);
              }
            } catch (err) {
              console.error(`Error deleting room ${roomId} from the database:`, err);
            }
          } else {
            console.log(`Remaining players in room ${roomId}:`, room.players);
          }
        } else {
          console.log('Disconnected player was not part of any room.');
        }
      });
      
      
      
    });
}

// Function to generate a unique room name
function generateUniqueRoomName() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 8; // Define the desired length of the room name
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result; // Generate a random alphanumeric string
}



module.exports = startSocketServer22;






