import { expect, it } from 'vitest';
import { COLONY_WORMHOLE, colonyWormholeGeometry, colonyWormholeState, paintColonyWormhole } from '../public/colony-system.js';

function recorder() {
  const draws: unknown[][] = [], fills: number[][] = [], strokes: string[] = [];
  const ctx = { strokeStyle: '', save() {}, restore() {}, translate() {}, beginPath() {}, arc() {}, ellipse() {}, rotate() {}, clip() {}, fill() {},
    stroke() { strokes.push(this.strokeStyle); }, fillRect(...args: number[]) { fills.push(args); }, drawImage(...args: unknown[]) { draws.push(args); },
    createRadialGradient() { return { addColorStop() {} }; },
    getImageData() { throw new Error('No per-frame pixel reads'); }, clearRect() { throw new Error('Keep the live star background'); } };
  return { ctx, draws, fills, strokes };
}
const outgoing = { width: 1100, height: 688, scene: 'combat' }, incoming = { width: 1100, height: 688, scene: 'colonization' };

it('closes the iris, holds a small convergence point, then opens within a bounded duration', () => {
  const { collapse, converge, expand, total } = COLONY_WORMHOLE;
  expect(collapse + converge + expand).toBe(total);
  expect(colonyWormholeState(0)).toMatchObject({ phase: 'collapse', aperture: 1, lens: 0, done: false });
  const closed = colonyWormholeState(collapse), before = colonyWormholeState(collapse - .01);
  expect(closed).toMatchObject({ phase: 'converge', aperture: 0, lens: 1, done: false });
  expect(before.aperture).toBeCloseTo(closed.aperture, 6);
  expect(colonyWormholeState(collapse + converge / 2)).toMatchObject({ phase: 'converge', aperture: 0 });
  expect(colonyWormholeState(collapse + converge)).toMatchObject({ phase: 'expand', aperture: 0, lens: 1 });
  expect(colonyWormholeState(total)).toMatchObject({ phase: 'expand', aperture: 1, lens: 0, done: true });
  for (let age = 0; age < total; age += 17) {
    const state = colonyWormholeState(age);
    expect(state.aperture).toBeGreaterThanOrEqual(0); expect(state.aperture).toBeLessThanOrEqual(1);
    expect(state.lens).toBeGreaterThanOrEqual(0); expect(state.lens).toBeLessThanOrEqual(1);
  }
});

it('keeps celestial images at the original screen scale while the circular iris sweeps them', () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) for (const age of [0, 200, 500, 800, 1100, 1400, 1750]) {
    const { ctx, draws } = recorder(), state = colonyWormholeState(age);
    paintColonyWormhole(ctx, outgoing, incoming, state, width, height, { focus: { x: width * .4, y: height * .48, radius: 330 } });
    expect(draws[0]).toEqual([state.phase === 'collapse' ? outgoing : incoming, 0, 0, width, height]);
  }
});

it('uses the real planet centre, covers every viewport corner initially and converges without a thumbnail', () => {
  const width = 1440, height = 900, options = { focus: { x: 410, y: 460, radius: 330 }, incomingFocus: { x: 720, y: 430, radius: 540 } };
  const start = colonyWormholeGeometry(colonyWormholeState(0), width, height, options);
  expect(start).toMatchObject({ x: 410, y: 460 });
  for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) expect(start.radius).toBeGreaterThan(Math.hypot(x - start.x, y - start.y));
  const state = colonyWormholeState(COLONY_WORMHOLE.collapse + COLONY_WORMHOLE.converge / 2);
  const point = colonyWormholeGeometry(state, width, height, options);
  expect(point.radius).toBe(3.5); expect(point.x).toBeCloseTo(565); expect(point.y).toBeCloseTo(445);
  const { ctx, draws, fills } = recorder();
  paintColonyWormhole(ctx, outgoing, incoming, state, width, height, options);
  expect(draws).toHaveLength(0);
  expect(fills).toHaveLength(1); expect(fills[0][2]).toBeLessThanOrEqual(74); expect(fills[0][3]).toBeLessThanOrEqual(74);
});

it('preserves the star background and bounds slit-scan work to sixteen tiny cached image crops', () => {
  for (const age of [250, 450, 650, 1150, 1400, 1600]) {
    const { ctx, draws, fills } = recorder();
    paintColonyWormhole(ctx, outgoing, incoming, colonyWormholeState(age), 1440, 900);
    expect(draws.length).toBeLessThanOrEqual(17);
    for (const sample of draws.slice(1)) {
      const [source, sx, sy, sw, sh, , , dw, dh] = sample as [typeof outgoing, number, number, number, number, number, number, number, number];
      expect(sx).toBeGreaterThanOrEqual(0); expect(sy).toBeGreaterThanOrEqual(0);
      expect(sx + sw).toBeLessThanOrEqual(source.width); expect(sy + sh).toBeLessThanOrEqual(source.height);
      expect(sw * sh).toBeLessThan(60); expect(dw).toBeGreaterThan(dh * 5);
    }
    // Only a tiny transparent convergence glow may use a filled rectangle.
    for (const [, , w, h] of fills) { expect(w).toBeLessThanOrEqual(74); expect(h).toBeLessThanOrEqual(74); }
  }
});

it('uses gold entering the civilian system and blue returning to combat without changing the path', () => {
  const state = colonyWormholeState(600), gold = recorder(), blue = recorder();
  paintColonyWormhole(gold.ctx, outgoing, incoming, state, 1440, 900, { direction: 'gold' });
  paintColonyWormhole(blue.ctx, outgoing, incoming, state, 1440, 900, { direction: 'blue' });
  expect(gold.strokes).toContain('#ffe1a0'); expect(blue.strokes).toContain('#9bdfff');
  expect(gold.draws).toEqual(blue.draws);
  const done = recorder(); paintColonyWormhole(done.ctx, outgoing, incoming, colonyWormholeState(COLONY_WORMHOLE.total), 390, 844);
  expect(done.draws).toHaveLength(0); expect(done.fills).toHaveLength(0);
});
