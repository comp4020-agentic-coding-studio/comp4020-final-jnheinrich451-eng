import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`one-tile junction builds, branches and persists on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(60000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-compact-')); let app = createApp({ dataDir }), context, other;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const port = app.server.address().port, url = `http://127.0.0.1:${port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    other = await browser.newContext(); const peer = await other.newPage(), page = await context.newPage(), errors = [];
    for (const p of [peer, page]) p.on('pageerror', e => errors.push(e.message));
    await peer.goto(url); await page.goto(url); await page.bringToFront(); await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (p, route, data) => p.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    for (const x of [64, 68, 72]) expect((await post(page, 'rails', { x, y: 22, shape: 'EW' })).status).toBe(201);
    expect((await post(peer, 'rails', { x: 68, y: 22, shape: 'NS', length: 1 })).status).toBe(409);
    await page.locator('#build-mode').click(); await page.locator('#rail-card').click(); await page.locator('#coordinate-details summary').click();
    const coordinates = async (x, y) => { await page.locator('#tile-x').fill(String(x)); await page.locator('#tile-y').fill(String(y)); await page.locator('#select-tile').click(); };
    await coordinates(68, 22); await page.locator('#rail-shape').selectOption('NS'); await page.locator('#place-building').click();
    await expect.poll(async () => (await state(peer)).rails.find(r => r.x === 68 && r.y === 22)?.shape).toBe('J');
    for (const y of [18, 26]) expect((await post(page, 'rails', { x: 68, y, shape: 'NS' })).status).toBe(201);
    await coordinates(74, 27); await page.locator('#rail-shape').selectOption('CNE'); await expect(page.locator('#rail-length')).toBeDisabled();
    await expect(page.locator('#site-reason')).toContainText('one tile'); await page.locator('#place-building').click();
    await expect.poll(async () => (await state(peer)).rails.filter(r => r.shape === 'CNE').length).toBe(1);
    await page.screenshot({ path: `docs/previews/compact-track-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.keyboard.press('Escape'); await expect(page.locator('#site-panel')).toBeHidden();
    const deployed = await post(page, 'artillery', { x: 67, y: 22 }); expect(deployed.status).toBe(201); const id = deployed.data.gun.id;
    expect((await post(page, 'artillery/control', { id })).status).toBe(200); await expect(page.locator('#facility-controls')).toBeVisible();
    const down = async key => { if (mobile) { const b = page.locator(`[data-direction="${{ d: 'right', w: 'up', s: 'down', a: 'left' }[key]}"]`); const rect = await b.boundingBox(); await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down(); } else { await page.locator('#world-canvas').focus(); await page.keyboard.down(key); } };
    const up = async key => { if (mobile) await page.mouse.up(); else await page.keyboard.up(key); };
    await down('d'); await expect.poll(async () => (await state(peer)).artillery[0].x, { intervals: [50] }).toBe(68); await up('d');
    await expect.poll(async () => (await state(page)).artillery[0].move).toBeNull();
    await down('w'); await expect.poll(async () => (await state(peer)).artillery[0].y, { intervals: [50] }).toBe(21); await up('w');
    const turning = (await state(page)).artillery[0]; expect(turning.move.fromShape).toBe('EW'); expect(turning.shape).toBe('NS');
    expect((await post(peer, 'artillery/control', { id })).status).toBe(409);
    await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r)); await page.reload();
    await expect(page.locator('#connection')).toContainText('live');
    const resumed = await state(page); expect(resumed.artillery[0].shape).toBe('NS'); expect(resumed.artillery[0].operator).toBeNull();
    expect(resumed.rails.find(r => r.x === 68 && r.y === 22).shape).toBe('J');
    await expect.poll(async () => (await state(page)).artillery[0].move).toBeNull();
    expect((await post(page, 'artillery/control', { id })).status).toBe(200); await expect(page.locator('#facility-controls')).toBeVisible();
    await down('s'); await expect.poll(async () => (await state(peer)).artillery[0].y, { intervals: [50] }).toBe(22); await up('s');
    await expect.poll(async () => (await state(page)).artillery[0].move).toBeNull();
    await down('d'); await expect.poll(async () => (await state(peer)).artillery[0].x, { intervals: [50] }).toBe(69); await up('d');
    await expect.poll(async () => (await state(page)).artillery[0].move).toBeNull();
    expect((await state(page)).artillery[0].shape).toBe('EW');
    await page.screenshot({ path: `docs/previews/compact-drive-${mobile ? 'mobile' : 'desktop'}.png` });
    expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  } finally {
    await context?.close(); await other?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-compact-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
