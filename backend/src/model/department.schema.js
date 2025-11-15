import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  hod: {
    type: String,
    default: '',
    trim: true
  },
  totalStudents: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default mongoose.model('Department', departmentSchema); 