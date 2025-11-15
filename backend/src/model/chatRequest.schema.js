import mongoose from 'mongoose';

const chatRequestSchema = new mongoose.Schema({
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
    enum: ['pending', 'accepted', 'rejected'],
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
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
  }
}, { 
  timestamps: true,
  indexes: [
    { sender: 1, receiver: 1, status: 1 },
    { expiresAt: 1, expireAfterSeconds: 0 }
  ]
});

export default mongoose.model('ChatRequest', chatRequestSchema); 