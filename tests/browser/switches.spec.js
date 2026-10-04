import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`shared junction routes, lock and saved turn on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(80000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-switch-')); let app = createApp({ dataDir }), context, other;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const port = app.server.address().port, url = `http://127.0.0.1:${port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    other = await browser.newContext(); const page = await context.newPage(), peer = await other.newPage(), errors = [];
    for (const p of [page, peer]) p.on('pageerror', e => errors.push(e.message));
    await peer.goto(url); await page.goto(url); await page.bringToFront(); await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (p, route, data) => p.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    for (const x of [64, 68, 72, 76]) expect((await post(page, 'rails', { x, y: 19, shape: 'EW' })).status).toBe(201);
    for (const y of [22, 26]) expect((await post(page, 'rails', { x: 71, y, shape: 'NS' })).status).toBe(201);
    expect((await post(page, 'rails', { x: 68, y: 22, shape: 'NE' })).status).toBe(201);
    expect((await post(peer, 'rails/switch', { x: 68, y: 22, route: 'curve' })).status).toBe(403);
    await page.locator('#site-button').click(); await page.locator('#coordinate-details summary').click();
    await page.locator('#tile-x').fill('68'); await page.locator('#tile-y').fill('22'); await page.locator('#select-tile').click();
    await page.locator('#enable-switch').click(); await expect(page.locator('#switch-status')).toContainText('CURVE');
    await page.locator('#switch-route').click(); await expect.poll(async () => (await state(peer)).switches[0]?.route).toBe('straight');
    expect((await post(peer, 'rails/switch', { x: 68, y: 22, route: 'bad' })).status).toBe(400);
    // Teammates may operate an installed switch, but installation/removal is owned.
    expect((await post(peer, 'rails/switch', { x: 68, y: 22, route: 'curve' })).status).toBe(200);
    await expect(page.locator('#switch-status')).toContainText('CURVE');
    await page.locator('#switch-inspect').click(); await page.screenshot({ path: `docs/previews/junction-open-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.locator('#switch-close').click(); await page.locator('#close-site').click();
    const gun = (await post(page, 'artillery', { x: 64, y: 19 })).data.gun;
    expect((await post(page, 'artillery/control', { id: gun.id })).status).toBe(200);
    await expect(page.locator('#facility-controls')).toBeVisible(); await page.locator('#world-canvas').focus(); await page.keyboard.down('d');
    await expect.poll(async () => (await state(peer)).artillery[0].move?.curve?.shape, { timeout: 12000, intervals: [100] }).toBe('NE'); await page.keyboard.up('d');
    expect((await post(peer, 'rails/switch', { x: 68, y: 22, route: 'straight' })).data.error).toContain('locked');
    await page.locator('#facility-switches').click(); await expect(page.locator('#switch-route')).toBeDisabled();
    await page.locator('#switch-inspect').click(); await page.screenshot({ path: `docs/previews/junction-locked-${mobile ? 'mobile' : 'desktop'}.png` });
    await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r)); await page.reload();
    await expect(page.locator('#connection')).toContainText('live');
    const resumed = await state(page); expect(resumed.switches[0].route).toBe('curve'); expect(resumed.artillery[0].move?.curve.shape).toBe('NE');
    expect((await post(page, 'rails/switch', { x: 68, y: 22, route: 'straight' })).data.error).toContain('locked');
    expect((await post(page, 'rails/remove', { x: 68, y: 22 })).data.error).toContain('locked');
    expect((await post(page, 'artillery/control', { id: gun.id })).status).toBe(200);
    await expect.poll(async () => (await state(page)).artillery[0].move, { timeout: 8000 }).toBeNull();
    await page.locator('#world-canvas').focus(); await page.keyboard.down('s');
    await expect.poll(async () => (await state(page)).artillery[0].y, { timeout: 8000, intervals: [100] }).toBe(26); await page.keyboard.up('s');
    await expect.poll(async () => (await state(page)).artillery[0].move).toBeNull();
    await page.locator('#facility-switches').click(); await expect(page.locator('#switch-route')).toBeEnabled(); await page.locator('#switch-route').click();
    await expect.poll(async () => (await state(peer)).switches[0]?.route).toBe('straight');
    await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r)); await page.reload();
    await expect(page.locator('#connection')).toContainText('live'); expect((await state(page)).switches[0].route).toBe('straight');
    await peer.reload(); await expect(peer.locator('#connection')).toContainText('live');
    expect((await post(peer, 'rails/remove', { x: 68, y: 22 })).status).toBe(403);
    expect((await post(page, 'rails/remove', { x: 68, y: 22 })).status).toBe(200); expect((await state(page)).switches).toEqual([]);
    expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  } finally {
    await context?.close(); await other?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-switch-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
