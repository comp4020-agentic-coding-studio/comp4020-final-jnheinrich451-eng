import { expect, it } from 'vitest';
import { COLONY_WORMHOLE } from '../public/colony-system.js';
import {
  THROAT_COLORS, WORMHOLE_LENS, coverAt, createRearStars, dopplerFactor, lensImages, lensLayer, lensSource,
  paintLensStars, paintThroatLight, skyCover, throatImage, throatSource, wormholeLensState,
} from '../public/wormhole-lens.js';

const { collapse, converge, total } = COLONY_WORMHOLE;

it('starts and ends as the ordinary view: no lens, no throat, no aberration', () => {
  expect(wormholeLensState(0, 540)).toMatchObject({ phase: 'collapse', k: 1, einstein: 0, throat: 0 });
  const end = wormholeLensState(total, 540);
  expect(end).toMatchObject({ phase: 'expand', k: 1, done: true });
  expect(end.throat).toBe(Infinity);
});

it('forms the lens first, then draws the sky in, without a jump at any phase boundary', () => {
  const P = 540, early = wormholeLensState(collapse * .3, P);
  expect(early.k).toBe(1); expect(early.einstein).toBeGreaterThan(0);
  for (const at of [collapse, collapse + converge]) {
    const before = wormholeLensState(at - .01, P), after = wormholeLensState(at, P);
    for (const key of ['k', 'einstein', 'throat'] as const) expect(after[key]).toBeCloseTo(before[key], 2);
  }
  expect(wormholeLensState(collapse + converge / 2, P).k).toBe(WORMHOLE_LENS.speed);
  let throat = 0;
  for (let age = 0; age < total; age += 10) {
    const state = wormholeLensState(age, P);
    expect(state.k).toBeGreaterThanOrEqual(WORMHOLE_LENS.speed); expect(state.k).toBeLessThanOrEqual(1);
    expect(state.throat).toBeGreaterThanOrEqual(throat - 1e-9); throat = state.throat;
  }
  // The planet is swallowed: its whole lensed image lies inside the throat.
  const swallowed = wormholeLensState(collapse + converge, P);
  expect(lensImages(P, swallowed.einstein)[0]).toBeLessThan(swallowed.throat);
});

it('places images where the point-lens equation puts them', () => {
  const einstein = 120;
  for (const beta of [0, 10, 120, 500]) {
    const [primary, secondary] = lensImages(beta, einstein);
    expect(primary).toBeGreaterThanOrEqual(einstein); expect(secondary).toBeLessThanOrEqual(0);
    expect(lensSource(primary, einstein)).toBeCloseTo(beta, 6);
    expect(lensSource(secondary, einstein)).toBeCloseTo(beta, 6);
  }
  // A source directly behind the lens becomes the Einstein ring.
  expect(lensImages(0, einstein)).toEqual([einstein, -einstein]);
});

it('fits the whole destination sky inside the throat and relaxes to identity', () => {
  for (const rho of [1, 50, 400, 1e4, 1e6]) {
    const theta = throatImage(rho, 200);
    expect(theta).toBeLessThan(200); expect(throatSource(theta, 200)).toBeCloseTo(rho, rho > 1e3 ? -2 : 6);
    expect(throatImage(rho, Infinity)).toBe(rho);
  }
  expect(throatSource(250, 200)).toBe(Infinity);
});

it('uses the relativistic Doppler factor: 1 at rest, 1/k ahead, redshifted far off-axis', () => {
  expect(dopplerFactor(1, 300, 700)).toBe(1);
  expect(dopplerFactor(.06, 0, 700)).toBeCloseTo(1 / .06, 6);
  expect(dopplerFactor(.06, 4000, 700)).toBeLessThan(1);
});

it('covers every screen pixel uncompressed and hides the layer edge when compressed', () => {
  for (const [width, height, focus] of [[1600, 1000, { x: 800, y: 480 }], [390, 844, { x: 195, y: 338 }]] as const) {
    const layer = lensLayer(width, height, width * 1.25, height * 1.25);
    expect(Number.isInteger(layer.marginX) && Number.isInteger(layer.marginY)).toBe(true);
    const rest = skyCover(1, focus, layer);
    for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height], [focus.x, focus.y]]) expect(coverAt(x, y, focus, rest, layer)).toBe(1);
    const fast = skyCover(WORMHOLE_LENS.speed, focus, layer);
    for (const [x, y] of [[layer.x, focus.y], [layer.x + layer.width, focus.y], [focus.x, layer.y], [focus.x, layer.y + layer.height]]) expect(coverAt(x, y, focus, fast, layer)).toBeLessThan(.02);
  }
  const capped = lensLayer(1920, 1200, 1920, 1200, 2048);
  expect(capped.backingWidth).toBeLessThanOrEqual(2048); expect(capped.backingHeight).toBeLessThanOrEqual(2048);
});

it('continues the forward star disc with a deterministic, sphere-uniform rear sky', () => {
  const rear = createRearStars(1150), again = createRearStars(1150), edge = WORMHOLE_LENS.field / (2 * WORMHOLE_LENS.focal);
  expect(rear).toEqual(again);
  expect(rear.length).toBeGreaterThan(1500); expect(rear.length).toBeLessThan(3000);
  for (const star of rear) expect(star.tan).toBeGreaterThanOrEqual(edge - 1e-9);
});

function recorder() {
  const fills: number[][] = [], strokes: string[] = [];
  const ctx = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, globalCompositeOperation: 'source-over',
    save() {}, restore() {}, beginPath() {}, arc() {}, stroke() { strokes.push(this.strokeStyle); },
    fillRect(...args: number[]) { fills.push(args); }, createRadialGradient() { return { addColorStop() {} }; },
    getImageData() { throw new Error('No per-frame pixel reads'); } };
  return { ctx, fills, strokes };
}

it('maps only the stars the painted layers lack, and none at rest', () => {
  const width = 1600, height = 1000, focus = { x: 800, y: 480, radius: 600 }, layer = lensLayer(width, height);
  const sky = { count: 3, x: new Float32Array([800, 300, 4000]), y: new Float32Array([200, 900, 480]), alpha: new Float32Array([.8, .8, .8]), size: new Float32Array([1, 1, 1]), bright: new Uint8Array(3) };
  const view = (k: number) => ({ centre: focus, focal: 720, width, height, layer,
    origin: { focus, cover: skyCover(k, focus, layer), dim: 'a', bright: 'b' }, destination: { focus, cover: skyCover(k, focus, layer), dim: 'c', bright: 'd' } });
  const rest = recorder();
  paintLensStars(rest.ctx, sky, wormholeLensState(0, 600), view(1));
  expect(rest.fills).toHaveLength(0);
  // At the throat the off-screen star is aberrated onto the screen.
  const fast = recorder(), state = wormholeLensState(collapse + converge / 2, 600);
  paintLensStars(fast.ctx, sky, state, view(state.k));
  expect(fast.fills.length).toBeGreaterThan(0);
  for (const [x, y, w, h] of fast.fills) { expect(x).toBeGreaterThan(-3); expect(y).toBeGreaterThan(-3); expect(w).toBeLessThan(3); expect(h).toBeLessThan(3); }
});

it('lights the photon ring gold entering the colony and blue returning, on the same path', () => {
  const state = wormholeLensState(collapse + converge / 2, 540), gold = recorder(), blue = recorder();
  paintThroatLight(gold.ctx, state, { x: 700, y: 450 }, THROAT_COLORS.gold, 900);
  paintThroatLight(blue.ctx, state, { x: 700, y: 450 }, THROAT_COLORS.blue, 900);
  expect(gold.strokes).toContain(THROAT_COLORS.gold.bright); expect(blue.strokes).toContain(THROAT_COLORS.blue.bright);
  expect(gold.fills).toEqual(blue.fills);
  const done = recorder(); paintThroatLight(done.ctx, wormholeLensState(total, 540), { x: 700, y: 450 }, THROAT_COLORS.gold, 900);
  expect(done.strokes).toHaveLength(0); expect(done.fills).toHaveLength(0);
});
