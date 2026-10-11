import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`distant tank click fires to maximum range ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-tank-range-'));
  let app = createApp({ dataDir: dir, logSink: () => {} }); await app.close();
  const db = new DatabaseSync(path.join(dir, 'world.sqlite')), token = randomUUID(), pilot = randomUUID();
  try {
    db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token, pilot, 'Range tester', 24.5, 18.5, Math.PI);
    const tank = { id: 'range-tank', owner: pilot, occupant: pilot, x: 24.5, y: 18.5, podX: 10, podY: 10, elapsed: 99, health: 200, angle: Math.PI, turret: Math.PI, weapon: 'HE', secondary: 'APCR' };
    db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
  } finally { db.close(); }
  app = createApp({ dataDir: dir, logSink: () => {} });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
  const other = await browser.newContext();
  try {
    await owner.addCookies([{ name: 'frontier', value: token, url: base }]);
    const page = await owner.newPage(), peer = await other.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/?legacy=1'); await peer.goto(base + '/?legacy=1');
    await page.bringToFront(); await expect(page.locator('#connection')).toContainText('live');
    const initial = await page.evaluate(async () => (await fetch('/api/world')).json());
    await page.locator('#center').click();
    for (let i = 0; i < 5; i++) await page.locator('#zoom-out').click();
    await expect(page.locator('#zoom-label')).toHaveText('35%');
    const box = await page.locator('#world-canvas').boundingBox();
    // Pan through the overview on phones so distant ground is clear of the HUD.
    if (mobile) {
      const mini = await page.locator('#minimap').boundingBox();
      await page.touchscreen.tap(mini.x + mini.width * initial.me.x / initial.world.width, mini.y + mini.height * (initial.me.y - 16) / initial.world.height);
    }
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 - (mobile ? 0 : 16 * 48 * .35) };
    expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id, point)).toBe('world-canvas');
    if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(1400);
    const response = page.waitForResponse(r => r.url().endsWith('/api/fire') && r.request().method() === 'POST');
    if (mobile) await page.locator('#fire-button').click(); else await page.mouse.click(point.x, point.y);
    const fired = await response; expect(fired.status()).toBe(200);
    const request = fired.request().postDataJSON();
    const distance = Math.hypot(request.x - initial.me.x, request.y - initial.me.y);
    expect(distance).toBeGreaterThan(14);
    const endpoint = { x: initial.me.x + (request.x - initial.me.x) / distance * 14, y: initial.me.y + (request.y - initial.me.y) / distance * 14 };
    await expect.poll(async () => peer.evaluate(async ({ x, y }) => {
      const s = await (await fetch('/api/world')).json();
      return s.combat.impacts.some(i => i.weapon === 'HE' && Math.abs(i.x - x) < .2 && Math.abs(i.y - y) < .2);
    }, endpoint), { intervals: [80] }).toBe(true);
    await page.screenshot({ path: info.outputPath('maximum-range.png') });
    expect(errors).toEqual([]);
  } finally {
    await owner.close(); await other.close(); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-tank-range-')) throw Error('Unexpected test directory');
    await rm(dir, { recursive: true, force: true });
  }
});
