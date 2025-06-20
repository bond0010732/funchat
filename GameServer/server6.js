

const socketIo = require('socket.io');
const OdinCircledbModel = require('../models/odincircledb');
const BetModel = require('../models/BetModel');
const WinnerModel = require('../models/WinnerModel');
require("dotenv").config();

// Parse the QUESTIONS environment variable
const QUESTIONS = JSON.parse(process.env.QUESTIONS);


const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

const startQuizGame = (httpServer) => {
    const io = socketIo(httpServer);

    let rooms = {};

    io.on('connection', (socket) => {
        console.log('A user connected to the quiz game');

        socket.on('joinGame', ({ playerName, roomName, userId, totalBet }, callback) => {
            console.log(`User ${playerName} is trying to join room ${roomName} with userId: ${userId}`);
        
            // Initialize the room if it doesn't exist
            if (!rooms[roomName]) {
                rooms[roomName] = {
                    players: {},
                    QUESTIONS: [...QUESTIONS],
                    currentQuestionIndex: 0,
                    gameTimer: null,
                    player1Name: null,
                    player2Name: null,
                    player1Score: 0,
                    player2Score: 0,
                };
                shuffleArray(rooms[roomName].QUESTIONS); // Shuffle questions when room is created
            }
        
            const room = rooms[roomName];
            const numPlayers = Object.keys(room.players).length;
        
            // Check if the room is full
            if (numPlayers >= 2) {
                callback({ error: 'Room is full' });
                return;
            }
        
            // Assign player number based on the number of players
            const playerNumber = numPlayers === 0 ? 1 : 2;
        
              // Assign player1Name or player2Name based on player number
        if (playerNumber === 1) {
        room.player1Name = playerName;
       } else if (playerNumber === 2) {
        room.player2Name = playerName;
         }
            // Add player to the room
            room.players[socket.id] = { playerName, score: 0, userId, totalBet, playerNumber };
            socket.join(roomName);
        
            // Send quiz information to the new player
            socket.emit('quizInfo', { QUESTIONS: room.QUESTIONS });
        
              // Emit the current player information to all clients in the room
          // Emit the current player information to all clients in the room
    io.to(roomName).emit('playerInfo', {
        roomName: roomName,
        player1Name: room.player1Name,
        player2Name: room.player2Name,
        playerNumber,
        totalBet: totalBet,
        score: room.score,
    });
        console.log(`Emitted 'playerInfo' event for ${playerName} in room ${roomName}`);

            // Notify other players in the room
            io.to(roomName).emit('playerJoined', {
                playerName,
                score: 0,
                userId,
                totalBet,
                playerNumber
            });
        
            console.log(`User ${playerName} (Player ${playerNumber}) joined room ${roomName} with userId: ${userId}`);
            console.log(`Current players in room ${roomName}:`, Object.keys(room.players).map(id => room.players[id].playerName));
        
            // Start the game if there are two players
            if (Object.keys(room.players).length === 2) {
                io.to(roomName).emit('roomFull', { message: 'Both players have joined. Game is starting!' });
                startGame(roomName);
            }

            callback({ success: true }); // or callback({ error: 'Some error' });
        });
        
        

        const startGame = (roomName) => {
            const room = rooms[roomName];
            if (!room) return;

            // Set a game-wide timer (e.g., 60 seconds)
            room.gameTimer = setTimeout(() => {
                endGame(roomName);
            }, 20000); // 10-second timer

            startNextQuestion(roomName);
        };

        const startNextQuestion = (roomName) => {
            const room = rooms[roomName];
            if (!room) return;

            if (room.currentQuestionIndex < room.QUESTIONS.length) {
                io.to(roomName).emit('nextQuestion', { questionIndex: room.currentQuestionIndex });
            } else {
                endGame(roomName);
            }
        };

        const endGame = async (roomName) => {
            const room = rooms[roomName];
            if (!room) return;
        
            clearTimeout(room.gameTimer); // Clear the game timer
            console.log(`Game over for room ${roomName}`);
        
            const playerIds = Object.keys(room.players);
            if (playerIds.length < 2) {
                console.log(`Not enough players in room ${roomName} to determine a winner.`);
                return;
            }
        
            const player1 = room.players[playerIds[0]];
            const player2 = room.players[playerIds[1]];
        
            if (player1.score === player2.score) {
                console.log('It\'s a draw! Resetting the game...');
                // Reset game for a draw
                player1.score = 0;
                player2.score = 0;
                room.currentQuestionIndex = 0;
                shuffleArray(room.QUESTIONS); // Shuffle questions again
                io.to(roomName).emit('gameReset', { message: 'The game is a draw! Restarting the game...' });
                startGame(roomName); // Restart the game
            } else {
                let highestScore = -1;
                let topPlayer = null;
        
                // Find the player with the highest score
                for (const playerId in room.players) {
                    const p = room.players[playerId];
                    if (p.score > highestScore) {
                        highestScore = p.score;
                        topPlayer = p.playerName;
                    }
                }
        
                // Emit the game over and takeover events
                io.to(roomName).emit('gameOver', { players: room.players, topPlayer, highestScore });
                io.to(roomName).emit('takeover', { topPlayer, message: `${topPlayer} takes over!` });
        
                // Clean up room data
                delete rooms[roomName];
        
         // Fetch and update winner in the database
try {
    const winningPlayerId = Object.keys(room.players).find(playerId => room.players[playerId].playerName === topPlayer);
    const winningPlayer = room.players[winningPlayerId];

    if (!winningPlayer) {
        throw new Error('Winning player not found');
    }

    const totalBet = room.totalBet;

    // Ensure totalBet is a valid number
    if (typeof totalBet !== 'number' || isNaN(totalBet)) {
        throw new Error(`Invalid totalBet: ${totalBet}`);
    }

    const winnerUser = await OdinCircledbModel.findById(winningPlayer.userId);

    if (!winnerUser) {
        throw new Error('Winner user not found');
    }

    // Ensure cashoutbalance is a number
    winnerUser.wallet.cashoutbalance = (winnerUser.wallet.cashoutbalance || 0) + totalBet;
    await winnerUser.save();

    console.log(`Winner's balance updated with total bet: ${totalBet}`);

    const newWinner = new WinnerModel({
        roomId: roomName,
        winnerName: winningPlayer.userId,
        totalBet: totalBet,
    });
    await newWinner.save();
    console.log('Winner saved to database:', newWinner);

} catch (error) {
    console.error('Error updating winner\'s balance or saving to DB:', error.message);

                    io.to(roomName).emit('error', 'An error occurred while updating the winner\'s balance. Please try again.');
                }
            }
        };
        
        

        socket.on('submitAnswer', ({ roomName, answerIndex }) => {
            console.log(`Answer submitted in room ${roomName} by player ${socket.id} with answer index ${answerIndex}`);
            
            const room = rooms[roomName];
            if (!room) {
                console.log(`Room ${roomName} does not exist`);
                socket.emit('error', { message: 'Room does not exist' });
                return;
            }

            const player = room.players[socket.id];
            if (!player) {
                console.log(`Player with ID ${socket.id} not found in room ${roomName}`);
                socket.emit('error', { message: 'Player not found in room' });
                return;
            }


            // If only one player in the room, notify the client to wait for the other player
            if (Object.keys(room.players).length === 1) {
                socket.emit('waitingForPlayer', { message: 'Waiting for the other player to join.' });
                return;
            }
        

            const currentQuestion = room.QUESTIONS[room.currentQuestionIndex];
            console.log(`Current question for room ${roomName}: ${currentQuestion.question}`);
            const isCorrect = currentQuestion.answer === answerIndex;

            if (isCorrect) {
                player.score++;
                console.log(`Player ${socket.id} answered correctly. New score: ${player.score}`);
                io.to(roomName).emit('updateScore', { playerId: socket.id, score: player.score });
            } else {
                console.log(`Player ${socket.id} answered incorrectly`);
            }

            room.currentQuestionIndex++;
            startNextQuestion(roomName);
        });


        socket.on('placeBet', async ({ roomName, userId, playerNumber, playerName, betAmount }) => {
            console.log(`Room ${roomName} - Player ${playerNumber} bets: ${betAmount}`);
            
             // Initialize room if it doesn't exist
             if (!rooms[roomName]) {
              rooms[roomName] = {
                player1Bet: 0,
                player2Bet: 0,
                player1UserId: null,
                player2UserId: null,
                totalBet: 0,
              };
              console.log(`Room ${roomName} created.`);
            }
          
            const room = rooms[roomName]; // Safely reference the room object
          
            // Store the bet amount and user ID in variables based on player number
            let playerBet;
            let otherPlayerBet;
            let playerUserId;
            let otherPlayerUserId;
          
           // For Player 1
          if (playerNumber === 1) {
            playerBet = betAmount;
            otherPlayerBet = rooms[roomName].player2Bet;
            playerUserId = userId;
            otherPlayerUserId = rooms[roomName].player2UserId;
            rooms[roomName].player1Bet = betAmount;
            rooms[roomName].player1UserId = userId;
            playerName = "Player 1";  // Replace with actual player's name, if available
          
          // For Player 2
          } else if (playerNumber === 2) {
            playerBet = betAmount;
            otherPlayerBet = rooms[roomName].player1Bet;
            playerUserId = userId;
            otherPlayerUserId = rooms[roomName].player1UserId;
            rooms[roomName].player2Bet = betAmount;
            rooms[roomName].player2UserId = userId;
            playerName = "Player 2";  // Replace with actual player's name, if available
          }
          
          // Save bet to BetCashModel
          try {
            const betCash = new BetModel({
              roomId: roomName,
              playerName,  // Ensure playerName is valid
              betAmount,
            });
            await betCash.save();
            console.log('Both bets saved to BetCashModel database:', betCash);
          } catch (error) {
            console.error('Error saving bets to BetCashModel:', error.message);
          }
          
            // Check if both players have placed their bets
          
            const { player1Bet, player2Bet, player1UserId, player2UserId } = room;
          
            if (player1Bet > 0 && player2Bet > 0) {
              const totalBet = player1Bet + player2Bet;
          
              // Store the totalBet in the room object
              room.totalBet = totalBet;
          
              console.log(`Total Bet: ${totalBet}`);
          
              // Emit 'betPlaced' event to all clients in the room with updated bet information
              io.to(roomName).emit('betPlaced', { 
                player1UserId, 
                player1Bet, 
                player2UserId, 
                player2Bet, 
                totalBet,
              });
          
              // Check if player1Bet equals player2Bet
              if (player1Bet === player2Bet) {
                // Emit 'equalBet' event if the bets are equal
                io.to(roomName).emit('equalBet', { 
                  player1UserId, 
                  player1Bet, 
                  player2UserId, 
                  player2Bet 
                });
          
                // Deduct the bet amount from the user's balance in the database
                try {
                  // Deduct the bet amount from the player's balance
                  const playerUser = await OdinCircledbModel.findById(playerUserId);
                  const otherPlayerUser = await OdinCircledbModel.findById(otherPlayerUserId);
          
                  if (!playerUser || !otherPlayerUser) {
                    throw new Error('User not found');
                  }
          
                  playerUser.wallet.balance -= playerBet;
                  otherPlayerUser.wallet.balance -= otherPlayerBet;
          
                  await Promise.all([playerUser.save(), otherPlayerUser.save()]);
          
                  console.log(`Bet amounts deducted from users ${playerUserId} and ${otherPlayerUserId}: ${playerBet}, ${otherPlayerBet}`);
                } catch (error) {
                  console.error('Error deducting bet amount from user balance:', error.message);
                }
              } else {
                  // Once both bets are placed, compare them
    // if (player1Bet > 0 && player2Bet > 0) {
    //     if (player1Bet !== player2Bet) {
    //       // Emit the unequalBet event if the bets are not equal
    //       io.to(roomName).emit('unequalBet', { player1Bet, player2Bet });
    //     }
    //   }
                // If the bets are not equal, notify the clients and reset the bet amounts
                io.to(roomName).emit('unequalBet', {
                  player1UserId,
                  player1Bet,
                  player2UserId,
                  player2Bet,
                });
          
                console.log('Bets are unequal. Resetting bet amounts.');
          
                // Reset the bet amounts and user IDs
                room.player1Bet = 0;
                room.player2Bet = 0;
              }
            }
          });
          

        // socket.on('placeBet', async ({ roomName, userId, playerNumber, betAmount, playerName }) => {
        //     console.log(`Room ${roomName} - Player ${playerNumber} bets: ${betAmount}`);
            
        //     // Ensure the room object exists
        //     rooms[roomName] = rooms[roomName] || {};
  
        //     // Store the bet amount and user ID in variables based on player number
        //     let playerBet;
        //     let otherPlayerBet;
        //     let playerUserId;
        //     let otherPlayerUserId;
          
        //     if (playerNumber === 1) {
        //         playerBet = betAmount;
        //         otherPlayerBet = rooms[roomName].player2Bet;
        //         playerUserId = userId;
        //         otherPlayerUserId = rooms[roomName].player2UserId;
        //         rooms[roomName].player1Bet = betAmount;
        //         rooms[roomName].player1UserId = userId;
        //         playerName = userId;
        //     } else if (playerNumber === 2) {
        //         playerBet = betAmount;
        //         otherPlayerBet = rooms[roomName].player1Bet;
        //         playerUserId = userId;
        //         otherPlayerUserId = rooms[roomName].player1UserId;
        //         rooms[roomName].player2Bet = betAmount;
        //         rooms[roomName].player2UserId = userId;
        //         playerName = userId;
        //     }

        //     try {
        //       const newBet = new BetModel({
        //             roomName,
        //             playerName,
        //             betAmount,
        //       });
        //     await newBet.save();
        //     console.log('Bet saved to database:', newBet);
        //     } catch (error) {
        //     console.error('Error saving bet to database:', error.message);
        //      }
        //     // Check if both players have placed their bets
        //     const { player1Bet, player2Bet, player1UserId, player2UserId } = rooms[roomName];
          
        //     if (player1Bet > 0 && player2Bet > 0) {
        //         const totalBet = player1Bet + player2Bet;
        
        //         // Store the totalBet in the room object
        //         rooms[roomName].totalBet = totalBet;
        
        //         console.log(`Total Bet: ${totalBet}`);
          
        //         // Emit 'betPlaced' event to all clients in the room with updated bet information
        //         io.to(roomName).emit('betPlaced', { 
        //             player1UserId, 
        //             player1Bet, 
        //             player2UserId, 
        //             player2Bet, 
        //             totalBet,
        //         });
          

        //         // Check if player1Bet equals player2Bet
        //         if (player1Bet === player2Bet) {
        //             // Emit 'equalBet' event if the bets are equal
        //             io.to(roomName).emit('equalBet', { 
        //                 player1UserId, 
        //                 player1Bet, 
        //                 player2UserId, 
        //                 player2Bet,
        //             });
        //                      // Check if player1Bet equals player2Bet
        // console.log('Checking bets:', { player1Bet, player2Bet, areEqual: player1Bet === player2Bet });

        //             // Deduct the bet amount from the user's balance in the database
        //             try {
        //                 // Deduct the bet amount from the player's balance
        //                 const playerUser = await OdinCircledbModel.findById(player1UserId);
        //                 const otherPlayerUser = await OdinCircledbModel.findById(player2UserId);
          
        //                 if (!playerUser || !otherPlayerUser) {
        //                     throw new Error('User not found');
        //                 }
          
        //                 playerUser.wallet.balance -= player1Bet;
        //                 otherPlayerUser.wallet.balance -= player2Bet;
          
        //                 await Promise.all([playerUser.save(), otherPlayerUser.save()]);
          
        //                 console.log(`Bet amounts deducted from users ${player1UserId} and ${player2UserId}: ${player1Bet}, ${player2Bet}`);
        //             } catch (error) {
        //                 console.error('Error deducting bet amount from user balance:', error.message);
        //                 // Handle the error (e.g., send an error response to the client)
        //             }
        //         } else {
        //             // If the bets are not equal, notify the clients and reset the bet amounts
        //             io.to(roomName).emit('unequalBet', {
        //                 player1UserId,
        //                 player1Bet,
        //                 player2UserId,
        //                 player2Bet,
        //             });
        
        //             console.log('Bets are unequal. Resetting bet amounts.');
          
        //             // Reset the bet amounts and user IDs
        //             rooms[roomName].player1Bet = 0;
        //             rooms[roomName].player2Bet = 0;
        //             rooms[roomName].player1UserId = null;
        //             rooms[roomName].player2UserId = null;
        //         }
        //     }
        // });

        socket.on('disconnect', () => {
            for (const roomName in rooms) {
                const room = rooms[roomName];
                const player = room.players[socket.id];
                if (player) {
                    delete room.players[socket.id];
                    io.to(roomName).emit('playerLeft', { playerName: player.playerName });
                    if (Object.keys(room.players).length === 0) {
                        delete rooms[roomName];
                    }
                    break;
                }
            }
            console.log('A user disconnected from the quiz game');
        });
    });
};

module.exports = startQuizGame;
