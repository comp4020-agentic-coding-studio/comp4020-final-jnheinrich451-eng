import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';

for (const mobile of [false, true]) test(`mortar shared warning, dodge, hit and saved conquest ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(65000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-mortar-')), contexts = [], logs = [];
  let app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port, base = `http://127.0.0.1:${port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, reducedMotion: mobile ? 'reduce' : 'no-preference' });
    const guest = await browser.newContext(); contexts.push(owner, guest);
    const post = async (c, route, data) => { const r = await c.request.post(base + route, { data, headers: { Origin: base } }); expect(r.status()).toBeLessThan(300); return r.json(); };
    const credentials = { name: 'Mortar tester', email: 'mortar@frontier.test', password: 'unique mortar password 123!', kind: 'demo' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] }); await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Mortar rehearsal' }); await post(owner, '/api/campaigns/enter', { id });
    const state = async () => (await owner.request.get(base + `/api/campaign-world/${id}/world`)).json();
    const initial = await state(), site = initial.combat.sites.find(s => s.kind === 'mortar'); expect(site).toBeTruthy();
    await post(owner, '/api/campaigns/leave', {});
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      // Isolate artillery counterplay from melee damage; guards have simulation coverage.
      // Newer campaigns seed several mortars and settlements. Conquer every other site so O can only select this one.
      for (const s of saved.sites) { s.guardsRemaining = 0; s.nextCall = 1e9; if (s.id !== site.id) Object.assign(s, { hp: 0, state: 'conquered', conqueredAt: -100000 }); }
      saved.sites.find(s => s.id === site.id).mortar = { angle: 0, nextShot: saved.now + 3000, targetId: null, charge: null };
      // Natural raids belong to the encounter director. Push them out of reach so only the mortar threatens the tank.
      if (saved.director) Object.assign(saved.director, { nextRaid: 1e9, nextPulse: 1e9 });
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'mortar-tank', owner: initial.me.id, occupant: initial.me.id, health: 200, hurt: 0,
        x: site.x + 1.5, y: site.y - 6.5, podX: 40, podY: 40, elapsed: 99, angle: Math.PI / 2, turret: Math.PI, weapon: 'HE', secondary: 'APCR' };
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
    await peer.goto(base + admitted.next); await expect(peer.locator('#connection')).toContainText('live');
    // Named site locators are gone. O walks the hostile sites nearest first, and this mortar is the only one left hostile.
    const locateMortar = async () => {
      await page.locator('#world-canvas').focus();
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('o');
        if (await expect(page.locator('#combat-status')).toContainText('mortar outpost', { timeout: 400 }).then(() => true, () => false)) return;
      }
      await expect(page.locator('#combat-status')).toContainText('mortar outpost');
    };
    await locateMortar();
    await expect(page.locator('#combat-status')).toContainText('mortar outpost');
    await expect(page.locator('#acid-warning')).toBeVisible();
    await expect.poll(() => peer.evaluate(() => !!window.lastBattle?.combat.sites.find(s => s.kind === 'mortar')?.mortar?.charge || window.lastBattle?.combat.acidShells.length > 0)).toBe(true);
    await page.screenshot({ path: info.outputPath('mortar-warning.png') });
    await page.locator('#world-canvas').focus(); // W drives along the hull heading; the tank is seeded facing east, so holding W dodges sideways as holding D once did.
    await page.keyboard.down('w');
    try { await page.waitForTimeout(1600); } finally { await page.keyboard.up('w'); }
    await expect.poll(async () => (await state()).combat.acidShells.some(s => s.impacted), { timeout: 5000, intervals: [100] }).toBe(true);
    expect((await state()).tanks.find(t => t.id === 'mortar-tank').health).toBe(200);
    await page.screenshot({ path: info.outputPath('mortar-dodged.png') });
    await expect.poll(async () => (await state()).tanks.find(t => t.id === 'mortar-tank').health, { timeout: 12000 }).toBe(160);
    await page.screenshot({ path: info.outputPath('mortar-hit.png') });
    await locateMortar();
    const box = await page.locator('#world-canvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(1200);
    const fire = () => mobile ? page.locator('#fire-button').click() : page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 10 && (await state()).combat.sites.find(s => s.kind === 'mortar').state !== 'conquered'; i++) { await fire(); await page.waitForTimeout(850); }
    await expect(page.locator('#combat-status')).toContainText('Mortar silenced');
    await expect.poll(() => peer.evaluate(() => window.lastBattle?.combat.sites.find(s => s.kind === 'mortar').state)).toBe('conquered');
    await page.screenshot({ path: info.outputPath('mortar-conquered.png') });
    const completed = (await state()).combat.sites.find(s => s.kind === 'mortar').conqueredAt;
    await post(owner, '/api/campaigns/leave', {});
    await expect(page).toHaveURL(/\/campaigns\//); await expect(peer).toHaveURL(/\/campaigns\//);
    await Promise.all([page.goto('about:blank'), peer.goto('about:blank')]);
    await app.close();
    app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
    await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    await post(owner, '/api/campaigns/enter', { id }); await page.goto(base + '/?campaign=' + id);
    await expect(page.locator('#connection')).toContainText('live');
    expect((await state()).combat.sites.find(s => s.kind === 'mortar')).toMatchObject({ hp: 0, state: 'conquered', conqueredAt: completed });
    expect(logs.some(e => e.event === 'enemy.weapon.hit' && e.saved)).toBe(true); expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(c => c.close())); await app.close(); await rm(dir, { recursive: true, force: true }); }
});
