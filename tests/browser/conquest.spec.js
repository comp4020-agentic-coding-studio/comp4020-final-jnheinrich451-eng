import { test, expect } from '@playwright/test';
import { leaveClosedRoom } from './room-helper.js';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { groupKey } from '../../public/encounter-director.js';

for (const mobile of [false, true]) test(`shared alert station, HE conquest and saved ruin ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-conquest-ui-')); let app = createApp({ dataDir: dir });
  const contexts = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); const port = app.server.address().port, base = `http://127.0.0.1:${port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile }); contexts.push(owner);
    const guest = await browser.newContext(); contexts.push(guest);
    const post = async (c, route, data) => { const res = await c.request.post(base + route, { data, headers: { Origin: base } }); expect(res.status()).toBeLessThan(300); return res.json(); };
    const credentials = { name: 'Crown hunter', email: 'hunter@frontier.test', password: 'a unique conquest password 123!', kind: 'demo' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] }); await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Crown assault' }); await post(owner, '/api/campaigns/enter', { id });
    const state = async c => (await c.request.get(base + `/api/campaign-world/${id}/world`)).json();
    const initial = await state(owner), site = initial.combat.sites[0]; expect(site).toBeTruthy();
    await post(owner, '/api/campaigns/leave', {});
    // Isolate shared structure damage/persistence from defender balance. Keep full
    // station HP and use real input/fire; AI resistance has separate domain coverage.
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      for (const s of saved.sites) { s.guardsRemaining = 0; s.pending = null; s.nextCall = 1e9; }
      saved.enemies = []; saved.director.sleeping = []; saved.director.nextRaid = 1e9;
      saved.director.groups = Object.fromEntries(saved.sites.map(s => [groupKey(s), { next: 1e9, wave: 0 }]));
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'test-tank', owner: initial.me.id, occupant: initial.me.id, health: 180, hurt: 0,
        x: site.x - 4, y: site.y + 1.5, podX: site.x - 8, podY: site.y + 8, elapsed: 20, angle: Math.PI / 2, turret: Math.PI / 2, weapon: 'HE', secondary: 'APCR' };
      db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
    } finally { db.close(); }
    await post(owner, '/api/campaigns/enter', { id });
    const page = await owner.newPage(), peer = await guest.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); peer.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    const invite = await post(owner, '/api/campaigns/invite', { id }); const admitted = await post(guest, '/api/campaigns/join', { code: invite.code });
    await peer.goto(base + admitted.next); await expect(peer.locator('#connection')).toContainText('live');
    await page.locator('#hud-menu-button').click().then(()=>page.getByRole('button', { name: 'Locate alert station' }).click());
    await expect(page.locator('#combat-status')).toContainText('alert station');
    await page.screenshot({ path: info.outputPath('station-alarm.png') });
    const canvas = page.locator('#world-canvas'), box = await canvas.boundingBox();
    const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (mobile) await page.touchscreen.tap(target.x, target.y); else await page.mouse.move(target.x, target.y);
    await expect.poll(async () => (await state(owner)).me.turret).toBeCloseTo(Math.PI / 2, 1);
    // Desktop uses LMB; phone uses the existing cannon button.
    const fire = () => mobile ? page.locator('#fire-button').tap() : page.mouse.click(target.x, target.y);
    await fire();
    await expect.poll(async () => (await state(owner)).combat.sites[0].hp).toBeLessThan(site.hp);
    const damaged = (await state(owner)).combat.sites[0].hp;
    await expect.poll(async () => (await state(guest)).combat.sites[0].hp).toBe(damaged);
    await page.screenshot({ path: info.outputPath('station-damaged.png') });
    for (let i = 0; i < 8 && (await state(owner)).combat.sites[0].state !== 'conquered'; i++) {
      const before = (await state(owner)).combat.sites[0].hp;
      await page.waitForTimeout(750); await fire();
      await expect.poll(async () => (await state(owner)).combat.sites[0].hp).toBeLessThan(before);
    }
    await expect.poll(async () => (await state(owner)).combat.sites[0].state).toBe('conquered');
    await expect.poll(async () => (await state(guest)).combat.sites[0].state).toBe('conquered');
    await expect(page.locator('#combat-status')).toContainText('Region conquered');
    await page.screenshot({ path: info.outputPath('station-conquered.png') });
    const completedAt = (await state(owner)).combat.sites[0].conqueredAt;
    await post(owner, '/api/campaigns/leave', {}); await leaveClosedRoom(page, peer);
    await Promise.all([page.goto('about:blank'), peer.goto('about:blank')]);
    await app.close(); app = createApp({ dataDir: dir }); await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    await post(owner, '/api/campaigns/enter', { id }); await page.goto(base + '/?campaign=' + id);
    await expect(page.locator('#connection')).toContainText('live');
    expect((await state(owner)).combat.sites[0]).toMatchObject({ state: 'conquered', hp: 0, conqueredAt: completedAt });
    expect((await readdir(path.join(dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith('before-conquest-'))).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(c => c.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-conquest-ui-')) throw Error('Unexpected test directory');
    await rm(dir, { recursive: true, force: true });
  }
});
