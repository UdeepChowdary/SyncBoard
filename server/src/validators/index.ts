import { z } from 'zod';

export const RoomIdSchema = z.string().min(1).max(100);
export const NicknameSchema = z.string().min(1).max(100);

export const StrokeSchema = z.object({
  id: z.string().min(1).max(100),
  tool: z.enum(['select', 'text', 'pen', 'rect', 'circle', 'arrow', 'image', 'eraser', 'laser', 'hand']),
  color: z.string().min(1).max(50),
  strokeWidth: z.number().min(1).max(500).optional(),
  points: z.array(z.number()).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  radius: z.number().optional(),
  text: z.string().max(5000).optional(),
  image: z.string().optional(), // image contains a data URL or direct link
  fontSize: z.number().min(1).max(500).optional(),
  scaleX: z.number().optional(),
  scaleY: z.number().optional(),
  rotation: z.number().optional(),
  fillColor: z.string().optional(),
});

export const JoinRoomPayloadSchema = z.object({
  roomId: RoomIdSchema,
  nickname: NicknameSchema.optional(),
  passcode: z.string().optional(),
});

export const LockRoomPayloadSchema = z.object({
  roomId: RoomIdSchema,
  passcode: z.string().min(4).max(4),
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
  strokes: z.array(StrokeSchema),
});

export const CursorMovePayloadSchema = z.object({
  roomId: RoomIdSchema,
  x: z.number(),
  y: z.number(),
});

export const LaserUpdatePayloadSchema = z.object({
  roomId: RoomIdSchema,
  points: z.array(z.number()),
});

export const LaserClearPayloadSchema = z.object({
  roomId: RoomIdSchema,
});
