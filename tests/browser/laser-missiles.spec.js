import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { missileAim, targetBox } from '../../public/missile.js';
import { aimOverview } from './aim-helper.js';

for (const mobile of [false, true]) test(`laser encounter and distant missile fire ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-laser-')), contexts = [];
  const app = createApp({ dataDir: dir, logSink: () => {} });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const guest = await browser.newContext(); contexts.push(owner, guest);
    const post = async (c, route, data) => { const r = await c.request.post(base + route, { data, headers: { Origin: base } }); expect(r.status(), await r.text()).toBeLessThan(300); return r.json(); };
    const credentials = { name: 'Laser tester', email: 'laser@frontier.test', password: 'unique laser test password 123!', kind: 'demo' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] }); await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Laser rehearsal' }); await post(owner, '/api/campaigns/enter', { id });
    const route = `/api/campaign-world/${id}`, state = async () => (await owner.request.get(base + route + '/world')).json();
    const initial = await state(), site = initial.combat.sites.find(s => s.kind === 'laser'); expect(site).toBeTruthy();
    await post(owner, '/api/campaigns/leave', {});
    const gun = { id: 'test-battery', kind: 'missile', owner: initial.me.id, x: 8, y: 74, ammo: 'HE', rotated: false, reload: 0, target: { x: 90, y: 15 }, operator: null, lease: 0 };
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      for (const s of saved.sites) { s.guardsRemaining = 0; if (s.kind !== 'laser') Object.assign(s, { hp: 0, state: 'conquered', conqueredAt: -100000 }); }
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'laser-tank', owner: initial.me.id, occupant: initial.me.id, health: 200, hurt: 0, x: site.x + 1.5, y: site.y - 5.5, podX: 40, podY: 40, elapsed: 99, angle: Math.PI, turret: Math.PI, weapon: 'HE', secondary: 'APCR' };
      db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('test-core', initial.me.id, 10, 10, 99);
      db.prepare('INSERT INTO artillery VALUES (?,?)').run(gun.id, JSON.stringify(gun));
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
    await page.getByRole('button', { name: 'Locate laser tower' }).click();
    await expect(page.locator('#combat-status')).toContainText('Lance tower');
    await expect.poll(() => peer.evaluate(() => window.lastBattle?.combat.sites.find(s => s.kind === 'laser').laser?.phase), { timeout: 12000 }).toBe('firing');
    await page.screenshot({ path: info.outputPath('laser-beam.png') });
    await expect.poll(async () => (await state()).world.tanks.find(t => t.id === 'laser-tank').health).toBeLessThan(200);
    // A moving tank must outrun the next burst in open ground, with the same
    // full-length, slowly turning beam visible to a separate player.
    const tower = async () => (await state()).combat.sites.find(s => s.kind === 'laser');
    await expect.poll(async () => (await tower()).laser.phase).toBe('cooling');
    const parked = (await state()).world.tanks.find(t => t.id === 'laser-tank');
    await expect.poll(async () => (await tower()).laser.phase, { timeout: 7000, intervals: [50] }).toBe('charging');
    await page.locator('#world-canvas').focus(); await page.keyboard.down('d');
    try {
      await expect.poll(() => peer.evaluate(() => window.lastBattle?.combat.sites.find(s => s.kind === 'laser').laser?.phase)).toBe('firing');
      await expect.poll(async () => (await state()).world.tanks.find(t => t.id === 'laser-tank').x).toBeGreaterThan(parked.x + 4);
      await expect.poll(() => peer.evaluate(() => {
        const s = window.lastBattle?.combat.sites.find(s => s.kind === 'laser'), end = s?.laser?.beam;
        return end ? Math.hypot(end.x - s.x - 1.5, end.y - s.y - 1.5) : 0;
      }), { intervals: [50] }).toBeGreaterThan(20);
      await page.screenshot({ path: info.outputPath('laser-chase-escape.png') });
      await expect.poll(async () => (await tower()).laser.phase).toBe('cooling');
    } finally { await page.keyboard.up('d'); }
    const escaped = (await state()).world.tanks.find(t => t.id === 'laser-tank');
    expect(escaped.health).toBe(parked.health); expect(escaped.x).toBeGreaterThan(parked.x + 6);
    await post(owner, route + '/tanks/exit', {});
    await post(owner, route + '/artillery/control', { id: gun.id });
    await expect(page.locator('#facility-controls')).toBeVisible();
    await aimOverview(page, gun.target.x, gun.target.y, mobile);
    await expect(page.locator('#artillery-fire')).toBeEnabled();
    await page.screenshot({ path: info.outputPath('missile-clamped-aim.png') });
    const fired = page.waitForResponse(r => r.url().endsWith('/artillery/fire') && r.request().method() === 'POST');
    await page.locator('#artillery-fire').click(); const response = await fired; expect(response.status()).toBe(200);
    const requested = response.request().postDataJSON().target;
    expect(Math.hypot(requested.x - gun.x - 2, requested.y - gun.y - 2)).toBeGreaterThan(100);
    const after = await state(), expected = targetBox(missileAim(gun, after.world, requested));
    expect(after.combat.barrages[0].box).toEqual(expected);
    await expect.poll(() => peer.evaluate(() => window.lastBattle?.combat.barrages.length)).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(c => c.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-laser-')) throw Error('Unexpected test directory');
    await rm(dir, { recursive: true, force: true });
  }
});
