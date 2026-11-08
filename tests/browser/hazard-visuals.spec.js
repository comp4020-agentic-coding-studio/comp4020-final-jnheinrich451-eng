import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { isolatedField } from './rover-helper.js';

// Isolated field only. Fire and gas fields keep their gameplay but move: flames sway
// with the shared cosmetic wind, gas spreads from its impact to its bound, fuel pools
// burn on the ground (author, 9 November 2026). Fields from makeField are drawn by the
// shipped drawing functions on an overlay canvas, at fixed server times.
const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-09');

// Draws one scene and reports pixel measures. Fire pixels are orange; gas pixels green.
const scene = (page, options) => page.evaluate(async ({ width, height, reduced, layout, frames }) => {
  const { drawHazards, drawFuelPools } = await import('/hazard-effects.js');
  const { makeField } = await import('/hazards.js');
  const { windAt } = await import('/wind.js');
  const tile = 32, world = { id: 'caldera-01' };
  let canvas = document.getElementById('hazard-scene');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'hazard-scene'; canvas.style.cssText = `position:fixed;inset:0;z-index:9999;width:${width}px;height:${height}px`; document.body.append(canvas); }
  canvas.width = width; canvas.height = height;
  const c = canvas.getContext('2d'), labels = [], fillText = c.fillText.bind(c);
  c.fillText = (text, ...rest) => { labels.push(text); return fillText(text, ...rest); };
  const fire = makeField(1, 'INCENDIARY', layout.fire.x / tile, layout.fire.y / tile, 0);
  const gas = makeField(2, 'GAS', layout.gas.x / tile, layout.gas.y / tile, 0);
  const pools = layout.pools.map((p, i) => ({ id: 100 + i, x: p.x / tile, y: p.y / tile, at: 0, until: 9000, owner: 'robot', heavy: false })); // Held past the frames measured.
  const draw = time => {
    fire.remaining = Math.max(0, fire.duration - time / 1000);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#93a17c'; c.fillRect(0, 0, width, height);
    drawHazards(c, [fire, gas], tile, time, reduced, 1, world);
    drawFuelPools(c, pools, tile, time, reduced, windAt(world, time, reduced));
  };
  const count = (box, test) => {
    const data = c.getImageData(box.x, box.y, box.w, box.h).data; let n = 0;
    for (let i = 0; i < data.length; i += 4) if (test(data[i], data[i + 1], data[i + 2])) n++;
    return n;
  };
  const isFire = (r, g, b) => r > 150 && g > 45 && g < 210 && b < 130 && r > g * 1.15;
  const isGas = (r, g, b) => g - r > 15 && g - b > 45;
  const around = (p, half) => ({ x: Math.max(0, p.x - half), y: Math.max(0, p.y - half), w: half * 2, h: half * 2 });
  const out = {};
  for (const time of frames) {
    draw(time);
    out[time] = {
      fire: count(around(layout.fire, 120), isFire), gas: count(around(layout.gas, 110), isGas),
      // The gas bound: the dashed ring sits at the full radius from the first frame.
      ring: count({ x: layout.gas.x + 2.6 * tile - 3, y: layout.gas.y - 40, w: 6, h: 80 }, (r, g, b) => r > 170 && g > 200 && b > 128),
      pools: count(around(layout.pools[0], 18), isFire),
      fireData: Array.from(c.getImageData(layout.fire.x - 100, layout.fire.y - 100, 200, 200).data.filter((_, i) => i % 16 === 0)),
    };
  }
  out.labels = [...new Set(labels)];
  out.wind = [windAt(world, 0), windAt(world, 0), windAt(world, 90000)].map(w => Math.round(w.angle * 1000));
  return out;
}, options);
const changed = (a, b) => a.reduce((n, v, i) => n + (Math.abs(v - b[i]) > 24 ? 1 : 0), 0) / a.length;

for (const [name, viewport, reduced] of [['desktop', { width: 1920, height: 1080 }, false], ['phone', { width: 390, height: 844 }, false], ['reduced', { width: 1920, height: 1080 }, true]]) test(`fire sways, gas spreads to its bound and fuel pools burn / ${name}`, async ({ browser }) => {
  test.setTimeout(60000);
  const arena = await isolatedField('hazard-visuals');
  const context = await browser.newContext({ viewport });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(arena.base + '/?legacy=1');
    await expect(page.locator('#connection')).toContainText('live');
    await mkdir(evidence, { recursive: true });
    const phone = viewport.width < 600;
    const layout = phone
      ? { fire: { x: 195, y: 190 }, gas: { x: 195, y: 470 }, pools: [{ x: 120, y: 720 }, { x: 195, y: 735 }, { x: 270, y: 720 }] }
      : { fire: { x: 480, y: 480 }, gas: { x: 960, y: 480 }, pools: [{ x: 1340, y: 470 }, { x: 1400, y: 500 }, { x: 1460, y: 465 }] };
    const result = await scene(page, { ...viewport, reduced, layout, frames: [300, 5000, 5400, 3000, 17000] });
    // The gas grows during its first second and a half; its dashed bound is there from the start.
    if (!reduced) expect(result[3000].gas).toBeGreaterThan(result[300].gas * 1.5);
    expect(result[300].ring).toBeGreaterThan(4);
    expect(result[3000].gas).toBeGreaterThan(1000);
    // Fire burns and, outside reduced effects, sways from one moment to the next.
    expect(result[5000].fire).toBeGreaterThan(1000);
    const motion = changed(result[5000].fireData, result[5400].fireData);
    // Sampled pixels changing by more than 24 levels in 0.4 s: still when reduced, moving otherwise.
    if (reduced) expect(motion).toBeLessThan(.005); else expect(motion).toBeGreaterThan(.025);
    expect(result[5000].pools).toBeGreaterThan(40);
    expect(result.labels).toEqual(expect.arrayContaining(['FIRE 13s', 'GAS 6/6', 'FIRE 1s']));
    // An aged field, a second from expiry, still reads as fire but has burned well down.
    expect(result[17000].fire).toBeGreaterThan(100); expect(result[17000].fire).toBeLessThan(result[5000].fire * .7);
    // The wind is the same for every client at a moment, and veers over time.
    expect(result.wind[0]).toBe(result.wind[1]); expect(result.wind[2]).not.toBe(result.wind[0]);
    // The record shows a fire in full flame and live pools, five seconds in.
    await scene(page, { ...viewport, reduced, layout, frames: [5000] });
    await page.locator('#hazard-scene').screenshot({ path: path.join(evidence, `hazard-visuals-${name}.png`) });
    // The spread itself, for the record: the first moments of a gas cloud.
    if (name === 'desktop') {
      await scene(page, { ...viewport, reduced, layout, frames: [17000] });
      await page.screenshot({ path: path.join(evidence, 'hazard-fire-aged.png'), clip: { x: layout.fire.x - 150, y: layout.fire.y - 150, width: 300, height: 320 } });
    }
    if (name === 'desktop') for (const time of [150, 700, 1500]) {
      await scene(page, { ...viewport, reduced, layout, frames: [time] });
      await page.screenshot({ path: path.join(evidence, `hazard-gas-spread-${time}ms.png`), clip: { x: layout.gas.x - 140, y: layout.gas.y - 140, width: 280, height: 300 } });
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); await arena.close(); }
});
