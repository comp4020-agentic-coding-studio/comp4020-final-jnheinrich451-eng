import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../server.js';
import { createCombat } from '../../public/combat.js';
import { freshLife } from '../../public/survival.js';

// Seed only disposable saves. There is no public damage/teleport test endpoint.
for (const mobile of [false, true]) test(`robot survival and shared-core recovery on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(45000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-survival-'));
  let app = createApp({ dataDir });
  await app.close();
  const db = new DatabaseSync(path.join(dataDir, 'world.sqlite'));
  const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
  const combat = createCombat(world); combat.start([]); const enemy = combat.snapshot().enemies[0];
  const token = randomUUID(), friendToken = randomUUID();
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token, 'robot', 'Scout A', enemy.x, enemy.y + .6, 0);
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(friendToken, 'friend', 'Scout B', 23.6, 22.5, 0);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('own-core', 'robot', 29, 13, 4.5);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('friend-core', 'friend', 20, 21, 4.5);
  db.prepare('INSERT INTO robot_states VALUES (?,?)').run('robot', JSON.stringify({ ...freshLife(), health: 25 })); db.close();
  app = createApp({ dataDir });
  let context, other;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1920, height: 1080 } });
    other = await browser.newContext();
    await context.addCookies([{ name: 'frontier', value: token, url }]); await other.addCookies([{ name: 'frontier', value: friendToken, url }]);
    const page = await context.newPage(), peer = await other.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); peer.on('pageerror', e => errors.push(e.message));
    await peer.goto(url); await page.goto(url); await page.bringToFront();
    await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const post = (route, data) => page.evaluate(async ({ route, data }) => (await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).status, { route, data });
    await expect(page.locator('#health-value')).toHaveText('25 / 100');
    await page.reload(); await expect(page.locator('#health-value')).toHaveText('25 / 100');
    await page.locator('#start-drill').click();
    await expect.poll(async () => (await state(page)).combat.enemies.some(e => e.attack)).toBe(true);
    await page.screenshot({ path: `docs/previews/survival-warning-${mobile ? 'mobile' : 'desktop'}.png` });
    await expect(page.locator('#recovery-panel')).toBeVisible({ timeout: 10000 });
    expect((await state(page)).me.health).toBe(0);
    for (const [route, data] of [['fire', { x: 25, y: 12, weapon: 'FLAME' }], ['input', { x: 1, y: 0 }], ['navigate', { x: 25, y: 12 }], ['cores', { x: 29, y: 13 }], ['buildings', { x: 28, y: 21 }]]) expect(await post(route, data)).toBe(409);
    const port = app.server.address().port;
    await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r));
    await page.reload(); await expect(page.locator('#recovery-panel')).toBeVisible(); await expect(page.locator('#health-value')).toHaveText('0 / 100');
    await expect.poll(async () => (await state(peer)).players.find(p => p.id === 'robot')?.life).toBe('disabled');
    await page.locator('#recovery-core').selectOption('friend-core');
    await page.screenshot({ path: `docs/previews/survival-recovery-${mobile ? 'mobile' : 'desktop'}.png` });
    await expect(page.locator('#revive-button')).toBeEnabled({ timeout: 6000 });
    if (mobile) await page.locator('#revive-button').tap(); else await page.locator('#revive-button').click();
    await expect(page.locator('#recovery-title')).toHaveText('Replacement incoming');
    expect(await post('revive', { coreId: 'friend-core' })).toBe(200);
    await page.screenshot({ path: `docs/previews/survival-pod-${mobile ? 'mobile' : 'desktop'}.png` });
    if (!mobile) {
      await app.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(port, '127.0.0.1', r));
      await page.reload();
    }
    await expect(page.locator('#recovery-panel')).toBeHidden({ timeout: 5000 });
    const recovered = await state(page);
    expect(recovered.me.health).toBe(100); expect(recovered.me.reviveCore).toBe('friend-core');
    expect(Math.hypot(recovered.me.x - 21.5, recovered.me.y - 22.5)).toBeLessThanOrEqual(6);
    expect(recovered.cores).toHaveLength(2); expect(recovered.buildings).toHaveLength(2);
    expect(await post('revive', { coreId: 'own-core' })).toBe(409);
    await expect.poll(async () => (await state(peer)).players.find(p => p.id === 'robot')?.life).toBe('active');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context?.close(); await other?.close(); await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});
