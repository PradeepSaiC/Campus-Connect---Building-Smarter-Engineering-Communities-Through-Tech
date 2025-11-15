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
  totalStudents: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Ensure unique department name per college
departmentSchema.index({ college: 1, name: 1 }, { unique: true });

export default mongoose.model('Department', departmentSchema); 