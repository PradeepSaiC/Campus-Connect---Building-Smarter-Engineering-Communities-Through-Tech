import mongoose from 'mongoose';

const ConnectionSchema = new mongoose.Schema({
  studentA: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentB: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, { timestamps: true });

// Ensure unordered uniqueness by always storing the smaller _id in studentA
ConnectionSchema.pre('validate', function(next) {
  if (this.studentA && this.studentB) {
    const a = this.studentA.toString();
    const b = this.studentB.toString();
    if (a > b) {
      const tmp = this.studentA;
      this.studentA = this.studentB;
      this.studentB = tmp;
    }
  }
  next();
});

ConnectionSchema.index({ studentA: 1, studentB: 1 }, { unique: true });

export default mongoose.model('Connection', ConnectionSchema);
