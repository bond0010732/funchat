
const socketIO = require('socket.io');
const OdinCircledbModel = require('../models/odincircledb');
const BetModel = require('../models/BetModel');
const WinnerModel = require('../models/WinnerModel');
// When creating a room

const cardImages = [
   'https://w7.pngwing.com/pngs/52/1014/png-transparent-duck-wiki-duck-animals-fauna-desktop-wallpaper.png',
   'https://e7.pngegg.com/pngimages/205/848/png-clipart-lion-cat-lion-mammal-cat-like-mammal-thumbnail.png',
 'https://w7.pngwing.com/pngs/502/150/png-transparent-havanese-dog-pet-sitting-labrador-retriever-puppy-cat-pet-dog-animals-carnivoran-pet.png',
  'https://e7.pngegg.com/pngimages/185/952/png-clipart-white-tiger-black-tiger-bengal-tiger-zoo-animal-white-tiger-mammal-cat-like-mammal.png',
 'https://w7.pngwing.com/pngs/510/849/png-transparent-leopard-jaguar-tiger-cheetah-cat-leopard-white-mammal-animals-thumbnail.png',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS1BuB1LK9ten4LOy2eMHPliAqAzl4twJ0i6A&s',
  'https://w7.pngwing.com/pngs/313/13/png-transparent-brown-cobra-snake-green-anaconda-snake-love-animals-fauna-thumbnail.png',
 'https://img.favpng.com/19/10/16/black-panther-jaguar-leopard-cougar-cheetah-png-favpng-JYztugSXVjUA8JcEv5weK6fMz.jpg',
];

const rooms = {};

function startSocketServer3(httpServer) {
    const io = socketIO(httpServer)

    // const rooms = {};

    io.on('connection', (socket) => {
        console.log('A user connected htails');
      

    socket.on('joinRoom', ({ playerName, userId, roomName, totalBet }) => {
      console.log('Received joinRoom event with:', { playerName, userId, roomName, totalBet });
  
      // Initialize the rooms object if it hasn't been initialized
      if (!rooms) {
          rooms = {};
          console.log('Initialized rooms object.');
      }
  
      // Check if the roomId is already being used
      let room = rooms[roomName];
  
    //    // Generate cards (pairs of images with values)
    const totalPairs = cardImages.length; // Adjust total pairs based on images
    const cards = Array(totalPairs * 2)
        .fill(null)
        .map((_, index) => {
            const pairValue = Math.floor(index / 2) + 1; // Assign pairs (1, 1, 2, 2, ...)
            return {
                id: index + 1,              // Unique card ID
                value: pairValue,           // Pair value for matching
                image: cardImages[pairValue - 1], // Image URL corresponding to the value
                flipped: false,             // Initially face down
                hidden: false,              // Initially visible
            };
        })
        .sort(() => Math.random() - 0.5); // Shuffle the cards

      if (!room) {
          // Create a new room with the specified roomId
          console.log(`Creating new room with roomId: ${roomName}`);
          // Create the room object
   room = {
        roomName,
        players: [],             // Empty player list initially
        currentTurnPlayer: null, // No player has a turn initially
        totalBet: totalBet || 0, // Default bet value if not provided
        cards,                   // Shuffled card deck
    };

          rooms[roomName] = room;
          console.log(`New room created with roomId: ${roomName}`);
      } else {
          console.log(`Found existing room with roomId: ${roomName}`);
      }
  
      console.log(`Joining room with roomId: ${roomName}`);
  
      // Join the room with the specified name
      try {
          socket.join(roomName);
          console.log(`${playerName} (userId: ${userId}) joined room ${roomName}`);
      } catch (error) {
          console.error(`Failed to join room ${roomName}:`, error);
          return;
      }
  
      // Track the number of players in the room
      if (!room.players) room.players = [];
  
      if (room.players.length < 2) {
          // Add the player to the room
          room.players.push({
              name: playerName,
              userId,
              id: socket.id,
              totalBet,
          });
          console.log(`Player added to room ${roomName}:`, room.players);
  
          // Emit player information
          socket.emit('playerInfo', {
              roomName,
              playerNumber: room.players.length,
              totalBet,
              playerName,
          });
          console.log(`Player info emitted for room ${roomName}`);
  
          // Assign the first player to take the turn
          if (room.players.length === 1) {
              room.currentTurnPlayer = socket.id;
              console.log('First player assigned as currentTurnPlayer:', socket.id);
          }
  
          // Notify all players about the new player
          io.to(roomName).emit('playerJoined', {
              playerName,
              players: room.players,
          });
          console.log(`PlayerJoined event emitted for room ${roomName}`);
  
          // Start the game when both players are connected
          if (room.players.length === 2) {
              console.log('Both players connected. Starting the game.');
              io.to(roomName).emit('gameStart', {
                  roomName,
                  players: room.players,
                  currentTurnPlayer: room.currentTurnPlayer,
                  cards: room.cards.map((card) => ({
                      id: card.id,
                      image: card.image,
                      value: card.value, 
                      flipped: card.flipped,
                      hidden: card.hidden,
                  })), // Send simplified card data
              });
              console.log(`GameStart event emitted for room ${roomName}`);
          }
      } else {
          // Handle the case when the room is already full
          socket.emit('roomFull', 'The room is already full.');
          console.log('Room full, cannot join:', roomName);
      }
  });
  




      const roomScores = {};
      
      socket.on('flipCard', ({ roomName, cardId, playerId }, callback) => {
        const room = rooms[roomName];
        if (!room) {
            console.error(`Room not found: ${roomName}`);
            return callback({ error: 'Room not found' });
        }
    
        const card = room.cards.find((c) => c.id === cardId);
        if (!card || card.flipped || card.hidden) {
            console.error(`Invalid card flip attempt: cardId=${cardId}`);
            return callback({ error: 'Invalid card flip attempt' });
        }
    
        // Flip the card
        card.flipped = true;
    
        // Track flipped cards
        if (!room.flippedCards) room.flippedCards = [];
        room.flippedCards.push(card);
    
        if (room.flippedCards.length === 2) {
            const [card1, card2] = room.flippedCards;
    
            // Check for a match
            if (card1.value === card2.value) {
                card1.hidden = false;
                card2.hidden = false;
    
                const player = room.players.find((p) => p.userId === playerId);
                if (player) {
                    player.score = (player.score || 0) + 1;
                }
    
                io.to(roomName).emit('cardsMatched', {
                    matchedCards: [card1.id, card2.id],
                    playerId,
                    newScore: player?.score || 0,
                });
            } else {
                // Flip cards back after a delay
                setTimeout(() => {
                    if (!card1.hidden && !card2.hidden) {
                        card1.flipped = false;
                        card2.flipped = false;
    
                        io.to(roomName).emit('cardsUnmatched', {
                            unmatchedCards: [card1.id, card2.id],
                        });
                    }
                }, 1000);
            }
    
            // Clear flipped cards for the next turn
            room.flippedCards = [];
    
            // Update turn to the next player
            const currentPlayerIndex = room.players.findIndex((p) => p.id === room.currentTurnPlayer);
            if (currentPlayerIndex !== -1) {
                room.currentTurnPlayer = room.players[(currentPlayerIndex + 1) % room.players.length].id;
            }
        }
    
        // Check if the game is over
        const allCardsHidden = room.cards.every((c) => c.hidden);
        if (allCardsHidden) {
            const scores = room.players.map((p) => p.score || 0);
            const maxScore = Math.max(...scores);
            const topScorers = room.players.filter((p) => p.score === maxScore);
    
            if (topScorers.length > 1) {
                io.to(roomName).emit('gameOver', {
                    isDraw: true,
                    players: room.players,
                });
            } else {
                io.to(roomName).emit('gameOver', {
                    winner: topScorers[0].userId,
                    players: room.players,
                });
            }
        }
    
        // Emit the updated game state to all players
        io.to(roomName).emit('gameUpdate', {
            roomName,
            cards: room.cards,
            players: room.players,
            currentTurnPlayer: room.currentTurnPlayer,
        });
    
        // Respond to the client who flipped the card
        callback({ success: true });
    });
    
      


  //   socket.on('flipCard', ({ roomName, cardId, userId:playerId }) => {
  //     const room = rooms[roomName];
  //     if (!room) {
  //         console.error(`Room not found: ${roomName}`);
  //         return;
  //     }
  
  //     // Check if it's the player's turn based on socket.id
  //     if (room.currentTurnPlayer !== socket.id) {
  //         console.error(`It's not the turn of player with socket ID: ${socket.id}`);
  //         return;
  //     }
  
  //     const card = room.cards.find((c) => c.id === cardId);
  //     if (!card || card.flipped || card.hidden) {
  //         console.error(`Invalid card flip attempt: cardId=${cardId}`);
  //         return;
  //     }
  
  //     // Flip the card
  //     card.flipped = true;
  
  //     // Notify all players about the flipped card
  //     io.to(roomName).emit('cardFlipped', { cardId, playerId });
  
  //     console.log(`Flipping card for player ${playerId} in room ${roomName}`);
  
  //     // Track the flipped cards in the room
  //     if (!room.flippedCards) room.flippedCards = [];
  //     room.flippedCards.push(card);
  
  //     if (room.flippedCards.length === 2) {
  //         const [card1, card2] = room.flippedCards;
  
  //         // Check for a match
  //         if (card1.value === card2.value) {
  //             // Hide the matched cards
  //             card1.hidden = true;
  //             card2.hidden = true;
  
  //             // Update the player's score using userId
  //             const player = room.players.find((p) => p.userId === playerId);
  //             if (player) {
  //                 player.score = (player.score || 0) + 1;
  //             }
  
  //             // Emit match event to all players
  //             io.to(roomName).emit('cardsMatched', {
  //                 matchedCards: [card1.id, card2.id],
  //                 playerId,
  //                 newScore: player?.score || 0,
  //             });
  
  //             console.log(`Match found in room ${roomName} by player ${playerId}`);
  //         } else {
  //             // No match: flip the cards back after a delay
  //             setTimeout(() => {
  //                 // Only flip back unmatched cards (not the matched ones)
  //                 if (!card1.hidden && !card2.hidden) {
  //                     card1.flipped = false;
  //                     card2.flipped = false;
  
  //                     // Notify all players about the unmatched cards
  //                     io.to(roomName).emit('cardsUnmatched', {
  //                         unmatchedCards: [card1.id, card2.id],
  //                     });
  
  //                     console.log(`No match in room ${roomName}`);
  //                 }
  //             }, 1000); // Adjust delay as needed
  //         }
  
  //         // Clear flipped cards for the next turn
  //         room.flippedCards = [];
  
  //         // Update current turn player using socket.id
  //         const currentPlayerIndex = room.players.findIndex((p) => p.id === room.currentTurnPlayer);
  //         if (currentPlayerIndex === -1) {
  //             console.error(`Error: Current turn player ${room.currentTurnPlayer} not found.`);
  //         } else {
  //             const nextPlayer = room.players[(currentPlayerIndex + 1) % room.players.length];
  //             room.currentTurnPlayer = nextPlayer.id;
  //             console.log(`Next player's socket ID: ${room.currentTurnPlayer}`);
  //             io.to(roomName).emit('turnChanged', { currentTurnPlayer: room.currentTurnPlayer });
  //         }
  //     }
  //    // Emit the updated game state to all players
  //    io.to(roomName).emit('gameUpdate', {
  //     roomName,
  //     cards: room.cards,
  //     players: room.players,
  //     currentTurnPlayer: room.currentTurnPlayer,
  // });

  //     // Check if the game is over
  //     const allCardsHidden = room.cards.every((c) => c.hidden);
  //     if (allCardsHidden) {
  //         const scores = room.players.map((p) => p.score || 0);
  //         const maxScore = Math.max(...scores);
  
  //         // Determine if it's a draw
  //         const topScorers = room.players.filter((p) => p.score === maxScore);
  //         if (topScorers.length > 1) {
  //             // Restart the game in case of a draw
  //             io.to(roomName).emit('gameOver', {
  //                 isDraw: true,
  //                 players: room.players,
  //             });
  
  //             console.log(`Game in room ${roomName} ended in a draw.`);
  //             restartGame(roomName);
  //         } else {
  //             // Declare the winner
  //             io.to(roomName).emit('gameOver', {
  //                 winner: topScorers[0].userId,
  //                 players: room.players,
  //             });
  
  //             console.log(`Game in room ${roomName} won by player ${topScorers[0].userId}`);
  //         }
  //     }
  // });
  
      // Function to restart the game
      
      function restartGame(roomName) {
        const room = rooms[roomName];
        if (!room) return;
      
        // Reset cards
        const totalPairs = cardImages.length;
        room.cards = Array(totalPairs * 2)
          .fill(null)
          .map((_, index) => ({
            id: index + 1,
            value: Math.floor(index / 2) + 1,
            image: cardImages[Math.floor(index / 2)],
            flipped: false,
            hidden: false,
          }))
          .sort(() => Math.random() - 0.5);
      
        // Reset players' scores and turn
        room.players.forEach((player) => (player.score = 0));
        room.currentTurnPlayer = room.players[0]?.userId;
      
        // Notify players about the restarted game
        io.to(roomName).emit('gameRestarted', {
          cards: room.cards.map((card) => ({
            id: card.id,
            image: card.image,
            value: card.value,
            flipped: card.flipped,
            hidden: card.hidden,
          })),
          players: room.players,
          currentTurnPlayer: room.currentTurnPlayer,
        });
      
        console.log(`Game in room ${roomName} restarted.`);
      }
      

 
          socket.on('chatMessage', ({ roomName, playerName, message }) => {
            // Broadcast the chat message to all clients in the room
            io.to(roomName).emit('chatMessage', { playerName, message });
          });

          socket.on('placeBet', async ({ roomName, userId, playerNumber, betAmount, playerName }) => {
            console.log(`Room ${roomName} - Player ${playerNumber} bets: ${betAmount}`);
            
            // Ensure the room object exists
            rooms[roomName] = rooms[roomName] || {};
  
            // Store the bet amount and user ID in variables based on player number
            let playerBet;
            let otherPlayerBet;
            let playerUserId;
            let otherPlayerUserId;
          
            if (playerNumber === 1) {
                playerBet = betAmount;
                otherPlayerBet = rooms[roomName].player2Bet;
                playerUserId = userId;
                otherPlayerUserId = rooms[roomName].player2UserId;
                rooms[roomName].player1Bet = betAmount;
                rooms[roomName].player1UserId = userId;
                playerName = userId;
            } else if (playerNumber === 2) {
                playerBet = betAmount;
                otherPlayerBet = rooms[roomName].player1Bet;
                playerUserId = userId;
                otherPlayerUserId = rooms[roomName].player1UserId;
                rooms[roomName].player2Bet = betAmount;
                rooms[roomName].player2UserId = userId;
                playerName = userId;
            }

            try {
              const newBet = new BetModel({
                    roomName: roomName,
                    playerName,
                    betAmount,
              });
            await newBet.save();
            console.log('Bet saved to database:', newBet);
            } catch (error) {
            console.error('Error saving bet to database:', error.message);
             }
            // Check if both players have placed their bets
            const { player1Bet, player2Bet, player1UserId, player2UserId } = rooms[roomName];
          
            if (player1Bet > 0 && player2Bet > 0) {
                const totalBet = player1Bet + player2Bet;
        
                // Store the totalBet in the room object
                rooms[roomName].totalBet = totalBet;
        
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
                        player2Bet,
                    });
                             // Check if player1Bet equals player2Bet
        console.log('Checking bets:', { player1Bet, player2Bet, areEqual: player1Bet === player2Bet });

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
                    io.to(roomName).emit('unequalBet', {
                        player1UserId,
                        player1Bet,
                        player2UserId,
                        player2Bet,
                    });
        
                    console.log('Bets are unequal. Resetting bet amounts.');
          
                    // Reset the bet amounts and user IDs
                    rooms[roomName].player1Bet = 0;
                    rooms[roomName].player2Bet = 0;
                    rooms[roomName].player1UserId = null;
                    rooms[roomName].player2UserId = null;
                }
            }
        });
  

        function shuffleCards() {
          const pairs = ['A', 'B', 'C', 'D', 'E', 'F']; // Example card pairs
          const deck = pairs.concat(pairs).map((value, index) => ({
              id: index,
              value,
              flipped: false,
          }));
          
          // Shuffle the deck
          for (let i = deck.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [deck[i], deck[j]] = [deck[j], deck[i]];
          }
      
          return deck;
      }
      
      
        socket.on('disconnect', () => {
          console.log('A user disconnected');
          // Handle removing the disconnected player from the room's players array
        Object.keys(rooms).forEach((roomName) => {
      // Ensure that the room exists and has a players array
      if (rooms[roomName] && rooms[roomName].players) {
          rooms[roomName].players = rooms[roomName].players.filter((player) => player.socketId !== socket.id);

          // If the room is empty after removing the player, you can delete the room or handle it accordingly
          if (rooms[roomName].players.length === 0) {
              delete rooms[roomName];
          }
          }
         });
        });
      });
      
    //   server.listen(PORT, () => {
    //     console.log(`Server is listening on port ${PORT}`);
    //   });
}

module.exports = startSocketServer3