import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

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

  socket.on('join_room', (roomId: string) => {
    console.log(`Socket ${socket.id} joining room`, roomId);
    socket.join(roomId);
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
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
