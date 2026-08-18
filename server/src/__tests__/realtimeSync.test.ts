import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { RoomState } from '../index';

describe('Realtime Multi-Client Synchronization & In-Memory Store', () => {
  let server: http.Server;
  let ioServer: SocketIOServer;
  let port: number;
  let serverUrl: string;

  const rooms = new Map<string, RoomState>();
  const users = new Map<string, { roomId: string; nickname: string; color: string }>();
  const roomHosts = new Map<string, string>();

  beforeAll(async () => {
    const app = express();
    server = http.createServer(app);
    ioServer = new SocketIOServer(server, {
      cors: { origin: '*' },
    });

    ioServer.on('connection', (socket) => {
      socket.on('join_room', (roomId: string, nickname: string = 'Guest', passcode?: string) => {
        let room = rooms.get(roomId);
        if (!room) {
          room = { roomId, strokes: [] };
          rooms.set(roomId, room);
        }

        if (room.passcode && room.passcode !== passcode) {
          socket.emit('room:join_error', { message: 'Invalid passcode' });
          return;
        }

        socket.join(roomId);
        users.set(socket.id, { roomId, nickname, color: '#f00' });

        if (!roomHosts.has(roomId)) {
          roomHosts.set(roomId, socket.id);
        }

        const roomUsers = Array.from(users.entries())
          .filter(([_, u]) => u.roomId === roomId)
          .map(([sid, u]) => ({
            socketId: sid,
            nickname: u.nickname,
            color: u.color,
            isHost: sid === roomHosts.get(roomId),
          }));

        ioServer.to(roomId).emit('room:users', roomUsers);
        socket.emit('board:snapshot', room.strokes || []);
      });

      socket.on('stroke:created', ({ roomId, stroke }: { roomId: string; stroke: any }) => {
        const room = rooms.get(roomId);
        if (room) {
          room.strokes.push(stroke);
        }
        socket.to(roomId).emit('stroke:created', stroke);
      });

      socket.on('shape:update', ({ roomId, shape }: { roomId: string; shape: any }) => {
        const room = rooms.get(roomId);
        if (room) {
          const idx = room.strokes.findIndex((s) => s.id === shape.id);
          if (idx !== -1) room.strokes[idx] = shape;
          else room.strokes.push(shape);
        }
        socket.to(roomId).emit('shape:update', shape);
      });

      socket.on('shape:delete', ({ roomId, shapeId }: { roomId: string; shapeId: string }) => {
        const room = rooms.get(roomId);
        if (room) {
          room.strokes = room.strokes.filter((s) => s.id !== shapeId);
        }
        socket.to(roomId).emit('shape:delete', shapeId);
      });

      socket.on('board:clear', ({ roomId }: { roomId: string }) => {
        if (roomHosts.get(roomId) !== socket.id) return;
        const room = rooms.get(roomId);
        if (room) {
          room.strokes = [];
        }
        socket.to(roomId).emit('board:clear');
      });

      socket.on('selection:update', ({ roomId, shapeId }: { roomId: string; shapeId: string | null }) => {
        const user = users.get(socket.id);
        if (user && user.roomId === roomId) {
          socket.to(roomId).emit('selection:update', {
            socketId: socket.id,
            shapeId,
            color: user.color,
          });
        }
      });

      socket.on('laser:update', ({ roomId, points }: { roomId: string; points: number[] }) => {
        socket.to(roomId).emit('laser:update', {
          socketId: socket.id,
          points,
          color: '#f00',
        });
      });

      socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
          users.delete(socket.id);
          if (roomHosts.get(user.roomId) === socket.id) {
            roomHosts.delete(user.roomId);
            for (const [sid, u] of users.entries()) {
              if (u.roomId === user.roomId) {
                roomHosts.set(user.roomId, sid);
                break;
              }
            }
          }
          socket.to(user.roomId).emit('user:left', { socketId: socket.id });
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr) {
          port = addr.port;
          serverUrl = `http://localhost:${port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      ioServer.close(() => {
        server.close(() => resolve());
      });
    });
  });

  it('synchronizes strokes, updates, sticky notes, and deletions between Client A and Client B', async () => {
    const clientA: ClientSocketType = ClientSocket(serverUrl);
    const clientB: ClientSocketType = ClientSocket(serverUrl);

    await Promise.all([
      new Promise<void>((resolve) => clientA.on('connect', () => resolve())),
      new Promise<void>((resolve) => clientB.on('connect', () => resolve())),
    ]);

    // Both join 'collab-room-1'
    clientA.emit('join_room', 'collab-room-1', 'Alice');
    clientB.emit('join_room', 'collab-room-1', 'Bob');

    await new Promise((r) => setTimeout(r, 50));

    // 1. Client A draws a stroke
    const penStroke = { id: 'stroke-a1', tool: 'pen', color: '#fff', points: [10, 10, 20, 20] };
    const strokePromise = new Promise<any>((resolve) => {
      clientB.once('stroke:created', (stroke) => resolve(stroke));
    });
    clientA.emit('stroke:created', { roomId: 'collab-room-1', stroke: penStroke });

    const receivedStroke = await strokePromise;
    expect(receivedStroke.id).toBe('stroke-a1');
    expect(receivedStroke.tool).toBe('pen');

    // 2. Client B creates a sticky note
    const stickyNote = { id: 'sticky-b1', tool: 'sticky', text: 'Important Note', fillColor: '#fef08a' };
    const stickyPromise = new Promise<any>((resolve) => {
      clientA.once('stroke:created', (stroke) => resolve(stroke));
    });
    clientB.emit('stroke:created', { roomId: 'collab-room-1', stroke: stickyNote });

    const receivedSticky = await stickyPromise;
    expect(receivedSticky.id).toBe('sticky-b1');
    expect(receivedSticky.text).toBe('Important Note');

    // 3. Client B updates the sticky note text
    const updatedSticky = { ...stickyNote, text: 'Updated Note' };
    const updatePromise = new Promise<any>((resolve) => {
      clientA.once('shape:update', (shape) => resolve(shape));
    });
    clientB.emit('shape:update', { roomId: 'collab-room-1', shape: updatedSticky });

    const receivedUpdate = await updatePromise;
    expect(receivedUpdate.text).toBe('Updated Note');

    // 4. Client C joins and gets the authoritative board snapshot with both shapes
    const clientC: ClientSocketType = ClientSocket(serverUrl);
    await new Promise<void>((resolve) => clientC.on('connect', () => resolve()));

    const snapshotPromise = new Promise<any[]>((resolve) => {
      clientC.once('board:snapshot', (strokes) => resolve(strokes));
    });
    clientC.emit('join_room', 'collab-room-1', 'Charlie');

    const receivedSnapshot = await snapshotPromise;
    expect(receivedSnapshot).toHaveLength(2);
    expect(receivedSnapshot.map((s) => s.id)).toEqual(['stroke-a1', 'sticky-b1']);
    expect(receivedSnapshot.find((s) => s.id === 'sticky-b1').text).toBe('Updated Note');

    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();
  });

  it('supports host-only board clear and selection updates', async () => {
    const clientHost: ClientSocketType = ClientSocket(serverUrl);
    const clientGuest: ClientSocketType = ClientSocket(serverUrl);

    await Promise.all([
      new Promise<void>((resolve) => clientHost.on('connect', () => resolve())),
      new Promise<void>((resolve) => clientGuest.on('connect', () => resolve())),
    ]);

    const hostJoined = new Promise<void>((resolve) => clientHost.once('room:users', () => resolve()));
    clientHost.emit('join_room', 'clear-room', 'HostUser');
    await hostJoined;

    const guestJoined = new Promise<void>((resolve) => clientGuest.once('room:users', () => resolve()));
    clientGuest.emit('join_room', 'clear-room', 'GuestUser');
    await guestJoined;

    // Selection update
    const selectionPromise = new Promise<any>((resolve) => {
      clientGuest.once('selection:update', (selection) => resolve(selection));
    });
    clientHost.emit('selection:update', { roomId: 'clear-room', shapeId: 'shape-99' });

    const receivedSelection = await selectionPromise;
    expect(receivedSelection.shapeId).toBe('shape-99');

    // Host clears board
    const clearPromise = new Promise<void>((resolve) => {
      clientGuest.once('board:clear', () => resolve());
    });
    clientHost.emit('board:clear', { roomId: 'clear-room' });
    await clearPromise;

    clientHost.disconnect();
    clientGuest.disconnect();
  });

  it('recovers full room state after temporary client disconnect and resumes live sync', async () => {
    const clientA: ClientSocketType = ClientSocket(serverUrl);
    const clientB: ClientSocketType = ClientSocket(serverUrl);

    await Promise.all([
      new Promise<void>((resolve) => clientA.on('connect', () => resolve())),
      new Promise<void>((resolve) => clientB.on('connect', () => resolve())),
    ]);

    const aJoined = new Promise<void>((resolve) => clientA.once('room:users', () => resolve()));
    clientA.emit('join_room', 'reconnect-room', 'Alice');
    await aJoined;

    const bJoined = new Promise<void>((resolve) => clientB.once('room:users', () => resolve()));
    clientB.emit('join_room', 'reconnect-room', 'Bob');
    await bJoined;

    // 1. Client A creates initial stroke
    clientA.emit('stroke:created', {
      roomId: 'reconnect-room',
      stroke: { id: 'stroke-1', tool: 'pen', points: [0, 0, 10, 10] },
    });

    // 2. Client B disconnects temporarily
    clientB.disconnect();

    // 3. Client A creates two more strokes while B is offline
    clientA.emit('stroke:created', {
      roomId: 'reconnect-room',
      stroke: { id: 'stroke-2', tool: 'rect', x: 20, y: 20, width: 50, height: 50 },
    });
    clientA.emit('stroke:created', {
      roomId: 'reconnect-room',
      stroke: { id: 'stroke-3', tool: 'sticky', text: 'Offline Catchup' },
    });

    // 4. Client B reconnects and rejoins the room
    const reconnectedB: ClientSocketType = ClientSocket(serverUrl);
    await new Promise<void>((resolve) => reconnectedB.on('connect', () => resolve()));

    const snapshotPromise = new Promise<any[]>((resolve) => {
      reconnectedB.once('board:snapshot', (strokes) => resolve(strokes));
    });
    reconnectedB.emit('join_room', 'reconnect-room', 'Bob');

    // 5. Client B recovers all 3 strokes from the authoritative server state
    const recoveredStrokes = await snapshotPromise;
    expect(recoveredStrokes).toHaveLength(3);
    expect(recoveredStrokes.map((s) => s.id)).toEqual(['stroke-1', 'stroke-2', 'stroke-3']);

    // 6. Live sync resumes seamlessly after reconnection
    const liveStrokePromise = new Promise<any>((resolve) => {
      clientA.once('stroke:created', (stroke) => resolve(stroke));
    });
    reconnectedB.emit('stroke:created', {
      roomId: 'reconnect-room',
      stroke: { id: 'stroke-4', tool: 'circle', radius: 30 },
    });

    const receivedLive = await liveStrokePromise;
    expect(receivedLive.id).toBe('stroke-4');

    clientA.disconnect();
    reconnectedB.disconnect();
  });
});
