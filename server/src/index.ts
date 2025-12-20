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

const getClientUrl = () => {
  const url = process.env.CLIENT_URL || 'http://localhost:5173';
  return url.startsWith('http') ? url : `https://${url}`;
};

const io = new Server(server, {
  cors: {
    origin: getClientUrl(),
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Map to store user info: socketId -> { roomId, nickname, color }
const users = new Map<string, { roomId: string; nickname: string; color: string }>();

const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  const getRoomUsers = (roomId: string) => {
    const roomUsers: { socketId: string; nickname: string; color: string }[] = [];
    for (const [socketId, user] of users.entries()) {
      if (user.roomId === roomId) {
        roomUsers.push({ socketId, nickname: user.nickname, color: user.color });
      }
    }
    return roomUsers;
  };

  socket.on('join_room', async (roomId: string, nickname: string = 'Guest') => {
    console.log(`Socket ${socket.id} joining room`, roomId, 'as', nickname);
    socket.join(roomId);

    users.set(socket.id, {
      roomId,
      nickname,
      color: getRandomColor()
    });

    // Broadcast updated user list to everyone in the room (including self)
    io.to(roomId).emit('room:users', getRoomUsers(roomId));

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

  socket.on('stroke:created', async (payload: { roomId: string; stroke: unknown }) => {
    const { roomId, stroke } = payload;
    // console.log('stroke:created from', socket.id, 'room', roomId);
    socket.to(roomId).emit('stroke:created', stroke);

    try {
      await RoomModel.findOneAndUpdate(
        { roomId },
        { $push: { strokes: stroke } }
      );
    } catch (err) {
      console.error('Error saving stroke for', roomId, err);
    }
  });

  socket.on('shape:update', async (payload: { roomId: string; shape: any }) => {
    const { roomId, shape } = payload;
    socket.to(roomId).emit('shape:update', shape);

    try {
      // Correct implementation depends on exact schema, but for 'strokes' array of objects:
      // We find the doc and utilize array filters or pull/push logic. 
      // Simpler for array of objects with id:

      await RoomModel.updateOne(
        { roomId, "strokes.id": shape.id },
        { $set: { "strokes.$": shape } }
      );
    } catch (err) {
      console.error('Error updating shape for', roomId, err);
    }
  });

  socket.on('shape:delete', async (payload: { roomId: string; shapeId: string }) => {
    const { roomId, shapeId } = payload;
    socket.to(roomId).emit('shape:delete', shapeId);

    try {
      await RoomModel.updateOne(
        { roomId },
        { $pull: { strokes: { id: shapeId } } }
      );
    } catch (err) {
      console.error('Error deleting shape from', roomId, err);
    }
  });

  socket.on('board:clear', async (payload: { roomId: string }) => {
    const { roomId } = payload;
    console.log('board:clear from', socket.id, 'room', roomId);
    socket.to(roomId).emit('board:clear');

    try {
      await RoomModel.updateOne(
        { roomId },
        { $set: { strokes: [] } }
      );
    } catch (err) {
      console.error('Error clearing room for', roomId, err);
    }
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

  socket.on('cursor:move', (payload: { roomId: string; x: number; y: number }) => {
    const { roomId, x, y } = payload;
    const user = users.get(socket.id);
    if (user && user.roomId === roomId) {
      socket.to(roomId).emit('cursor:move', {
        socketId: socket.id,
        x,
        y,
        nickname: user.nickname,
        color: user.color
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const user = users.get(socket.id);
    if (user) {
      const { roomId } = user;
      users.delete(socket.id); // Delete first to update list correctly
      socket.to(roomId).emit('user:left', { socketId: socket.id });

      // Emit updated user list to remaining users
      io.to(roomId).emit('room:users', getRoomUsers(roomId));
    }
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
