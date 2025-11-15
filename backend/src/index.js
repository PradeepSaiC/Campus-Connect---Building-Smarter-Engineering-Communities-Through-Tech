import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
import agoraService from './services/agoraService.js';
import pkg from 'agora-token';
const { RtcRole } = pkg;

// Import models
import Student from './model/student.schema.js';
import College from './model/college.schema.js';
import Department from './model/department.schema.js';
import Chat from './model/chat.schema.js';
import ChatRequest from './model/chatRequest.schema.js';
import VideoCallRequest from './model/videoCallRequest.schema.js';
import Event from './model/event.schema.js';
import VideoCall from './model/videoCall.schema.js';
import Connection from './model/connection.schema.js';
import Poll from './model/poll.schema.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 25000
});

// Track online users in memory (student IDs as strings)
const onlineUsers = new Set();

// Middleware
// Helper: check if two students are connected (accepted connection)
const areConnected = async (idA, idB) => {
  try {
    if (!idA || !idB) return false;
    const a = idA.toString();
    const b = idB.toString();
    const [studentA, studentB] = a < b ? [a, b] : [b, a];
    const conn = await Connection.findOne({ studentA, studentB, status: 'accepted' });
    return !!conn;
  } catch (e) {
    return false;
  }
};
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Public stream token for cultural events (no auth needed)
app.get('/api/events/:id/stream-token-public', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!event.streamChannel || !event.isLive) return res.status(400).json({ message: 'Stream is not live' });
    if (event.type !== 'cultural') return res.status(403).json({ message: 'Public streaming not allowed for this event' });

    const channelName = event.streamChannel;
    const account = `anon_${Date.now()}`; // anonymous audience id
    let token;
    try {
      token = agoraService.generateRtcToken(channelName, account, RtcRole.SUBSCRIBER, 3600);
    } catch (e) {
      console.error('Agora token error:', e);
      return res.status(500).json({ message: 'Agora not configured' });
    }
    const appId = agoraService.getAppId();
    res.json({ appId, channelName, token, account, role: 'audience' });
  } catch (error) {
    console.error('Public stream token error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// (moved /api/student/profile below after authenticateToken)

// (route moved below after authenticateToken definition)

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campusconnect')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Authenticated file upload to Cloudinary (images only)
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const mime = req.file.mimetype || '';
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ message: 'Only image uploads are allowed' });
    }
    // Upload buffer to Cloudinary via stream
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'campusconnect', resource_type: 'image' },
        (error, uploadResult) => {
          if (error) return reject(error);
          resolve(uploadResult);
        }
      );
      stream.end(req.file.buffer);
    });
    return res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ message: 'Upload failed' });
  }
});

// Update student profile (name, email, interests, photoURL)
app.put('/api/student/profile', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { name, email, interests, photoURL } = req.body || {};
    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (typeof name === 'string') student.name = name;
    if (typeof email === 'string') student.email = email;
    if (Array.isArray(interests)) student.interests = interests;
    if (typeof photoURL === 'string') student.photoURL = photoURL;
    await student.save();
    return res.json({
      message: 'Profile updated successfully',
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        usn: student.usn,
        interests: student.interests,
        photoURL: student.photoURL,
        college: student.college,
        department: student.department
      }
    });
  } catch (e) {
    console.error('Update student profile error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// (moved /api/upload below after authenticateToken)

// Issue Agora tokens for event streaming (host/audience)
app.get('/api/events/:id/stream-token', authenticateToken, async (req, res) => {
  try {
    const role = String(req.query.role || 'audience').toLowerCase();
    const session = String(req.query.session || '');
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Validate access
    const isHost = event.host?.toString && event.host.toString() === req.user.id;
    if (role === 'host') {
      if (!isHost) return res.status(403).json({ message: 'Only host can get host token' });
      if (!event.streamChannel) {
        // Host requests token right after start; ensure channel exists
        return res.status(400).json({ message: 'Stream channel not initialized. Start the event first.' });
      }
    } else {
      // audience
      if (!event.isLive || !event.streamChannel) {
        return res.status(400).json({ message: 'Stream is not live' });
      }
    }

    const channelName = event.streamChannel;
    // Stable "account" to avoid UID collisions; include session to separate tabs
    const baseId = role === 'host' ? (event.host?.toString?.() || req.user.id) : req.user.id;
    const account = `${role}_${baseId}${session ? '_' + session : ''}`;

    let token;
    try {
      const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      token = agoraService.generateRtcToken(channelName, account, agoraRole, 3600);
    } catch (e) {
      console.error('Agora token error:', e);
      return res.status(500).json({ message: 'Agora not configured' });
    }
    const appId = agoraService.getAppId();
    return res.json({ appId, channelName, token, account, role });
  } catch (e) {
    console.error('Stream token error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Email configuration with safe fallback to avoid dev crashes
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  try {
    // Verify asynchronously; if it fails, fall back to no-op
    transporter.verify().catch((e) => {
      console.warn('Email transporter verify failed, switching to no-op:', e?.message || e);
      transporter = { sendMail: async () => ({ accepted: [], rejected: [], messageId: 'noop' }) };
    });
  } catch (_) {
    transporter = { sendMail: async () => ({ accepted: [], rejected: [], messageId: 'noop' }) };
  }
} else {
  // No creds provided; use no-op transporter
  transporter = { sendMail: async () => ({ accepted: [], rejected: [], messageId: 'noop' }) };
}

// In-memory tracker for live viewers per eventId
const liveViewers = new Map(); // eventId -> Map(userId -> { id, name, usn })

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Store user information
  let currentUser = null;

  // Optionally authenticate immediately using token passed during handshake
  try {
    const handshakeToken = socket.handshake?.auth?.token;
    if (handshakeToken) {
      const decoded = jwt.verify(handshakeToken, process.env.JWT_SECRET);
      // Try student first
      Student.findById(decoded.id).select('_id name usn photoURL').then((user) => {
        if (user) {
          currentUser = user._id.toString();
          socket.userId = currentUser;
          socket.join(`user_${user._id}`);
          // Track online and notify
          onlineUsers.add(socket.userId);
          socket.emit('online_users', Array.from(onlineUsers));
          socket.broadcast.emit('user_online', user._id);
          console.log(`✅ (handshake) User authenticated: ${user.name} (${user._id})`);
        }
      }).catch((e) => {
        console.error('Handshake auth lookup error:', e);
      });
    }
  } catch (e) {
    // Handshake auth failed; emit a soft error to client if desired
    // Do not disconnect immediately to allow client to re-authenticate via event
    socket.emit('auth_error', { code: e?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID', message: e?.message || 'Auth failed' });
  }

  // Authenticate user on connection
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      currentUser = await Student.findById(decoded.id).select('_id name usn photoURL');
      
      if (currentUser) {
        socket.userId = currentUser._id.toString();
        socket.join(`user_${currentUser._id}`);
        console.log(`✅ User authenticated: ${currentUser.name} (${currentUser._id})`);
        
        // Add to online users and share the current online list with this user
        onlineUsers.add(socket.userId);
        socket.emit('online_users', Array.from(onlineUsers));

        // Notify others that user is online
        socket.broadcast.emit('user_online', currentUser._id);
      }
    } catch (error) {
      console.error('❌ Socket authentication failed:', error);
      // Tell client why auth failed and disconnect to avoid unauthenticated lingering session
      const code = error?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
      socket.emit('auth_error', { code, message: error?.message || 'Authentication failed' });
      socket.disconnect(true);
    }
  });

  socket.on('join', (roomId) => {
    socket.join(roomId);
    console.log(`🚪 User ${socket.userId || 'unknown'} joined room: ${roomId}`);
  });

  socket.on('leave', (roomId) => {
    socket.leave(roomId);
    console.log(`🚪 User ${socket.userId || 'unknown'} left room: ${roomId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { chatId, senderId, content, messageType = 'text' } = data;
      
      console.log(`📤 Message from ${senderId} to chat ${chatId}: ${content}`);

      // Verify sender is authenticated
      if (socket.userId !== senderId) {
        console.error('❌ Unauthorized message attempt');
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      // Create message object
      const message = {
        _id: new mongoose.Types.ObjectId(),
        sender: senderId,
        content,
        messageType,
        createdAt: new Date(),
        readBy: [senderId]
      };

      // Save message to database
      const updatedChat = await Chat.findByIdAndUpdate(chatId, {
        $push: { messages: message },
        $set: { 
          lastMessage: content,
          lastMessageTime: new Date()
        }
      }, { new: true });

      if (!updatedChat) {
        console.error('❌ Chat not found:', chatId);
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      // Get sender information
      const sender = await Student.findById(senderId).select('name photoURL');
      
      // Prepare message for frontend
      const messageForFrontend = {
        ...message,
        sender: {
          _id: senderId,
          name: sender?.name || 'Unknown User',
          photoURL: sender?.photoURL
        },
        chatId: chatId
      };

      // Emit to all users in the chat room
      io.to(chatId).emit('new_message', { 
        chatId, 
        message: messageForFrontend 
      });

      // Confirm message sent
      socket.emit('message_sent', { 
        messageId: message._id,
        chatId 
      });

      console.log(`✅ Message sent successfully to chat ${chatId}`);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', (data) => {
    const { chatId, userId, isTyping } = data;
    console.log(`⌨️ User ${userId} ${isTyping ? 'started' : 'stopped'} typing in chat ${chatId}`);
    
    // Verify user is authenticated
    if (socket.userId !== userId) {
      return;
    }
    
    // Emit typing status to all users in the chat
    socket.to(chatId).emit('user_typing', {
      userId: userId,
      isTyping: isTyping
    });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User ${socket.userId || 'unknown'} disconnected`);
    if (socket.userId) {
      // Remove from online users
      onlineUsers.delete(socket.userId);
      // Notify others that user is offline
      socket.broadcast.emit('user_offline', socket.userId);
    }
  });

  socket.on('user_online', (userId) => {
    currentUser = userId;
    console.log(`🟢 User ${userId} is online`);
    
    // Notify other users
    socket.broadcast.emit('user_online', userId);
  });

  socket.on('user_offline', (userId) => {
    console.log(`⚫ User ${userId} is offline`);
    
    // Notify other users
    socket.broadcast.emit('user_offline', userId);
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    
    // Notify other users if we have user info
    if (currentUser) {
      onlineUsers.delete(String(currentUser));
      socket.broadcast.emit('user_offline', currentUser);
    }
  });

  // Video call events
  socket.on('join_call_room', (callId) => {
    socket.join(`call_${callId}`);
    console.log(`User joined call room: ${callId}`);
  });

  socket.on('leave_call_room', (callId) => {
    socket.leave(`call_${callId}`);
    console.log(`User left call room: ${callId}`);
  });

  socket.on('call_signal', (data) => {
    socket.to(`call_${data.callId}`).emit('call_signal', data);
  });

  socket.on('stream_viewer_joined', (data) => {
    socket.to(`call_${data.callId}`).emit('stream_viewer_joined', data);
  });

  socket.on('stream_viewer_left', (data) => {
    socket.to(`call_${data.callId}`).emit('stream_viewer_left', data);
  });

  // Host subscribes to live viewers updates for an event
  socket.on('host_subscribe_event', (payload) => {
    try {
      const { eventId } = payload || {};
      if (!eventId) return;
      socket.join(`event_${eventId}_host`);
      // Send current snapshot
      const viewers = Array.from((liveViewers.get(eventId) || new Map()).values());
      socket.emit('live_viewers_update', { eventId, viewers, count: viewers.length });
    } catch (_) {}
  });

  // Audience announces join
  socket.on('live_viewer_join', async (payload) => {
    try {
      const { eventId } = payload || {};
      if (!eventId || !socket.userId) return;
      // Load user
      const user = await Student.findById(socket.userId).select('_id name usn');
      if (!user) return;
      const evMap = liveViewers.get(eventId) || new Map();
      evMap.set(String(user._id), { id: String(user._id), name: user.name, usn: user.usn });
      liveViewers.set(eventId, evMap);
      const viewers = Array.from(evMap.values());
      io.to(`event_${eventId}_host`).emit('live_viewers_update', { eventId, viewers, count: viewers.length });
    } catch (e) {
      console.error('live_viewer_join error', e);
    }
  });

  // Audience announces leave
  socket.on('live_viewer_leave', (payload) => {
    try {
      const { eventId } = payload || {};
      if (!eventId || !socket.userId) return;
      const evMap = liveViewers.get(eventId);
      if (evMap) {
        evMap.delete(String(socket.userId));
        const viewers = Array.from(evMap.values());
        io.to(`event_${eventId}_host`).emit('live_viewers_update', { eventId, viewers, count: viewers.length });
      }
    } catch (e) {
      console.error('live_viewer_leave error', e);
    }
  });

  // Cleanup on disconnect: remove the user from all event viewer maps
  socket.on('disconnect', () => {
    try {
      if (socket.userId) {
        for (const [eventId, evMap] of liveViewers.entries()) {
          if (evMap.delete(String(socket.userId))) {
            const viewers = Array.from(evMap.values());
            io.to(`event_${eventId}_host`).emit('live_viewers_update', { eventId, viewers, count: viewers.length });
          }
        }
      }
    } catch (_) {}
  });
});

// Routes

// College Registration
app.post('/api/college/register', async (req, res) => {
  try {
    const { collegeName, adminName, adminEmail, password, collegeAddress, collegeType, collegeVision } = req.body;

    // Check if college already exists
    const existingCollege = await College.findOne({ adminEmail });
    if (existingCollege) {
      return res.status(400).json({ message: 'College with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create college
    const college = new College({
      collegeName,
      adminName,
      adminEmail,
      password: hashedPassword,
      collegeAddress,
      collegeType,
      collegeVision,
      isVerified: false,
      totalStudents: 0
    });

    await college.save();

    res.status(201).json({ message: 'College registered successfully' });
  } catch (error) {
    console.error('College registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// College Login
app.post('/api/college/login', async (req, res) => {
  try {
    const { adminEmail, password } = req.body;

    // Find college
    const college = await College.findOne({ adminEmail });
    if (!college) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, college.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token and refresh token
    const token = jwt.sign(
      { id: college._id, email: college.adminEmail, type: 'college' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    const refreshToken = jwt.sign(
      { id: college._id, email: college.adminEmail, type: 'college' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      college: {
        id: college._id,
        collegeName: college.collegeName,
        adminName: college.adminName,
        adminEmail: college.adminEmail,
        collegeAddress: college.collegeAddress,
        collegeType: college.collegeType,
        collegeVision: college.collegeVision,
        isVerified: college.isVerified,
        totalStudents: college.totalStudents
      },
      token,
      refreshToken: jwt.sign(
        { id: college._id, email: college.adminEmail, type: 'college' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      )
    });
  } catch (error) {
    console.error('College login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Student First Login (Send OTP)
app.post('/api/auth/first-login', async (req, res) => {
  try {
    const { usn } = req.body;

    // Find student with populated college and department
    const student = await Student.findOne({ usn }).populate('college department');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (student.isRegistered) {
      return res.status(400).json({ message: 'Student already registered' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP
    student.otp = otp;
    student.otpExpiry = otpExpiry;
    await student.save();

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: student.email,
      subject: 'CampusConnect - OTP Verification',
      html: `
        <h2>CampusConnect OTP Verification</h2>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This OTP will expire in 10 minutes.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ 
      message: 'OTP sent successfully',
      student: {
        name: student.name,
        email: student.email,
        usn: student.usn,
        department: student.department ? {
          id: student.department._id,
          name: student.department.name
        } : null,
        college: student.college ? {
          id: student.college._id,
          collegeName: student.college.collegeName
        } : null
      }
    });
  } catch (error) {
    console.error('First login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify OTP and Complete Registration
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { usn, otp, password, interests, skills } = req.body;

    // Find student with populated college and department
    const student = await Student.findOne({ usn }).populate('college department');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check OTP
    if (student.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Check OTP expiry
    if (new Date() > student.otpExpiry) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update student
    student.password = hashedPassword;
    student.interests = interests || [];
    student.skills = skills || [];
    student.isRegistered = true;
    student.isFirstLogin = false;
    student.otp = null;
    student.otpExpiry = null;
    await student.save();

    // Generate token and refresh token
    const token = jwt.sign(
      { id: student._id, usn: student.usn, type: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    const refreshToken = jwt.sign(
      { id: student._id, usn: student.usn, type: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Registration completed successfully',
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        usn: student.usn,
        department: student.department ? {
          id: student.department._id,
          name: student.department.name
        } : null,
        college: student.college ? {
          id: student.college._id,
          collegeName: student.college.collegeName
        } : null,
        interests: student.interests,
        skills: student.skills
      },
      token
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Student Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usn, password } = req.body;

    // Find student
    const student = await Student.findOne({ usn }).populate('college department');
    if (!student) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!student.isRegistered) {
      return res.status(400).json({ message: 'Please complete registration first' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, student.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: student._id, usn: student.usn, type: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        usn: student.usn,
        department: student.department ? {
          id: student.department._id,
          name: student.department.name
        } : null,
        college: student.college ? {
          id: student.college._id,
          collegeName: student.college.collegeName
        } : null,
        interests: student.interests,
        skills: student.skills
      },
      token
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all colleges (public): return all with departments populated
app.get('/api/colleges', async (req, res) => {
  try {
    const colleges = await College.find({})
      .select('collegeName adminName adminEmail collegeType collegeAddress collegeLink collegeLogo isVerified totalStudents createdAt departments')
      .populate('departments', 'name totalStudents');
    res.json(colleges);
  } catch (error) {
    console.error('Get colleges error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get college by ID
app.get('/api/colleges/:id', async (req, res) => {
  try {
    const college = await College.findById(req.params.id).select('-password');
    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }
    res.json(college);
  } catch (error) {
    console.error('Get college error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update college profile
app.put('/api/college/profile', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { 
      collegeName, 
      adminName, 
      adminEmail, 
      collegeAddress, 
      collegeType, 
      collegeVision, 
      collegeLink, 
      collegeLogo 
    } = req.body;

    // Validate required fields
    if (!collegeName || !adminName || !adminEmail || !collegeAddress) {
      return res.status(400).json({ message: 'College name, admin name, admin email, and address are required' });
    }

    const college = await College.findById(req.user.id);
    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    // Check if email is being changed and if it conflicts with existing college
    if (adminEmail !== college.adminEmail) {
      const existingCollege = await College.findOne({ adminEmail });
      if (existingCollege) {
        return res.status(400).json({ message: 'Email is already in use by another college' });
      }
    }

    // Check if college name is being changed and if it conflicts
    if (collegeName !== college.collegeName) {
      const existingCollege = await College.findOne({ collegeName });
      if (existingCollege) {
        return res.status(400).json({ message: 'College name is already in use' });
      }
    }

    // Update college
    college.collegeName = collegeName;
    college.adminName = adminName;
    college.adminEmail = adminEmail;
    college.collegeAddress = collegeAddress;
    college.collegeType = collegeType || 'Private';
    college.collegeVision = collegeVision || '';
    college.collegeLink = collegeLink || '';
    college.collegeLogo = collegeLogo || '';
    
    await college.save();

    res.json({ 
      message: 'Profile updated successfully', 
      college: {
        id: college._id,
        collegeName: college.collegeName,
        adminName: college.adminName,
        adminEmail: college.adminEmail,
        collegeAddress: college.collegeAddress,
        collegeType: college.collegeType,
        collegeVision: college.collegeVision,
        collegeLink: college.collegeLink,
        collegeLogo: college.collegeLogo,
        isVerified: college.isVerified,
        totalStudents: college.totalStudents
      }
    });
  } catch (error) {
    console.error('Update college profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create department
app.post('/api/college/departments', authenticateToken, async (req, res) => {
  try {
    const { name, description, hod } = req.body;
    
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    // Check if department with similar name already exists
    const existingDepartment = await Department.findOne({ 
      name: { $regex: new RegExp(name, 'i') },
      college: req.user.id 
    });
    
    if (existingDepartment) {
      return res.status(400).json({ message: 'Department with similar name already exists' });
    }

    const department = new Department({
      name,
      description: description || '',
      hod: hod || '',
      totalStudents: 0,
      college: req.user.id
    });

    await department.save();

    // Ensure department is linked in college document
    await College.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { departments: department._id } },
      { new: true }
    );

    res.status(201).json({ message: 'Department created successfully', department });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get departments by college
app.get('/api/colleges/:collegeId/departments', async (req, res) => {
  try {
    const departments = await Department.find({ college: req.params.collegeId });
    res.json({ departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update department
app.put('/api/college/departments/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, description, hod } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    const department = await Department.findOne({ 
      _id: req.params.id, 
      college: req.user.id 
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Check if name is being changed and if it conflicts with existing department
    if (name !== department.name) {
      const existingDepartment = await Department.findOne({ 
        name: { $regex: new RegExp(name, 'i') },
        college: req.user.id,
        _id: { $ne: req.params.id }
      });
      
      if (existingDepartment) {
        return res.status(400).json({ message: 'Department with similar name already exists' });
      }
    }

    // Update department
    department.name = name;
    department.description = description || '';
    department.hod = hod || '';
    
    await department.save();

    res.json({ 
      message: 'Department updated successfully', 
      department 
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete department
app.delete('/api/college/departments/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const department = await Department.findOne({ 
      _id: req.params.id, 
      college: req.user.id 
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Check if department has students
    const studentCount = await Student.countDocuments({ department: req.params.id });
    if (studentCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete department. It has ${studentCount} students. Please remove all students first.` 
      });
    }

    await Department.findByIdAndDelete(req.params.id);

    // Remove reference from college document
    await College.findByIdAndUpdate(
      req.user.id,
      { $pull: { departments: req.params.id } }
    );
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add individual student
app.post('/api/college/students', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { usn, name, email, phone, address, departmentId } = req.body;

    // Validate required fields
    if (!usn || !name || !email || !departmentId) {
      return res.status(400).json({ message: 'USN, name, email, and department are required' });
    }

    // Verify department exists and belongs to the college
    const department = await Department.findOne({ 
      _id: departmentId, 
      college: req.user.id 
    });
    
    if (!department) {
      return res.status(400).json({ message: 'Invalid department selected' });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({ usn });
    if (existingStudent) {
      return res.status(400).json({ message: 'Student with this USN already exists' });
    }

    // Check if email is already taken
    const existingEmail = await Student.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Student with this email already exists' });
    }

    // Create student
    const student = new Student({
      usn,
      name,
      email,
      phone: phone || '',
      address: address || '',
      department: department._id,
      college: req.user.id,
      isRegistered: false
    });

    await student.save();

    // Update department and college student counts
    const departmentStudentCount = await Student.countDocuments({ department: department._id });
    department.totalStudents = departmentStudentCount;
    await department.save();

    const collegeStudentCount = await Student.countDocuments({ college: req.user.id });
    const college = await College.findById(req.user.id);
    if (college) {
      college.totalStudents = collegeStudentCount;
      await college.save();
    }

    res.status(201).json({
      message: 'Student added successfully',
      student: {
        id: student._id,
        usn: student.usn,
        name: student.name,
        email: student.email,
        department: student.department
      }
    });

  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Upload students via CSV
app.post('/api/college/upload-students', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { uploadType, departmentId } = req.body;
    
    if (!uploadType || !['same_department', 'different_departments'].includes(uploadType)) {
      return res.status(400).json({ message: 'Upload type must be "same_department" or "different_departments"' });
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString();
    const lines = csvContent.split('\n').filter(line => line.trim()); // Remove empty lines
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    
    // Validate headers based on upload type
    const requiredHeaders = ['usn', 'name', 'email'];
    if (uploadType === 'different_departments') {
      requiredHeaders.push('department');
    }
    
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({ 
        message: `Missing required columns: ${missingHeaders.join(', ')}` 
      });
    }

    const students = [];
    const errors = [];
    const departmentStats = {};
    const autoCreatedDepartments = [];

    // Get all departments for the college
    const allDepartments = await Department.find({ college: req.user.id });
    const departmentMap = {};
    allDepartments.forEach(dept => {
      departmentMap[dept.name.toLowerCase()] = dept._id;
    });

    // Process each line (skip header)
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const studentData = {};
        
        headers.forEach((header, index) => {
          studentData[header] = values[index] || '';
        });

        // Validate required fields
        if (!studentData.usn || !studentData.name || !studentData.email) {
          errors.push(`Row ${i + 1}: Missing required fields (USN, Name, Email)`);
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(studentData.email)) {
          errors.push(`Row ${i + 1}: Invalid email format`);
          continue;
        }

        // Check if student already exists (by USN or email)
        const existingStudent = await Student.findOne({ 
          $or: [
            { usn: studentData.usn },
            { email: studentData.email }
          ]
        });
        
        if (existingStudent) {
          errors.push(`Row ${i + 1}: Student with USN ${studentData.usn} or email ${studentData.email} already exists`);
          continue;
        }

        // Determine department
        let targetDepartmentId;
        
        if (uploadType === 'same_department') {
          if (!departmentId) {
            errors.push(`Row ${i + 1}: Department ID is required for same department upload`);
            continue;
          }
          
          // Verify department exists and belongs to the college
          const department = await Department.findOne({ 
            _id: departmentId, 
            college: req.user.id 
          });
          
          if (!department) {
            errors.push(`Row ${i + 1}: Invalid department selected`);
            continue;
          }
          
          targetDepartmentId = departmentId;
        } else {
          // Different departments upload
          if (!studentData.department) {
            errors.push(`Row ${i + 1}: Department is required for different departments upload`);
            continue;
          }

          const departmentKey = studentData.department.trim().toLowerCase();
          console.log(`Processing student ${studentData.name} for department: "${studentData.department}" (normalized: "${departmentKey}")`);
          console.log('Available departments:', Object.keys(departmentMap));
          
          if (!departmentMap[departmentKey]) {
            // Auto-create new department if it doesn't exist
            try {
              const newDepartment = new Department({
                name: studentData.department.trim(),
                description: `Auto-created department for ${studentData.department.trim()}`,
                college: req.user.id,
                totalStudents: 0
              });
              
              await newDepartment.save();

              // Link new department to college document
              await College.findByIdAndUpdate(
                req.user.id,
                { $addToSet: { departments: newDepartment._id } },
                { new: true }
              );
              
              // Update department map and allDepartments array
              departmentMap[departmentKey] = newDepartment._id;
              allDepartments.push(newDepartment);
              
              // Track auto-created departments
              autoCreatedDepartments.push(studentData.department.trim());
              
              console.log(`Auto-created department: ${studentData.department.trim()}`);
            } catch (deptError) {
              console.error(`Error creating department ${studentData.department}:`, deptError);
              errors.push(`Row ${i + 1}: Failed to create department "${studentData.department}". Please create it manually first.`);
              continue;
            }
          }
          
          targetDepartmentId = departmentMap[departmentKey];
        }

        // Create student
        const student = new Student({
          usn: studentData.usn,
          name: studentData.name,
          email: studentData.email,
          department: targetDepartmentId,
          college: req.user.id,
          phone: studentData.phone || '',
          address: studentData.address || '',
          isRegistered: false,
          isFirstLogin: true
        });

        await student.save();
        students.push(student);

        // Track department stats
        const deptName = allDepartments.find(d => d._id.toString() === targetDepartmentId.toString())?.name || 'Unknown';
        if (!departmentStats[deptName]) {
          departmentStats[deptName] = 0;
        }
        departmentStats[deptName]++;

      } catch (error) {
        console.error(`Error processing row ${i + 1}:`, error);
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    // Update department and college student counts
    if (students.length > 0) {
      // Update all departments' student counts
      for (const department of allDepartments) {
        const departmentStudentCount = await Student.countDocuments({ department: department._id });
        department.totalStudents = departmentStudentCount;
        await department.save();
      }

      // Update college student count
      const collegeStudentCount = await Student.countDocuments({ college: req.user.id });
      const college = await College.findById(req.user.id);
      if (college) {
        college.totalStudents = collegeStudentCount;
        await college.save();
      }
    }

    res.json({
      message: `Successfully uploaded ${students.length} students`,
      uploaded: students.length,
      departmentStats,
      autoCreatedDepartments: autoCreatedDepartments.length > 0 ? autoCreatedDepartments : null,
      errors: errors.length > 0 ? errors : null,
      totalProcessed: lines.length - 1
    });

  } catch (error) {
    console.error('Upload students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get students by department
app.get('/api/departments/:id/students', async (req, res) => {
  try {
    const students = await Student.find({ department: req.params.id })
      .populate('college department')
      .select('-password -otp -otpExpiry');
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Transfer student to different department
app.put('/api/college/students/:id/transfer', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { departmentId } = req.body;

    if (!departmentId) {
      return res.status(400).json({ message: 'Department ID is required' });
    }

    const student = await Student.findOne({ 
      _id: req.params.id, 
      college: req.user.id 
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Verify target department exists and belongs to the college
    const targetDepartment = await Department.findOne({ 
      _id: departmentId, 
      college: req.user.id 
    });
    
    if (!targetDepartment) {
      return res.status(400).json({ message: 'Invalid target department' });
    }

    // Get old department to update student count
    const oldDepartment = await Department.findById(student.department);

    // Update student's department
    student.department = departmentId;
    await student.save();

    // Update old department student count
    if (oldDepartment) {
      const oldDepartmentStudentCount = await Student.countDocuments({ department: oldDepartment._id });
      oldDepartment.totalStudents = oldDepartmentStudentCount;
      await oldDepartment.save();
    }

    // Update new department student count
    const newDepartmentStudentCount = await Student.countDocuments({ department: departmentId });
    targetDepartment.totalStudents = newDepartmentStudentCount;
    await targetDepartment.save();

    res.json({ 
      message: 'Student transferred successfully',
      student: {
        id: student._id,
        name: student.name,
        department: targetDepartment.name
      }
    });
  } catch (error) {
    console.error('Transfer student error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all students for college
app.get('/api/college/students', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { department, search } = req.query;
    let query = { college: req.user.id };

    // Filter by department if provided
    if (department) {
      query.department = department;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { usn: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await Student.find(query)
      .populate('department', 'name')
      .select('-password -otp -otpExpiry')
      .sort({ createdAt: -1 });

    res.json({
      students,
      total: students.length
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get student by ID
app.get('/api/college/students/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const student = await Student.findOne({ 
      _id: req.params.id, 
      college: req.user.id 
    }).populate('department', 'name');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({
      student: {
        id: student._id,
        usn: student.usn,
        name: student.name,
        email: student.email,
        phone: student.phone,
        address: student.address,
        department: student.department,
        isRegistered: student.isRegistered,
        interests: student.interests,
        skills: student.skills,
        createdAt: student.createdAt
      }
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update student
app.put('/api/college/students/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, email, phone, address, departmentId } = req.body;

    const student = await Student.findOne({ 
      _id: req.params.id, 
      college: req.user.id 
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if email is already taken by another student
    if (email && email !== student.email) {
      const existingStudent = await Student.findOne({ 
        email, 
        _id: { $ne: req.params.id },
        college: req.user.id 
      });
      if (existingStudent) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Update student
    if (name) student.name = name;
    if (email) student.email = email;
    if (phone !== undefined) student.phone = phone;
    if (address !== undefined) student.address = address;

    // Handle department change
    if (departmentId && departmentId !== student.department.toString()) {
      // Verify new department exists and belongs to the college
      const newDepartment = await Department.findOne({ 
        _id: departmentId, 
        college: req.user.id 
      });
      
      if (!newDepartment) {
        return res.status(400).json({ message: 'Invalid department' });
      }

      // Get old department to update student count
      const oldDepartment = await Department.findById(student.department);

      // Update student's department
      student.department = departmentId;

      // Update old department student count
      if (oldDepartment) {
        const oldDepartmentStudentCount = await Student.countDocuments({ department: oldDepartment._id });
        oldDepartment.totalStudents = oldDepartmentStudentCount;
        await oldDepartment.save();
      }

      // Update new department student count
      const newDepartmentStudentCount = await Student.countDocuments({ department: departmentId });
      newDepartment.totalStudents = newDepartmentStudentCount;
      await newDepartment.save();
    }

    await student.save();

    res.json({ 
      message: 'Student updated successfully',
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        address: student.address,
        department: student.department
      }
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete student
app.delete('/api/college/students/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const student = await Student.findOne({ 
      _id: req.params.id, 
      college: req.user.id 
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get department to update student count
    const department = await Department.findById(student.department);
    
    await Student.findByIdAndDelete(req.params.id);

    // Update department and college student counts
    if (department) {
      const departmentStudentCount = await Student.countDocuments({ department: department._id });
      department.totalStudents = departmentStudentCount;
      await department.save();
    }

    const collegeStudentCount = await Student.countDocuments({ college: req.user.id });
    const college = await College.findById(req.user.id);
    if (college) {
      college.totalStudents = collegeStudentCount;
      await college.save();
    }

    res.json({ 
      message: 'Student deleted successfully',
      deletedStudent: {
        id: student._id,
        name: student.name,
        usn: student.usn
      }
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Search students by interests
app.get('/api/students/search', async (req, res) => {
  try {
    const { interests, limit = 20 } = req.query;
    
    let query = { isRegistered: true };
    
    // If interests are provided, filter by them
    if (interests && interests.trim() !== '') {
      const interestArray = interests.split(',').map(interest => interest.trim()).filter(interest => interest !== '');
      if (interestArray.length > 0) {
        query.interests = { $in: interestArray };
      }
    }
    
    const students = await Student.find(query)
      .populate('college department')
      .select('-password -otp -otpExpiry')
      .limit(parseInt(limit));

    res.json(students);
  } catch (error) {
    console.error('Search students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Chat Request routes
app.post('/api/chat-requests', authenticateToken, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    
    // Check if user is trying to send request to themselves
    if (req.user.id === receiverId) {
      return res.status(400).json({ message: 'Cannot send request to yourself' });
    }

    // Check if receiver exists
    const receiver = await Student.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Check if request already exists
    const existingRequest = await ChatRequest.findOne({
      $or: [
        { sender: req.user.id, receiver: receiverId, status: 'pending' },
        { sender: receiverId, receiver: req.user.id, status: 'pending' }
      ]
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Chat request already exists' });
    }

    // Check if chat already exists
    const existingChat = await Chat.findOne({
      participants: { $all: [req.user.id, receiverId] }
    });

    if (existingChat) {
      return res.status(400).json({ message: 'Chat already exists' });
    }

    // Create chat request
    const chatRequest = new ChatRequest({
      sender: req.user.id,
      receiver: receiverId,
      message: message || ''
    });

    await chatRequest.save();

    // Populate sender info for response
    await chatRequest.populate('sender', 'name usn');

    res.status(201).json(chatRequest);
  } catch (error) {
    console.error('Create chat request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/chat-requests', authenticateToken, async (req, res) => {
  try {
    const { type = 'received' } = req.query;
    
    let query = {};
    if (type === 'received') {
      query.receiver = req.user.id;
    } else if (type === 'sent') {
      query.sender = req.user.id;
    }

    const requests = await ChatRequest.find(query)
      .populate('sender', 'name usn photoURL')
      .populate('receiver', 'name usn photoURL')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get chat requests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/chat-requests/:id', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    
    const chatRequest = await ChatRequest.findById(req.params.id)
      .populate('sender', 'name usn')
      .populate('receiver', 'name usn');

    if (!chatRequest) {
      return res.status(404).json({ message: 'Chat request not found' });
    }

    if (chatRequest.receiver._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to respond to this request' });
    }

    if (chatRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    if (action === 'accept') {
      chatRequest.status = 'accepted';
      await chatRequest.save();

      // Create chat
      const chat = new Chat({
        participants: [chatRequest.sender._id, chatRequest.receiver._id],
        messages: [],
        isActive: true
      });

      await chat.save();

      res.json({ 
        message: 'Chat request accepted',
        chat: chat,
        request: chatRequest
      });
    } else if (action === 'reject') {
      chatRequest.status = 'rejected';
      await chatRequest.save();

      res.json({ 
        message: 'Chat request rejected',
        request: chatRequest
      });
    } else {
      res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Update chat request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Chat routes (only accessible after request is accepted)
app.post('/api/chats', authenticateToken, async (req, res) => {
  try {
    const { participantId } = req.body;
    
    // Check if chat already exists
    const existingChat = await Chat.findOne({
      participants: { $all: [req.user.id, participantId] }
    });

    if (existingChat) {
      return res.json(existingChat);
    }

    // Check if there's an accepted chat request
    const acceptedRequest = await ChatRequest.findOne({
      $or: [
        { sender: req.user.id, receiver: participantId, status: 'accepted' },
        { sender: participantId, receiver: req.user.id, status: 'accepted' }
      ]
    });

    if (!acceptedRequest) {
      return res.status(403).json({ message: 'Chat request must be accepted first' });
    }

    // Create new chat
    const chat = new Chat({
      participants: [req.user.id, participantId],
      messages: [],
      isActive: true
    });

    await chat.save();
    res.status(201).json(chat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user.id })
      .populate('participants', 'name email usn')
      .sort({ lastMessageTime: -1 });
    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'name email usn photoURL');
      
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.participants.some(p => p._id.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Format messages with sender information
    const formattedMessages = chat.messages.map(message => ({
      ...message.toObject(),
      sender: chat.participants.find(p => p._id.toString() === message.sender.toString())
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Event routes
app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};

    // Normalize type to match schema enum
    let incomingType = (body.type || '').toString().trim();
    const normalized = incomingType.toLowerCase().replace(/\s+/g, ' ');
    const typeMap = {
      'cultural event': 'cultural',
      'cultural': 'cultural',
      'webinar': 'webinar',
      'lecture': 'lecture',
      'workshop': 'workshop',
      'seminar': 'seminar'
    };
    const eventType = typeMap[normalized] || undefined;

    // If start/end provided, compute duration; else use provided duration or default 60
    let startTime = body.startTime ? new Date(body.startTime) : null;
    let endTime = body.endTime ? new Date(body.endTime) : null;
    let duration;
    if (startTime && endTime && !isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
      duration = Math.ceil((endTime - startTime) / (60 * 1000));
    } else {
      duration = Number.isFinite(Number(body.duration)) ? Number(body.duration) : 60;
      // If only date+time was provided previously, keep compatibility (date holds start)
      if (!startTime && body.date) {
        try { startTime = new Date(body.date); } catch (_) {}
      }
      if (!endTime && startTime) {
        endTime = new Date(startTime.getTime() + duration * 60000);
      }
    }

    // Derive host (College) and hostName
    let hostId = null;
    let hostName = (body.hostName || '').toString().trim();
    // Try to resolve College directly by token id
    let college = null;
    try { college = await College.findById(req.user.id).select('_id collegeName'); } catch (_) {}
    if (college) {
      hostId = college._id;
      if (!hostName) hostName = college.collegeName || 'College Host';
    } else {
      // Fallback: user is a Student; use their college
      const student = await Student.findById(req.user.id).populate('college', 'collegeName');
      if (!student || !student.college) {
        return res.status(400).json({ message: 'Unable to resolve event host from current user' });
      }
      hostId = student.college._id;
      if (!hostName) hostName = student.college.collegeName || 'College Host';
    }

    // Validate required fields
    const errors = [];
    if (!body.title) errors.push('title is required');
    if (!body.description) errors.push('description is required');
    if (!eventType) errors.push(`type must be one of: webinar, lecture, cultural, workshop, seminar`);
    if (!body.date && !startTime) errors.push('date or startTime is required');
    if (errors.length) {
      return res.status(400).json({ message: 'Invalid event data', errors });
    }

    const eventData = {
      title: body.title,
      description: body.description,
      type: eventType,
      date: startTime ? startTime : body.date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      duration,
      maxParticipants: body.maxParticipants ?? 100,
      streamUrl: body.streamUrl ?? '',
      tags: Array.isArray(body.tags) ? body.tags : [],
      thumbnail: body.thumbnail ?? '',
      registrationUrl: body.registrationUrl ?? '',
      host: hostId,
      hostName
    };

    const event = new Event(eventData);
    await event.save();

    try { io.emit('event_created', event); } catch (_) {}
    res.status(201).json(event);
  } catch (error) {
    console.error('Create event error:', error);
    // Best effort to surface validation details
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: 'Invalid event data', details: error.errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const { type, search, upcoming } = req.query;
    let query = {};

    if (type) query.type = type;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    // Hide completed events from student/public feed by default
    query.isCompleted = { $ne: true };
    if (upcoming === 'true') {
      // Optionally return only upcoming by date (and not completed)
      query.date = { $gte: new Date() };
    }

    const events = await Event.find(query)
      .populate('host', 'collegeName')
      .sort({ date: 1 });
    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/colleges/:collegeId/events', async (req, res) => {
  try {
    const events = await Event.find({ host: req.params.collegeId })
      .populate('host', 'collegeName')
      .sort({ date: 1 });
    const now = new Date();
    const withStatus = events.map((ev) => {
      const e = ev.toObject();
      const start = e.startTime ? new Date(e.startTime) : null;
      const end = e.endTime ? new Date(e.endTime) : null;
      let status = 'upcoming';
      if (e.isCompleted) status = 'completed';
      else if (e.isLive) status = 'live';
      else if (start && end && now >= start && now <= end) status = 'live';
      else if (end && now > end) status = 'completed';
      else if (start && now < start) status = 'upcoming';
      e.status = status;
      return e;
    });
    res.json({ events: withStatus });
  } catch (error) {
    console.error('Get college events error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Get single event with participants details
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('host', 'collegeName')
      .populate('participants', 'name email usn');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start/Stop live stream and notify participants by email
app.put('/api/events/:id/live', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body || {};
    const event = await Event.findById(req.params.id).populate('participants', 'name email');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Host-only control
    if (event.host?.toString && event.host.toString() !== req.user.id) {
      try { console.log(`[LIVE][${new Date().toISOString()}] DENY ${action} event=${req.params.id} by user=${req.user.id} (not host)`); } catch (_) {}
      return res.status(403).json({ message: 'Not authorized to control this event' });
    }

    if (action === 'start') {
      try { console.log(`[LIVE][${new Date().toISOString()}] START requested event=${event._id} by host=${req.user.id} preState={isLive:${event.isLive}, isCompleted:${event.isCompleted}}`); } catch (_) {}
      if (event.isLive) {
        try { console.log(`[LIVE][${new Date().toISOString()}] START ignored (already live) event=${event._id}`); } catch (_) {}
        return res.status(400).json({ message: 'Event is already live' });
      }
      // Enforce scheduled start time
      if (!event.startTime) {
        return res.status(400).json({ message: 'Event start time is not set' });
      }
      const now = new Date();
      const startAt = new Date(event.startTime);
      const endAt = event.endTime ? new Date(event.endTime) : null;
      if (now < startAt) {
        try { console.log(`[LIVE][${new Date().toISOString()}] START blocked (before startTime) event=${event._id} now=${now.toISOString()} startAt=${startAt.toISOString()}`); } catch (_) {}
        return res.status(400).json({ message: 'Cannot start before the scheduled start time' });
      }
      // If scheduled end has already passed, auto-extend and allow restart
      if (endAt && now > endAt) {
        const minutes = Number(event.duration || 60);
        const newEnd = new Date(now.getTime() + minutes * 60 * 1000);
        event.endTime = newEnd;
        event.isCompleted = false;
      }
      // Auto-generate channel and internal link
      const channel = agoraService.generateStreamChannelName(event.host, event.title);
      const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
      event.isLive = true;
      event.streamChannel = channel;
      event.streamUrl = `/live/${event._id}`; // internal path for frontend to route
      await event.save();
      try { console.log(`[LIVE][${new Date().toISOString()}] STARTED event=${event._id} channel=${event.streamChannel}`); } catch (_) {}

      try { io.emit('event_live_started', event); } catch (_) {}

      // Email notify all participants who joined the event
      try {
        const toList = (event.participants || []).map(p => p.email).filter(Boolean);
        if (toList.length) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            bcc: toList,
            subject: `Event Live Now: ${event.title}`,
            html: `<p>The event <b>${event.title}</b> is live now.</p><p>Join: <a href="${frontendBase}/live/${event._id}">${frontendBase}/live/${event._id}</a></p>`
          });
        }
      } catch (e) { console.error('Email notify error:', e); }

      return res.json({ message: 'Event is now live', event });
    }

    if (action === 'stop') {
      try { console.log(`[LIVE][${new Date().toISOString()}] STOP requested event=${event._id} by host=${req.user.id} preState={isLive:${event.isLive}, isCompleted:${event.isCompleted}}`); } catch (_) {}
      // Mark as not live only (do not complete). Students will still see the event until endTime
      event.isLive = false;
      await event.save();
      try { liveViewers.delete(String(event._id)); } catch (_) {}
      try { io.emit('event_live_stopped', { id: String(event._id) }); } catch (_) {}
      try { console.log(`[LIVE][${new Date().toISOString()}] STOPPED event=${event._id}`); } catch (_) {}
      return res.json({ message: 'Event live stream stopped', event });
    }

    return res.status(400).json({ message: 'Invalid action' });
  } catch (error) {
    try { console.error(`[LIVE][${new Date().toISOString()}] ERROR event=${req.params.id} action=${req.body?.action}`, error); } catch (_) { console.error('Update event live error:', error); }
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Polls: create/list/vote/close (anonymous results)
app.post('/api/events/:id/polls', authenticateToken, async (req, res) => {
  try {
    const { question, options } = req.body || {};
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.host?.toString && event.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only host can create polls' });
    }
    if (!event.isLive) return res.status(400).json({ message: 'Event is not live' });
    if (!question || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: 'Provide question and at least 2 options' });
    }
    const poll = await Poll.create({
      event: event._id,
      question,
      options: options.map((t) => ({ text: String(t) }))
    });
    try { io.emit('poll_created', { eventId: String(event._id), poll: sanitizePoll(poll) }); } catch (_) {}
    res.status(201).json(sanitizePoll(poll));
  } catch (e) {
    console.error('Create poll error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/events/:id/polls', authenticateToken, async (req, res) => {
  try {
    const polls = await Poll.find({ event: req.params.id }).sort({ createdAt: -1 });
    res.json(polls.map(sanitizePoll));
  } catch (e) {
    console.error('List polls error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Periodic maintenance: auto-complete events whose endTime has passed
// This keeps tags accurate and ensures audience sees "completed" without manual action
try {
  setInterval(async () => {
    try {
      const now = new Date();
      const toComplete = await Event.find({ isCompleted: false, endTime: { $lte: now } }).select('_id isLive');
      if (!toComplete || toComplete.length === 0) return;
      const ids = toComplete.map(e => e._id);
      // Mark completed and not live
      await Event.updateMany({ _id: { $in: ids } }, { $set: { isCompleted: true, isLive: false } });
      // Clean up live viewers and notify clients
      for (const ev of toComplete) {
        try { liveViewers.delete(String(ev._id)); } catch (_) {}
        try { io.emit('event_live_stopped', { id: String(ev._id) }); } catch (_) {}
        try { io.emit('event_updated', { id: String(ev._id), isCompleted: true, isLive: false }); } catch (_) {}
      }
    } catch (e) {
      console.error('Auto-complete events error:', e);
    }
  }, 30000); // check every 30s
} catch (_) {}

app.post('/api/polls/:pollId/vote', authenticateToken, async (req, res) => {
  try {
    const { optionIndex } = req.body || {};
    const poll = await Poll.findById(req.params.pollId).populate('event');
    if (!poll) return res.status(404).json({ message: 'Poll not found' });
    if (!poll.isActive) return res.status(400).json({ message: 'Poll is closed' });
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ message: 'Invalid option' });
    }
    // Prevent duplicate votes per user (stored internally; not exposed)
    const uid = String(req.user.id);
    if (poll.voters.includes(uid)) {
      return res.status(400).json({ message: 'Already voted' });
    }
    poll.voters.push(uid);
    poll.options[optionIndex].votes += 1;
    await poll.save();
    const payload = { eventId: String(poll.event._id || poll.event), poll: sanitizePoll(poll) };
    try { io.emit('poll_updated', payload); } catch (_) {}
    res.json(sanitizePoll(poll));
  } catch (e) {
    console.error('Vote poll error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/polls/:pollId/close', authenticateToken, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.pollId).populate('event');
    if (!poll) return res.status(404).json({ message: 'Poll not found' });
    // Host-only close
    const ev = poll.event;
    const hostId = ev?.host?.toString ? ev.host.toString() : String(ev.host || '');
    if (hostId !== req.user.id) return res.status(403).json({ message: 'Only host can close polls' });
    const eventId = String(ev._id || ev);
    const pollId = String(poll._id);
    await Poll.deleteOne({ _id: poll._id });
    try { io.emit('poll_deleted', { eventId, pollId }); } catch (_) {}
    res.json({ ok: true, deleted: true, pollId });
  } catch (e) {
    console.error('Close poll error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

function sanitizePoll(p) {
  const obj = p.toObject ? p.toObject() : p;
  delete obj.voters;
  return obj;
}


app.get('/api/colleges/:collegeId/departments', async (req, res) => {
  try {
    const departments = await Department.find({ college: req.params.collegeId })
      .sort({ name: 1 });
    res.json({ departments });
  } catch (error) {
    console.error('Get college departments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/colleges/:collegeId/students', async (req, res) => {
  try {
    const students = await Student.find({ college: req.params.collegeId })
      .populate('department', 'name code')
      .populate('college', 'collegeName')
      .sort({ name: 1 });
    res.json({ students });
  } catch (error) {
    console.error('Get college students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/departments/:departmentId/students', async (req, res) => {
  try {
    const students = await Student.find({ department: req.params.departmentId })
      .populate('department', 'name code')
      .populate('college', 'collegeName')
      .sort({ name: 1 });
    res.json({ students });
  } catch (error) {
    console.error('Get department students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/events/:id/join', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.participants.includes(req.user.id)) {
      return res.status(400).json({ message: 'Already joined this event' });
    }

    if (event.currentParticipants >= event.maxParticipants) {
      return res.status(400).json({ message: 'Event is full' });
    }

    event.participants.push(req.user.id);
    event.currentParticipants += 1;
    await event.save();

    try { io.emit('event_updated', { id: String(event._id), currentParticipants: event.currentParticipants }); } catch (_) {}
    res.json({ message: 'Successfully joined event' });
  } catch (error) {
    console.error('Join event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user owns this event (host-only)
    if (event.host?.toString && event.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }

    await Event.findByIdAndDelete(req.params.id);
    try { io.emit('event_deleted', { id: String(req.params.id) }); } catch (_) {}
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Host-only edit
    if (event.host?.toString && event.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }

    const updatableFields = [
      'title',
      'description',
      'type',
      'date',
      'startTime',
      'endTime',
      'duration',
      'maxParticipants',
      'thumbnail',
      'registrationUrl',
      'tags'
    ];

    updatableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        event[field] = req.body[field];
      }
    });

    // If duration changed and endTime not explicitly provided, recompute endTime from startTime
    if (Object.prototype.hasOwnProperty.call(req.body, 'duration') && !Object.prototype.hasOwnProperty.call(req.body, 'endTime')) {
      const start = event.startTime ? new Date(event.startTime) : null;
      const mins = parseInt(event.duration, 10);
      if (start && Number.isFinite(mins) && mins > 0) {
        event.endTime = new Date(start.getTime() + mins * 60000);
      }
    }

    await event.save();
    try { io.emit('event_updated', event); } catch (_) {}
    res.json({ message: 'Event updated successfully', event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Extend event end time (host-only)
app.put('/api/events/:id/extend', authenticateToken, async (req, res) => {
  try {
    const { minutes } = req.body || {};
    const add = parseInt(minutes, 10);
    if (!Number.isFinite(add) || add <= 0) {
      return res.status(400).json({ message: 'Invalid extension minutes' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.host?.toString && event.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to extend this event' });
    }
    const baseEnd = event.endTime ? new Date(event.endTime) : new Date();
    const newEnd = new Date(baseEnd.getTime() + add * 60000);
    event.endTime = newEnd;
    await event.save();
    res.json({ message: 'Event extended', event });
  } catch (error) {
    console.error('Extend event error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Scheduler: auto-start/stop events based on startTime/endTime
setInterval(async () => {
  try {
    const now = new Date();
    // Auto-start events whose startTime has passed and are not live
    const toStart = await Event.find({ startTime: { $lte: now }, isLive: false, isCompleted: { $ne: true } }).limit(50);
    for (const ev of toStart) {
      try {
        const channel = agoraService.generateStreamChannelName(ev.host, ev.title);
        ev.isLive = true;
        ev.streamChannel = channel;
        ev.streamUrl = `/live/${ev._id}`;
        await ev.save();
        try { io.emit('event_live_started', ev); } catch (_) {}
      } catch (_) {}
    }

    // Auto-stop events whose endTime has passed (with 5 min grace) and are live
    const grace = new Date(now.getTime() - 5 * 60 * 1000);
    const toStop = await Event.find({ endTime: { $lte: grace }, isLive: true }).limit(50);
    for (const ev of toStop) {
      try {
        ev.isLive = false;
        ev.isCompleted = true;
        await ev.save();
        try { liveViewers.delete(String(ev._id)); } catch (_) {}
        try { io.emit('event_live_stopped', { id: String(ev._id) }); } catch (_) {}
      } catch (_) {}
    }
  } catch (_) {}
}, 60 * 1000);

// Connect (consent) routes to gate chat/video features
app.post('/api/connect/request', authenticateToken, async (req, res) => {
  try {
    const { peerId } = req.body;
    if (!peerId) return res.status(400).json({ message: 'peerId is required' });
    if (peerId === req.user.id) return res.status(400).json({ message: 'Cannot connect to yourself' });

    // Ensure peer exists
    const peer = await Student.findById(peerId).select('_id');
    if (!peer) return res.status(404).json({ message: 'Peer not found' });

    const [studentA, studentB] = req.user.id < peerId ? [req.user.id, peerId] : [peerId, req.user.id];
    let conn = await Connection.findOne({ studentA, studentB });
    if (!conn) {
      conn = new Connection({ studentA, studentB, status: 'pending' });
      await conn.save();
    } else if (conn.status === 'rejected') {
      // allow re-request after rejection
      conn.status = 'pending';
      await conn.save();
    }
    res.json({ id: conn._id, status: conn.status });
  } catch (e) {
    console.error('Connect request error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/connect/:id', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    const conn = await Connection.findById(req.params.id);
    if (!conn) return res.status(404).json({ message: 'Connection not found' });

    // Only participants can update
    const uid = req.user.id.toString();
    const isParticipant = [conn.studentA.toString(), conn.studentB.toString()].includes(uid);
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });

    if (action === 'accept') conn.status = 'accepted';
    else if (action === 'reject') conn.status = 'rejected';
    else return res.status(400).json({ message: 'Invalid action' });

    await conn.save();
    res.json({ id: conn._id, status: conn.status });
  } catch (e) {
    console.error('Connect update error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/connect/status', authenticateToken, async (req, res) => {
  try {
    const { peerId } = req.query;
    if (!peerId) return res.status(400).json({ message: 'peerId is required' });
    const [studentA, studentB] = req.user.id < peerId ? [req.user.id, peerId] : [peerId, req.user.id];
    const conn = await Connection.findOne({ studentA, studentB });
    if (!conn) return res.json({ status: 'none', id: null });
    res.json({ status: conn.status, id: conn._id });
  } catch (e) {
    console.error('Connect status error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/connect/list', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id.toString();
    const list = await Connection.find({
      $or: [{ studentA: uid }, { studentB: uid }]
    }).lean();
    res.json(list);
  } catch (e) {
    console.error('Connect list error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Video Call Request routes
app.post('/api/video-call-requests', authenticateToken, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    
    // Check if user is trying to send request to themselves
    if (req.user.id === receiverId) {
      return res.status(400).json({ message: 'Cannot send request to yourself' });
    }

    // Check if receiver exists
    const receiver = await Student.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Check if request already exists
    const existingRequest = await VideoCallRequest.findOne({
      $or: [
        { sender: req.user.id, receiver: receiverId, status: 'pending' },
        { sender: receiverId, receiver: req.user.id, status: 'pending' }
      ]
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Video call request already exists' });
    }

    // Create video call request
    const videoCallRequest = new VideoCallRequest({
      sender: req.user.id,
      receiver: receiverId,
      message: message || ''
    });

    await videoCallRequest.save();

    // Populate sender info for response
    await videoCallRequest.populate('sender', 'name usn');

    res.status(201).json(videoCallRequest);
  } catch (error) {
    console.error('Create video call request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/video-call-requests', authenticateToken, async (req, res) => {
  try {
    const { type = 'received' } = req.query;
    
    let query = {};
    if (type === 'received') {
      query.receiver = req.user.id;
    } else if (type === 'sent') {
      query.sender = req.user.id;
    }

    const requests = await VideoCallRequest.find(query)
      .populate('sender', 'name usn photoURL')
      .populate('receiver', 'name usn photoURL')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get video call requests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/video-call-requests/:id', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    
    const videoCallRequest = await VideoCallRequest.findById(req.params.id)
      .populate('sender', 'name usn')
      .populate('receiver', 'name usn');

    if (!videoCallRequest) {
      return res.status(404).json({ message: 'Video call request not found' });
    }

    if (videoCallRequest.receiver._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to respond to this request' });
    }

    if (videoCallRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    if (action === 'accept') {
      videoCallRequest.status = 'accepted';
      await videoCallRequest.save();

      // Generate channel name
      const channelName = agoraService.generateChannelName(videoCallRequest.sender._id, videoCallRequest.receiver._id);
      
      // Create video call record
      const videoCall = new VideoCall({
        caller: videoCallRequest.sender._id,
        receiver: videoCallRequest.receiver._id,
        channelName,
        isLiveStream: false // Students can only do one-to-one calls
      });

      await videoCall.save();

      // Emit call notification to caller (target user-specific room)
      io.to(`user_${videoCallRequest.sender._id.toString()}`).emit('call_accepted', {
        callId: videoCall._id,
        channelName
      });

      res.json({ 
        message: 'Video call request accepted',
        videoCall: videoCall,
        request: videoCallRequest
      });
    } else if (action === 'reject') {
      videoCallRequest.status = 'rejected';
      await videoCallRequest.save();

      res.json({ 
        message: 'Video call request rejected',
        request: videoCallRequest
      });
    } else {
      res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Update video call request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// College Live Stream routes (only for colleges)
app.post('/api/college/live-stream', authenticateToken, async (req, res) => {
  try {
    // Check if user is college admin
    if (req.user.type !== 'college') {
      return res.status(403).json({ message: 'Only colleges can create live streams' });
    }

    const { streamTitle, streamDescription } = req.body;
    
    if (!streamTitle) {
      return res.status(400).json({ message: 'Stream title is required' });
    }

    // Generate channel name
    const channelName = agoraService.generateStreamChannelName(req.user.id, streamTitle);
    
    // Create live stream record
    const videoCall = new VideoCall({
      caller: req.user.id,
      receiver: req.user.id, // College is both caller and receiver for streams
      channelName,
      isLiveStream: true,
      streamTitle,
      streamDescription,
      streamHost: req.user.id
    });

    await videoCall.save();

    res.json({
      message: 'Live stream created successfully',
      callId: videoCall._id,
      channelName,
      streamTitle,
      streamDescription
    });
  } catch (error) {
    console.error('Create live stream error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Video Call Routes (only accessible after request is accepted)

// Initiate video call
app.post('/api/video-call/initiate', authenticateToken, async (req, res) => {
  try {
    const { receiverId } = req.body;
    
    // Check if receiver exists
    const receiver = await Student.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Check if there's an accepted chat request between users
    const acceptedRequest = await ChatRequest.findOne({
      $or: [
        { sender: req.user.id, receiver: receiverId, status: 'accepted' },
        { sender: receiverId, receiver: req.user.id, status: 'accepted' }
      ]
    });

    if (!acceptedRequest) {
      return res.status(403).json({ message: 'Chat request must be accepted before video calling' });
    }

    // Check if there's already a pending call
    const existingCall = await VideoCall.findOne({
      $or: [
        { caller: req.user.id, receiver: receiverId, status: 'pending' },
        { caller: receiverId, receiver: req.user.id, status: 'pending' }
      ]
    });

    if (existingCall) {
      // If the existing call has a legacy/invalid channel name, regenerate to Agora-compliant one
      if (!agoraService.validateChannelName(existingCall.channelName)) {
        existingCall.channelName = agoraService.generateChannelName(req.user.id, receiverId);
        await existingCall.save();
      }
      // Load caller identity for accurate UI on receiver side
      let callerInfo = { id: req.user.id };
      try {
        const callerDoc = await Student.findById(req.user.id).select('name usn');
        if (callerDoc) callerInfo = { id: req.user.id, name: callerDoc.name, usn: callerDoc.usn };
      } catch (_) {}
      
      // Re-emit incoming call to ensure receiver sees it if the first emit was missed
      io.to(`user_${receiverId}`).emit('incoming_call', {
        callId: existingCall._id,
        receiverId: receiverId,
        caller: callerInfo,
        channelName: existingCall.channelName,
        isLiveStream: false
      });
      io.to(`${receiverId}`).emit('incoming_call', {
        callId: existingCall._id,
        receiverId: receiverId,
        caller: callerInfo,
        channelName: existingCall.channelName,
        isLiveStream: false
      });
      // Inform caller that it's already ringing; do not treat as error
      return res.json({ 
        message: 'Call already in progress',
        callId: existingCall._id,
        channelName: existingCall.channelName
      });
    }

    // Generate channel name
    const channelName = agoraService.generateChannelName(req.user.id, receiverId);
    
    // Create video call record
    const videoCall = new VideoCall({
      caller: req.user.id,
      receiver: receiverId,
      channelName,
      isLiveStream: false // Students can only do one-to-one calls
    });

    await videoCall.save();

    // Load caller identity for accurate UI on receiver side
    let callerInfo = { id: req.user.id };
    try {
      const callerDoc = await Student.findById(req.user.id).select('name usn');
      if (callerDoc) callerInfo = { id: req.user.id, name: callerDoc.name, usn: callerDoc.usn };
    } catch (_) {}
    // Emit call notification to receiver (target user-specific room)
    const receiverIdStr = receiverId.toString();
    io.to(`user_${receiverId}`).emit('incoming_call', {
      callId: videoCall._id,
      caller: callerInfo,
      receiverId: receiverIdStr,
      channelName,
      isLiveStream: false
    });
    // Fallback: also emit to plain receiverId room in case clients joined that room
    io.to(`${receiverId}`).emit('incoming_call', {
      callId: videoCall._id,
      caller: callerInfo,
      receiverId: receiverIdStr,
      channelName,
      isLiveStream: false
    });

    res.json({
      message: 'Call initiated successfully',
      callId: videoCall._id,
      channelName
    });
  } catch (error) {
    console.error('Initiate call error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Accept video call
app.post('/api/video-call/:callId/accept', authenticateToken, async (req, res) => {
  try {
    const videoCall = await VideoCall.findById(req.params.callId)
      .populate('caller', 'name usn')
      .populate('receiver', 'name usn');

    if (!videoCall) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (videoCall.receiver._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to accept this call' });
    }

    if (videoCall.status !== 'pending') {
      return res.status(400).json({ message: 'Call is no longer pending' });
    }

    // Ensure channel name is valid (handle legacy records)
    if (!agoraService.validateChannelName(videoCall.channelName)) {
      const callerIdStr = videoCall.caller._id.toString();
      const receiverIdStr = videoCall.receiver._id.toString();
      videoCall.channelName = agoraService.generateChannelName(callerIdStr, receiverIdStr);
    }

    // Update call status
    videoCall.status = 'accepted';
    videoCall.startTime = new Date();
    await videoCall.save();

    // Generate tokens for both participants (use account-based string IDs)
    const callerToken = agoraService.generateRtcToken(videoCall.channelName, videoCall.caller._id.toString());
    const receiverToken = agoraService.generateRtcToken(videoCall.channelName, videoCall.receiver._id.toString());

    // Notify caller that call was accepted (target user-specific room)
    io.to(`user_${videoCall.caller._id.toString()}`).emit('call_accepted', {
      callId: videoCall._id,
      channelName: videoCall.channelName,
      token: callerToken,
      receiver: {
        id: videoCall.receiver._id,
        name: videoCall.receiver.name,
        usn: videoCall.receiver.usn
      }
    });

    res.json({
      message: 'Call accepted',
      callId: videoCall._id,
      channelName: videoCall.channelName,
      token: receiverToken,
      caller: {
        id: videoCall.caller._id,
        name: videoCall.caller.name,
        usn: videoCall.caller.usn
      }
    });
  } catch (error) {
    console.error('Accept call error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reject video call
app.post('/api/video-call/:callId/reject', authenticateToken, async (req, res) => {
  try {
    const videoCall = await VideoCall.findById(req.params.callId)
      .populate('caller', 'name usn');

    if (!videoCall) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (videoCall.receiver.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to reject this call' });
    }

    videoCall.status = 'rejected';
    await videoCall.save();

    // Notify caller that call was rejected (target user-specific room)
    io.to(`user_${videoCall.caller._id.toString()}`).emit('call_rejected', {
      callId: videoCall._id
    });

    res.json({ message: 'Call rejected' });
  } catch (error) {
    console.error('Reject call error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// End video call
app.post('/api/video-call/:callId/end', authenticateToken, async (req, res) => {
  try {
    const videoCall = await VideoCall.findById(req.params.callId)
      .populate('caller', 'name usn')
      .populate('receiver', 'name usn');

    if (!videoCall) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const isCaller = videoCall.caller._id.toString() === req.user.id;
    const isReceiver = videoCall.receiver._id.toString() === req.user.id;

    if (!isCaller && !isReceiver) {
      return res.status(403).json({ message: 'Not authorized to end this call' });
    }

    // Allow ending even when still pending (cancel from caller)
    videoCall.status = 'ended';
    videoCall.endTime = new Date();
    
    if (videoCall.startTime) {
      videoCall.duration = Math.floor((videoCall.endTime - videoCall.startTime) / 1000);
    }

    await videoCall.save();

    // Notify the other participant (target user-specific room + fallback)
    const otherParticipantId = isCaller ? videoCall.receiver._id.toString() : videoCall.caller._id.toString();
    io.to(`user_${otherParticipantId}`).emit('call_ended', { callId: videoCall._id, duration: videoCall.duration || 0 });
    io.to(`${otherParticipantId}`).emit('call_ended', { callId: videoCall._id, duration: videoCall.duration || 0 });

    res.json({ 
      message: 'Call ended',
      duration: videoCall.duration
    });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get call history
app.get('/api/video-call/history', authenticateToken, async (req, res) => {
  try {
    const calls = await VideoCall.find({
      $or: [
        { caller: req.user.id },
        { receiver: req.user.id }
      ]
    })
    .populate('caller', 'name usn')
    .populate('receiver', 'name usn')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json({ calls });
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get Agora credentials
app.get('/api/video-call/credentials', authenticateToken, async (req, res) => {
  try {
    const appId = agoraService.getAppId();
    res.json({ appId });
  } catch (error) {
    console.error('Get credentials error:', error);
    res.status(500).json({ message: 'Agora credentials not configured' });
  }
});

// Get active or pending call with a peer (used for resume flow)
app.get('/api/video-call/active', authenticateToken, async (req, res) => {
  try {
    const { peerId } = req.query;
    if (!peerId) {
      return res.status(400).json({ message: 'peerId required' });
    }

    const call = await VideoCall.findOne({
      $or: [
        { caller: req.user.id, receiver: peerId },
        { caller: peerId, receiver: req.user.id }
      ],
      status: { $in: ['pending', 'accepted'] }
    }).sort({ createdAt: -1 });

    if (!call) {
      return res.status(404).json({ message: 'No active call' });
    }
    // Ensure channelName is Agora-compliant; regenerate if legacy
    if (!agoraService.validateChannelName(call.channelName)) {
      call.channelName = agoraService.generateChannelName(req.user.id, peerId);
      await call.save();
    }
    let token = null;
    if (call.status === 'accepted') {
      token = agoraService.generateRtcToken(call.channelName, req.user.id);
    }

    res.json({ callId: call._id, channelName: call.channelName, token });
  } catch (error) {
    console.error('Get active call error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Alias for active (some clients may call /current)
app.get('/api/video-call/current', authenticateToken, async (req, res) => {
  try {
    const { peerId } = req.query;
    if (!peerId) {
      return res.status(400).json({ message: 'peerId required' });
    }

    const call = await VideoCall.findOne({
      $or: [
        { caller: req.user.id, receiver: peerId },
        { caller: peerId, receiver: req.user.id }
      ],
      status: { $in: ['pending', 'accepted'] }
    }).sort({ createdAt: -1 });

    if (!call) {
      return res.status(404).json({ message: 'No active call' });
    }

    let token = null;
    if (call.status === 'accepted') {
      token = agoraService.generateRtcToken(call.channelName, req.user.id);
    }

    res.json({ callId: call._id, channelName: call.channelName, token });
  } catch (error) {
    console.error('Get current call error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get credentials for a specific call (channelName + token for current user)
app.get('/api/video-call/:callId/credentials', authenticateToken, async (req, res) => {
  try {
    const call = await VideoCall.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const isParticipant = [call.caller.toString(), call.receiver.toString()].includes(req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Ensure channelName is Agora-compliant; regenerate if legacy
    if (!agoraService.validateChannelName(call.channelName)) {
      // Pick other participant id for deterministic rename
      const otherId = call.caller.toString() === req.user.id ? call.receiver.toString() : call.caller.toString();
      call.channelName = agoraService.generateChannelName(req.user.id, otherId);
      await call.save();
    }
    const token = agoraService.generateRtcToken(call.channelName, req.user.id);
    res.json({ callId: call._id, channelName: call.channelName, token });
  } catch (error) {
    console.error('Get call credentials error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Alias for credentials (some clients may call /api/video-call/:callId)
app.get('/api/video-call/:callId', authenticateToken, async (req, res) => {
  try {
    const call = await VideoCall.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const isParticipant = [call.caller.toString(), call.receiver.toString()].includes(req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const token = agoraService.generateRtcToken(call.channelName, req.user.id);
    res.json({ callId: call._id, channelName: call.channelName, token });
  } catch (error) {
    console.error('Get call credentials (alias) error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List all colleges (public)
app.get('/api/colleges', async (req, res) => {
  try {
    const colleges = await College.find({})
      .select('collegeName adminName adminEmail collegeType collegeAddress collegeLink collegeLogo isVerified totalStudents createdAt departments')
      .populate('departments', 'name totalStudents');
    res.json(colleges);
  } catch (error) {
    console.error('Get colleges error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get college by ID (public)
app.get('/api/colleges/:id', async (req, res) => {
  try {
    const college = await College.findById(req.params.id)
      .populate('departments', 'name totalStudents');
    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }
    res.json({
      id: college._id,
      collegeName: college.collegeName,
      adminName: college.adminName,
      adminEmail: college.adminEmail,
      collegeType: college.collegeType,
      collegeAddress: college.collegeAddress,
      collegeLink: college.collegeLink,
      collegeLogo: college.collegeLogo,
      isVerified: college.isVerified,
      totalStudents: college.totalStudents,
      departments: college.departments
    });
  } catch (error) {
    console.error('Get college by id error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Join live stream
app.post('/api/video-call/:callId/join-stream', authenticateToken, async (req, res) => {
  try {
    const videoCall = await VideoCall.findById(req.params.callId)
      .populate('caller', 'name usn')
      .populate('viewers', 'name usn');

    if (!videoCall) {
      return res.status(404).json({ message: 'Stream not found' });
    }

    if (!videoCall.isLiveStream) {
      return res.status(400).json({ message: 'This is not a live stream' });
    }

    if (videoCall.status !== 'accepted') {
      return res.status(400).json({ message: 'Stream is not active' });
    }

    if (videoCall.viewers.length >= videoCall.maxViewers) {
      return res.status(400).json({ message: 'Stream is full' });
    }

    // Add viewer if not already present
    if (!videoCall.viewers.find(viewer => viewer._id.toString() === req.user.id)) {
      videoCall.viewers.push(req.user.id);
      await videoCall.save();
    }

    // Generate viewer token
    const viewerToken = agoraService.generateRtcToken(videoCall.channelName, req.user.id, RtcRole.SUBSCRIBER);

    res.json({
      message: 'Joined stream successfully',
      channelName: videoCall.channelName,
      token: viewerToken,
      streamer: {
        id: videoCall.caller._id,
        name: videoCall.caller.name,
        usn: videoCall.caller.usn
      },
      viewers: videoCall.viewers.length
    });
  } catch (error) {
    console.error('Join stream error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Leave live stream
app.post('/api/video-call/:callId/leave-stream', authenticateToken, async (req, res) => {
  try {
    const videoCall = await VideoCall.findById(req.params.callId);

    if (!videoCall) {
      return res.status(404).json({ message: 'Stream not found' });
    }

    // Remove viewer
    videoCall.viewers = videoCall.viewers.filter(viewer => viewer.toString() !== req.user.id);
    await videoCall.save();

    res.json({ message: 'Left stream successfully' });
  } catch (error) {
    console.error('Leave stream error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));

  // Handle React routing, return all requests to React app (except API routes)
  app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../frontend', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

