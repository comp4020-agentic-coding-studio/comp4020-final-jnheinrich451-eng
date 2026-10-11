import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';

for (const mobile of [false, true]) test(`modifier shared conquest and terrain recovery ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-modifier-')), contexts = [], logs = [];
  let app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port, base = `http://127.0.0.1:${port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, reducedMotion: mobile ? 'reduce' : 'no-preference' });
    const guest = await browser.newContext(); contexts.push(owner, guest);
    const post = async (c, route, data) => { const r = await c.request.post(base + route, { data, headers: { Origin: base } }); expect(r.status()).toBeLessThan(300); return r.json(); };
    const credentials = { name: 'Modifier tester', email: 'modifier@frontier.test', password: 'unique modifier password 123!', kind: 'demo' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] }); await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Modifier rehearsal' }); await post(owner, '/api/campaigns/enter', { id });
    const state = async () => (await owner.request.get(base + `/api/campaign-world/${id}/world`)).json();
    const initial = await state(), site = initial.combat.sites.find(s => s.kind === 'modifier'); expect(site).toBeTruthy();
    await post(owner, '/api/campaigns/leave', {});
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      // Isolate terrain/conquest visuals; domain checks cover guards and calls.
      for (const s of saved.sites) { s.guardsRemaining = 0; s.nextCall = 1e9; }
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'modifier-tank', owner: initial.me.id, occupant: initial.me.id, health: 200, hurt: 0,
        x: site.x + 1.5, y: site.y - 6.5, podX: 40, podY: 40, elapsed: 99, angle: Math.PI, turret: Math.PI, weapon: 'HE', secondary: 'APCR' };
      db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
    } finally { db.close(); }
    await post(owner, '/api/campaigns/enter', { id });
    const page = await owner.newPage(), peer = await guest.newPage(), errors = [];
    for (const p of [page, peer]) {
      p.on('pageerror', e => errors.push(e.message));
      await p.addInitScript(() => { const Original = window.EventSource; window.EventSource = class extends Original { constructor(...args) { super(...args); this.addEventListener('message', e => { try { window.lastBattle = JSON.parse(e.data); } catch {} }); } }; });
    }
    await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    const invite = await post(owner, '/api/campaigns/invite', { id }), admitted = await post(guest, '/api/campaigns/join', { code: invite.code });
    await peer.goto(base + admitted.next); await expect(peer.locator('#connection')).toContainText('live'); await page.bringToFront();
    await page.getByRole('button', { name: 'Locate environment modifier' }).click();
    await expect(page.locator('#combat-status')).toContainText('environment modifier');
    await page.screenshot({ path: info.outputPath('modifier-alive.png') });
    const terrain = (await state()).world.terrain;
    const box = await page.locator('#world-canvas').boundingBox(), target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (mobile) await page.touchscreen.tap(target.x, target.y); else await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(1200);
    for (let i = 0; i < 9 && (await state()).combat.sites.find(s => s.kind === 'modifier').state !== 'conquered'; i++) {
      if (mobile) await page.locator('#fire-button').click(); else await page.mouse.click(target.x, target.y);
      await page.waitForTimeout(850);
    }
    await expect(page.locator('#combat-status')).toContainText('Blight cleared');
    await expect.poll(() => peer.evaluate(() => window.lastBattle?.combat.sites.find(s => s.kind === 'modifier').state)).toBe('conquered');
    await expect(page.locator('#objective-health')).toContainText('Natural terrain restored', { timeout: 8000 });
    await page.screenshot({ path: info.outputPath('modifier-restored.png') });
    const completed = (await state()).combat.sites.find(s => s.kind === 'modifier').conqueredAt;
    expect((await state()).world.terrain).toEqual(terrain);
    expect(logs.some(e => e.event === 'objective.conquered' && e.targetId === site.id && e.saved)).toBe(true);
    await post(owner, '/api/campaigns/leave', {});
    await expect(page).toHaveURL(/\/campaigns\//); await expect(peer).toHaveURL(/\/campaigns\//);
    await Promise.all([page.goto('about:blank'), peer.goto('about:blank')]); await app.close();
    app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
    await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    await post(owner, '/api/campaigns/enter', { id }); await page.goto(base + '/?campaign=' + id);
    await expect(page.locator('#connection')).toContainText('live');
    await page.getByRole('button', { name: 'Locate environment modifier' }).click();
    await expect(page.locator('#objective-health')).toContainText('Natural terrain restored');
    expect((await state()).combat.sites.filter(s => s.kind === 'modifier' && !s.settlement)).toEqual([expect.objectContaining({ hp: 0, state: 'conquered', conqueredAt: completed })]);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(c => c.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-modifier-')) throw Error('Unexpected test directory');
    await rm(dir, { recursive: true, force: true });
  }
});
