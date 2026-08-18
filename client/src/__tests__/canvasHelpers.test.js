import { describe, it, expect } from 'vitest';

function calculatePointsBoundingBox(points) {
  if (!points || points.length < 2) return null;
  let minX = points[0], maxX = points[0];
  let minY = points[1], maxY = points[1];
  for (let idx = 0; idx < points.length; idx += 2) {
    const px = points[idx];
    const py = points[idx + 1];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  return {
    bx: minX,
    by: minY,
    bw: maxX - minX,
    bh: maxY - minY,
  };
}

describe('Canvas Helpers', () => {
  it('calculates bounding box for point sequences correctly without stack overflow', () => {
    const points = [10, 20, 100, 200, 5, 50, 80, 10];
    const bbox = calculatePointsBoundingBox(points);
    expect(bbox).toEqual({
      bx: 5,
      by: 10,
      bw: 95,
      bh: 190
    });
  });

  it('handles large point arrays efficiently', () => {
    const largePoints = [];
    for (let i = 0; i < 20000; i++) {
      largePoints.push(i, i * 2);
    }
    const bbox = calculatePointsBoundingBox(largePoints);
    expect(bbox.bw).toBe(19999);
    expect(bbox.bh).toBe(39998);
  });
});
