import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { aimOverview } from './aim-helper.js';

for (const mobile of [false, true]) test(`HE battery placement, volley, handoff and saved reload on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(55000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-missile-')); let app = createApp({ dataDir }), context, other;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const port = app.server.address().port, url = `http://127.0.0.1:${port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    other = await browser.newContext(); const peer = await other.newPage(), page = await context.newPage(), errors = [];
    for (const p of [page, peer]) p.on('pageerror', e => errors.push(e.message));
    await peer.goto(url); await page.goto(url); await page.bringToFront(); await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (p, route, data) => p.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    await page.locator('#build-mode').click(); await page.locator('#missile-card').click(); await page.locator('#coordinate-details summary').click();
    await page.locator('#tile-x').fill('0'); await page.locator('#tile-y').fill('0'); await page.locator('#select-tile').click();
    await expect(page.locator('#site-reason')).toContainText('Ocean'); await expect(page.locator('#place-building')).toBeDisabled();
    expect((await post(page, 'missiles', { x: 0, y: 0 })).status).toBe(409);
    expect((await state(page)).artillery).toHaveLength(0);
    await page.screenshot({ path: `docs/previews/missile-ocean-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.locator('#tile-x').fill('64'); await page.locator('#tile-y').fill('24'); await page.locator('#select-tile').click();
    await expect(page.locator('#site-reason')).toContainText('4 × 4'); await expect(page.locator('#place-building')).toHaveText(/Deploy missile battery/);
    await page.screenshot({ path: `docs/previews/missile-placement-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.locator('#place-building').click(); await expect(page.locator('.facility-heading strong')).toHaveText('MISSILE BATTERY');
    await expect(page.locator('[data-shell="GAS"]')).toBeEnabled();
    const gun = (await state(page)).artillery.find(g => g.kind === 'missile'); expect(gun).toBeTruthy();
    expect((await post(peer, 'artillery/control', { id: gun.id })).status).toBe(409);
    expect((await post(peer, 'artillery/fire', { id: gun.id, target: { x: 100, y: 50 }, rotated: false })).status).toBe(403);
    expect((await post(page, 'artillery/move', { id: gun.id, step: 1 })).status).toBe(409);
    expect((await post(page, 'artillery/ammo', { id: gun.id, ammo: 'INVALID' })).status).toBe(409);
    expect((await post(page, 'artillery/fire', { id: gun.id, target: { x: 127, y: 50 } })).status).toBe(409);
    expect((await state(page)).artillery[0].reload).toBe(0);
    if (mobile) await page.locator('#missile-rotate').click(); else { await page.locator('#world-canvas').focus(); await page.keyboard.press('r'); }
    await expect.poll(async () => (await state(peer)).artillery[0].rotated).toBe(true);
    await page.evaluate(() => { window.missileImpacts = new Set(); window.missileEvents = new EventSource('/api/events'); window.missileEvents.onmessage = e => { for (const i of JSON.parse(e.data).combat.impacts) if (i.weapon === 'HE') window.missileImpacts.add(i.id); }; });
    const aim = await aimOverview(page, 100, 50, mobile);
    await expect(page.locator('#artillery-fire')).toBeEnabled();
    if (mobile) await page.locator('#artillery-fire').click(); else await page.mouse.click(aim.x, aim.y);
    await expect.poll(async () => (await state(peer)).combat.barrages.length).toBe(1);
    const shot = (await state(peer)).combat.barrages[0]; expect(shot.missiles).toHaveLength(12); expect([shot.box.width, shot.box.height]).toEqual([18, 12]);
    expect((await post(page, 'artillery/fire', { id: gun.id, target: { x: 100, y: 50 } })).status).toBe(409);
    // Aim changes affect only the next volley.
    await aimOverview(page, 90, 60, mobile); expect((await state(peer)).combat.barrages[0].missiles).toEqual(shot.missiles);
    await expect.poll(async () => (await state(peer)).combat.barrages[0]?.age).toBeGreaterThan(3);
    await page.screenshot({ path: `docs/previews/missile-flight-${mobile ? 'mobile' : 'desktop'}.png` });
    await expect.poll(() => page.evaluate(() => window.missileImpacts.size), { timeout: 13000, intervals: [100] }).toBe(12);
    expect((await state(peer)).combat.barrages).toHaveLength(0);
    const marks = (await state(peer)).combat.marks.filter(m => m.kind === 'crater');
    expect(marks).toHaveLength(12); expect(marks.every(m => m.size >= 7.2 && m.size <= 8.8)).toBe(true);
    await page.screenshot({ path: `docs/previews/missile-impact-${mobile ? 'mobile' : 'desktop'}.png` });
    const remaining = (await state(page)).artillery[0].reload; expect(remaining).toBeGreaterThan(0);
    await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r)); await page.reload(); await peer.reload();
    await expect(page.locator('#connection')).toContainText('live'); await expect(peer.locator('#connection')).toContainText('live');
    const resumed = await state(page); expect(resumed.artillery[0].kind).toBe('missile'); expect(resumed.artillery[0].rotated).toBe(true); expect(resumed.artillery[0].operator).toBeNull();
    expect(resumed.artillery[0].reload).toBeGreaterThan(0); expect(resumed.artillery[0].reload).toBeLessThanOrEqual(remaining); expect(resumed.combat.barrages).toHaveLength(0);
    expect((await post(peer, 'artillery/control', { id: gun.id })).status).toBe(200);
    expect((await post(page, 'artillery/control', { id: gun.id })).status).toBe(409);
    expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  } finally {
    await context?.close(); await other?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-missile-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
