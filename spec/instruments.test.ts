import { expect, it } from 'vitest';
import { bearingRange, telemetry, graticuleStep, scaleBarTiles, visibleTiles } from '../public/instruments.js';

it('measures compass bearings clockwise from north and ranges in tiles', () => {
  const o = { x: 10, y: 10 };
  expect(bearingRange(o, { x: 10, y: 5 }).bearing).toBeCloseTo(0);
  expect(bearingRange(o, { x: 15, y: 10 }).bearing).toBeCloseTo(90);
  expect(bearingRange(o, { x: 10, y: 15 }).bearing).toBeCloseTo(180);
  expect(bearingRange(o, { x: 5, y: 10 }).bearing).toBeCloseTo(270);
  expect(bearingRange(o, { x: 13, y: 14 }).range).toBeCloseTo(5);
});

it('formats cursor telemetry with units, with or without an origin', () => {
  expect(telemetry({ x: 88.4, y: 60.9 }, null)).toBe('X 088 · Y 060');
  expect(telemetry({ x: 15.5, y: 10.5 }, { x: 10.5, y: 10.5 })).toBe('X 015 · Y 010 · BRG 090° · RNG 5.0 t');
});

it('keeps graticule labels and the scale bar readable at every zoom', () => {
  for (const zoom of [.2, .35, .7, 1, 1.6]) {
    expect(graticuleStep(zoom, 48) * 48 * zoom).toBeGreaterThanOrEqual(70);
    const tiles = scaleBarTiles(zoom, 48);
    expect(tiles * 48 * zoom).toBeLessThanOrEqual(150);
  }
  expect(visibleTiles({ x: 480, y: 480, zoom: 1 }, 960, 480, 48)).toEqual({ left: 0, top: 5, right: 20, bottom: 15 });
});
