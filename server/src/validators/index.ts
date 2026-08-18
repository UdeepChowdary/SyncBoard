import { z } from 'zod';

export const RoomIdSchema = z.string().min(1).max(100);
export const NicknameSchema = z.string().min(1).max(100);

export const StrokeSchema = z.object({
  id: z.string().min(1).max(100),
  tool: z.enum(['select', 'text', 'pen', 'rect', 'circle', 'arrow', 'sticky', 'image', 'eraser', 'laser', 'hand']),
  color: z.string().min(1).max(50),
  strokeWidth: z.number().finite().min(1).max(500).optional(),
  points: z.array(z.number().finite()).max(10000).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().optional(),
  height: z.number().finite().optional(),
  radius: z.number().finite().optional(),
  text: z.string().max(5000).optional(),
  image: z.string().max(2000000).optional(), // image contains a data URL or direct link
  fontSize: z.number().finite().min(1).max(500).optional(),
  scaleX: z.number().finite().optional(),
  scaleY: z.number().finite().optional(),
  rotation: z.number().finite().optional(),
  fillColor: z.string().max(50).optional(),
});

export const JoinRoomPayloadSchema = z.object({
  roomId: RoomIdSchema,
  nickname: NicknameSchema.optional(),
  passcode: z.string().max(50).optional(),
});

export const LockRoomPayloadSchema = z.object({
  roomId: RoomIdSchema,
  passcode: z.string().min(4).max(20),
});

export const StrokeCreatedPayloadSchema = z.object({
  roomId: RoomIdSchema,
  stroke: StrokeSchema,
});

export const ShapeUpdatePayloadSchema = z.object({
  roomId: RoomIdSchema,
  shape: StrokeSchema,
});

export const ShapeDeletePayloadSchema = z.object({
  roomId: RoomIdSchema,
  shapeId: z.string().min(1).max(100),
});

export const BoardClearPayloadSchema = z.object({
  roomId: RoomIdSchema,
});

export const BoardSnapshotPayloadSchema = z.object({
  roomId: RoomIdSchema,
  strokes: z.array(StrokeSchema).max(5000),
});

export const CursorMovePayloadSchema = z.object({
  roomId: RoomIdSchema,
  x: z.number().finite(),
  y: z.number().finite(),
});

export const LaserUpdatePayloadSchema = z.object({
  roomId: RoomIdSchema,
  points: z.array(z.number().finite()).max(2000),
});

export const LaserClearPayloadSchema = z.object({
  roomId: RoomIdSchema,
});

export const SelectionUpdatePayloadSchema = z.object({
  roomId: RoomIdSchema,
  shapeId: z.string().max(100).nullable().optional(),
});
