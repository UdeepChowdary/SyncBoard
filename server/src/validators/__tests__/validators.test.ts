import { describe, it, expect } from 'vitest';
import {
  StrokeSchema,
  JoinRoomPayloadSchema,
  LockRoomPayloadSchema,
  StrokeCreatedPayloadSchema,
  ShapeUpdatePayloadSchema,
  ShapeDeletePayloadSchema,
  BoardClearPayloadSchema,
  BoardSnapshotPayloadSchema,
  CursorMovePayloadSchema,
  LaserUpdatePayloadSchema,
  SelectionUpdatePayloadSchema
} from '../index';

describe('Validator Schemas', () => {
  describe('StrokeSchema', () => {
    it('validates standard pen stroke', () => {
      const payload = {
        id: 'stroke-1',
        tool: 'pen',
        color: '#ffffff',
        strokeWidth: 3,
        points: [0, 0, 10, 20]
      };
      const result = StrokeSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('validates sticky note stroke correctly (P0 bugfix)', () => {
      const payload = {
        id: 'sticky-1',
        tool: 'sticky',
        color: '#333333',
        fillColor: '#fef08a',
        x: 100,
        y: 100,
        width: 150,
        height: 150,
        text: 'Hello Sticky',
        fontSize: 16
      };
      const result = StrokeSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid tool type', () => {
      const payload = {
        id: 'invalid-1',
        tool: 'invalid_tool',
        color: '#ffffff'
      };
      const result = StrokeSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects infinite or NaN numbers', () => {
      const payload = {
        id: 'bad-num',
        tool: 'rect',
        color: '#ffffff',
        x: Infinity,
        y: 100
      };
      const result = StrokeSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects excessively large points array', () => {
      const points = new Array(15000).fill(1);
      const payload = {
        id: 'huge-points',
        tool: 'pen',
        color: '#ffffff',
        points
      };
      const result = StrokeSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('BoardSnapshotPayloadSchema', () => {
    it('accepts valid snapshot', () => {
      const payload = {
        roomId: 'room-123',
        strokes: [
          { id: 's1', tool: 'sticky', color: '#000', fillColor: '#ffff00', width: 100, height: 100 }
        ]
      };
      const result = BoardSnapshotPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects snapshot exceeding max strokes limit', () => {
      const strokes = new Array(6000).fill({ id: 's', tool: 'pen', color: '#fff' });
      const payload = {
        roomId: 'room-123',
        strokes
      };
      const result = BoardSnapshotPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('SelectionUpdatePayloadSchema', () => {
    it('accepts valid selection update with null or string', () => {
      expect(SelectionUpdatePayloadSchema.safeParse({ roomId: 'r1', shapeId: 's1' }).success).toBe(true);
      expect(SelectionUpdatePayloadSchema.safeParse({ roomId: 'r1', shapeId: null }).success).toBe(true);
    });
  });
});
