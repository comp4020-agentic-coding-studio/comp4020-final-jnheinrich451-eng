import { aimOverview } from './aim-helper.js';
import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`robot guard, curved railway and expanded battlefield on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(70000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-expansion-')); let app = createApp({ dataDir }); let context, peerContext;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const port = app.server.address().port, url = `http://127.0.0.1:${port}`;
    context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1920, height: 1080 } });
    peerContext = await browser.newContext(); const peer = await peerContext.newPage(), page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await peer.goto(url); await page.goto(url); await page.bringToFront();
    await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (p, route, data) => p.evaluate(async ({ route, data }) => { const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json() }; }, { route, data });
    const positionRobot = async (x, y) => {
      // This setup uses server navigation; idle mouse-aim input normally cancels
      // that route. Suspend only that unrelated input while arranging the robot.
      const idle = route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      await page.route('**/api/input', idle);
      try {
        expect((await post(page, 'navigate', { x, y })).status).toBe(200);
        await expect.poll(async () => { const p = (await state(page)).me; return Math.hypot(p.x - x - .5, p.y - y - .5); }, { timeout: 10000, intervals: [100] }).toBeLessThan(.1);
      } finally { await page.unroute('**/api/input', idle); }
    };
    const initial = await state(page); expect([initial.world.width, initial.world.height]).toEqual([128, 96]);
    for (const data of [{ x: 68, y: 19, shape: 'EW' }, { x: 71, y: 22, shape: 'NS' }, { x: 68, y: 22, shape: 'NE' }]) expect((await post(page, 'rails', data)).status).toBe(201);
    const deployed = await post(page, 'artillery', { x: 68, y: 19 }); expect(deployed.status).toBe(201); const gun = deployed.data.gun;
    expect((await post(page, 'cores', { x: 29, y: 13 })).status).toBe(201);
    await expect.poll(async () => (await state(page)).me.deploying, { timeout: 8000, intervals: [100] }).toBe(false);
    await positionRobot(30, 11);
    expect((await post(page, 'artillery/control', { id: gun.id })).status).toBe(200);
    await expect(page.locator('#artillery-guard')).toContainText('Robot guarding');
    await page.evaluate(() => { window.guardShots = []; window.guardEvents = new EventSource('/api/events'); window.guardEvents.onmessage = e => { for (const s of JSON.parse(e.data).combat.shots) if (!window.guardShots.some(old => old.id === s.id)) window.guardShots.push(s); }; });
    expect((await post(page, 'drill', {})).status).toBe(200);
    await expect.poll(() => page.evaluate(id => window.guardShots.some(s => s.owner === id && s.weapon === 'LASER'), initial.me.id), { timeout: 8000 }).toBe(true);
    await expect.poll(async () => (await state(page)).combat.status, { timeout: 10000 }).toBe('cleared');
    expect((await state(page)).me.x).toBeCloseTo(30.5); expect((await state(peer)).players.find(p => p.id === initial.me.id).guarding).toBe(true);
    await page.screenshot({ path: `docs/previews/guard-${mobile ? 'mobile' : 'desktop'}.png` });
    expect((await post(page, 'artillery/control', { id: gun.id, release: true })).status).toBe(200);
    await expect.poll(async () => (await state(page)).me.guarding).toBe(false);
    await positionRobot(24, 11);
    expect((await post(page, 'artillery/control', { id: gun.id })).status).toBe(200); expect((await post(page, 'drill', {})).status).toBe(200);
    await expect.poll(() => page.evaluate(id => window.guardShots.some(s => s.owner === id && s.weapon === 'FLAME'), initial.me.id), { timeout: 6000 }).toBe(true);
    await expect.poll(async () => (await state(page)).combat.status, { timeout: 10000 }).toBe('cleared');
    await page.locator('#world-canvas').focus(); await page.keyboard.down('d');
    await expect.poll(async () => (await state(peer)).artillery[0].move?.curve?.shape).toBe('NE'); await page.keyboard.up('d');
    expect((await post(peer, 'rails/remove', { x: 68, y: 22 })).status).toBe(403);
    // Save midway through the arc and resume without retaining an operator.
    await page.screenshot({ path: `docs/previews/rail-curve-${mobile ? 'mobile' : 'desktop'}.png` });
    await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r)); await page.reload();
    await expect(page.locator('#connection')).toContainText('live');
    const resumed = await state(page); expect(resumed.artillery[0].move?.curve.shape).toBe('NE'); expect(resumed.artillery[0].operator).toBeNull();
    expect((await post(page, 'rails/remove', { x: 68, y: 22 })).status).toBe(409);
    await expect.poll(async () => (await state(page)).artillery[0].move, { timeout: 8000 }).toBeNull();
    expect([(await state(page)).artillery[0].x, (await state(page)).artillery[0].y]).toEqual([71, 22]);
    await page.locator('#drill-front').selectOption('east'); await page.locator('#start-drill').click();
    await expect.poll(async () => (await state(peer)).combat.objective.id).toBe('east');
    expect((await state(page)).combat.enemies.every(e => e.x > 48)).toBe(true);
    expect((await post(page, 'artillery/control', { id: gun.id })).status).toBe(200);
    await aimOverview(page, 71.5, 65, mobile);
    await expect.poll(async () => (await state(page)).artillery[0].elevation).toBeLessThanOrEqual(70);
    await expect(page.locator('#artillery-fire')).toBeEnabled(); await page.locator('#artillery-fire').click();
    await expect.poll(async () => (await state(peer)).combat.salvos.length).toBe(1);
    const shot = (await state(peer)).combat.salvos[0]; expect(Math.hypot(shot.targetX - shot.x, shot.targetY - shot.y)).toBeGreaterThan(30);
    await page.screenshot({ path: `docs/previews/expanded-${mobile ? 'mobile' : 'desktop'}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await peerContext?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-expansion-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
