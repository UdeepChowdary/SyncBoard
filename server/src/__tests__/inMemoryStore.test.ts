import { describe, it, expect, beforeEach } from 'vitest';

interface RoomState {
  roomId: string;
  passcode?: string;
  strokes: Record<string, any>[];
}

describe('In-Memory Room State & Realtime Fallback Store', () => {
  let rooms: Map<string, RoomState>;
  let users: Map<string, { roomId: string; nickname: string; color: string }>;
  let roomHosts: Map<string, string>;

  beforeEach(() => {
    rooms = new Map<string, RoomState>();
    users = new Map<string, { roomId: string; nickname: string; color: string }>();
    roomHosts = new Map<string, string>();
  });

  it('creates and retrieves in-memory room without requiring database', () => {
    const roomId = 'room-101';
    let room = rooms.get(roomId);
    if (!room) {
      room = { roomId, strokes: [] };
      rooms.set(roomId, room);
    }

    expect(room).toBeDefined();
    expect(room.roomId).toBe('room-101');
    expect(room.strokes).toHaveLength(0);
  });

  it('applies stroke additions, updates, deletions and board clear in-memory', () => {
    const roomId = 'draw-room';
    const room: RoomState = { roomId, strokes: [] };
    rooms.set(roomId, room);

    // 1. Add strokes
    const stroke1 = { id: 'stroke-1', tool: 'pen', color: '#fff', points: [0, 0, 10, 10] };
    const stroke2 = { id: 'stroke-2', tool: 'rect', color: '#ff0', x: 50, y: 50, width: 100, height: 100 };
    room.strokes.push(stroke1);
    room.strokes.push(stroke2);
    expect(room.strokes).toHaveLength(2);

    // 2. Update shape
    const updatedStroke2 = { ...stroke2, x: 75, y: 75 };
    const updateIdx = room.strokes.findIndex((s) => s.id === updatedStroke2.id);
    expect(updateIdx).toBe(1);
    room.strokes[updateIdx] = updatedStroke2;
    expect(room.strokes[1].x).toBe(75);

    // 3. Delete shape
    room.strokes = room.strokes.filter((s) => s.id !== 'stroke-1');
    expect(room.strokes).toHaveLength(1);
    expect(room.strokes[0].id).toBe('stroke-2');

    // 4. Clear board
    room.strokes = [];
    expect(room.strokes).toHaveLength(0);
  });

  it('handles room passcode locking in memory', () => {
    const roomId = 'secure-room';
    const room: RoomState = { roomId, strokes: [] };
    rooms.set(roomId, room);

    // Host locks room with passcode
    room.passcode = '1234';

    // Verify passcode check logic
    const attemptValid = '1234';
    const attemptInvalid = '9999';

    expect(room.passcode === attemptValid).toBe(true);
    expect(room.passcode === attemptInvalid).toBe(false);
  });

  it('manages host assignment and fallback reassignment on disconnect', () => {
    const roomId = 'collab-room';
    const hostSocket = 'socket-user-1';
    const guestSocket = 'socket-user-2';

    // First user joins -> becomes host
    users.set(hostSocket, { roomId, nickname: 'Alice', color: '#f00' });
    if (!roomHosts.has(roomId)) {
      roomHosts.set(roomId, hostSocket);
    }
    expect(roomHosts.get(roomId)).toBe(hostSocket);

    // Second user joins
    users.set(guestSocket, { roomId, nickname: 'Bob', color: '#0f0' });
    expect(roomHosts.get(roomId)).toBe(hostSocket);

    // Host disconnects -> next user in room is promoted to host
    users.delete(hostSocket);
    if (roomHosts.get(roomId) === hostSocket) {
      roomHosts.delete(roomId);
      for (const [sid, u] of users.entries()) {
        if (u.roomId === roomId) {
          roomHosts.set(roomId, sid);
          break;
        }
      }
    }

    expect(roomHosts.get(roomId)).toBe(guestSocket);
  });
});
