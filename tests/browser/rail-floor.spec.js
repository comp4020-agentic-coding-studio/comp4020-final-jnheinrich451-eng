import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`rails cross pad and unfolded flooring on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-floor-')), app = createApp({ dataDir }); let context, other;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (route, data) => page.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    const coordinates = async (x, y) => { await page.locator('#tile-x').fill(String(x)); await page.locator('#tile-y').fill(String(y)); await page.locator('#select-tile').click(); };
    expect((await post('cores', { x: 29, y: 13 })).status).toBe(201);
    await expect.poll(async () => (await state(page)).me.deploying, { timeout: 8000 }).toBe(false);
    await page.locator('#build-mode').click(); await page.locator('#rail-card').click(); await page.locator('#coordinate-details summary').click();
    await coordinates(25, 16); await page.locator('#rail-shape').selectOption('NS');
    await expect(page.locator('#place-building')).toBeEnabled(); await page.locator('#place-building').click();
    await expect.poll(async () => (await state(page)).rails.length).toBe(5);
    await page.screenshot({ path: `docs/previews/rail-pad-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.keyboard.press('Escape');
    // The original guest has exited the core, leaving the landing pad empty.
    expect((await post('artillery', { x: 25, y: 17 })).status).toBe(201);
    other = await browser.newContext(); const peer = await other.newPage(); await peer.goto(url);
    const joined = await state(peer), guest = joined.me;
    expect(Math.abs(guest.x - 25.5) >= 1.75 || Math.abs(guest.y - 17.5) >= 1.75).toBe(true);
    await page.bringToFront(); await page.locator('#build-mode').click(); await page.locator('#rail-card').click();
    await coordinates(34, 14); await page.locator('#rail-shape').selectOption('EW');
    await expect(page.locator('#place-building')).toBeEnabled(); await page.locator('#place-building').click();
    await expect.poll(async () => (await state(peer)).rails.length).toBe(10);
    await page.locator('#close-site').click();
    await page.screenshot({ path: `docs/previews/rail-floor-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.locator('#site-button').click();
    await coordinates(30, 14); await expect(page.locator('#place-building')).toBeDisabled(); await expect(page.locator('#site-reason')).toContainText('machinery');
    expect((await post('rails', { x: 30, y: 14, shape: 'EW' })).status).toBe(409);
    expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  } finally {
    await context?.close(); await other?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-floor-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
