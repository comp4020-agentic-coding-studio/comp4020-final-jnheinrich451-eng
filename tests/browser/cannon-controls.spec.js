import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { aimOverview } from './aim-helper.js';

for (const mobile of [false, true]) test(`pointer cannon, directional drive and context manual on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-controls-')); const app = createApp({ dataDir }); let context;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); await page.goto(url);
    const state = () => page.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (route, data) => page.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    for (const x of [20, 24]) expect((await post('rails', { x, y: 13, shape: 'EW' })).status).toBe(201);
    const gun = (await post('artillery', { x: 20, y: 13 })).data.gun;
    expect((await post('artillery/control', { id: gun.id })).status).toBe(200);
    await expect(page.locator('#facility-controls')).toBeVisible(); await expect(page.locator('.mode-dock')).toBeHidden();
    await expect(page.locator('.battlefield')).toHaveClass(/artillery-orbit/);
    await page.locator('#world-canvas').focus();
    for (const [key, ammo] of [['2', 'INCENDIARY'], ['3', 'GAS'], ['1', 'HE']]) {
      if (mobile) await page.locator(`[data-shell=${ammo}]`).tap(); else await page.keyboard.press(key);
      await expect.poll(async () => (await state()).artillery[0].ammo).toBe(ammo);
      expect((await state()).artillery[0].operator).toBe((await state()).me.id);
    }
    await aimOverview(page, 30.5, 13.5, mobile);
    await expect.poll(async () => (await state()).artillery[0].elevation).toBeGreaterThan(84);
    await page.locator('#world-canvas').focus(); await page.keyboard.down('w');
    await expect.poll(async () => (await state()).artillery[0].input?.y).toBe(-1);
    expect((await state()).artillery[0].move).toBeNull(); await page.keyboard.up('w');
    const point = await aimOverview(page, 20.5, 24.5, mobile);
    if (mobile) { expect((await state()).combat.salvos).toHaveLength(0); await page.locator('#artillery-fire').tap(); }
    else await page.mouse.click(point.x, point.y);
    await expect.poll(async () => (await state()).combat.salvos.length).toBe(1);
    const shot = (await state()).combat.salvos[0];
    // Immediate click fires the old physical bearing, not an instantaneous cursor snap.
    expect(Math.hypot(shot.targetX - 20.5, shot.targetY - 24.5)).toBeGreaterThan(5);
    await page.locator('#world-canvas').focus(); await page.keyboard.down('d');
    await expect.poll(async () => (await state()).artillery[0].move).toBeTruthy(); await page.keyboard.up('d');
    const pause = route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    await page.route('**/api/artillery/command', pause);
    await expect.poll(async () => (await state()).artillery[0].move, { timeout: 4000, intervals: [100] }).toBeNull();
    await expect.poll(async () => (await state()).artillery[0].brace, { timeout: 3000, intervals: [100] }).toBe(0);
    expect((await state()).artillery[0].x).toBe(21); await page.unroute('**/api/artillery/command', pause);
    await page.screenshot({ path: `docs/previews/cannon-controls-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.keyboard.press('Escape'); await expect(page.locator('#facility-controls')).toBeHidden(); await expect(page.locator('.mode-dock')).toBeVisible();
    expect((await state()).artillery[0].operator).toBeNull(); expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  } finally {
    await context?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-controls-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
