const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const OdinCircledbModel = require('../models/odincircledb');
const WalletModel = require('../models/Walletmodel');
const TopUpModel = require('../models/TopUpModel');
const DebitModel = require('../models/DebitModel');
const ChatModel = require('../models/ChatModel');
const UserOtpVerification = require('../models/UserOtpVerify');
const TransOtpVerify = require('../models/TransOtpVerify');
const BankModel = require('../models/BankModel');
const WithdrawAuthModel = require("../models/WithdrawAuthModel")
const VirtualAccountModel = require("../models/VirtualAccountModel");
const WinnerModel = require("../models/WinnerModel");
const TictactoeModel = require("../models/BetCashModel");
const DeleteRequestModel = require('../models/DeleteRequestModel');
const ReferralModel = require('../models/ReferralModel');
const { v4: uuidv4 } = require('uuid'); // To generate unique referral codes
const jwtSecret = process.env.JWT_SECRET;
// Parse the EMAIL_USER AND EMAIL_PASS environment variable
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require("dotenv").config();

const multer = require('multer');
const Device = require('../models/Device');
const UserFriendsModel = require('../models/UserFriendsModel');
const ChatsFriends = require('../models/ChatsFriends');
const TransOtpVerificationModel = require('../models/TransOtpVerify');
const BetModel = require('../models/BetModel');
const BetModelCoin = require('../models/BetModelCoin');
const BetModelDice = require('../models/BetModelDice');
const BetModelQuiz = require('../models/BetModelQuiz');
const BetModelRock = require('../models/BetModelRock');
const QuestionModel = require('../models/QuestionModel');
const WithdrawOnceModel = require('../models/WithdrawOnceModel');
const BatchAnswer = require('../models/BatchAnswerModel');
const cloudinary = require('cloudinary').v2;
const { Expo } = require('expo-server-sdk');
const BatchModel = require('../models/BatchModel');
const FaceOffModel = require('../models/FaceOffModel');
const FaceOffAnswer = require('../models/FaceOffAnswerModel');
const expo = new Expo();

const { ObjectId } = require('mongoose').Types;

// Configure multer for file upload handling
const storage = multer.memoryStorage(); // Use memory storage
const upload = multer({ storage });

// Configure Cloudinary properly
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,  // Correct syntax
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

console.log(process.env.API_KEY, 'API Key');  // Fix: Use process.env.API_KEY
console.log(process.env.Email_User, 'emai kdsodsy');  // Fix: Use process.env.API_KEY

const router = express.Router();

// Generate a short referral code by trimming the UUID
const generateReferralCode = () => {
  return uuidv4().slice(0, 6); // For a 6-character code
};


// Define rate limiting rules
const registrationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 5 registration requests per windowMs
  message: 'Too many registration attempts from this IP, please try again after 5 minutes',
});


router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await OdinCircledbModel.findOne({ email: email });

    if (user) {
      // Compare provided password with hashed password in the database
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        res.status(200).json({ status: 'success', user: user });
      } else {
        res.status(401).json({ status: 'error', message: 'The password is incorrect' });
      }
    } else {
      res.status(404).json({ status: 'error', message: 'User not found' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});


router.post('/register',upload.single('image'), registrationLimiter, async (req, res) => {
  try {
    const { fullName, email, password, expoPushToken,phone, image, referralCode } = req.body;

    // Check if req.file exists
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

     // Check if referral code exists
     let referredBy = null;
     if (referralCode) {
       referredBy = await OdinCircledbModel.findOne({ referralCode: referralCode });
       if (!referredBy) {
         return res.status(400).json({ error: 'Invalid referral code' });
       }
     }

    // Upload image to Cloudinary using upload_stream
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (error, result) => {
          if (error) {
            reject({ message: 'Image upload failed', error });
          } else {
            resolve(result);
          }
        }
      );
      stream.end(req.file.buffer);
    });

      if (!result || !result.secure_url) {
        return res.status(500).json({ message: 'Failed to get secure_url from Cloudinary result' });
      }
  
  // Check if referral code exists

     // Generate a salt and hash the password
     const salt = await bcrypt.genSalt(10);
     const hashedPassword = await bcrypt.hash(req.body.password, salt); 

    // Generate a random 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000);

    console.log('expotoks:', expoPushToken);
    // Create a new user
    const newUser = await OdinCircledbModel.create({
      fullName: req.body.fullName,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      //password: req.body.password,
      password: hashedPassword, // Use hashed password
      // Other user properties...
      otp: otp.toString(),
      //otpTrans: otp.toString(),
      //image: result.secure_url, // Store the Cloudinary URL
      image: result.secure_url,  
      expoPushToken,
      referralCode: generateReferralCode(),
    });


    // If the user was referred, add the referral data
if (referredBy) {
  const isAlreadyReferred = referredBy.referrals.some(referral => referral.referredUserId.toString() === newUser._id.toString());

  if (isAlreadyReferred) {
    return res.status(400).json({ error: 'This user has already been referred by this code' });
  }

  
     // If the user was referred, add the referral data
     if (referredBy) {
      // Update the referring user's referral list
      referredBy.referrals.push({
        referredUserId: newUser._id,
        codeUsed: referralCode,
        email: newUser.email,
      });
      await referredBy.save();

      // Create a separate document in the Referral schema
      await ReferralModel.create({
        referredUserId: newUser._id,
        referringUserId: referredBy._id,
        codeUsed: referralCode,
        email: newUser.email,
        status: "UnPaid", // Default status for new referrals
      });
    }
}
      // Save the new user
      await newUser.save();
   // Check if the expoPushToken already exists in the Device collection
   let device = await Device.findOne({ expoPushToken });

   if (!device) {
     // If no device exists with this expoPushToken, create a new one
     device = new Device({
       expoPushToken,
       users: [newUser._id], // Add the new user ID to the device's users array
     });
   } else {
     // If the device already exists, check if the user is already registered
     if (!device.users.includes(newUser._id)) {
       device.users.push(newUser._id); // Add the new user to the device's users array
     }
   }

   // Save the updated or new device
   await device.save();

  
     // Save the OTP details in the database
     await UserOtpVerification.create({
      userId: newUser._id,
      otp: otp.toString(), // Convert OTP to string for storage
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // OTP expires in 15 minutes
    });
   // console.log('OTP verification record created:', otpVerification);

    // Send OTP to user's email using Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: 'odincirclex@gmail.com',
        pass: 'otjt jjfb ooju khwk',
      },
    });

 
    const mailOptions = {
      from: 'odincirclex@gmail.com',
      to: newUser.email,
      subject: 'Confirm your Identity',
      text: 'hello'
    //   html: `
    //   <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px;">
    //     <img src="cid:logo" alt="Logo" style="width: 100px; height: 100px; border-radius: 50%; margin-bottom: 20px;" />
    //     <p style="color: #000; margin-bottom: 10px; font-size: 16px">Hello ${newUser.fullName},</p>
    //     <h2 style="color: #000; margin-bottom: 10px; font-size: 24px">Confirm Your Identity</h2>
    //     <p style="font-size: 16px; margin-bottom: 20px;">Thank you for signing up to Odincircle. Here's your One Time Password to verify your account.</p>
    //     <h3 style="font-size: 24px; color: #000; margin-bottom: 10px; background-color: aliceblue; padding: 20px 0; text-align: center";>${otp}</h3>
    //     <p style="font-size: 16px; margin-bottom: 20px;">If you have any complaint please contact our support team immediately via in-app or email.</p>
    //     <p style="font-size: 16px; margin-bottom: 20px;">support@odincirclegames.co</p>
    //     <p style="font-size: 16px;">Please use this OTP to complete your registration process.</p>
    //   </div>`, // HTML content with inline CSS styles
    // attachments: [
    //   {
    //     filename: 'odincircle.png', // Name of the image file
    //     path: '../../odincircle.png', // Path to the image file
    //     cid: 'logo', // Unique ID for referencing the image in the HTML content
    //   },
    // ],
  };
  

    //transporter.sendMail(mailOptions);

// Send email
transporter.sendMail(mailOptions, (error, info) => {
  console.log('OTP sent to user:', newUser.email);
  if (error) {
    console.error('Error sending email:', error);
  } else {
    console.log('Email sent:', info.response);
  }
});

      // Create a new wallet for the user
      const newWallet = await WalletModel.create({
          userId: newUser._id,
          balance: 0,
          cashoutbalance: 0,
          transactions: []
      });
      
      // Create an initial chat document for the user
      const initialChat = await ChatModel.create({
          sender: newUser._id, // Sender is the newly registered user
          receiver: newUser._id, // Initially set receiver to null, can be updated later
          author: newUser._id,
          message: "", // Initial welcome message
          roomId: "", // Initial welcome message
          messageId: "",
          timestamp: Date.now(),
          recipientId: newUser._id,
          recipientPushToken: "",
          // delivered: false,
          // seen: false,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // OTP expires in 15 minutes
      });

      // Save the chat ID in the user's document
      newUser.chat = [initialChat._id];

      // Save the updated user (with wallet and chat reference)
      await newUser.save();

    
      res.status(201).json({ user: newUser, wallet: newWallet, chat: initialChat,  });
  } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ message: 'Error registering user' });
  }
});

// Function to send OTP to user's email
async function sendOTPByEmail(newUser, otp) {
  try {
      // Create a nodemailer transporter
      let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'odincirclex@gmail.com',
          pass: 'otjt jjfb ooju khwk',
        },
      });

      const mailOptions = {
        from: 'odincirclex@gmail.com',
        to: newUser.email,
        subject: 'Confirm your Identity',
        html: `
        <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px;">
          <img src="cid:logo" alt="Logo" style="width: 100px; height: 100px; border-radius: 50%; margin-bottom: 20px;" />
          <p style="color: #000; margin-bottom: 10px; font-size: 16px">Hello ${newUser.fullName},</p>
          <h2 style="color: #000; margin-bottom: 10px; font-size: 24px">Confirm Your Identity</h2>
          <p style="font-size: 16px; margin-bottom: 20px;">Thank you for signing up to betxcircle. Here's your One Time Password to verify your account.</p>
          <h3 style="font-size: 24px; color: #000; margin-bottom: 10px; background-color: aliceblue; padding: 20px 0; text-align: center";>${otp}</h3>
          <p style="font-size: 16px; margin-bottom: 20px;">If you have any complaint please contact our support team immediately via in-app or email.</p>
          <p style="font-size: 16px; margin-bottom: 20px;">odincirclex@gmail.com</p>
          <p style="font-size: 16px;">Please use this OTP to complete your registration process.</p>
        </div>`, // HTML content with inline CSS styles
      attachments: [
        {
          filename: 'odincircle.png', // Name of the image file
          path: '../../odincircle.png', // Path to the image file
          cid: 'logo', // Unique ID for referencing the image in the HTML content
        },
      ],
    };

      // Send the email
      await transporter.sendMail(mailOptions);

      console.log('OTP email sent successfully.');
  } catch (error) {
      console.error('Error sending OTP email:', error.message);
      throw new Error('Failed to send OTP email.');
  }
}

router.get('/referral/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Step 1: Find the user by ID
    const user = await OdinCircledbModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const referralCode = user.referralCode;

    // Step 2: Find referrals matching the user's referral code
    const referrals = await ReferralModel.find({ codeUsed: referralCode });

    res.status(200).json({
      referralCode,
      referrals,
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ message: 'Error fetching referrals' });
  }
});


// Update bank details
router.put('/updateBankDetails/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { bankName, accountName, accountNumber } = req.body;

    const user = await OdinCircledbModel.findById(userId);

    if (user) {
      user.bankDetails = { bankName, accountName, accountNumber };
      await user.save();
      res.status(200).json({ message: 'Bank details updated successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to update bank details', error });
  }
});


router.post("/verifyEmailAndOTP", async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // Check if email and OTP are provided and not empty
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    // Find the user by email
    let user = await OdinCircledbModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let userOtpRecord = await UserOtpVerification.findOne({ userId: user._id });

    if (!userOtpRecord || userOtpRecord.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    user.verified = true;
    await user.save();

    res.json({ message: "User verified successfully" });
  } catch (error) {
    // Handle any errors that occur during the verification process
    console.error('Error verifying email and OTP:', error.message);
    res.status(400).json({ error: "Failed to verify email and OTP" });
  }
});


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'odincirclex@gmail.com',
    pass: 'otjt jjfb ooju khwk',
  },
});

// Utility functions
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateToken = (email) => jwt.sign({ email }, jwtSecret, { expiresIn: '1h' });

router.post('/register-device', async (req, res) => {
  const { expoPushToken, userId } = req.body;

  // Check if expoPushToken and userId are not null
  if (!expoPushToken || !userId) {
    return res.status(400).json({ success: false, message: 'expoPushToken and userId are required' });
  }

  try {
    let device = await Device.findOne({ expoPushToken });

    if (!device) {
      // If no document found, log that a new device is being created
      console.log('No existing device found, creating a new one.');
      device = new Device({
        expoPushToken,
        users: [{ _id: userId }], // Initialize with the first user
      });
    } else {
      // Ensure device.users is not null or undefined
      if (device.users && !device.users.some(user => user._id?.toString() === userId.toString())) {
        device.users.push({ _id: userId }); // Add new userId if not already present
      }
    }

    await device.save();
    res.status(200).json({ success: true, message: 'User and token saved successfully' });
  } catch (error) {
    console.error('Error saving expoPushToken:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// Route to update device registration with user ID
router.post('/update-device', async (req, res) => {
  const { userId, expoPushToken } = req.body;

  if (!userId || !expoPushToken) {
    return res.status(400).json({ success: false, message: 'User ID and expoPushToken are required' });
  }

  try {
    // Find the device document with the given expoPushToken
    const device = await Device.findOne({ expoPushToken });

    if (device) {
      // Update the device document with the new userId
      if (!device.users.includes(userId)) {
        device.users.push(userId);
        await device.save();
      }
      res.status(200).json({ success: true, message: 'Device updated successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Device not found' });
    }
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


router.post('/send-code', async (req, res) => {
  const { email } = req.body;

  try {
    // Find user by email
    const user = await OdinCircledbModel.findOne({ email });
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000); // Generates a random 6-digit code

    // Save OTP to the database
    await UserOtpVerification.findOneAndUpdate(
      { userId: user._id }, 
      { otp },               
      { upsert: true, new: true }
    );

    // Send OTP via email
    await transporter.sendMail({
      from: 'odincirclex@gmail.com',
      to: email,
      subject: 'Password Reset Code',
      // text: `Your password reset code is ${otp}`,
      html: `<div style="font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); max-width: 600px; margin: 20px auto; border: 1px solid #ddd;">
      <!-- Header -->
      <div style="text-align: center; padding: 10px 0; border-bottom: 2px solid #000;">
        <h2 style="color: #000; margin: 0;">betxcircle</h2>
        <p style="color: #666; font-size: 14px; margin: 0;">Reset Code</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 20px;">
    
        <!-- OTP Code -->
        <p style="font-size: 16px; font-weight: bold; color:rgb(9, 9, 9); margin-top: 20px;">
          Your password reset code is: <span style="color:rgb(1, 7, 14);">${otp}</span>
        </p>
        <p style="color: #333; font-size: 14px;">
          If you have any questions or concerns, feel free to reach out to us.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 10px;">
        <p style="margin: 5px 0;">Thank you,</p>
        <p style="margin: 5px 0;">betxcircle Admin</p>
        <p style="margin: 5px 0;">Contact: odincirclex@gmail.com</p>
      </div>
    </div>
    `
    });

    res.send('Reset code sent');
  } catch (error) {
    console.error('Error sending reset code:', error.message);
    res.status(500).send('Error sending reset code');
  }
});



router.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await OdinCircledbModel.findOne({ email });

    if (!user) {
      return res.status(404).send('User not found');
    }

    const otpRecord = await UserOtpVerification.findOne({
      userId: user._id, 
      otp: code         
    });

  
    if (!otpRecord) {
      return res.status(400).send('Invalid or expired code');
    }

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error.message);
    res.status(500).send('Error verifying OTP');
  }
});


router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Find the user by email
    const user = await OdinCircledbModel.findOne({ email });
    if (!user) {
      return res.status(404).send('User not found');
    }

    user.password = hashedPassword;
    await user.save();
    
    // Send a success response
    res.send('Password reset successful');
  } catch (error) {
    console.error(`Error resetting password: ${error.message}`);
    res.status(500).send('Error resetting password');
  }
});




// Mark message as read
router.put('/messages/read-all', async (req, res) => {
  const { author } = req.body;
  try {
    // Update all messages from the specified author to mark them as read
    const result = await ChatsFriends.updateMany({ author }, { $set: { unreadCount: 0, isRead: true } });

    res.status(200).json({ message: 'All messages marked as read', result });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



router.get('/api/unread-messages/:recipientId', async (req, res) => {
  const { recipientId } = req.params;

  try {
    const unreadMessages = await ChatsFriends.find({ recipientId });

    if (unreadMessages.length === 0) {
      console.log('No unread messages found for recipientId:', recipientId);
    }

    res.json(unreadMessages);
  } catch (error) {
    console.error('Error fetching unread messages:', error);
    res.status(500).json({ message: 'Error fetching unread messages' });
  }
});


// Fetch messages by roomId
router.get('/messages/retrieve/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    const messages = await ChatModel.find({ roomId }).sort({ timestamp: -1 }); // Latest messages first
    res.status(200).json({ messages });
  } catch (error) {
    console.error('Error retrieving messages:', error);
    res.status(500).json({ message: 'Error retrieving messages' });
  }
});


router.get('/usersWithLastMessages', async (req, res) => {
  try {

    const users = await OdinCircledbModel.find({});

    const usersWithLastMessages = await Promise.all(
      users.map(async (user) => {
      
        const lastMessage = await ChatModel.findOne({
          $or: [{ author: user._id }],
        })
          .sort({ timestamp: -1 })
          .exec();

        const userWithLastMessage = { ...user.toObject(), lastMessage };
        return userWithLastMessage;
      })
    );

    //console.log("Finished mapping users to their last messages");
    res.status(200).send(usersWithLastMessages);
  } catch (error) {
    console.error("Error fetching users with last messages:", error);
    res.status(500).send({ error: error.message });
  }
});


router.get('/cart-items', async (req, res) => {
  const cartItems = await CartItem.find();
  res.json(cartItems);
});

router.post('/cart-items', async (req, res) => {
  const newItem = new CartItem(req.body);
  await newItem.save();
  res.status(201).json(newItem);
});

router.post('/check-email', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await OdinCircledbModel.findOne({ email: email });
    if (user) {
      return res.json({ exists: true });
    } else {
      return res.json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking email existence:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create a new delete request
router.post('/delete-account', async (req, res) => {
  const {userId, fullName, firstName, lastName, email, phone,  confirmationText } = req.body;

  // Validate input fields
  if (!userId || !firstName || !lastName || !email || !phone || !confirmationText) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
  }

  try {
      // Create a new delete request
      const newDeleteRequest = new DeleteRequestModel({
          userId,
          fullName,
          firstName,
          lastName,
          email,
          phone,
          confirmationText,
      });

      // Save to database
      await newDeleteRequest.save();

      res.status(201).json({ message: 'Delete request created successfully.' });
  } catch (error) {
      console.error('Error creating delete request:', error);
      res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

router.post('/resendOTP', async (req, res) => {
  try {
      const { email, userId } = req.body;

      // Generate a new OTP (you can use any OTP generation logic here)
      const newOTP = Math.floor(1000 + Math.random() * 9000); // Generates a 4-digit OTP

       // To get the user's information, let's assume there's a function to fetch the user by email
       const user = await OdinCircledbModel.findOne({ email: email });
       if (!user) {
         throw new Error('User not found.');
       }
 
      // Log the generated OTP
      console.log(`Generated OTP for ${userId} ${email}: ${newOTP}`);

      // Update or create a new OTP record for the user by email
      await UserOtpVerification.findOneAndUpdate(
          { userId: user._id},
          { otp: newOTP },
          { upsert: true }
      );

      // Update or create a new OTP record for the user by email
      await OdinCircledbModel.findOneAndUpdate(
        { email: email },
        { otp: newOTP },
        { upsert: true }
    );

      // Send the OTP to the user's email
     
      // Call the sendOTPByEmail function with the user object and OTP
      await sendOTPByEmail(user, newOTP);

      // Respond with success message
      res.status(200).json({ message: 'OTP has been resent to your email.' });
  } catch (error) {
      console.error('Error resending OTP:', error.message);
      res.status(500).json({ error: 'Failed to resend OTP. Please try again later.' });
  }
});

// Update user's profile image
router.put('/updateUserProfileImage/:userId', upload.single('image'), async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await OdinCircledbModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Upload the image to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (error, result) => {
          if (error) {
            reject({ message: 'Image upload failed', error });
          } else {
            resolve(result);
          }
        }
      );
      stream.end(req.file.buffer);
    });

    // Update the user's image URL in the database
    user.image = result.secure_url; // Save the secure URL to the database
    await user.save();

    res.status(200).json({ message: 'Profile image updated successfully', imageUrl: user.image });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user profile by userId
router.get('/getUserProfile/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await OdinCircledbModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      image: user.image,
      phone: user.phone,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user's fullName
router.put('/updateUserProfile/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { fullName } = req.body;

    const user = await OdinCircledbModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.fullName = fullName;
    await user.save();

    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/add-bank-details', async (req, res) => {
  const { bankName, accountName, accountNumber, userId } = req.body;

  try {
    // Check if a bank detail entry with the given account name already exists
    let existingBankDetail = await BankModel.findOne({ accountName });

    if (existingBankDetail) {

      existingBankDetail.accountNumber = accountNumber;
      await existingBankDetail.save();

      res.status(200).json({ message: 'Account number updated successfully' });
    } else {
      const newBankDetail = new BankModel({
        userId,
        bankName,
        accountName,
        accountNumber,
      });

      await newBankDetail.save();

      res.status(200).json({ message: 'Bank details added successfully' });
    }
  } catch (error) {
    console.error('Error adding or updating bank details:', error);
    res.status(500).json({ message: 'An error occurred while adding or updating bank details' });
  }
});

router.post('/verify-password', async (req, res) => {
  const { password, amount } = req.body;
  const { userId } = req.body;

  try {
    const user = await OdinCircledbModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password); // Use await here

    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    if (user.cashoutbalance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    return res.status(200).json({ message: 'Withdrawal successful' });
  } catch (error) {
    //console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

//Transotp
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
};

const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'odincirclex@gmail.com',
      pass: 'otjt jjfb ooju khwk',
    },
  });

     
  const mailOptions = {
    from: 'odincirclex@gmail.com',
    to: email,
    subject: 'Your OTP Code',
    html: `<div style="font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); max-width: 600px; margin: 20px auto; border: 1px solid #ddd;">
  <!-- Header -->
  <div style="text-align: center; padding: 10px 0; border-bottom: 2px solid #000;">
    <h2 style="color: #000; margin: 0;">betxcircle</h2>
    <p style="color: #666; font-size: 14px; margin: 0;">One Time Password</p>
  </div>
  
  <!-- Content -->
  <div style="padding: 20px;">

    <!-- OTP Code -->
    <p style="font-size: 16px; font-weight: bold; color:rgb(9, 9, 9); margin-top: 20px;">
      Your OTP code is: <span style="color:rgb(1, 7, 14);">${otp}</span>
    </p>
    <p style="color: #333; font-size: 14px;">
      If you have any questions or concerns, feel free to reach out to us.
    </p>
  </div>
  
  <!-- Footer -->
  <div style="text-align: center; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 10px;">
    <p style="margin: 5px 0;">Thank you,</p>
    <p style="margin: 5px 0;">betxcircle Admin</p>
    <p style="margin: 5px 0;">Contact: odincirclex@gmail.com</p>
  </div>
</div>
`
  };

  return transporter.sendMail(mailOptions);
};

// Send OTP transaction route
router.post('/send-otptransaction', async (req, res) => {
  const { userId, amount  } = req.body;

  try {
    // Fetch the user's email based on the user ID
    const user = await OdinCircledbModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const email = user.email;
    const otp = generateOTP();

    // Save the OTP details in the database
    const otpTrans = new TransOtpVerify({
      userId,
      otp: otp.toString(), // Convert OTP to string for storage
      createdAt: new Date()
    });
    await otpTrans.save();

    // Send OTP to email
    await sendOTPEmail(email, otp);

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'An error occurred while sending OTP' });
  }
});


router.post('/verify-otpwithdraw', async (req, res) => {
  const { userId, password, otp, totalAmount, amount, title, message, fullName } = req.body;

  try {
    // Retrieve the OTP from the database
    const otpRecord = await TransOtpVerify.findOne({ userId, otp });
    if (!otpRecord) {
      return res.status(400).send('Invalid OTP');
    }

    // Fetch the user from the database
    const user = await OdinCircledbModel.findById(userId);
    if (!user) {
      return res.status(400).send('User not found');
    }

    // Check if the password is correct
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).send('Invalid password');
    }

    // Validate the withdrawal amount
    const withdrawalAmount = parseFloat(totalAmount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).send('Invalid amount');
    }

    // Check if the user has sufficient balance
    if (user.wallet.cashoutbalance < withdrawalAmount) {
      return res.status(400).send('Insufficient balance');
    }

    // Deduct the amount from the user's wallet
    user.wallet.cashoutbalance -= withdrawalAmount;
    await user.save();

    // Save the transaction record
    const transaction = new DebitModel({
      userId,
      amount: amount,
      fullName: fullName,
      WithdrawStatus: 'pending',
      date: new Date(),
    });
    await transaction.save();

    // Clear the OTP after successful verification
    await TransOtpVerify.deleteOne({ userId, otp });

    // Step 1: Send Email Notification
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'odincirclex@gmail.com',
        pass: 'otjt jjfb ooju khwk',
      },
    });

    const emailOptions = {
      from: 'odincirclex@gmail.com',
      to: user.email,
      subject: 'Withdrawal Notification',
      html: `
     <div style="font-family: Arial, sans-serif; color: #333; background-color: #f8f8f8; padding: 20px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
  <!-- Header -->
  <div style="text-align: center; background-color:rgb(12, 14, 16); color: white; padding: 10px 0; border-radius: 10px 10px 0 0;">
    <h4 style="margin: 0; font-size: 14px;">Withdrawal Notification</h4>
  </div>

  <!-- Main Content -->
  <div style="padding: 20px; background-color: #fff; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; margin-bottom: 10px;">Hello <strong>${user.fullName}</strong>,</p>
    <p style="font-size: 16px; margin-bottom: 10px; text-align: center">Your withdrawal of <strong>NGN ${withdrawalAmount.toFixed(2)}</strong> has been successfully processed.</p>
    
    <p style="font-size: 16px; margin-bottom: 10px; text-align: center"><strong>Transaction Details:</strong></p>
    <p style="font-size: 14px; margin-left: 20px; text-align: center">
      Transaction ID: <strong>${transaction._id}</strong><br>
      Amount: <strong>NGN ${amount}</strong><br>
      <p style="color:rgb(205, 9, 9)">Status:<strong>Pending</strong>,</p><br>
      Date: <strong>${new Date().toLocaleString()}</strong>
    </p>


    <p style="font-size: 16px; margin-top: 20px;">If you have any questions or concerns, please contact us at <a href="mailto:support@example.com" style="color: #007bff;">odincirclex@gmail.com</a>.</p>
  </div>

  <!-- Footer -->
  <div style="text-align: center; margin-top: 20px; font-size: 14px; color: #777;">
    <p style="margin: 0;">Thank you for using our service.</p>
  </div>
</div>
      `,
    };

    await transporter.sendMail(emailOptions);

    try {
      // const device = await Device.findOne({ userId: userObjectId });
      const device = await Device.findOne({
        users: { $elemMatch: { _id: userId } }
      });
      
      
      if (!device) {
        return res.status(404).json({ message: 'Device not found.' });
      }

   // Check if the expoPushToken is valid
   if (!Expo.isExpoPushToken(device.expoPushToken)) {
    console.log('Invalid Expo Push Token:', device.expoPushToken);
    return { status: 400, message: 'Invalid Expo Push Token.' };
  }

      const notificationMessage = {
        to: device.expoPushToken,
        sound: 'default',
        title: title || 'Withdrawal Notification',
        body: message || `Your withdrawal of NGN ${withdrawalAmount.toFixed(2)} is being processed.`,
      };

      // Chunk the notifications and send them in batches
      const chunks = expo.chunkPushNotifications([notificationMessage]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending notification chunk:', error);
          return res.status(500).json({ message: 'Error sending notification.' });
        }
      }

      // Respond with success
      return res.status(200).json({
        message: 'Withdrawal successful. Email and notification sent.',
        tickets,
      });

    } catch (error) {
      console.error('Error sending notification:', error.message);
      return res.status(500).json({ message: 'Error sending notification.', error: error.message });
    }

  } catch (error) {
    console.error('Error during withdrawal process:', error.message);
    return res.status(500).json({ message: 'An error occurred during the withdrawal process.', error: error.message });
  }
});


module.exports = router;


// Define the route
router.post('/addOrUpdateBankDetails', async (req, res) => {
  const { userId, bankName, accountName, accountNumber } = req.body;

  try {
      // Use findOneAndUpdate with upsert option
      const bankDetails = await BankModel.findOneAndUpdate(
          { userId }, 
          { bankName, accountName, accountNumber }, 
          { new: true, upsert: true }
      );

      res.status(200).json({
          message: 'Bank details saved successfully',
          data: bankDetails
      });
  } catch (error) {
      console.error('Error saving bank details:', error);
      res.status(500).json({
          message: 'Error saving bank details',
          error: error.message
      });
  }
});


router.post('/check-user-existence', async (req, res) => {
  const { email, phone, bvn, fullName } = req.body;

  try {
    // Check if email already exists
    const emailExists = await OdinCircledbModel.findOne({ email });

    const fullNameExists = await OdinCircledbModel.findOne({ fullName });
    // Check if phone already exists
    const phoneExists = await OdinCircledbModel.findOne({ phone });
    // Check if BVN already exists
    const bvnExists = await OdinCircledbModel.findOne({ bvn });

    res.json({
      emailExists: !!emailExists,
      fullNameExists: !!fullNameExists,
      phoneExists: !!phoneExists,
      bvnExists: !!bvnExists,
    });
  } catch (error) {
    console.error("Error checking user existence:", error);
    res.status(500).json({ message: 'An error occurred while checking user existence' });
  }
});

router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'email is required.' });
    }

    const user = await OdinCircledbModel.findOne({ email });

    return res.json({ exists: !!user });
  } catch (error) {
    console.error('Error checking full name:', error.message || error);
    return res.status(500).json({ message: 'Something went wrong. Please try again later.' });
  }
});

router.get('/check-fullname', async (req, res) => {
  try {
    const { fullName } = req.query;

    if (!fullName) {
      return res.status(400).json({ message: 'Full name is required.' });
    }

    const user = await OdinCircledbModel.findOne({ fullName });

    return res.json({ exists: !!user });
  } catch (error) {
    console.error('Error checking full name:', error.message || error);
    return res.status(500).json({ message: 'Something went wrong. Please try again later.' });
  }
});



router.get('/getBankDetails/:userId', async (req, res) => {
  try {
      const { userId } = req.params;
      const bankDetails = await BankModel.findOne({ userId });
      if (!bankDetails) {
          return res.status(200).json({ message: 'No bank details found', data: null });
      }
      res.status(200).json(bankDetails);
  } catch (error) {
      console.error('Error fetching bank details:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});


// Check balance route
router.post('/check-balance', async (req, res) => {
  const { userId, amount } = req.body;

  try {
    const user = await OdinCircledbModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const withdrawalAmount = parseFloat(amount);
    if (user.wallet.balance < withdrawalAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    res.status(200).json({ message: 'Sufficient balance' });
  } catch (error) {
    console.error('Error checking balance:', error);
    res.status(500).json({ message: 'An error occurred while checking balance' });
  }
});

router.post('/save-topup', async (req, res) => {
  const { userId, topUpAmount } = req.body;

  try {
      const newTopUp = new TopUpModel({
          userId: userId,
          topUpAmount: topUpAmount,
      });

      await newTopUp.save();
      res.status(200).json({ message: 'Top-up saved successfully!' });
  } catch (error) {
      console.error('Error saving top-up:', error);
      res.status(500).json({ error: 'Failed to save top-up' });
  }
});

// Update user balance route

//balance
router.get("/user/:id", async (req, res) => {
    const userId = req.params.id;
  
    try {
      const user = await OdinCircledbModel.findById(userId).populate('wallet');
  
      // Check if user exists
      if (user) {
        // Extract the balance from the user's wallet
        const balance = user.wallet.balance;

        res.json({ user, balance });
      } else {
       
        res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
      // Log and handle any errors that occur
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

   //cashoutbalance
  router.get("/user/:id", async (req, res) => {
    const userId = req.params.id;
  
    try {
      // Find the user by userId
      const user = await OdinCircledbModel.findById(userId);
  
      // Check if user exists
      if (user) {
        await user.populate('wallet').execPopulate();
  
        const cashoutbalance = user.wallet.cashoutbalance;
  
        res.json({ user, cashoutbalance });
      } else {

        res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
    
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Endpoint to get user's wallet balance by ID
router.get('/user/:userId/balance', async (req, res) => {
    const { userId } = req.params;
  
    try {
      // Find the user by ID
      const user = await OdinCircledbModel.findById(userId);
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Respond with user's wallet balance
      res.json({ balance: user.wallet.balance });
    } catch (error) {
      console.error('Error fetching user balance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

    // Endpoint to get user's wallet cashoutbalance by ID
router.get('/user/:userId/cashoutbalance', async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the user by ID
    const user = await OdinCircledbModel.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Respond with user's wallet balance
    res.json({ cashoutbalance: user.wallet.cashoutbalance });
  } catch (error) {
    console.error('Error fetching user balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  router.post('/add-update-balance', async (req, res) => {
    const { userId, amount } = req.body;
  
    try {
      // Find the user by userId
      const user = await OdinCircledbModel.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      user.wallet.balance += parseInt(amount); 
  
      // Save the updated user
      await user.save();
  
      res.status(200).json({ message: 'Amount added successfully' });
    } catch (error) {
      // Log any errors that occur
      console.error('Error adding amount to wallet:', error);
      res.status(500).json({ message: 'Error adding amount to wallet' });
    }
  });



  router.post('/user-amount', async (req, res) => {
    const { userId, amount } = req.body;
  
    try {
      // Find the user by userId
      const user = await OdinCircledbModel.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  

       user.wallet.transactions.push({ amount: parseInt(amount) }); 
  
  
    await user.save();

    res.status(200).json({ message: 'Amount added to transactions successfully' });
  } catch (error) {
    // Log any errors that occur
    console.error('Error adding the amount to transactions:', error);
    res.status(500).json({ message: 'Error updating amount in transactions' });
  }
});


// Route to get the amount for a specific user
router.get('/user/:userId/amount', async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the user by userId
    const user = await OdinCircledbModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const transactions = user.wallet.transactions;
    const latestTransaction = transactions[transactions.length - 1]; 
    const amount = latestTransaction ? latestTransaction.amount : 0;

    res.status(200).json({ amount });
  } catch (error) {
    console.error('Error fetching amount:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Route to get the push token for a given user ID
router.get('/getPushToken/:recipientId', async (req, res) => {
  const { recipientId } = req.params;

  if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
    return res.status(400).json({ error: 'Invalid or missing Recipient ID' });
  }

  try {
    const user = await OdinCircledbModel.findById(recipientId, 'expoPushToken');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ pushToken: user.expoPushToken });
  } catch (error) {
    console.error('Error fetching push token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/user/add', async (req, res) => {
  const { userId, selectedUserId } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(selectedUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId or selectedUserId' });
    }

    const selectedUser = await OdinCircledbModel.findById(selectedUserId, 'fullName image');

    if (!selectedUser) {
      return res.status(404).json({ success: false, message: 'Selected user not found' });
    }

    let userFriends = await UserFriendsModel.findOne({ userId });

    if (!userFriends) {
      userFriends = new UserFriendsModel({
        userId,
        selectedUsers: [{ _id: selectedUserId, fullName: selectedUser.fullName, image: selectedUser.image }],
      });
    } else {
      const isUserAlreadyAdded = userFriends.selectedUsers.some(user => user._id.equals(selectedUserId));
      if (!isUserAlreadyAdded) {
        userFriends.selectedUsers.push({ _id: selectedUserId, fullName: selectedUser.fullName, image: selectedUser.image });
      }
    }

    // Save the updated friends list
    await userFriends.save();

    res.status(200).json({ success: true, message: 'User added successfully' });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Route to remove a user from the friends list
router.post('/user/remove', async (req, res) => {
  const { userId, selectedUserId } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(selectedUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId or selectedUserId' });
    }

    // Find the user's friends list
    let userFriends = await UserFriendsModel.findOne({ userId });

    if (!userFriends) {
      return res.status(404).json({ success: false, message: 'User not found in friends list' });
    }

    // Filter out the selected user from the list
    userFriends.selectedUsers = userFriends.selectedUsers.filter(user => !user._id.equals(selectedUserId));

    // Save the updated list
    await userFriends.save();

    res.status(200).json({ success: true, message: 'User removed successfully' });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});



// GET /transactions?page=1&limit=10
router.get('/transactions', async (req, res) => {
  const { userId } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 3;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const transactions = await DebitModel.find({ userId })
      .sort({ createdAt: -1 }) 
      .skip((page - 1) * limit)  
      .limit(limit);            

    res.status(200).json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/usersall", async (req, res) => {
  try {
    const users = await OdinCircledbModel.find();

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; 
    const limit = parseInt(req.query.limit) || 1; 

    const skip = (page - 1) * limit;

    const users = await OdinCircledbModel.find().skip(skip).limit(limit);

    console.log(`Page: ${page}, Limit: ${limit}, Users returned: ${users.length}`);

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.get('/user/friends/:userId', async (req, res) => {
  const { userId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  if (page < 1 || limit < 1) {
    return res.status(400).json({ success: false, message: 'Invalid page or limit parameters' });
  }

  try {
    // Fetch friends for the given userId with pagination
    const friends = await UserFriendsModel.find({ userId })
      .populate('selectedUsers')
      .skip((page - 1) * limit) // Skip previous pages
      .limit(limit); // Limit the result set to the requested number of items

    const selectedUsers = friends.map(friend => friend.selectedUsers).flat();

    if (selectedUsers.length === 0) {
      return res.status(404).json({ success: false, message: 'No friends found' });
    }

    // Fetch the last message for each friend
    const friendsWithLastMessages = await Promise.all(
      selectedUsers.map(async (friend) => {
        const lastMessage = await ChatModel.findOne({ author: friend._id })
          .sort({ timestamp: -1 }) // Sort to get the latest message
          .exec();
        
        return { ...friend.toObject(), lastMessage };
      })
    );

    const totalFriends = await UserFriendsModel.countDocuments({ userId });
    const totalPages = Math.ceil(totalFriends / limit);

    return res.status(200).json({
      success: true,
      friends: friendsWithLastMessages,
      page,
      limit,
      totalPages,
      totalFriends,
    });
  } catch (error) {
    console.error('Error fetching friends with last messages:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Route to get a user by ID and return their verification status
router.get('/userverified/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch the user from the database using the provided userId
    const user = await OdinCircledbModel.findById(userId).select('verified');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Respond with the user's verified status
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: 'Error fetching user' });
  }
});

 
// routes/winners.js
router.get('/winnerstoday', async (req, res) => {
  try {
    // Fetch all winners without a date filter
    const allWinners = await WinnerModel.find({});

    res.status(200).json(allWinners);
  } catch (error) {
    console.error('Error fetching all winners:', error);
    res.status(500).json({ message: 'Failed to fetch all winners' });
  }
});



router.put('/withdrawAuth/:userId', async (req, res) => {
  const { userId } = req.params; 
  const { bvn, nin, phone, lastName, firstName } = req.body; 

  try {
    if (!bvn || !nin) {
      return res.status(400).json({ message: 'BVN and NIN are required' });
    }

    if (bvn.length !== 11 || nin.length !== 11) {
      return res.status(400).json({ message: 'BVN and NIN must each be 11 digits' });
    }

    const user = await OdinCircledbModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let withdrawAuth = await WithdrawAuthModel.findOne({ userId: user._id });

    if (!withdrawAuth) {
      withdrawAuth = new WithdrawAuthModel({
        userId: user._id,
        bvn,
        nin,
        phone,
        firstName,
        lastName
      });
    } else {
      // If WithdrawAuth record exists, update BVN and NIN
      withdrawAuth.bvn = bvn;
      withdrawAuth.nin = nin;
      withdrawAuth.phone = phone;
      withdrawAuth.firstName = firstName;
      withdrawAuth.lastName = lastName;
    }

    // Save changes to the database
    await withdrawAuth.save();

    // Respond with success message
    res.json({ message: 'Withdrawal authorization updated/created successfully', withdrawAuth });
  } catch (error) {
    console.error('Error updating withdrawal authorization:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});



router.get('/user/:userId/details', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await OdinCircledbModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      amount: user.wallet.balance,
      email: user.email,
      phone: user.phone,
      bvn: user.bvn,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'An error occurred while fetching user details' });
  }
});

router.post('/user/:userId/balancetopup', async (req, res) => {
  const { userId } = req.params;
  const { amount, tx_ref, status} = req.body;

  try {

    const user = await TopUpModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (status === 'successful') {
      user.balance += amount; 
      await user.save(); 

      const payment = new TopUpModel({_id: tx_ref, topUpAmount: amount, userId });
      await payment.save();

      return res.status(200).json({ message: 'Balance updated successfully' });
    } else {
      return res.status(400).json({ message: 'Payment was not successful' });
    }
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


router.get('/user/:userId/amounts', async (req, res) => {
  const { userId } = req.params;

  try {
    const topUps = await TopUpModel.find({ userId });

    if (!topUps || topUps.length === 0) {
      return res.status(404).json({ message: 'No transactions found for this user' });
    }

    const transactions = topUps.map(topUp => ({
      _id: topUp._id,
      amount: topUp.amount,
      txRef: topUp.txRef,
      createdAt: topUp.createdAt
    }));

    res.status(200).json({ transactions });
  } catch (error) {
    console.error('Error fetching amounts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to search users
router.get('/users/search', async (req, res) => {
  const { query, page = 1, limit = 10 } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required.' });
  }

  try {
   
    const searchRegex = new RegExp(query, 'i');

    // Find users matching the query
    const users = await OdinCircledbModel.find({ fullName: searchRegex })
      .skip((page - 1) * limit) 
      .limit(parseInt(limit)) 
      .select('fullName verified');

    const totalUsers = await OdinCircledbModel.countDocuments({ fullName: searchRegex });

    res.json({
      users,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'An error occurred while fetching users.' });
  }
});


router.get('/getBets', async (req, res) => {
  try {
    const bets = await BetModel.find(); // Fetch all bets
    res.status(200).json(bets);
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to check if a room exists by roomId
router.get('/room/exists/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    // Check if room exists
    const roomExists = await BetModel.exists({  roomId });
    if (roomExists) {
      return res.status(200).json({ exists: true });
    } else {
      return res.status(404).json({ exists: false });
    }
  } catch (err) {
    console.error('Error checking room existence:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// Route to fetch room details by roomId
router.get('/room/details/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    // Query using the roomId field
    const room = await BetModel.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    return res.status(200).json(room);
  } catch (err) {
    console.error('Error fetching room details:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/room/existsdice/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    // Check if room exists
    const roomExists = await BetModelDice.exists({  roomId });
    if (roomExists) {
      return res.status(200).json({ exists: true });
    } else {
      return res.status(404).json({ exists: false });
    }
  } catch (err) {
    console.error('Error checking room existence:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to fetch room details by roomId
// Route to fetch room details by roomId
router.get('/room/detailsdice/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    // Query using the roomId field
    const room = await BetModelDice.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    return res.status(200).json(room);
  } catch (err) {
    console.error('Error fetching room details:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/getBetsDice', async (req, res) => {
  try {
    const bets = await BetModelDice.find(); // Fetch all bets
    res.status(200).json(bets);
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/getBetsCoin', async (req, res) => {
  try {
    const bets = await BetModelCoin.find(); // Fetch all bets
    res.status(200).json(bets);
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/getBetsRock', async (req, res) => {
  try {
    const bets = await BetModelRock.find(); // Fetch all bets
    res.status(200).json(bets);
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/getBetsQuiz', async (req, res) => {
  try {
    const bets = await BetModelQuiz.find(); // Fetch all bets
    res.status(200).json(bets);
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to get the referral list for a specific user by userId
router.get('/referrals/:userId', async (req, res) => {
  try {
    const { userId } = req.params; // Extract the userId from the URL parameters

    // Fetch the user and their referrals from the database
    const user = await OdinCircledbModel.findById(userId).select('fullName referrals').populate('referrals.referredUserId');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Structure the referral data to return
    const referrals = user.referrals.map((referral) => ({
      referredUserId: referral.referredUserId._id, // Populated user ID
      codeUsed: referral.codeUsed,
      email: referral.email,
      phone: referral.phone,
      status: referral.status,
      referralDate: referral.referralDate,
    }));

    // Return the referral data
    return res.status(200).json({
      user: {
        id: user._id,
        fullName: user.fullName,
      },
      referrals,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error retrieving referrals.' });
  }
});

router.put('/update-withdraw-status', async (req, res) => {
  const { userId, withdrawConfirmed, expirationTime } = req.body;

  try {
    // Convert expirationTime to a Date object
    const expireAt = new Date(expirationTime);

    const result = await WithdrawOnceModel.findOneAndUpdate(
      { userId },
      { withdrawConfirmed, expireAt },
      { new: true, upsert: true }
    );

    if (result) {
      res.status(200).json({
        message: 'Withdrawal status updated successfully.',
        result
      });
    } else {
      res.status(404).json({
        message: 'User not found for update.',
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error updating withdrawal status.',
      error: error.message,
    });
  }
});


router.get('/get-withdraw-status', async (req, res) => {
  const { userId } = req.query;

  try {
    const record = await WithdrawOnceModel.findOne({ userId });
    if (record) {
      res.status(200).json({
        withdrawConfirmed: record.withdrawConfirmed,
        expireAt: record.expireAt,
      });
    } else {
      res.status(404).json({ message: 'No withdrawal record found.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching withdrawal status.', error });
  }
});

router.get('/batches', async (req, res) => {
  console.log('Fetching all batches...');
  try {
      const batches = await BatchModel.find();
      res.json(batches);
  } catch (err) {
      console.error('Error fetching batches:', err.message);
      res.status(500).json({ error: err.message });
  }
});

// Update PlayersInRoom
router.post('/updatePlayersInRoom', async (req, res) => {
  const { batchId, userId } = req.body;

  try {
    const batch = await BatchModel.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    // Check if the room is full
    if (batch.PlayersInRoom >= batch.NumberPlayers) {
      return res.status(400).json({ message: 'Room is full. No more players can join.' });
    }

    // Check if the user has already joined
    if (batch.joinedUsers.includes(userId)) {
      return res.status(200).json({ message: 'User already joined', batch });
    }

    // Add userId to joinedUsers and increment PlayersInRoom
    batch.joinedUsers.push(userId);
    batch.PlayersInRoom += 1;

    await batch.save();

    return res.status(200).json({ message: 'PlayersInRoom updated', batch });
  } catch (error) {
    console.error('Error updating PlayersInRoom:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


// Remove userId if validation fails
router.post('/removeUserFromBatch', async (req, res) => {
  const { batchId, userId } = req.body;

  try {
    const batch = await BatchModel.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    // Remove the user from joinedUsers
    batch.joinedUsers = batch.joinedUsers.filter((id) => id !== userId);
    batch.PlayersInRoom = Math.max(0, batch.PlayersInRoom - 1);

    await batch.save();

    return res.status(200).json({ message: 'User removed from batch', batch });
  } catch (error) {
    console.error('Error removing user from batch:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/placeBet', async (req, res) => {
  const { batchId, userId, betAmount } = req.body; // Expect batchId, userId, and betAmount

  try {
    const batch = await BatchModel.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const user = await OdinCircledbModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let userBalance = parseFloat(user.wallet.balance); 

    const requiredBet = parseFloat(batch.betAmount);
    const userBet = parseFloat(betAmount);

    if (isNaN(userBet) || userBet !== requiredBet) {
      return res.status(400).json({ message: 'Invalid or incorrect bet amount' });
    }

    if (userBalance < userBet) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

   
     user.wallet.balance = userBalance - userBet;
 
    await user.save();

    batch.betsAmountPlayer.push({ userId, betsAmount: userBet });

    await batch.save();

    return res.status(200).json({ message: 'Bet placed successfully', batch });
  } catch (error) {
    console.error('Error placing bet:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


// Fetch questions based on the batch level (level1 for Batch A, level2 for Batch B)
router.get('/questions/:level', async (req, res) => {
  const { level } = req.params; // "level1" or "level2"
  
// Ensure that level is valid
if (!/^Level(10|[1-9])$/.test(level)) {
  return res.status(400).json({ message: 'Invalid level' });
}

  try {
    // Fetch questions based on the level
    const questions = await QuestionModel.find({ level });

    if (!questions || questions.length === 0) {
      return res.status(404).json({ message: 'No questions found for this level' });
    }

    return res.status(200).json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


// Save the number of correct answers for a user

router.post('/saveCorrectAnswers', async (req, res) => {
  const {
    batchId,
    batchName: batch,
    totalBetAmount,
    userId,              // Single user ID
    correctAnswers,      // Array of correct answers for each question
    timestamp,
  } = req.body;

  try {
    // Check if a BatchAnswer document already exists for this batchId
    let batchAnswer = await BatchAnswer.findOne({ batchId });

    if (batchAnswer) {
      // If the batch exists, check if the user already submitted answers
      const existingUserAnswer = batchAnswer.userAnswers.find(
        (user) => user.userId === userId
      );

      if (existingUserAnswer) {
        return res
          .status(400)
          .json({ message: 'Answers for this user and batch already exist.' });
      }

  
      batchAnswer.userAnswers.push({
        userId,
        correctAnswers, 
      });

      // Save the updated document
      await batchAnswer.save();
    } else {
      batchAnswer = new BatchAnswer({
        batchId,
        batchName: batch,
        totalBetAmount,
        userAnswers: [
          {
            userId,
            correctAnswers, 
          },
        ],
        timestamp: timestamp || new Date(), 
      });

      await batchAnswer.save();
    }

    return res
      .status(200)
      .json({ message: 'Correct answers saved successfully', batch: batchAnswer });
  } catch (error) {
    console.error('Error saving correct answers:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/api/verify-transaction', async (req, res) => {
  const { transaction_id, tx_ref, userId, amount,email } = req.body;

  if (!transaction_id || !tx_ref || !userId || !amount || !email) {
    return res.status(400).json({ error: 'Transaction ID, tx_ref, userId, and amount are required' });
  }

  try {
    const transactionDetails = {
      transaction_id,
      amount,
      currency: 'NGN',
      status: 'successful',
      customer: userId,
      userId,
      tx_ref,
      email
    };

    const user = await OdinCircledbModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (transactionDetails.status === 'successful') {
      const amount = parseFloat(transactionDetails.amount);

      if (!isNaN(amount) && amount > 0) {
        await OdinCircledbModel.updateOne(
          { _id: user._id },
          { $inc: { 'wallet.balance': amount } }
        );
      } else {
        console.error('Invalid transaction amount:');
      }
    }

    const newTopUp = new TopUpModel({
      userId: transactionDetails.userId,
      amount: transactionDetails.amount,
      transactionId: transactionDetails.transaction_id,
      txRef: transactionDetails.tx_ref,
      email: transactionDetails.email
    });

    await newTopUp.save();

    // Configure the email transport
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or another email service like 'SendGrid', 'Outlook', etc.
      auth: {
        user: process.env.EMAIL_USER, // Your email address (use environment variables for security)
        pass: process.env.EMAIL_PASS, // Your email password
      },
    });

    // Prepare the email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email, // Assuming the user model has an 'email' field
      subject: 'TopUp Successful',
      text: 'Transaction Receipt from ODINCIRCLEX LIMITED',
      html: `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #f8f9fa; padding: 20px; border: 1px solid #e0e0e0; max-width: 600px; margin: auto;">
        <div style="border-bottom: 4px solid #743df9; padding-bottom: 10px; text-align: center;">
          <h1 style="margin: 20px 0; font-size: 16px; color: #743df9;">ODINCIRCLEX LIMITED</h1>
          <p style="margin: 20px 0; font-size: 8px; color: #555;">Receipt from Odincirclex Limited</p>
        </div>
  
        <div style="margin: 20px 0; background-color: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <p style="font-size: 15px; margin: 0 10px 10px;"><strong>YOUR TOP-UP WAS SUCCESSFUL!</strong></p>
          <p style="font-size: 16px; margin: 0 0 20px;">Your account has been topped up with <strong>NGN ${amount}</strong>.</p>
  
          <h3 style="margin: 0; font-size: 18px; border-bottom: 2px solid #743df9; padding-bottom: 5px;">Payment Details</h3>
          <p style="margin: 15px 0;"><strong>Amount Paid:</strong> NGN ${amount}</p>
          <p style="margin: 15px 0;"><strong>Transaction ID:</strong> ${transaction_id}</p>
          <p style="margin: 15px 0;"><strong>Email:</strong> ${user.email}</p>
          <p style="margin: 15px 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        </div>
  
        <div style="margin-top: 20px; text-align: center; font-size: 14px; color: #666;">
          <p>If you have any questions or issues with this payment, kindly contact Odincirclex Limited at <a href="mailto:odincirclexlimited@gmail.com" style="color: #007bff; text-decoration: none;">odincirclexlimited@gmail.com</a>.</p>
        </div>
      </div>
    `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    console.log('Success email sent to:', user.email);

    return res.status(200).json({
      message: 'Transaction verified successfully and email sent',
      data: transactionDetails,
    });
  } catch (error) {
    console.error('Error verifying transaction:', error.message);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

router.get('/faceoffbatches', async (req, res) => {
  console.log('Fetching all faceoffbatches...');
  try {
      const batches = await FaceOffModel.find();
      res.json(batches);
  } catch (err) {
      console.error('Error fetching faceoffbatches:', err.message);
      res.status(500).json({ error: err.message });
  }
});

router.put('/faceoffbatches/:id', async (req, res) => {
  try {
    const { joinedUsers } = req.body;
    const { id } = req.params; // Get batch id from the URL

    // Update the batch document by setting the joinedUsers array
    const updatedBatch = await FaceOffModel.findByIdAndUpdate(
      id, // Use the batch id (from the URL)
      { joinedUsers }, // Update the joinedUsers array
      { new: true } // Return the updated document
    );

    // Check if the batch was not found
    if (!updatedBatch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    res.status(200).json(updatedBatch); // Send the updated batch back
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ message: 'Error updating batch' });
  }
});




router.post('/faceoffanswers', async (req, res) => {
  try {
    const { batchId, userAnswers, timer } = req.body;

    // Validate required fields
    if (!batchId || !Array.isArray(userAnswers) || userAnswers.length === 0) {
      return res.status(400).json({ message: 'Invalid request data' });
    }

    // Ensure each entry in 'userAnswers' contains 'userId' and an 'answers' array
    const validAnswers = userAnswers.every(
      (entry) => entry.userId && Array.isArray(entry.answers)
    );

    if (!validAnswers) {
      return res.status(400).json({ message: 'Invalid answers format' });
    }

    // Find existing record for the batchId
    const existingRecord = await FaceOffAnswer.findOne({ batchId });

    // If the batchId exists, update the userAnswers
    if (existingRecord) {
      // Filter out answers that have already been submitted by the user
      const newAnswers = userAnswers.filter(
        ({ userId }) => !existingRecord.userAnswers.some(u => u.userId.equals(userId))
      );

      if (newAnswers.length === 0) {
        return res.status(400).json({ message: 'Users already submitted answers' });
      }

      // Add new user answers to the existing record
      newAnswers.forEach(({ userId, answers }) => {
        existingRecord.userAnswers.push({ userId, answers });
      });

      // Update the record with the new answers and timer
      existingRecord.timer = timer;
      await existingRecord.save();

      return res.status(200).json({ message: 'Answers added to existing batch successfully' });
    }

    // If the batchId does not exist, create a new record
    const answerDocs = userAnswers.map(({ userId, answers }) => ({
      batchId,
      userAnswers: [
        {
          userId,
          answers, // Array of answers per user
        }
      ],
      timer,
    }));

    // Save multiple user answers in a new batch
    await FaceOffAnswer.insertMany(answerDocs);

    res.status(200).json({ message: 'Answers saved successfully' });
  } catch (error) {
    console.error('Error saving answers:', error);
    res.status(500).json({ message: 'Error saving answers' });
  }
});


// Sample route to fetch batch answers
router.get('/api/batch-answers', async (req, res) => {
  try {
    const batchAnswers = await BatchAnswer.find();
    return res.status(200).json(batchAnswers);
  } catch (error) {
    console.error('Error fetching batch answers:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get("/check-username", async (req, res) => {
  const { fullName } = req.query;

  try {
    // Check if username exists in the database
    const userExists = await OdinCircledbModel.findOne({ fullName });

    if (userExists) {
      return res.json({
        available: false,
      });
    } else {
      return res.json({ available: true });
    }
  } catch (error) {
    console.error("Error checking username:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


module.exports = router;
