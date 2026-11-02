import { aimOverview } from './aim-helper.js';
import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serverState } from './drive-helper.js';

for (const mobile of [false, true]) test(`incendiary and gas artillery on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(120000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-shells-')); let app = createApp({ dataDir }), context, other;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const port = app.server.address().port, url = `http://127.0.0.1:${port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    other = await browser.newContext(); const page = await context.newPage(), peer = await other.newPage(), errors = [];
    for (const p of [page, peer]) p.on('pageerror', e => errors.push(e.message));
    await peer.goto(url + '/?legacy=1'); await page.goto(url + '/?legacy=1'); await page.bringToFront(); await expect(page.locator('#connection')).toContainText('live'); await expect(peer.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async()=>(await fetch('/api/world')).text()).then(JSON.parse);
    const post = (p, route, data) => p.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    // Orbital entry: both scouts land before building; the operator's core supports the cannon.
    // Cores carry automatic sentries and a guarding robot fires its laser, so the gas test
    // below uses the eastern drill sector, out of their reach, rather than the island beacon.
    expect((await post(page, 'cores', { x: 24, y: 24 })).status).toBe(201); expect((await post(peer, 'cores', { x: 29, y: 13 })).status).toBe(201);
    for (const p of [page, peer]) await expect.poll(async () => (await serverState(p, url)).me.deploying, { timeout: 8000, intervals: [100] }).toBe(false);
    expect((await post(page, 'rails', { x: 20, y: 13, shape: 'EW' })).status).toBe(201);
    const { data: { gun } } = await post(page, 'artillery', { x: 20, y: 13 });
    // Orbital cargo arrives in a crate and unfolds; the cannon cannot be operated until its job completes.
    await expect.poll(async () => !!(await serverState(page, url)).logistics.jobs[gun.id], { timeout: 20000 }).toBe(false);
    expect((await post(page, 'artillery/control', { id: gun.id })).status).toBe(200);
    await aimOverview(page, 30.5, 13.5, mobile);
    await expect.poll(async () => (await state(page)).artillery[0].elevation, { intervals: [100] }).toBeGreaterThanOrEqual(85);
    expect((await post(peer, 'artillery/ammo', { id: gun.id, ammo: 'GAS' })).status).toBe(403);
    expect((await post(page, 'artillery/ammo', { id: gun.id, ammo: 'INVALID' })).status).toBe(400);
    await page.locator('[data-shell=INCENDIARY]').click();
    await expect(page.locator('#artillery-fire')).toContainText('Fire'); await expect(page.locator('#artillery-fire')).toBeEnabled();
    await page.locator('#artillery-fire').click();
    await expect.poll(async () => (await state(peer)).combat.salvos[0]?.weapon).toBe('INCENDIARY');
    await page.locator('[data-shell=GAS]').click();
    expect((await post(page, 'artillery/fire', { id: gun.id })).status).toBe(409);
    const flying = (await state(peer)).combat.salvos[0]; expect(flying.weapon).toBe('INCENDIARY');
    // The shell flies for flying.duration seconds (about 7.7 s at the default elevation) before the field appears.
    await expect.poll(async () => (await state(peer)).combat.fields[0]?.weapon, { timeout: flying.duration * 1000 + 4000 }).toBe('INCENDIARY');
    await page.screenshot({ path: `docs/previews/incendiary-${mobile ? 'mobile' : 'desktop'}.png` });
    // Move the second landing point east onto the Eastern plain drill sector.
    await aimOverview(page, 72.5, 22.5, mobile);
    await expect.poll(async () => (await state(page)).artillery[0].angle, { intervals: [100] }).toBeGreaterThan(1.68);
    // With the 180-tile range a 52.8-tile shot uses the higher arc, 90 - asin(d / 180) / 2 in degrees (about 81.5);
    // let elevation converge on it before firing.
    const higherArc = 90 - Math.asin(Math.hypot(72.5 - 20.5, 22.5 - 13.5) / 180) * 90 / Math.PI;
    await expect.poll(async () => Math.abs((await state(page)).artillery[0].elevation - higherArc) < 0.5, { timeout: 8000, intervals: [100] }).toBe(true);
    await expect(page.locator('#artillery-fire')).toBeEnabled({ timeout: 8000 }); await page.locator('#artillery-fire').click();
    await expect.poll(async () => (await state(peer)).combat.salvos.some(v => v.weapon === 'GAS')).toBe(true);
    const gasShell = (await state(peer)).combat.salvos.find(v => v.weapon === 'GAS');
    await expect.poll(async () => (await state(peer)).combat.fields.some(f => f.weapon === 'GAS'), { timeout: gasShell.duration * 1000 + 4000 }).toBe(true);
    await expect(page.locator('#artillery-ammo-info')).toContainText('6 kills');
    const gas = (await state(peer)).combat.fields.find(f => f.weapon === 'GAS'); expect(gas.capacity).toBe(6);
    await page.evaluate(() => { const el = document.getElementById('reduced-effects'); el.checked = true; el.dispatchEvent(new Event('change')); });
    await page.screenshot({ path: `docs/previews/gas-reduced-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.evaluate(() => { const el = document.getElementById('reduced-effects'); el.checked = false; el.dispatchEvent(new Event('change')); });
    await page.screenshot({ path: `docs/previews/gas-${mobile ? 'mobile' : 'desktop'}.png` });
    await expect.poll(async () => (await state(peer)).combat.fields.some(f => f.weapon === 'INCENDIARY'), { timeout: 20000 }).toBe(false);
    expect((await state(peer)).combat.fields.find(f => f.id === gas.id).capacity).toBe(6);
    expect((await post(page, 'drill', { frontId: 'east' })).status).toBe(200);
    await expect.poll(async () => (await state(peer)).combat.fields.find(f => f.id === gas.id)?.capacity ?? 0, { timeout: 18000 }).toBeLessThan(6);
    // Selection is durable; transient fields and operator ownership are not.
    await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r)); await page.reload();
    await expect(page.locator('#connection')).toContainText('live');
    const reopened = await state(page); expect(reopened.artillery[0].ammo).toBe('GAS'); expect(reopened.artillery[0].operator).toBeNull(); expect(reopened.combat.fields).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await other?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-shells-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
