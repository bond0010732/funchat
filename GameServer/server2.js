// server.js

const socketIO = require('socket.io');
const OdinCircledbModel = require('../models/odincircledb');
const BetModel = require('../models/BetModel');
const WinnerModel = require('../models/WinnerModel');

// Keep track of players in each room and their turns
const rooms = {};

function startSocketServer2(httpServer) {
    const io = socketIO(httpServer)

    io.on('connection', (socket) => {
        console.log('A user connected dice2');
      
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
           
          
          socket.on('chatMessage', ({ roomId, playerName, message }) => {
            // Broadcast the chat message to all clients in the room
            io.to(roomId).emit('chatMessage', { playerName, message });
          });


          socket.on('placeBet', async ({ roomId, userId, playerNumber, betAmount }) => {
            console.log(`Room ${roomId} - Player ${playerNumber} bets: ${betAmount}`);
            
            // Ensure the room object exists
            rooms[roomId] = rooms[roomId] || {};

            // Store the bet amount and user ID in variables based on player number
            let playerBet;
            let otherPlayerBet;
            let playerUserId;
            let otherPlayerUserId;
            let playerName; 
          
            if (playerNumber === 1) {
                playerBet = betAmount;
                otherPlayerBet = rooms[roomId].player2Bet;
                playerUserId = userId;
                otherPlayerUserId = rooms[roomId].player2UserId;
                rooms[roomId].player1Bet = betAmount;
                rooms[roomId].player1UserId = userId;
                playerName = userId;
            } else if (playerNumber === 2) {
                playerBet = betAmount;
                otherPlayerBet = rooms[roomId].player1Bet;
                playerUserId = userId;
                otherPlayerUserId = rooms[roomId].player1UserId;
                rooms[roomId].player2Bet = betAmount;
                rooms[roomId].player2UserId = userId;
                playerName = userId;
            }
          
                    // Save the bet to the database
           try {
            const newBet = new BetModel({
                  roomId,
                  playerName,
                  betAmount,
            });
          await newBet.save();
          console.log('Bet saved to database:', newBet);
          } catch (error) {
          console.error('Error saving bet to database:', error.message);
           }
            // Check if both players have placed their bets
            const { player1Bet, player2Bet, player1UserId, player2UserId } = rooms[roomId];
          
            if (player1Bet > 0 && player2Bet > 0) {
                const totalBet = player1Bet + player2Bet;
        
                // Store the totalBet in the room object
                rooms[roomId].totalBet = totalBet;
        
                console.log(`Total Bet: ${totalBet}`);
          
                // Emit 'betPlaced' event to all clients in the room with updated bet information
                io.to(roomId).emit('betPlaced', { 
                    player1UserId, 
                    player1Bet, 
                    player2UserId, 
                    player2Bet, 
                    totalBet,
                });
          
                // Check if player1Bet equals player2Bet
                if (player1Bet === player2Bet) {
                    // Emit 'equalBet' event if the bets are equal
                    io.to(roomId).emit('equalBet', { 
                        player1UserId, 
                        player1Bet, 
                        player2UserId, 
                        player2Bet 
                    });
          
                    // Deduct the bet amount from the user's balance in the database
                    try {
                        // Deduct the bet amount from the player's balance
                        const playerUser = await OdinCircledbModel.findById(player1UserId);
                        const otherPlayerUser = await OdinCircledbModel.findById(player2UserId);
          
                        if (!playerUser || !otherPlayerUser) {
                            throw new Error('User not found');
                        }
          
                        playerUser.wallet.balance -= player1Bet;
                        otherPlayerUser.wallet.balance -= player2Bet;
          
                        await Promise.all([playerUser.save(), otherPlayerUser.save()]);
          
                        console.log(`Bet amounts deducted from users ${player1UserId} and ${player2UserId}: ${player1Bet}, ${player2Bet}`);
                    } catch (error) {
                        console.error('Error deducting bet amount from user balance:', error.message);
                        // Handle the error (e.g., send an error response to the client)
                    }
                } else {
                    // If the bets are not equal, notify the clients and reset the bet amounts
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
          
       

        socket.on('disconnect', () => {
          console.log('User disconnected frieds');
        
          // Iterate over all rooms to find the one that the disconnected player was in
          Object.keys(rooms).forEach((roomId) => {
            const room = rooms[roomId];
        
            // Check if the room exists and if the room has players
            if (room && room.players) {
              // Remove the player from the room when they disconnect
              room.players = room.players.filter((player) => player.id !== socket.id);
        
              // Update the turn if there are still players in the room
              room.turn = room.players.length > 0 ? room.players[0].id : null;
        
              // Emit the updated game state to all players in the room
              io.to(roomId).emit('updateGame', {
                players: room.players,
                turn: room.turn,
              });
        
              // If the room is empty after the player leaves, you might want to delete the room
              if (room.players.length === 0) {
                delete rooms[roomId];
              }
            }
          });
        });
    });
}

module.exports = startSocketServer2;