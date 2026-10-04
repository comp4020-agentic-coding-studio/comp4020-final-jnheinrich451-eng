import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { aimOverview } from './aim-helper.js';

for (const mobile of [false, true]) for (const ammo of ['INCENDIARY', 'GAS']) test(`${ammo} missile controls, shared sectors and restart on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(55000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-missile-fields-')); let app = createApp({ dataDir }), context, other;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const port = app.server.address().port, url = `http://127.0.0.1:${port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    other = await browser.newContext(); const page = await context.newPage(), peer = await other.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await peer.goto(url); await page.goto(url); await page.bringToFront(); await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (p, route, data) => p.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    await page.locator('#build-mode').click(); await page.locator('#missile-card').click(); await page.locator('#coordinate-details summary').click();
    await page.locator('#tile-x').fill('64'); await page.locator('#tile-y').fill('24'); await page.locator('#select-tile').click(); await page.locator('#place-building').click();
    await expect(page.locator('.facility-heading strong')).toHaveText('MISSILE BATTERY');
    if (mobile) await page.locator(`[data-shell="${ammo}"]`).click(); else { await page.locator('#world-canvas').focus(); await page.keyboard.press(ammo === 'GAS' ? '3' : '2'); }
    await expect(page.locator(`[data-shell="${ammo}"]`)).toHaveAttribute('aria-pressed', 'true');
    if (mobile) await page.locator('#missile-rotate').click(); else await page.keyboard.press('r');
    const g = (await state(page)).artillery[0], target = { x: 100, y: 50 };
    const point = await aimOverview(page, target.x, target.y, mobile); await expect(page.locator('#artillery-fire')).toBeEnabled();
    if (mobile) await page.locator('#artillery-fire').click(); else await page.mouse.click(point.x, point.y);
    await expect.poll(async () => (await state(peer)).combat.barrages.length).toBe(1);
    const shot = (await state(peer)).combat.barrages[0]; expect(shot.weapon).toBe(ammo); expect(shot.box.width).toBe(18);
    expect((await state(peer)).combat.fields[0].sectors).toHaveLength(0);
    // A different battery cannot bypass the area reservation while missiles fly.
    const second = (await post(peer, 'missiles', { x: 74, y: 24 })).data.gun;
    expect((await post(peer, 'artillery/control', { id: second.id })).status).toBe(200);
    await post(peer, 'artillery/ammo', { id: second.id, ammo });
    const rejected = await post(peer, 'artillery/fire', { id: second.id, target, rotated: true });
    expect(rejected.status).toBe(409); expect(rejected.data.error).toContain('area limit');
    expect((await state(peer)).artillery.find(g => g.id === second.id).reload).toBe(0);
    await post(peer, 'artillery/control', { id: second.id, release: true });
    // Switching loadout cannot change the committed warhead.
    await page.locator('[data-shell="HE"]').click(); await expect(page.locator('[data-shell="HE"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await state(peer)).combat.fields[0]?.sectors.length, { timeout: 13000, intervals: [100] }).toBe(12);
    const field = (await state(peer)).combat.fields[0]; expect(field.weapon).toBe(ammo); expect(field.pending).toBe(0); expect(field.box).toEqual(shot.box);
    expect((await state(page)).combat.fields[0].sectors.map(s => [s.x, s.y])).toEqual(field.sectors.map(s => [s.x, s.y]));
    expect((await state(page)).combat.marks.filter(m => m.kind === 'crater')).toHaveLength(12);
    expect(field.sectors.every((s, i) => s.radius > 3 && s.x === shot.missiles[i].x && s.y === shot.missiles[i].y)).toBe(true);
    expect((await state(page)).combat.impacts.some(i => i.weapon === ammo && i.minorBlast)).toBe(true);
    if (ammo === 'GAS') expect(field.capacity).toBe(18); else expect(field.remaining).toBeGreaterThan(17);
    await page.screenshot({ path: `docs/previews/missile-${ammo.toLowerCase()}-${mobile ? 'mobile' : 'desktop'}.png` });
    // Save the chosen new loadout even though the old volley remains independent.
    await page.locator(`[data-shell="${ammo}"]`).click(); await expect(page.locator(`[data-shell="${ammo}"]`)).toHaveAttribute('aria-pressed', 'true');
    await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r)); await page.reload();
    await expect(page.locator('#connection')).toContainText('live'); const resumed = await state(page);
    expect(resumed.artillery.find(gun => gun.id === g.id).ammo).toBe(ammo); expect(resumed.artillery.find(gun => gun.id === g.id).reload).toBeGreaterThan(0);
    expect(resumed.combat.fields).toHaveLength(0); expect(resumed.combat.barrages).toHaveLength(0);
    expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  } finally {
    await context?.close(); await other?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-missile-fields-')) throw Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
