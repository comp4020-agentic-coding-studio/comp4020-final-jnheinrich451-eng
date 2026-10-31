import { expect, it } from 'vitest';
import { AA_TRACE, aaEffectBorn, aaTracerDashes } from '../public/aa-tracer-effects.js';
import { CombatEffects } from '../public/effects.js';

it.each([
  { id: 3, x: 2, y: 7, endX: 19, endY: 7 },
  { id: 4, x: 19, y: 7, endX: 2, endY: 7 },
  { id: 5, x: 2, y: 7, endX: 12, endY: 23 },
  { id: 6, x: 2, y: 7, endX: 2.03, endY: 7.01 },
])('keeps every tracer dash on the clipped shot segment %#', shot => {
  const frozen = Object.freeze({ ...shot, barrel: 1 });
  const dx = shot.endX - shot.x, dy = shot.endY - shot.y, distance = Math.hypot(dx, dy);
  for (let age = 0; age < AA_TRACE.life; age += .005) {
    const dashes = aaTracerDashes(frozen, age);
    expect(dashes.length).toBeLessThanOrEqual(AA_TRACE.maxDashes);
    for (const dash of dashes) {
      expect(Math.hypot(dash.endX - dash.x, dash.endY - dash.y)).toBeLessThanOrEqual(AA_TRACE.length + 1e-9);
      for (const p of [{ x: dash.x, y: dash.y }, { x: dash.endX, y: dash.endY }]) {
        const projection = ((p.x - shot.x) * dx + (p.y - shot.y) * dy) / distance;
        expect(projection).toBeGreaterThanOrEqual(-1e-9);
        expect(projection).toBeLessThanOrEqual(distance + 1e-9);
        expect(Math.abs((p.x - shot.x) * dy - (p.y - shot.y) * dx)).toBeLessThan(1e-8);
      }
    }
  }
  expect(frozen).toEqual({ ...shot, barrel: 1 });
});

it('lights successive samples without allocating a trail proportional to range', () => {
  const shot = { id: 12, barrel: 0, x: 0, y: 0, endX: 1000, endY: 0 };
  const first = aaTracerDashes(shot, 0), later = aaTracerDashes(shot, .04);
  expect(first).toHaveLength(1); expect(later).toHaveLength(3);
  expect(later[0].alpha).toBeLessThan(later[1].alpha);
  expect(later[1].alpha).toBeLessThan(later[2].alpha);
  expect(later.map(d => d.x)).toEqual([...later.map(d => d.x)].sort((a, b) => a - b));
  expect(aaTracerDashes(shot, .04)).toEqual(later);
  expect(aaTracerDashes(shot, AA_TRACE.life)).toEqual([]);
  expect(aaTracerDashes(shot, -1)).toEqual([]);
  expect(aaTracerDashes({ ...shot, endX: NaN }, .02)).toEqual([]);
  expect(aaTracerDashes({ ...shot, endX: 0 }, .02)).toEqual([]);
});

it('preserves alternating fire times within a snapshot and across later snapshots', () => {
  const left = aaEffectBorn(1000, 1200, 9000), right = aaEffectBorn(1125, 1200, 9000);
  expect(right - left).toBe(125);
  expect(aaEffectBorn(1250, 1300, 9100) - right).toBe(125);
  expect(right).toBe(9025);
});

it('reduced motion has one stationary fading sample and tracers cannot kick either barrel', () => {
  const shot = { id: 12, barrel: 0, x: 0, y: 0, endX: 7, endY: 2 };
  const early = aaTracerDashes(shot, 0, true), late = aaTracerDashes(shot, .05, true);
  expect(early).toHaveLength(1); expect(late).toHaveLength(1);
  expect(late[0]).toMatchObject({ x: early[0].x, y: early[0].y, endX: early[0].endX, endY: early[0].endY });
  expect(late[0].alpha).toBeLessThan(early[0].alpha);
  const effects = Object.create(CombatEffects.prototype);
  effects.muzzles = [
    { owner: 'aa', mount: 'aa-35mm', weapon: 'AA35', barrel: 0, born: 0 },
    { owner: 'aa', mount: 'aa-tracer', weapon: 'AA35', barrel: 1, born: 45 },
  ];
  expect(effects.aaRecoil('aa', 55)).toEqual([1.5, 0]);
  effects.muzzles.push({ owner: 'aa', mount: 'aa-35mm', weapon: 'AA35', barrel: 1, born: 125 });
  expect(effects.aaRecoil('aa', 55)).toEqual([1.5, 0]);
  expect(effects.aaRecoil('aa', 125)).toEqual([0, 3]);
});
