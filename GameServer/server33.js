const socketIO = require('socket.io');
const OdinCircledbModel = require('../models/odincircledb');
const BetModelDice = require('../models/BetModelDice');
const WinnerModel = require('../models/WinnerModel');
const BetCashModel = require('../models/BetCashModel');
const BetModelCoin = require('../models/BetModelCoin');

function startSocketServer33(httpServer) {
    const io = socketIO(httpServer);

    const Grooms = {};

    // Function to generate a random room name
    function generateRandomRoomName(length = 6) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    io.on('connection', (socket) => {
        console.log('A user connected');

        // Function to find or create a room with available spots
       // Function to find or create a room with available spots
function findOrCreateRoom() {
    for (const roomName in Grooms) {
        if (Grooms.hasOwnProperty(roomName) && Grooms[roomName].players && Grooms[roomName].players.length < 2) {
            return roomName;
        }
    }
    // If no room is found with available spots, create a new one
    const newRoomName = generateRandomRoomName();
    Grooms[newRoomName] = { players: [], currentTurnPlayer: null, currentRound: 0 };
    return newRoomName;
}


        socket.on('joinRoom', ({ playerName, userId, totalBet, playerNumber }) => {
            console.log(`Received joinRoom event with userId: ${userId}`);

            const roomName = findOrCreateRoom();
            const position = Grooms[roomName].players.length === 0 ? 'head' : 'tail';

            socket.join(roomName);
            console.log(`User joined room ${roomName} as ${position}`);

            const player = {
                socketId: socket.id,
                playerName,
                userId,  // Add userId to the player object
                position: Grooms[roomName].players.length === 0 ? 'head' : 'tail',
            };

            Grooms[roomName].players.push(player);

             // Emit the current player information to all clients in the room
             socket.emit('playerInfo',{
                roomName: roomName,
                userId: userId,
                playerName: playerName,
                playerNumber: Grooms[roomName].players.length,
                totalBet: totalBet,
                position,
               }
              );

            if (Grooms[roomName].players.length === 2) {
                Grooms[roomName].currentTurnPlayer = Grooms[roomName].players[0].playerName;
                io.to(roomName).emit('gameStart', {
                    roomName,
                    players: Grooms[roomName].players,
                    currentTurnPlayer: Grooms[roomName].currentTurnPlayer,
                });
                io.to(roomName).emit('playersConnected', { roomName });
            }

            const roomScores = {};
            socket.on('flipCoin', async ({ roomName }) => {
                const result = Math.random() < 0.5 ? 'head' : 'tail';
              
                console.log(`Coin flip result: ${result}`);
              
                if (Grooms[roomName] && Grooms[roomName].players) {
                  const currentPlayerIndex = Grooms[roomName].players.findIndex(player => player.playerName === Grooms[roomName].currentTurnPlayer);
              
                  if (currentPlayerIndex !== -1) {
                    // Calculate the next player's index
                    const nextPlayerIndex = (currentPlayerIndex + 1) % Grooms[roomName].players.length;
              
                    // Ensure the next player index is valid before setting the currentTurnPlayer
                    if (Grooms[roomName].players[nextPlayerIndex]) {
                      Grooms[roomName].currentTurnPlayer = Grooms[roomName].players[nextPlayerIndex].playerName;
                      console.log(`Next turn: ${Grooms[roomName].currentTurnPlayer}`);
                    } else {
                      console.error(`Player at index ${nextPlayerIndex} does not exist in room "${roomName}".`);
                    }
              
                    // Update scores for the current round
                    roomScores[roomName] = roomScores[roomName] || { head: 0, tail: 0 };
                    roomScores[roomName][result]++;
              
                    // Check if all players have taken their turns in the current round
                    if (nextPlayerIndex === 0) {
                      // Increment the round
                      Grooms[roomName].currentRound++;
              
                      // Emit an event to inform clients that the round has ended
                      io.to(roomName).emit('roundEnd', { round: Grooms[roomName].currentRound });
                    }
                  } else {
                    console.error(`Current turn player "${Grooms[roomName].currentTurnPlayer}" not found in room "${roomName}".`);
                  }
                } else {
                  console.error(`Room "${roomName}" does not exist or has no players.`);
                  // Handle the error as appropriate (e.g., return early, throw an error, etc.)
                }
              
                // Check if it's the end of the game (after round 3)
                if (Grooms[roomName].currentRound > 3) {
                  const { head, tail } = roomScores[roomName];
                  let winner = null;
              
                  // Determine the winner based on the highest score
                  if (head > tail) {
                    winner = 'head';
                  } else if (tail > head) {
                    winner = 'tail';
                  }
              
                  console.log(`Determined winner: ${winner}`);
              
                  if (winner) {
                    // Log the players array
                    console.log(`Players in room "${roomName}": ${JSON.stringify(Grooms[roomName].players)}`);
              
                    // Find the player who supported the winning result
                    const winningPlayer = Grooms[roomName].players.find(player => {
                      console.log(`Checking player ${player.playerName} with position ${player.position} against winner ${winner}`);
                      return player.position === winner;
                    });
              
                    console.log(`Winning Player Details: ${JSON.stringify(winningPlayer)}`); // Debugging info
              
                    if (winningPlayer) {
                      // Emit an event to inform clients about the game result
                      io.to(roomName).emit('gameEnd', {
                        winner,
                        winnerUserId: winningPlayer.userId,
                        playerName: winningPlayer.playerName,
                        totalBet: Grooms[roomName].totalBet
                      });
                      
                      console.log(`Game end emitted for room: ${roomName} with winner: ${winner}`);
              
                      try {
                        const winnerUserId = winningPlayer.userId;
                        console.log(`Fetching winner from DB: ${winnerUserId}`);
                        const winnerUser = await OdinCircledbModel.findById(winnerUserId);
              
                        if (!winnerUser) {
                          throw new Error('Winner user not found');
                        }
              
                        const totalBet = Grooms[roomName].totalBet;
                        winnerUser.wallet.cashoutbalance += totalBet;
                        await winnerUser.save();
              
                        console.log(`Winner's balance updated with total bet: ${totalBet}`);
              
                        const newWinner = new WinnerModel({
                          roomId: roomName,
                          winnerName: winnerUserId,
                          totalBet: totalBet,
                        });
                        await newWinner.save();
                        console.log('Winner saved to database:', newWinner);
              
                      } catch (error) {
                        console.error('Error updating winner\'s balance or saving to DB:', error.message);
                        io.to(roomName).emit('error', 'An error occurred while updating the winner\'s balance. Please try again.');
                      }
                    } else {
                      console.error('No winning player found for the game.');
                      io.to(roomName).emit('gameEnd', {
                        winner: 'No winner found',
                        winnerUserId: null,
                        playerName: null,
                        totalBet: 0
                      });
                    }
                  }
                }
              
                // Emit the coin result and the next turn player to the clients
                io.to(roomName).emit('coinResult', { result, nextTurnPlayer: Grooms[roomName].currentTurnPlayer });
              });



        
            socket.on('chatMessage', ({ roomName, playerName, message }) => {
                io.to(roomName).emit('chatMessage', { playerName, message });
            });
            

            socket.on('placeBet', async ({ roomName, userId, playerNumber, betAmount, playerName }) => {
                console.log(`Room ${roomName} - Player ${playerNumber} bets: ${betAmount}`);
                
                // Ensure the room object exists
                Grooms[roomName] = Grooms[roomName] || {};
            
                // Update the room data based on player number
                if (playerNumber === 1) {
                    Grooms[roomName].player1Bet = betAmount;
                    Grooms[roomName].player1UserId = userId;
                    playerName = userId;
                } else if (playerNumber === 2) {
                    Grooms[roomName].player2Bet = betAmount;
                    Grooms[roomName].player2UserId = userId;
                    playerName = userId
                }
            
                try {
                    // Save bet to BetModel only if it's Player 1
                    if (playerNumber === 1) {
                        const newBet = new BetModelCoin({
                            roomName: roomName,
                            playerName,
                            betAmount,
                        });
                        await newBet.save();
                        console.log('Bet saved to BetModeCoin:', newBet);
                    }
            
                    // Save bets for both players to BetCashModel
                    const newBetCash = new BetCashModel({
                        roomName,
                        playerNumber,
                        playerName,
                        betAmount,
                    });
                    await newBetCash.save();
                    console.log('Bet saved to BetCashModel:', newBetCash);
                } catch (error) {
                    console.error('Error saving bet to database:', error.message);
                }
            
                // Check if both players have placed their bets
                const { player1Bet, player2Bet, player1UserId, player2UserId } = Grooms[roomName];
            
                if (player1Bet > 0 && player2Bet > 0) {
                    const totalBet = player1Bet + player2Bet;
            
                    // Store the totalBet in the room object
                    Grooms[roomName].totalBet = totalBet;
            
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
                        // Deduct the bet amount from both players' balances
                        try {
                            const player1 = await OdinCircledbModel.findById(player1UserId);
                            const player2 = await OdinCircledbModel.findById(player2UserId);
            
                            if (!player1 || !player2) {
                                throw new Error('User not found');
                            }
            
                            player1.wallet.balance -= player1Bet;
                            player2.wallet.balance -= player2Bet;
            
                            await Promise.all([player1.save(), player2.save()]);
            
                            console.log(`Bet amounts deducted for Player 1 (${player1UserId}) and Player 2 (${player2UserId}): ${player1Bet}, ${player2Bet}`);
                        } catch (error) {
                            console.error('Error deducting bet amount:', error.message);
                        }
                    } else {
                        // If the bets are unequal, notify the clients and reset the bet amounts
                        io.to(roomName).emit('unequalBet', {
                            player1UserId,
                            player1Bet,
                            player2UserId,
                            player2Bet,
                        });
            
                        console.log('Bets are unequal. Resetting bet amounts.');
            
                        // Reset the bets in the room object
                        Grooms[roomName].player1Bet = 0;
                        Grooms[roomName].player2Bet = 0;
                        Grooms[roomName].player1UserId = null;
                        Grooms[roomName].player2UserId = null;
                    }
                }
            });
            
    // socket.on('placeBet', async ({ roomName, userId, playerNumber, betAmount, playerName }) => {
    //     console.log(`Room ${roomName} - Player ${playerNumber} bets: ${betAmount}`);
        
    //     // Ensure the room object exists
    //     Grooms[roomName] = Grooms[roomName] || {};

    //     // Store the bet amount and user ID in variables based on player number
    //     let playerBet;
    //     let otherPlayerBet;
    //     let playerUserId;
    //     let otherPlayerUserId;
      
    //     if (playerNumber === 1) {
    //         playerBet = betAmount;
    //         otherPlayerBet = Grooms[roomName].player2Bet;
    //         playerUserId = userId;
    //         otherPlayerUserId = Grooms[roomName].player2UserId;
    //         Grooms[roomName].player1Bet = betAmount;
    //         Grooms[roomName].player1UserId = userId;
    //         playerName = userId;
    //     } else if (playerNumber === 2) {
    //         playerBet = betAmount;
    //         otherPlayerBet = Grooms[roomName].player1Bet;
    //         playerUserId = userId;
    //         otherPlayerUserId = Grooms[roomName].player1UserId;
    //         Grooms[roomName].player2Bet = betAmount;
    //         Grooms[roomName].player2UserId = userId;
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
    //     const { player1Bet, player2Bet, player1UserId, player2UserId } = Grooms[roomName];
      
    //     if (player1Bet > 0 && player2Bet > 0) {
    //         const totalBet = player1Bet + player2Bet;
    
    //         // Store the totalBet in the room object
    //         Grooms[roomName].totalBet = totalBet;
    
    //         console.log(`Total Bet: ${totalBet}`);
      
    //         // Emit 'betPlaced' event to all clients in the room with updated bet information
    //         io.to(roomName).emit('betPlaced', { 
    //             player1UserId, 
    //             player1Bet, 
    //             player2UserId, 
    //             player2Bet, 
    //             totalBet,
    //         });
      

    // //           // Broadcast the bet amount to all players in the room
    // //    io.to(roomId).emit('betPlaced', {
    // //     player1Bet: room.player1Bet || null,
    // //     player2Bet: room.player2Bet || null,
    // //   });
    // //         // Check if player1Bet equals player2Bet
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
    //             Grooms[roomName].player1Bet = 0;
    //             Grooms[roomName].player2Bet = 0;
    //             Grooms[roomName].player1UserId = null;
    //             Grooms[roomName].player2UserId = null;
    //         }
    //     }
    // });


            socket.on('disconnect', () => {
                console.log('A user disconnected');
                for (const roomName in Grooms) {
                    if (Grooms[roomName] && Grooms[roomName].players) {
                        Grooms[roomName].players = Grooms[roomName].players.filter(player => player.socketId !== socket.id);
                        if (Grooms[roomName].players.length === 0) {
                            delete Grooms[roomName];
                        }
                    }
                }
            });            
        });
    });
}

module.exports = startSocketServer33;
