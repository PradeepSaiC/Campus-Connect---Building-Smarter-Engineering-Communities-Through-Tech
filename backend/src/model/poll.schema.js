import mongoose from 'mongoose';

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: { type: Number, default: 0 }
}, { _id: false });

const pollSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  question: { type: String, required: true },
  options: { type: [pollOptionSchema], validate: v => Array.isArray(v) && v.length >= 2 },
  // Internal voter tracking to prevent duplicate votes; not exposed in API
  voters: { type: [String], default: [] }, // store userId strings
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Poll', pollSchema);
