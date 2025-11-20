import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    strokes: { type: Array, default: [] },
  },
  { timestamps: true }
);

export const RoomModel = mongoose.model('Room', roomSchema);
