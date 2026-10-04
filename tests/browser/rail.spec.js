import { aimOverview } from './aim-helper.js';
import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`railway cannon placement, shared control, HE and movement on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(50000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-rail-')); let app = createApp({ dataDir });
  let context, other;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const port = app.server.address().port, url = `http://127.0.0.1:${port}`;
    context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1920, height: 1080 } });
    other = await browser.newContext(); const page = await context.newPage(), peer = await other.newPage(), errors = [];
    for (const p of [page, peer]) p.on('pageerror', e => errors.push(e.message));
    await peer.goto(url); await page.goto(url); await page.bringToFront(); await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (p, route, data) => p.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    const coordinates = async (x, y) => {
      if (!(await page.locator('#site-panel').isVisible())) await page.locator('#site-button').click();
      if ((await page.locator('#coordinate-details').getAttribute('open')) === null) await page.locator('#coordinate-details summary').click();
      await page.locator('#tile-x').fill(String(x)); await page.locator('#tile-y').fill(String(y)); await page.locator('#select-tile').click();
    };
    await page.locator('#build-mode').click(); await page.locator('#rail-card').click(); await coordinates(20, 13);
    await expect(page.locator('#place-building')).toBeEnabled(); await page.locator('#place-building').click();
    await expect.poll(async () => (await state(page)).rails.length).toBe(5);
    await page.screenshot({ path: `docs/previews/rail-track-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.keyboard.press('Escape'); await page.locator('#build-mode').click(); await page.locator('#artillery-card').click(); await coordinates(20, 13);
    await expect(page.locator('#place-building')).toBeEnabled(); await page.locator('#place-building').click();
    await expect(page.locator('#facility-controls')).toBeVisible();
    await expect.poll(async () => (await state(page)).artillery[0]?.operator).toBe((await state(page)).me.id);
    const initial = await state(page), gun = initial.artillery[0];
    expect((await post(peer, 'artillery/control', { id: gun.id })).status).toBe(409);
    expect((await post(peer, 'artillery/fire', { id: gun.id, x: 30.5, y: 13.5 })).status).toBe(403);
    expect((await post(page, 'input', { x: 1, y: 0 })).status).toBe(409);
    await expect(page.locator('.battlefield')).toHaveClass(/artillery-orbit/);
    await aimOverview(page, 30.5, 13.5, mobile);
    await expect.poll(async () => (await state(page)).artillery[0].elevation).toBeGreaterThanOrEqual(84);
    await expect(page.locator('#artillery-fire')).toBeEnabled({ timeout: 7000 });
    await page.screenshot({ path: `docs/previews/rail-ready-${mobile ? 'mobile' : 'desktop'}.png` });
    if (mobile) await page.locator('#artillery-fire').tap(); else await page.locator('#artillery-fire').click();
    await expect.poll(async () => (await state(peer)).combat.salvos.length).toBe(1);
    expect((await post(page, 'artillery/fire', { id: gun.id, x: 30.5, y: 13.5 })).status).toBe(409);
    const airborne = (await state(peer)).combat.salvos[0];
    expect(airborne.elevation).toBeGreaterThanOrEqual(84); expect(airborne.duration).toBeGreaterThan(4);
    await expect.poll(async () => (await state(peer)).combat.marks.some(m => m.kind === 'crater' && m.size === 8), { timeout: 6500 }).toBe(true);
    expect((await state(page)).me.x).toBe(initial.me.x); expect((await state(page)).me.y).toBe(initial.me.y);
    await page.screenshot({ path: `docs/previews/rail-impact-${mobile ? 'mobile' : 'desktop'}.png` });
    // Start a fresh reload before the restart, rather than racing the first shell's flight.
    await expect(page.locator('#artillery-fire')).toBeEnabled({ timeout: 7000 }); await page.locator('#artillery-fire').click();
    await expect.poll(async () => (await state(page)).artillery[0].reload).toBeGreaterThan(5);
    await page.locator('#world-canvas').focus(); await page.keyboard.down('d');
    await expect.poll(async () => (await state(page)).artillery[0].move).toBeTruthy(); await page.keyboard.up('d');
    // Restart midway through relocation: preserve the footprint and reload, release the operator.
    await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r));
    await page.reload(); await expect(page.locator('#connection')).toContainText('live');
    const reopened = await state(page); expect(reopened.rails).toHaveLength(5); expect(reopened.artillery).toHaveLength(1);
    expect(reopened.artillery[0].x).toBe(21); expect(reopened.artillery[0].operator).toBeNull(); expect(reopened.artillery[0].reload).toBeGreaterThan(0);
    expect(reopened.artillery[0].elevation).toBeGreaterThanOrEqual(84); expect(reopened.artillery[0].inputTime).toBe(0);
    expect((await post(page, 'rails/remove', { x: 21, y: 13 })).status).toBe(409);
    await expect.poll(async () => (await state(page)).players.length).toBe(2);
    expect((await post(peer, 'rails/remove', { x: 18, y: 13 })).status).toBe(403);
    await expect.poll(async () => (await state(page)).artillery[0].move).toBeNull();
    await page.locator('#build-mode').click(); await page.locator('#artillery-open').click(); await page.locator('#artillery-control-button').click();
    expect((await post(page, 'artillery/move', { id: gun.id, step: 1 })).status).toBe(409);
    await page.locator('#facility-exit').click();
    expect((await post(page, 'rails/remove', { x: 18, y: 13 })).status).toBe(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect(errors).toEqual([]);
    await page.locator('#artillery-open').evaluate(el => el.click());
    // A disconnected operator must not leave a permanent shared lock.
    await page.locator('#artillery-control-button').click();
    await expect.poll(async () => (await state(peer)).artillery[0].operator).toBe(initial.me.id);
    await page.close();
    await expect.poll(async () => (await state(peer)).artillery[0].operator).toBeNull();
    expect((await post(peer, 'artillery/control', { id: gun.id })).status).toBe(200);
  } finally {
    await context?.close(); await other?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-rail-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
