import { describe, it, expect } from 'vitest';

describe('Server Authorization Rules', () => {
  const users = new Map<string, { roomId: string; nickname: string; color: string }>();
  const roomHosts = new Map<string, string>();

  const isRoomHost = (socketId: string, roomId: string): boolean => {
    return roomHosts.get(roomId) === socketId;
  };

  const isRoomMember = (socketId: string, roomId: string): boolean => {
    const user = users.get(socketId);
    return !!user && user.roomId === roomId;
  };

  it('correctly identifies room host vs guest', () => {
    roomHosts.set('room-1', 'host-socket-1');
    users.set('host-socket-1', { roomId: 'room-1', nickname: 'Alice', color: '#ff0000' });
    users.set('guest-socket-2', { roomId: 'room-1', nickname: 'Bob', color: '#00ff00' });
    users.set('other-socket-3', { roomId: 'room-2', nickname: 'Charlie', color: '#0000ff' });

    expect(isRoomHost('host-socket-1', 'room-1')).toBe(true);
    expect(isRoomHost('guest-socket-2', 'room-1')).toBe(false);
    expect(isRoomMember('guest-socket-2', 'room-1')).toBe(true);
    expect(isRoomMember('other-socket-3', 'room-1')).toBe(false);
    expect(isRoomHost('host-socket-1', 'room-2')).toBe(false);
  });
});
