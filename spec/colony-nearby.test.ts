import { expect, it } from 'vitest';
import { bedEdgeDistance, nearbyColonyBed } from '../public/colony-nearby.js';

const left = { id: 'left', x: 10, y: 10 }, right = { id: 'right', x: 14, y: 10 };

it('includes the whole bed and nearby edges, using ground distance at corners', () => {
  expect(bedEdgeDistance(left, { x: 9, y: 9 })).toBe(0);
  expect(nearbyColonyBed([left], { x: 8, y: 10 })).toBe(left);
  expect(nearbyColonyBed([left], { x: 8, y: 8 })).toBeNull();
  expect(nearbyColonyBed([left], { x: 7.9, y: 10 })).toBeNull();
  expect(nearbyColonyBed([left], null)).toBeNull();
});

it('keeps the current bed across a small boundary wobble, then closes farther away', () => {
  expect(nearbyColonyBed([left], { x: 7.8, y: 10 }, left.id)).toBe(left);
  expect(nearbyColonyBed([left], { x: 7.4, y: 10 }, left.id)).toBeNull();
});

it('switches between neighboring beds only when the other is clearly closer', () => {
  expect(nearbyColonyBed([left, right], { x: 12.5, y: 10 }, left.id)).toBe(left);
  expect(nearbyColonyBed([left, right], { x: 12.6, y: 10 }, left.id)).toBe(left);
  expect(nearbyColonyBed([left, right], { x: 12.8, y: 10 }, left.id)).toBe(right);
});

it('ignores dismissed or removed beds without changing the garden', () => {
  const beds = [left, right], before = structuredClone(beds);
  expect(nearbyColonyBed(beds, { x: 10, y: 10 }, left.id, new Set([left.id]))).toBeNull();
  expect(nearbyColonyBed([right], { x: 14, y: 10 }, left.id)).toBe(right);
  expect(beds).toEqual(before);
});
