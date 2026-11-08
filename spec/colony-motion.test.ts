import { expect, it } from 'vitest';
import { COLONY, colonyCanStand } from '../public/colonization.js';
import { advanceColonyPlayers, receiveColonyPlayers } from '../public/colony-motion.js';

const field = () => ({ world: { width: 64, height: 64, terrain: Array(64 * 64).fill(2) }, hub: { x: 50, y: 50 } });
const worker = (x: number, y = 10) => ({ id: 'gardener', name: 'Gardener', x, y, angle: Math.PI / 2 });
const presentation = () => new Map<string, any>();

it('moves continuously between sparse authoritative packets without changing their positions', () => {
  const rendered = presentation(), state = field(), steps: number[] = [];
  receiveColonyPlayers(rendered, [worker(10)], 0);
  let previous = 10;
  for (let frame = 1; frame <= 180; frame++) {
    const now = frame * 1000 / 60;
    if (frame % 15 === 0) receiveColonyPlayers(rendered, [worker(10 + COLONY.robotSpeed * now / 1000)], now);
    advanceColonyPlayers(rendered, state, now, 1 / 60);
    const current = rendered.get('gardener');
    if (frame > 60) steps.push(current.x - previous);
    expect(current.targetX).toBeCloseTo(10 + COLONY.robotSpeed * Math.floor(frame / 15) / 4);
    previous = current.x;
  }
  expect(Math.min(...steps)).toBeGreaterThan(COLONY.robotSpeed / 60 * .9);
  expect(Math.max(...steps)).toBeLessThan(COLONY.robotSpeed / 60 * 1.1);
  expect(rendered.get('gardener').walkAmount).toBeGreaterThan(.9);
});

it('limits prediction at a shoreline instead of drawing the worker through water', () => {
  const rendered = presentation(), state = field();
  for (let y = 0; y < 64; y++) for (let x = 7; x < 64; x++) state.world.terrain[y * 64 + x] = 0;
  receiveColonyPlayers(rendered, [worker(6)], 0);
  receiveColonyPlayers(rendered, [worker(6.5)], 250);
  for (let frame = 1; frame <= 90; frame++) {
    advanceColonyPlayers(rendered, state, 250 + frame * 1000 / 60, 1 / 60);
    const pose = rendered.get('gardener');
    expect(colonyCanStand(state, pose.x, pose.y)).toBe(true);
    expect(pose.x).toBeLessThan(7 - COLONY.robotRadius);
  }
});

it('bounds stale movement and lets the feet settle when no fresh packets arrive', () => {
  const rendered = presentation(), state = field();
  receiveColonyPlayers(rendered, [worker(10)], 0);
  receiveColonyPlayers(rendered, [worker(10.5)], 250);
  for (let frame = 1; frame <= 180; frame++) advanceColonyPlayers(rendered, state, 250 + frame * 1000 / 60, 1 / 60);
  const stopped = rendered.get('gardener');
  expect(stopped.x).toBeCloseTo(11);
  expect(stopped.walkAmount).toBe(0);
  const phase = stopped.walkPhase;
  advanceColonyPlayers(rendered, state, 5000, 1 / 60);
  expect(stopped.walkPhase).toBeCloseTo(phase);
});

it('reconciles to the server when paused and never extrapolates a negative snapshot age', () => {
  const rendered = presentation(), state = field();
  receiveColonyPlayers(rendered, [worker(10)], 0);
  receiveColonyPlayers(rendered, [worker(10.5)], 250);
  advanceColonyPlayers(rendered, state, 240, 1 / 60);
  expect(rendered.get('gardener').x).toBeGreaterThan(10);
  expect(rendered.get('gardener').x).toBeLessThan(10.5);
  for (let frame = 1; frame <= 120; frame++) advanceColonyPlayers(rendered, state, 250 + frame * 1000 / 60, 1 / 60, false);
  expect(rendered.get('gardener').x).toBeCloseTo(10.5);
  expect(rendered.get('gardener').walkAmount).toBe(0);
});

it('resets teleports and runtime changes, removes departed workers and caps noisy velocities', () => {
  const rendered = presentation();
  receiveColonyPlayers(rendered, [worker(10)], 0);
  receiveColonyPlayers(rendered, [worker(11)], 50);
  expect(rendered.get('gardener').vx).toBeCloseTo(COLONY.robotSpeed);
  receiveColonyPlayers(rendered, [worker(30)], 300);
  expect(rendered.get('gardener')).toMatchObject({ x: 30, vx: 0, walkAmount: 0 });
  receiveColonyPlayers(rendered, [worker(31)], 600, true);
  expect(rendered.get('gardener')).toMatchObject({ x: 31, targetX: 31, vx: 0, walkPhase: 0 });
  receiveColonyPlayers(rendered, [], 900);
  expect(rendered.size).toBe(0);
});

it('carries a worker activity into the rendered player when it sits or fishes without moving far', () => {
  const rendered = new Map();
  receiveColonyPlayers(rendered, [{ id: 'w', name: 'Wren', x: 36.5, y: 31.5, angle: 0, activity: null }], 0);
  receiveColonyPlayers(rendered, [{ id: 'w', name: 'Wren', x: 38, y: 31.5, angle: Math.PI, activity: { kind: 'sit', itemId: 'f-bench', since: 3 } }], 250);
  expect(rendered.get('w').activity).toEqual({ kind: 'sit', itemId: 'f-bench', since: 3 });
  receiveColonyPlayers(rendered, [{ id: 'w', name: 'Wren', x: 36.5, y: 31.5, angle: 0 }], 500);
  expect(rendered.get('w').activity).toBeNull();
});
