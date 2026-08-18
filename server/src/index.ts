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

const PORT = Number(process.env.PORT) || 5000;
const SERVER_PUBLIC_URL = process.env.SERVER_PUBLIC_URL || `http://localhost:${PORT}`;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

const checkOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (
    !origin ||
    origin.endsWith('.vercel.app') ||
    origin.endsWith('.hf.space') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    allowedOrigins.includes(origin) ||
    process.env.NODE_ENV !== 'production'
  ) {
    callback(null, true);
  } else {
    callback(null, true);
  }
};

const io = new Server(server, {
  maxHttpBufferSize: 10 * 1024 * 1024, // 10 MB limit for whiteboard snapshots
  cors: {
    origin: checkOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

app.use(cors({
  origin: checkOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// --- In-Memory State Layer ---
export interface RoomState {
  roomId: string;
  passcode?: string | null;
  strokes: Record<string, any>[];
}

// Map to store in-memory room boards: roomId -> RoomState
const rooms = new Map<string, RoomState>();
// Map to store user info: socketId -> { roomId, nickname, color }
const users = new Map<string, { roomId: string; nickname: string; color: string }>();
// Map to store the host of each room: roomId -> socketId
const roomHosts = new Map<string, string>();

let mongoAvailable = false;

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoAvailable ? 'connected' : 'unavailable',
    roomsActive: rooms.size,
    usersConnected: users.size,
  });
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
    res.json({ url: `${SERVER_PUBLIC_URL}/uploads/${req.file.filename}` });
  });
});

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

const getOrLoadRoom = async (roomId: string): Promise<RoomState> => {
  let room = rooms.get(roomId);
  if (!room) {
    if (mongoAvailable) {
      try {
        const dbRoom = await RoomModel.findOne({ roomId }).lean();
        if (dbRoom) {
          const loadedRoom: RoomState = {
            roomId: dbRoom.roomId,
            passcode: dbRoom.passcode,
            strokes: (dbRoom.strokes as Record<string, any>[]) || [],
          };
          rooms.set(roomId, loadedRoom);
          return loadedRoom;
        }
      } catch (err) {
        console.error(`[Database] Error loading room ${roomId} from MongoDB:`, err);
      }
    }
    // If not found in DB or MongoDB is unavailable, initialize in memory
    const newRoom: RoomState = {
      roomId,
      strokes: [],
    };
    rooms.set(roomId, newRoom);
    if (mongoAvailable) {
      RoomModel.create({ roomId, strokes: [] }).catch(() => {});
    }
    return newRoom;
  }
  return room;
};

io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);

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
      const room = await getOrLoadRoom(cleanRoomId);
      
      // If room has a passcode, verify it
      if (room && room.passcode) {
        if (room.passcode !== providedPasscode) {
          socket.emit('room:join_error', { message: 'Invalid passcode' });
          return;
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

      console.log(`[Socket] ${socket.id} joining room ${cleanRoomId} as "${cleanNickname}"`);
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

      // Send current board snapshot to the joining client
      socket.emit('board:snapshot', room.strokes || []);
    } catch (err) {
      console.error(`[Socket] Error joining room ${cleanRoomId}:`, err);
      socket.emit('room:join_error', { message: 'Server error joining room' });
    }
  });

  socket.on('room:lock', (payload: { roomId: string; passcode: string }) => {
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

    // 1. Update in-memory state
    const room = rooms.get(roomId);
    if (room) {
      room.passcode = passcode;
    }

    // 2. Broadcast
    io.to(roomId).emit('room:locked', { isLocked: true });

    // 3. Persist asynchronously if MongoDB is available
    if (mongoAvailable) {
      RoomModel.updateOne({ roomId }, { $set: { passcode } }).catch((err) => {
        console.error(`[Database] Error locking room ${roomId}:`, err);
      });
    }
  });

  socket.on('stroke:created', (payload: { roomId: string; stroke: Record<string, any> }) => {
    const validation = StrokeCreatedPayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[stroke:created] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId, stroke } = validation.data;
    if (!isRoomMember(socket.id, roomId)) return;

    // 1. Update in-memory state
    const room = rooms.get(roomId);
    if (room) {
      room.strokes.push(stroke);
    }

    // 2. Broadcast immediately to peers
    socket.to(roomId).emit('stroke:created', stroke);

    // 3. Persist asynchronously if MongoDB is available
    if (mongoAvailable) {
      RoomModel.findOneAndUpdate(
        { roomId },
        { $push: { strokes: stroke } }
      ).catch((err) => {
        console.error(`[Database] Error saving stroke for ${roomId}:`, err);
      });
    }
  });

  socket.on('shape:update', (payload: { roomId: string; shape: Record<string, any> }) => {
    const validation = ShapeUpdatePayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[shape:update] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId, shape } = validation.data;
    if (!isRoomMember(socket.id, roomId)) return;

    // 1. Update in-memory state
    const room = rooms.get(roomId);
    if (room) {
      const idx = room.strokes.findIndex((s) => s.id === shape.id);
      if (idx !== -1) {
        room.strokes[idx] = shape;
      } else {
        room.strokes.push(shape);
      }
    }

    // 2. Broadcast immediately to peers
    socket.to(roomId).emit('shape:update', shape);

    // 3. Persist asynchronously if MongoDB is available
    if (mongoAvailable) {
      RoomModel.updateOne(
        { roomId, "strokes.id": shape.id },
        { $set: { "strokes.$": shape } }
      ).catch((err) => {
        console.error(`[Database] Error updating shape for ${roomId}:`, err);
      });
    }
  });

  socket.on('shape:delete', (payload: { roomId: string; shapeId: string }) => {
    const validation = ShapeDeletePayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[shape:delete] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId, shapeId } = validation.data;
    if (!isRoomMember(socket.id, roomId)) return;

    // 1. Update in-memory state
    const room = rooms.get(roomId);
    if (room) {
      room.strokes = room.strokes.filter((s) => s.id !== shapeId);
    }

    // 2. Broadcast immediately
    socket.to(roomId).emit('shape:delete', shapeId);

    // 3. Persist asynchronously if MongoDB is available
    if (mongoAvailable) {
      RoomModel.updateOne(
        { roomId },
        { $pull: { strokes: { id: shapeId } } }
      ).catch((err) => {
        console.error(`[Database] Error deleting shape from ${roomId}:`, err);
      });
    }
  });

  socket.on('board:clear', (payload: { roomId: string }) => {
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

    // 1. Update in-memory state
    const room = rooms.get(roomId);
    if (room) {
      room.strokes = [];
    }

    // 2. Broadcast
    console.log(`[Board] Cleared by host ${socket.id} in room ${roomId}`);
    socket.to(roomId).emit('board:clear');

    // 3. Persist asynchronously if MongoDB is available
    if (mongoAvailable) {
      RoomModel.updateOne(
        { roomId },
        { $set: { strokes: [] } }
      ).catch((err) => {
        console.error(`[Database] Error clearing room for ${roomId}:`, err);
      });
    }
  });

  socket.on('board:snapshot', (payload: { roomId: string; strokes: Record<string, any>[] }) => {
    const validation = BoardSnapshotPayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.warn(`[board:snapshot] Validation failed for socket ${socket.id}:`, validation.error.format());
      return;
    }
    const { roomId, strokes } = validation.data;
    if (!isRoomMember(socket.id, roomId)) return;

    // 1. Update in-memory state
    const room = rooms.get(roomId);
    if (room) {
      room.strokes = strokes;
    } else {
      rooms.set(roomId, { roomId, strokes });
    }

    // 2. Broadcast snapshot to other clients
    console.log(`[Board] Snapshot received from ${socket.id} in room ${roomId} (${strokes.length} strokes)`);
    socket.to(roomId).emit('board:snapshot', strokes);

    // 3. Persist asynchronously if MongoDB is available
    if (mongoAvailable) {
      RoomModel.findOneAndUpdate(
        { roomId },
        { $set: { strokes } },
        { upsert: true }
      ).catch((err) => {
        console.error(`[Database] Error saving room snapshot for ${roomId}:`, err);
      });
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
    console.log('[Socket] Client disconnected:', socket.id);
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

// START HTTP + Socket.IO Server IMMEDIATELY (Never blocked by database)
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 SyncBoard Server running on port ${PORT}`);
  console.log(`🌐 Public URL: ${SERVER_PUBLIC_URL}`);
  console.log(`=========================================`);
});

// Asynchronously attempt MongoDB connection (Optional Persistence)
const mongoUri = process.env.MONGO_URI;

if (mongoUri) {
  mongoose.connection.on('connected', () => {
    mongoAvailable = true;
    console.log('✅ [Database] MongoDB connected. Permanent persistence enabled.');
  });

  mongoose.connection.on('error', (err) => {
    mongoAvailable = false;
    console.warn('⚠️ [Database] MongoDB error. Running SyncBoard with in-memory persistence.', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    mongoAvailable = false;
    console.warn('⚠️ [Database] MongoDB disconnected. Running SyncBoard with in-memory persistence.');
  });

  mongoose
    .connect(mongoUri, { serverSelectionTimeoutMS: 4000 })
    .catch((err) => {
      mongoAvailable = false;
      console.warn('⚠️ [Database] MongoDB connection failed. Running SyncBoard with in-memory persistence.');
    });
} else {
  console.log('ℹ️ [Database] MONGO_URI not configured. Running SyncBoard with in-memory persistence.');
}
