import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { RoomModel } from './models/Room';
import {
  JoinRoomPayloadSchema,
  StrokeCreatedPayloadSchema,
  ShapeUpdatePayloadSchema,
  ShapeDeletePayloadSchema,
  BoardClearPayloadSchema,
  BoardSnapshotPayloadSchema,
  CursorMovePayloadSchema,
  LockRoomPayloadSchema,
  LaserUpdatePayloadSchema,
  LaserClearPayloadSchema,
  SelectionUpdatePayloadSchema
} from './validators';

dotenv.config();

const app = express();
const server = http.createServer(app);

const getClientUrl = () => {
  const url = process.env.CLIENT_URL || 'http://localhost:5173';
  return url.startsWith('http') ? url : `https://${url}`;
};

const io = new Server(server, {
  maxHttpBufferSize: 10 * 1024 * 1024, // 10 MB limit for large whiteboard snapshots
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Setup uploads directory
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve the uploads folder with security headers
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  }
}));

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] || '.png';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Only valid image files (PNG, JPEG, WebP, GIF) are allowed'));
    }
  }
});

app.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const backendUrl = process.env.VITE_SERVER_URL || `http://localhost:${process.env.PORT || 7860}`;
    res.json({ url: `${backendUrl}/uploads/${req.file.filename}` });
  });
});

// Map to store user info: socketId -> { roomId, nickname, color }
const users = new Map<string, { roomId: string; nickname: string; color: string }>();
// Map to store the host of each room: roomId -> socketId
const roomHosts = new Map<string, string>();

const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};

const isRoomHost = (socketId: string, roomId: string): boolean => {
  return roomHosts.get(roomId) === socketId;
};

const isRoomMember = (socketId: string, roomId: string): boolean => {
  const user = users.get(socketId);
  return !!user && user.roomId === roomId;
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  const getRoomUsers = (roomId: string) => {
    const hostSocketId = roomHosts.get(roomId);
    const roomUsers: { socketId: string; nickname: string; color: string; isHost: boolean }[] = [];
    for (const [socketId, user] of users.entries()) {
      if (user.roomId === roomId) {
        roomUsers.push({ socketId, nickname: user.nickname, color: user.color, isHost: socketId === hostSocketId });
      }
    }
    return roomUsers;
  };

  socket.on('join_room', async (roomId: string, nickname: string = 'Guest', passcode?: string) => {
    const validation = JoinRoomPayloadSchema.safeParse({ roomId, nickname, passcode });
    if (!validation.success) {
      console.warn(`[join_room] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const validated = validation.data;
    const cleanRoomId = validated.roomId;
    const cleanNickname = validated.nickname || 'Guest';
    const providedPasscode = validated.passcode;

    try {
      let room = await RoomModel.findOne({ roomId: cleanRoomId }).lean();
      
      // If room exists and has a passcode, verify it
      if (room && room.passcode) {
        if (room.passcode !== providedPasscode) {
          socket.emit('room:join_error', { message: 'Invalid passcode' });
          return;
        }
      }

      if (!room) {
        try {
          room = await RoomModel.findOneAndUpdate(
            { roomId: cleanRoomId },
            { $setOnInsert: { roomId: cleanRoomId, strokes: [] } },
            { upsert: true, new: true, lean: true }
          );
        } catch (err: any) {
          // Fallback if duplicate key occurred in concurrent join
          room = await RoomModel.findOne({ roomId: cleanRoomId }).lean();
        }
      }

      // If user was previously in another room, clean up previous room subscription
      const prevUser = users.get(socket.id);
      if (prevUser && prevUser.roomId !== cleanRoomId) {
        socket.leave(prevUser.roomId);
        if (roomHosts.get(prevUser.roomId) === socket.id) {
          roomHosts.delete(prevUser.roomId);
          for (const [sid, u] of users.entries()) {
            if (u.roomId === prevUser.roomId && sid !== socket.id) {
              roomHosts.set(prevUser.roomId, sid);
              break;
            }
          }
        }
        io.to(prevUser.roomId).emit('room:users', getRoomUsers(prevUser.roomId));
      }

      console.log(`Socket ${socket.id} joining room`, cleanRoomId, 'as', cleanNickname);
      socket.join(cleanRoomId);

      users.set(socket.id, {
        roomId: cleanRoomId,
        nickname: cleanNickname,
        color: getRandomColor()
      });

      // Assign host if this is the first user joining the room or host is unassigned
      if (!roomHosts.has(cleanRoomId)) {
        roomHosts.set(cleanRoomId, socket.id);
      }

      // Broadcast updated user list to everyone in the room (including self)
      io.to(cleanRoomId).emit('room:users', getRoomUsers(cleanRoomId));

      const strokes = room?.strokes || [];
      if (strokes.length > 0) {
        socket.emit('board:snapshot', strokes);
      }
    } catch (err) {
      console.error('Error loading room state for', cleanRoomId, err);
      socket.emit('room:join_error', { message: 'Server error joining room' });
    }
  });

  socket.on('room:lock', async (payload: { roomId: string; passcode: string }) => {
    const validation = LockRoomPayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[room:lock] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId, passcode } = validation.data;
    
    // Only allow room host who is currently in the room
    if (!isRoomHost(socket.id, roomId) || !isRoomMember(socket.id, roomId)) {
      console.warn(`[room:lock] Unauthorized lock attempt by socket ${socket.id} in room ${roomId}`);
      return;
    }

    try {
      await RoomModel.updateOne({ roomId }, { $set: { passcode } });
      io.to(roomId).emit('room:locked', { isLocked: true });
    } catch (err) {
      console.error('Error locking room', roomId, err);
    }
  });

  socket.on('stroke:created', async (payload: { roomId: string; stroke: Record<string, any> }) => {
    const validation = StrokeCreatedPayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[stroke:created] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId, stroke } = validation.data;
    if (!isRoomMember(socket.id, roomId)) return;

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

  socket.on('shape:update', async (payload: { roomId: string; shape: Record<string, any> }) => {
    const validation = ShapeUpdatePayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[shape:update] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId, shape } = validation.data;
    if (!isRoomMember(socket.id, roomId)) return;

    socket.to(roomId).emit('shape:update', shape);

    try {
      await RoomModel.updateOne(
        { roomId, "strokes.id": shape.id },
        { $set: { "strokes.$": shape } }
      );
    } catch (err) {
      console.error('Error updating shape for', roomId, err);
    }
  });

  socket.on('shape:delete', async (payload: { roomId: string; shapeId: string }) => {
    const validation = ShapeDeletePayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[shape:delete] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId, shapeId } = validation.data;
    if (!isRoomMember(socket.id, roomId)) return;

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
    const validation = BoardClearPayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[board:clear] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId } = validation.data;
    
    // Only host can clear board
    if (!isRoomHost(socket.id, roomId) || !isRoomMember(socket.id, roomId)) {
      console.warn(`[board:clear] Unauthorized board clear attempt by socket ${socket.id} in room ${roomId}`);
      return;
    }

    console.log('board:clear from host', socket.id, 'room', roomId);
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

  socket.on('board:snapshot', async (payload: { roomId: string; strokes: Record<string, any>[] }) => {
    const validation = BoardSnapshotPayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[board:snapshot] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId, strokes } = validation.data;
    if (!isRoomMember(socket.id, roomId)) return;

    console.log('board:snapshot from', socket.id, 'room', roomId);
    socket.to(roomId).emit('board:snapshot', strokes);

    try {
      await RoomModel.findOneAndUpdate(
        { roomId },
        { $set: { strokes } },
        { upsert: true }
      );
    } catch (err) {
      console.error('Error saving room snapshot for', roomId, err);
    }
  });

  socket.on('selection:update', (payload: { roomId: string; shapeId?: string | null }) => {
    const validation = SelectionUpdatePayloadSchema.safeParse(payload);
    if (!validation.success) return;
    const { roomId, shapeId } = validation.data;
    const user = users.get(socket.id);
    if (user && user.roomId === roomId) {
      socket.to(roomId).emit('selection:update', {
        socketId: socket.id,
        shapeId: shapeId || null,
        color: user.color
      });
    }
  });

  socket.on('cursor:move', (payload: { roomId: string; x: number; y: number }) => {
    const validation = CursorMovePayloadSchema.safeParse(payload);
    if (!validation.success) {
      return;
    }
    const { roomId, x, y } = validation.data;
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

  socket.on('laser:update', (payload: { roomId: string; points: number[] }) => {
    const validation = LaserUpdatePayloadSchema.safeParse(payload);
    if (!validation.success) return;
    const { roomId, points } = validation.data;
    const user = users.get(socket.id);
    if (user && user.roomId === roomId) {
      socket.to(roomId).emit('laser:update', {
        socketId: socket.id,
        points,
        color: user.color
      });
    }
  });

  socket.on('laser:clear', (payload: { roomId: string }) => {
    const validation = LaserClearPayloadSchema.safeParse(payload);
    if (!validation.success) return;
    const { roomId } = validation.data;
    const user = users.get(socket.id);
    if (user && user.roomId === roomId) {
      socket.to(roomId).emit('laser:clear', {
        socketId: socket.id
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const user = users.get(socket.id);
    if (user) {
      const { roomId } = user;
      users.delete(socket.id); // Delete first to update list correctly

      // If the host disconnects, assign the next available user as host
      if (roomHosts.get(roomId) === socket.id) {
        roomHosts.delete(roomId);
        // Find another user in the room to become host
        for (const [sid, u] of users.entries()) {
          if (u.roomId === roomId) {
            roomHosts.set(roomId, sid);
            break;
          }
        }
      }

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

    const PORT = process.env.PORT || 7860;
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
  });
