import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { colonyFixture } from './colony-motion-helper.js';

// Disposable expeditions only. Every colony transition passes through black, as the
// menu's descent ends: the garden fades in from it, leaving and a closed room fade
// back into it, and the descent itself lands in the garden's own light (8 November 2026).
const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-08');
const fade = page => page.evaluate(() => { const layer = document.getElementById('colony-fade'); return { hidden: layer.hidden, kind: layer.className, opacity: Number(getComputedStyle(layer).opacity) }; });

test('the garden fades in from black, and Save and return fades out with the camera rising, showing no reason', async ({ browser }) => {
  test.setTimeout(60000);
  const f = await colonyFixture(browser, { viewport: { width: 1920, height: 1080 } });
  try {
    const { page } = f;
    // The cover is black with no words, and the fade-in layer clears itself without catching input.
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('colony-loading')).backgroundColor)).toBe('rgb(0, 0, 0)');
    await expect.poll(async () => (await fade(page)).hidden, { timeout: 4000 }).toBe(true);
    await page.locator('#room-open').click();
    const tile = await page.evaluate(() => window.colonyFrames.at(-1).camera.tile);
    await page.locator('#colony-leave').click();
    const samples = [];
    for (let i = 0; i < 5; i++) { samples.push(await Promise.all([fade(page), page.evaluate(() => window.colonyFrames.at(-1).camera.tile)]).then(([value, now]) => ({ ...value, tile: now })).catch(() => null)); await page.waitForTimeout(160); }
    const seen = samples.filter(Boolean);
    expect(seen.some(sample => sample.kind.includes('fade-out') && sample.opacity > .05 && sample.opacity < .95)).toBe(true);
    expect(seen.at(-1).opacity).toBeGreaterThan(seen[0].opacity);
    expect(seen.at(-1).tile).toBeLessThan(tile * .97);
    await page.waitForURL('**/campaigns/**', { timeout: 6000 });
    // Leaving by choice keeps no reason for the menu.
    expect(await page.evaluate(() => sessionStorage.getItem('frontier-room-ended'))).toBeNull();
    await expect(page.locator('#message')).not.toHaveClass(/error/);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

for (const phone of [false, true]) test(`a room closed elsewhere fades the garden away, says why and returns to the menu that keeps the reason / ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(60000);
  const f = await colonyFixture(browser, { viewport: phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 } });
  try {
    const { page } = f, tag = phone ? 'phone' : 'desktop';
    await mkdir(evidence, { recursive: true });
    await expect.poll(async () => (await fade(page)).hidden, { timeout: 4000 }).toBe(true);
    // The host's other tab (here the API) closes the room: this page did not choose to leave.
    await f.post(f.owner, '/api/campaigns/leave', { id: f.campaign.id });
    await expect.poll(async () => (await fade(page)).kind, { timeout: 4000 }).toContain('fade-out');
    await expect.poll(async () => (await fade(page)).opacity, { timeout: 4000 }).toBeGreaterThan(.3);
    await expect(page.locator('#colony-loading')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('#colony-loading h2')).toHaveText('Your garden will be waiting.');
    await expect(page.locator('#loading-message')).toHaveText('The host closed this room. Progress is saved.');
    await page.screenshot({ path: path.join(evidence, `colony-room-closed-${tag}.png`) });
    await page.waitForURL('**/campaigns/**', { timeout: 8000 });
    await expect(page.locator('#message')).toHaveText('The host closed this room. Progress is saved.');
    // Reopening the closed garden's page explains itself and returns to the menu as well.
    await page.goto(new URL(`/colony/?campaign=${f.campaign.id}`, page.url()).href);
    await expect(page.locator('#loading-message')).toHaveText('This room is closed or your visit has ended.');
    await expect(page.locator('#colony-loading h2')).toHaveText('Your garden will be waiting.');
    await page.waitForURL('**/campaigns/**', { timeout: 8000 });
    await expect(page.locator('#message')).toHaveText('This room is closed or your visit has ended.');
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

// The descent from the menu lands in the garden's own light: a night garden is a dark, blue
// descent, a day garden a bright one. Captured mid-dive, once the air has fully come in.
test('the shuttle descent is lit by the garden: dark blue for a night garden, bright for a day garden', async ({ browser }) => {
  test.setTimeout(120000);
  await mkdir(evidence, { recursive: true });
  const light = {};
  for (const lighting of ['night', 'day']) {
    const f = await colonyFixture(browser, { viewport: { width: 1600, height: 1000 }, seedColony: colony => { colony.environment = { ...(colony.environment || {}), lighting, weather: 'clear' }; } });
    try {
      const { page } = f;
      await f.post(f.owner, '/api/campaigns/leave', { id: f.campaign.id });
      await page.waitForURL('**/campaigns/**', { timeout: 10000 });
      await page.goto(new URL('/campaigns/#view=continue&mode=colonization&planet=morrow-v1', page.url()).href);
      await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
      await expect(page.locator('body')).toHaveAttribute('data-entry-colony-ship', 'ready');
      await page.getByRole('button', { name: 'Enter Motion fixture', exact: true }).click();
      await expect(page.locator('body')).toHaveAttribute('data-entry-drop', 'dive', { timeout: 8000 });
      // Air is complete 36% into the 4.8 s dive; sample just after.
      await page.waitForTimeout(2300);
      light[lighting] = await page.evaluate(() => {
        const canvas = document.querySelector('canvas.entry-scene'), data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let sum = 0, blue = 0, n = 0;
        for (let i = 0; i < data.length; i += 4 * 97) { sum += .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]; blue += data[i + 2] - data[i]; n++; }
        return { luminance: sum / n, blueOverRed: blue / n };
      });
      await page.screenshot({ path: path.join(evidence, `colony-descent-${lighting}.png`) });
      await page.waitForURL('**/colony/?campaign=*', { timeout: 10000 });
      await expect(page.locator('#colony-loading')).toBeHidden();
      expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  }
  expect(light.night.luminance).toBeLessThan(light.day.luminance * .55);
  expect(light.night.blueOverRed).toBeGreaterThan(0);
});
