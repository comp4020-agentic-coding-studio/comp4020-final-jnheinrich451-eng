import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';

for (const mobile of [false, true]) test(`scanner lock, shared report and escape ${mobile ? 'phone reduced effects' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-scanner-')), contexts = [], logs = [];
  const app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, reducedMotion: mobile ? 'reduce' : 'no-preference' });
    const guest = await browser.newContext(); contexts.push(owner, guest);
    const post = async (c, route, data) => { const res = await c.request.post(base + route, { data, headers: { Origin: base } }); expect(res.status()).toBeLessThan(300); return res.json(); };
    const credentials = { name: 'Sensor tester', email: 'sensor@frontier.test', password: 'unique scanner password 123!', kind: 'demo' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] }); await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Sensor rehearsal' }); await post(owner, '/api/campaigns/enter', { id });
    const state = async () => (await owner.request.get(base + `/api/campaign-world/${id}/world`)).json();
    const initial = await state(), site = initial.combat.sites[0];
    await post(owner, '/api/campaigns/leave', {});
    // Isolated fixture: clear terrain and a ready tank. Leave calls disabled here
    // to measure sensor escape independently of damage/respawn; conquest tests fight.
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2);
      for (let x = site.x + 3; x <= site.x + 18; x++) world.terrain[(site.y - 2) * world.width + x] = 3;
      db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      saved.sites[0].guardsRemaining = 0; saved.sites[0].nextCall = 1e9;
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'sensor-tank', owner: initial.me.id, occupant: initial.me.id, health: 180, hurt: 0,
        x: site.x + 1.5, y: site.y - 6.5, podX: 40, podY: 40, elapsed: 99, angle: 0, turret: 0, weapon: 'HE', secondary: 'APCR' };
      db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
    } finally { db.close(); }
    await post(owner, '/api/campaigns/enter', { id });
    const page = await owner.newPage(), peer = await guest.newPage(), errors = [];
    for (const p of [page, peer]) {
      p.on('pageerror', e => errors.push(e.message));
      await p.addInitScript(() => {
        const Original = window.EventSource;
        window.EventSource = class extends Original {
          constructor(...args) { super(...args); this.addEventListener('message', e => { try { window.lastBattle = JSON.parse(e.data); } catch {} }); }
        };
      });
    }
    await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    const invite = await post(owner, '/api/campaigns/invite', { id }), admitted = await post(guest, '/api/campaigns/join', { code: invite.code });
    await peer.goto(base + admitted.next); await expect(peer.locator('#connection')).toContainText('live');
    await page.getByRole('button', { name: 'Locate alert station' }).click();
    await expect(page.locator('#detection-status')).toBeVisible();
    await expect(page.locator('#detection-status')).toContainText('DETECTED');
    await expect.poll(() => peer.evaluate(() => window.lastBattle?.combat.sites[0].sensor.mode)).toBe('tracking');
    expect(await peer.evaluate(() => window.lastBattle.combat.sites[0].sensor.targetId)).toBe(initial.me.id);
    await expect(peer.locator('#detection-status')).toBeHidden(); // Orbital camera is not a target.
    await page.screenshot({ path: info.outputPath('scanner-tracking.png') });
    // Drive east behind the rock ridge, then continue beyond search radius.
    await page.locator('#world-canvas').focus(); await page.keyboard.down('d');
    try { await expect(page.locator('#detection-status')).toContainText('CONTACT LOST'); await page.waitForTimeout(6500); }
    finally { await page.keyboard.up('d'); }
    await page.screenshot({ path: info.outputPath('scanner-escape.png') });
    await expect(page.locator('#detection-status')).toBeHidden({ timeout: 12000 });
    await expect.poll(() => peer.evaluate(() => window.lastBattle?.combat.sites[0].sensor.mode)).toBe('search');
    expect(logs.some(e => e.event === 'sensor.changed' && e.cause === 'tracking' && e.saved)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(c => c.close())); await app.close(); await rm(dir, { recursive: true, force: true }); }
});
