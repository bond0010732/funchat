import express from 'express';
import { Expo } from 'expo-server-sdk';
import Device from '../models/Device'; 
//  import { Notice } from '../models/NoticeModel.js';// Import Device model

const router = express.Router();
const expo = new Expo(); // Initialize Expo SDK client

router.post('/', async (req, res) => {
  const { title, message } = req.body;

  try {
    // Fetch all device tokens from the database
    const devices = await Device.find({});
    console.log('Fetched devices:', devices);  // Log the entire device documents to inspect the data

    // Extract the expoPushToken from each device
    const tokens = devices.map((device) => {
      console.log('Device:', device);  // Log each device to inspect its structure
      return device.expoPushToken;    // Extract expoPushToken field
    });
    console.log('Extracted tokens:', tokens);  // Log the extracted tokens to check for undefined values

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'No devices registered for notifications' });
    }

    // Filter out invalid tokens and prepare messages
    const messages = tokens
      .filter((token) => {
        console.log('Validating token:', token);  // Log token before validation
        return Expo.isExpoPushToken(token);  // Ensure token is valid
      })
      .map((token) => ({
        to: token,
        sound: 'default',
        title,
        body: message,
      }));

    console.log('Messages to send:', messages);  // Log messages to ensure they're correctly formatted

    if (messages.length === 0) {
      return res.status(400).json({ error: 'No valid Expo push tokens found' });
    }

    // Chunk messages into batches to send with Expo
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    // Send notifications in chunks
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notification chunk:', error);
        return res.status(500).json({ error: 'Error sending notification chunk' });
      }
    }

    // Log tickets for debugging
    console.log('Notification tickets:', tickets);

    res.status(200).json({
      message: 'Notifications sent successfully',
      tickets,
    });
  } catch (error) {
    console.error('Error sending notifications:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to send notifications', details: error.message });
  }
});


// router.post('/', async (req, res) => {
//     const { title, message } = req.body;
  
//     if (!title || !message ) {
//       return res.status(400).json({ error: 'All fields are required.' });
//     }
  
//     try {
//       const newNotice = new Notice({
//         title,
//         message,
//       });
//       await newNotice.save();
//       res.status(201).json({ message: 'Batch created successfully!', notice: newNotice });
//     } catch (error) {
//       console.error('Error creating batch:', error);
//       res.status(500).json({ error: 'Internal server error.' });
//     }
//   });

export default router;

