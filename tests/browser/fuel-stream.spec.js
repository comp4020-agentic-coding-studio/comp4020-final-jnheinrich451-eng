import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { isolatedField, landCore } from './rover-helper.js';

// Isolated field only. The robot's fuel jet is burning liquid, slim at the nozzle and
// thick at the tail, reaching 7.5 tiles; a swinging nozzle bends it like a hose because
// each packet keeps the line it was fired on (author, 9 November 2026).
const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-09');

// Share of fire-coloured pixels in a box on the world canvas, in CSS pixels.
// Bands, not points: after C the robot sits within about a tile of the centre.
const fireAt = (page, x, y, half = 14, tall = 120) => page.evaluate(({ x, y, half, tall }) => {
  const canvas = document.getElementById('world-canvas'), scale = canvas.width / canvas.getBoundingClientRect().width;
  const data = canvas.getContext('2d').getImageData(Math.round((x - half) * scale), Math.round((y - tall) * scale), Math.round(half * 2 * scale), Math.round(tall * 2 * scale)).data;
  let hot = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 190 && data[i + 1] > 70 && data[i + 2] < 140 && data[i] > data[i + 2] + 80) hot++;
  return hot / (data.length / 4);
}, { x, y, half, tall });

for (const reduced of [false, true]) test(`the fuel jet is a tapering burning stream that reaches 7.5 tiles${reduced ? ' / reduced effects' : ''}`, async ({ browser }) => {
  test.setTimeout(60000);
  const arena = await isolatedField('fuel-stream');
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  if (reduced) await context.addInitScript(() => localStorage.setItem('frontier-effects', 'reduced'));
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(arena.base + '/?legacy=1');
    await expect(page.locator('#connection')).toContainText('live');
    await landCore(page);
    await mkdir(evidence, { recursive: true });
    const canvas = page.locator('#world-canvas');
    await canvas.focus();
    // C centres the camera on the robot; aim due east and hold the jet.
    await page.keyboard.press('c'); await page.waitForTimeout(1500);
    const box = await canvas.boundingBox(), zoom = parseInt(await page.locator('#zoom-label').textContent(), 10) / 100, tile = 48 * zoom;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx + tile * 10, cy);
    // Near: about 1 to 2 tiles from the robot. Far: about 5.2 to 6.6 tiles, past the old 5-tile reach.
    const bands = async () => ({ near: await fireAt(page, cx + tile * 2.4, cy, tile * .8), far: await fireAt(page, cx + tile * 6.9, cy, tile * .7) });
    const before = await bands();
    await page.mouse.down();
    await page.waitForTimeout(900);
    const firing = await bands();
    await page.screenshot({ path: path.join(evidence, `fuel-stream${reduced ? '-reduced' : ''}.png`), clip: { x: cx - tile * 3, y: cy - tile * 4, width: tile * 13, height: tile * 8 } });
    // Fire burns along the stream and beyond the old 5-tile reach.
    expect(firing.near).toBeGreaterThan(before.near + .003);
    expect(firing.far).toBeGreaterThan(before.far + .003);
    if (!reduced) {
      // Sweep the nozzle north while firing: packets already fired keep their line.
      for (let i = 1; i <= 6; i++) { await page.mouse.move(cx + tile * 10 * Math.cos(i * .2), cy - tile * 10 * Math.sin(i * .2)); await page.waitForTimeout(60); }
      await page.screenshot({ path: path.join(evidence, 'fuel-stream-sweep.png'), clip: { x: cx - tile * 3, y: cy - tile * 8, width: tile * 13, height: tile * 11 } });
    }
    await page.mouse.up();
    expect(errors).toEqual([]);
  } finally { await context.close(); await arena.close(); }
});
