import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  usn: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  photoURL: {
    type: String,
    default: '',
    trim: true
  },
  password: {
    type: String,
    trim: true
  },
  isRegistered: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    default: ''
  },
  otpExpiry: {
    type: Date
  },
  interests: [{
    type: String,
    trim: true
  }],
  skills: [{
    type: String,
    trim: true
  }],
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  isFirstLogin: {
    type: Boolean,
    default: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College'
  }
}, { timestamps: true });

export default mongoose.model('Student', studentSchema);

