import mongoose from 'mongoose';

const videoCallRequestSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  message: {
    type: String,
    trim: true,
    maxlength: 200
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    }
  }
}, { 
  timestamps: true,
  indexes: [
    { sender: 1, receiver: 1, status: 1 },
    { expiresAt: 1, expireAfterSeconds: 0 }
  ]
});

export default mongoose.model('VideoCallRequest', videoCallRequestSchema); 