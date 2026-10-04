import { aimOverview } from './aim-helper.js';
import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`incendiary and gas artillery on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(65000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-shells-')); let app = createApp({ dataDir }), context, other;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const port = app.server.address().port, url = `http://127.0.0.1:${port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    other = await browser.newContext(); const page = await context.newPage(), peer = await other.newPage(), errors = [];
    for (const p of [page, peer]) p.on('pageerror', e => errors.push(e.message));
    await peer.goto(url); await page.goto(url); await page.bringToFront(); await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (p, route, data) => p.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    expect((await post(page, 'rails', { x: 20, y: 13, shape: 'EW' })).status).toBe(201);
    const { data: { gun } } = await post(page, 'artillery', { x: 20, y: 13 });
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
    expect((await state(peer)).combat.salvos[0].weapon).toBe('INCENDIARY');
    await expect.poll(async () => (await state(peer)).combat.fields[0]?.weapon, { timeout: 7000 }).toBe('INCENDIARY');
    await page.screenshot({ path: `docs/previews/incendiary-${mobile ? 'mobile' : 'desktop'}.png` });
    // Move the second landing point south, keeping both fields visible near the island.
    await aimOverview(page, 27.5, 21.5, mobile);
    await expect.poll(async () => (await state(page)).artillery[0].angle, { intervals: [100] }).toBeGreaterThan(2.3);
    await expect(page.locator('#artillery-fire')).toBeEnabled({ timeout: 8000 }); await page.locator('#artillery-fire').click();
    await expect.poll(async () => (await state(peer)).combat.fields.some(f => f.weapon === 'GAS'), { timeout: 7000 }).toBe(true);
    await expect(page.locator('#artillery-ammo-info')).toContainText('6 kills');
    const gas = (await state(peer)).combat.fields.find(f => f.weapon === 'GAS'); expect(gas.capacity).toBe(6);
    await page.evaluate(() => { const el = document.getElementById('reduced-effects'); el.checked = true; el.dispatchEvent(new Event('change')); });
    await page.screenshot({ path: `docs/previews/gas-reduced-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.evaluate(() => { const el = document.getElementById('reduced-effects'); el.checked = false; el.dispatchEvent(new Event('change')); });
    await page.screenshot({ path: `docs/previews/gas-${mobile ? 'mobile' : 'desktop'}.png` });
    await expect.poll(async () => (await state(peer)).combat.fields.some(f => f.weapon === 'INCENDIARY'), { timeout: 20000 }).toBe(false);
    expect((await state(peer)).combat.fields.find(f => f.id === gas.id).capacity).toBe(6);
    expect((await post(page, 'drill', {})).status).toBe(200);
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
