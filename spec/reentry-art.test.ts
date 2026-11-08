import { beforeEach, expect, it } from 'vitest';
import {
  REENTRY, altitude, capsuleDescent, descentPose, drawDescentHead, drawReentrySmoke, entryOffset, noteDescent, orbitTrack,
  reentryFrame, reentryTrack, reentryTrailCount,
} from '../public/reentry-art.js';

const world = { id: 'reentry-test-world' };
function recorder() {
  const calls = { fill: 0, stroke: 0, fillRect: 0, gradients: 0 };
  const gradient = () => { calls.gradients++; return { addColorStop() {} }; };
  const ctx = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', globalCompositeOperation: 'source-over',
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
    fill() { calls.fill++; }, stroke() { calls.stroke++; }, fillRect() { calls.fillRect++; },
    createLinearGradient: gradient, createRadialGradient: gradient,
    getImageData() { throw new Error('No per-frame pixel reads'); } };
  return { ctx, calls };
}
beforeEach(() => reentryFrame({ id: 'reset-' + Math.random() }, 0, false));

it('lands every descent exactly on its ground point at its saved impact', () => {
  reentryFrame(world, 1000, false);
  for (const curve of ['pod', 'shell']) {
    const offset = entryOffset(10), landed = descentPose(curve, 1, offset);
    expect(landed.a).toBe(0); expect(Math.hypot(landed.x, landed.y)).toBe(0);
    expect(descentPose(curve, 0, offset)).toMatchObject({ a: 1, x: offset.x, y: offset.y });
  }
  // Capsules brake to a soft contact; shells keep their speed to the ground.
  const speed = (curve: string, s: number) => (altitude(curve, s - .01) - altitude(curve, s)) / .01;
  expect(speed('pod', .995)).toBeLessThan(.15); expect(speed('pod', .05)).toBeGreaterThan(1.3);
  expect(speed('shell', .995)).toBeCloseTo(1, 6);
});

it('brings every arrival on one planet down the same orbital track, from above', () => {
  const track = orbitTrack(world), again = orbitTrack({ id: world.id });
  expect(track).toEqual(again); expect(Math.hypot(track.x, track.y)).toBeCloseTo(1, 9);
  expect(Math.abs(track.x)).toBeGreaterThan(Math.cos(.7) - 1e-9);
  reentryFrame(world, 0, false);
  expect(reentryTrack()).toEqual(track);
  for (const height of [8, 10, 24, 34]) expect(entryOffset(height).y).toBeLessThan(0);
  const other = orbitTrack({ id: 'another-campaign' });
  expect(other.x !== track.x || other.y !== track.y).toBe(true);
});

it('glows while hot: capsule plasma dies as it brakes, shells stay hot, retro burns only at the end', () => {
  const offset = entryOffset(10);
  expect(descentPose('pod', 0, offset).heat).toBe(1); expect(descentPose('pod', .62, offset).heat).toBe(0);
  expect(descentPose('shell', .9, offset).heat).toBeGreaterThan(descentPose('shell', .1, offset).heat);
  for (const s of [0, .5, .79]) expect(descentPose('pod', s, offset).burn).toBe(0);
  expect(descentPose('pod', .9, offset).burn).toBe(1); expect(descentPose('pod', 1, offset).burn).toBe(0);
  for (const s of [0, .5, .9]) expect(descentPose('shell', s, offset).burn).toBe(0);
});

it('remembers one trail per descent, replaces a new descent, and lets smoke linger then go', () => {
  reentryFrame(world, 10000, false);
  const spec = { x: 20, y: 14, offset: entryOffset(10), curve: 'pod', duration: 1.35, size: 1 };
  noteDescent('core:a', { ...spec, elapsed: .5 });
  reentryFrame(world, 10100, false); noteDescent('core:a', { ...spec, elapsed: .6 });
  expect(reentryTrailCount()).toBe(1);
  // The trail outlives the 1.35 s descent by its full linger, then is dropped.
  reentryFrame(world, 9500 + 1350 + REENTRY.linger - 100, false); expect(reentryTrailCount()).toBe(1);
  reentryFrame(world, 9500 + 1350 + REENTRY.linger + 100, false); expect(reentryTrailCount()).toBe(0);
  for (let i = 0; i < REENTRY.maxTrails + 10; i++) noteDescent('shell:' + i, { ...spec, curve: 'shell', elapsed: 0, duration: 2 });
  expect(reentryTrailCount()).toBe(REENTRY.maxTrails);
});

it('draws bounded smoke without pixel reads, culls off-screen trails, and nothing with reduced effects', () => {
  reentryFrame(world, 20000, false);
  for (let i = 0; i < 12; i++) noteDescent('barrage:' + i, { x: 20 + i, y: 14, offset: entryOffset(24), curve: 'shell', elapsed: 0, duration: 1.8, size: .8 });
  noteDescent('cut', { type: 'cut', x: 10, y: 10, to: { x: 40, y: 10 }, elapsed: 0, duration: 18, preroll: 0 });
  reentryFrame(world, 26000, false);
  const shown = recorder();
  drawReentrySmoke(shown.ctx, 48);
  expect(shown.calls.fill).toBeLessThanOrEqual(12 * 2 + 48); expect(shown.calls.fill).toBeGreaterThan(12);
  const away = recorder();
  drawReentrySmoke(away.ctx, 48, { x0: 1e5, y0: 1e5, x1: 1e5 + 1920, y1: 1e5 + 1080 });
  expect(away.calls.fill).toBeLessThanOrEqual(48);
  reentryFrame(world, 26000, true);
  const reduced = recorder(); drawReentrySmoke(reduced.ctx, 48);
  drawDescentHead(reduced.ctx, descentPose('shell', .5, entryOffset(24)), 48, 1);
  expect(reduced.calls).toEqual({ fill: 0, stroke: 0, fillRect: 0, gradients: 0 });
  noteDescent('ignored', { x: 1, y: 1, offset: entryOffset(10), curve: 'pod', elapsed: 0, duration: 1 });
  expect(reentryTrailCount()).toBe(13);
});

it('wraps a capsule in plasma sized to its drawn body and returns the pose it is drawn at', () => {
  reentryFrame(world, 30000, false);
  const small = recorder(), large = recorder();
  const pose = capsuleDescent(small.ctx, 48, { id: 'robot', x: 5, y: 5, s: .2, duration: 1.44, height: 8, body: .35, grow: .6 }, false);
  expect(pose).toMatchObject(descentPose('pod', .2, entryOffset(8)));
  capsuleDescent(large.ctx, 48, { id: 'core', x: 9, y: 9, s: .2, duration: 1.35, height: 10, body: 1.5, grow: 1.1 }, false);
  expect(small.calls.gradients).toBeGreaterThan(0); expect(large.calls.gradients).toBe(small.calls.gradients);
  const reduced = recorder();
  expect(capsuleDescent(reduced.ctx, 48, { id: 'quiet', x: 1, y: 1, s: .2, duration: 1, height: 10, body: 1 }, true)).toMatchObject({ s: .2 });
  expect(reduced.calls.gradients).toBe(0);
});
