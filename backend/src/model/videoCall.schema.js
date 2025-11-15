import mongoose from 'mongoose';

const videoCallSchema = new mongoose.Schema({
  caller: {
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
    enum: ['pending', 'accepted', 'rejected', 'ended', 'missed'],
    default: 'pending'
  },
  channelName: {
    type: String,
    required: true
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  isLiveStream: {
    type: Boolean,
    default: false
  },
  streamTitle: {
    type: String,
    default: ''
  },
  streamDescription: {
    type: String,
    default: ''
  },
  streamHost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College'
  }, // Only colleges can host streams
  viewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  maxViewers: {
    type: Number,
    default: 1000
  }
}, { timestamps: true });

export default mongoose.model('VideoCall', videoCallSchema); 