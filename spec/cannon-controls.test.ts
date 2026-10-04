import { expect, it } from 'vitest';
import { artilleryAim, artillerySolution, driveCarriage, tickCarriage, railSegment, RAIL } from '../public/rail.js';
import { createCombat } from '../public/combat.js';
import { createWorld } from '../public/world.js';
import { curveEnds } from '../public/track.js';

const gun = () => ({ id: 'g', x: 20, y: 13, shape: 'EW', heading: 1, angle: Math.PI / 2, aim: Math.PI / 2, elevation: 75,
  operator: 'a', lease: 5, inputTime: .35, input: { mode: 'pointer', x: 0, y: 0 }, target: { x: 30.5, y: 13.5 }, reload: 0, brace: 0, move: null as any });
const field = () => ({ ...createWorld(), terrain: Array(48 * 36).fill(2), rails: railSegment(20, 13, 'EW'), artillery: [] as any[] });

it('solves the upper arc, clamps range, and converges at physical traverse/elevation rates', () => {
  const g = gun(), target = { x: 20.5, y: 33.5 }; g.target = target;
  const desired = artilleryAim(g, target); expect(desired.elevation).toBeGreaterThan(45);
  const before = g.angle; tickCarriage(g, .1); expect(g.angle - before).toBeCloseTo(RAIL.turnSpeed * .1);
  expect(Math.abs(g.elevation - 75)).toBeLessThanOrEqual(.800001);
  for (let i = 0; i < 60; i++) { g.inputTime = .35; g.lease = 5; tickCarriage(g, .1); }
  const impact = artillerySolution(g); expect(impact.x).toBeCloseTo(target.x); expect(impact.y).toBeCloseTo(target.y);
  expect(artilleryAim(g, { x: 200, y: 13.5 })).toMatchObject({ elevation: 45, inRange: false });
  expect(artilleryAim(g, { x: 20.5, y: 13.5 }).elevation).toBeCloseTo(87);
});

it('stale pointer input stops aiming and early fire keeps the current physical landing point', () => {
  const g = gun(), w = field(), combat = createCombat(w); g.target = { x: 20.5, y: 30.5 };
  tickCarriage(g, .35); const angle = g.angle, elevation = g.elevation;
  tickCarriage(g, .5); expect(g.angle).toBe(angle); expect(g.elevation).toBe(elevation);
  const solution = artillerySolution(g);
  expect(combat.lob({ id: g.id, x: g.x + .5, y: g.y + .5 }, solution.x, solution.y, solution)).toBeNull();
  g.target = { x: 40, y: 25 }; g.inputTime = .35; tickCarriage(g, .1);
  expect(combat.snapshot().salvos[0].targetX).toBe(solution.x); expect(combat.snapshot().salvos[0].targetY).toBe(solution.y);
  expect(Math.hypot(solution.x - 20.5, solution.y - 30.5)).toBeGreaterThan(5);
});

it('ignores perpendicular keys, respects track ends and keeps an in-progress step indivisible', () => {
  const g = gun(), w = field(); w.artillery.push(g);
  expect(driveCarriage(g, 0, -1, w, [], [])).toBeNull(); expect(g.move).toBeNull();
  expect(driveCarriage(g, 1, 0, w, [], [])).toBeNull(); expect(g.x).toBe(21);
  expect(driveCarriage(g, -1, 0, w, [], [])).toBeNull(); expect(g.x).toBe(21);
  tickCarriage(g, 1.2); expect(g.move).toBeNull();
  expect(driveCarriage(g, 1, 0, w, [], [])).toContain('three');
  expect(driveCarriage(g, -1, 0, w, [], [])).toBeNull(); expect(g.x).toBe(20);
});

it.each(['NE', 'SE', 'SW', 'NW'])('world-direction driving enters and reverses a %s curve', shape => {
  const w = field(), curve = { x: 12, y: 12, shape }, [a, b] = curveEnds(curve);
  w.rails = [...railSegment(a.x, a.y, a.shape), ...railSegment(b.x, b.y, b.shape), curve];
  const g = { ...gun(), x: a.x, y: a.y, shape: a.shape, heading: a.dx || a.dy }; w.artillery.push(g);
  expect(driveCarriage(g, a.dx, a.dy, w, [], [])).toBeNull(); expect(g.move.curve.shape).toBe(shape);
  tickCarriage(g, g.move.duration); expect([g.x, g.y, g.shape]).toEqual([b.x, b.y, b.shape]);
  expect(driveCarriage(g, -b.dx, -b.dy, w, [], [])).toBeNull(); tickCarriage(g, g.move.duration);
  expect([g.x, g.y]).toEqual([a.x, a.y]);
});
