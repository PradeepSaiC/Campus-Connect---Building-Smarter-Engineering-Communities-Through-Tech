import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['webinar', 'lecture', 'cultural', 'workshop', 'seminar'],
    required: true
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  hostName: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  maxParticipants: {
    type: Number,
    default: 100
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  streamUrl: {
    type: String,
    default: ''
  },
  streamChannel: {
    type: String,
    default: ''
  },
  isLive: {
    type: Boolean,
    default: false
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  thumbnail: {
    type: String,
    default: ''
  },
  registrationUrl: {
    type: String,
    default: ''
  }
}, { timestamps: true });

export default mongoose.model('Event', eventSchema); 