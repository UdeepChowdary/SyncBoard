import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { RoomModel } from './models/Room';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_room', async (roomId: string) => {
    console.log(`Socket ${socket.id} joining room`, roomId);
    socket.join(roomId);

    try {
      let room = await RoomModel.findOne({ roomId }).lean();
      if (!room) {
        room = await RoomModel.create({ roomId, strokes: [] });
      }

      const strokes = room.strokes || [];
      if (strokes.length > 0) {
        socket.emit('board:snapshot', strokes);
      }
    } catch (err) {
      console.error('Error loading room state for', roomId, err);
    }
  });

  socket.on('stroke:created', (payload: { roomId: string; stroke: unknown }) => {
    const { roomId, stroke } = payload;
    console.log('stroke:created from', socket.id, 'room', roomId);
    socket.to(roomId).emit('stroke:created', stroke);
  });

  socket.on('board:clear', (payload: { roomId: string }) => {
    const { roomId } = payload;
    console.log('board:clear from', socket.id, 'room', roomId);
    socket.to(roomId).emit('board:clear');
  });

  socket.on('board:snapshot', (payload: { roomId: string; strokes: unknown }) => {
    const { roomId, strokes } = payload;
    console.log('board:snapshot from', socket.id, 'room', roomId);
    socket.to(roomId).emit('board:snapshot', strokes);

     RoomModel.findOneAndUpdate(
       { roomId },
       { $set: { strokes } },
       { upsert: true }
     ).catch((err) => {
       console.error('Error saving room snapshot for', roomId, err);
     });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/syncboard';

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');

    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
  });
