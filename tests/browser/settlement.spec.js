import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';

for (const mobile of [false, true]) test(`settlement shared checklist and permanent conquest ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-settlement-')), contexts = [], logs = [];
  let app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port, base = `http://127.0.0.1:${port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, reducedMotion: mobile ? 'reduce' : 'no-preference' });
    const guest = await browser.newContext(); contexts.push(owner, guest);
    const post = async (c, route, data) => { const r = await c.request.post(base + route, { data, headers: { Origin: base } }); expect(r.status()).toBeLessThan(300); return r.json(); };
    const credentials = { name: 'Settlement tester', email: 'settlement@frontier.test', password: 'unique settlement password 123!', kind: 'demo' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] }); await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Settlement rehearsal' }); await post(owner, '/api/campaigns/enter', { id });
    const state = async () => (await owner.request.get(base + `/api/campaign-world/${id}/world`)).json();
    const initial = await state(), members = initial.combat.sites.filter(s => s.settlement), group = members[0].settlement; expect(members).toHaveLength(3);
    await post(owner, '/api/campaigns/leave', {});
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      // One-hit fixtures isolate shared checklist transitions; domain tests cover full HP and defenders.
      for (const s of saved.sites) { s.guardsRemaining = 0; s.nextCall = 1e9; if(s.settlement) s.hp = 75; if(s.kind === 'mortar') s.mortar = { angle: 0, targetId: null, charge: null, nextShot: 1e9 }; }
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'settlement-tank', owner: initial.me.id, occupant: initial.me.id, health: 200, hurt: 0,
        x: group.x, y: group.y, podX: 40, podY: 40, elapsed: 99, angle: Math.PI, turret: Math.PI, weapon: 'HE', secondary: 'APCR' };
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
    if (mobile) await page.getByRole('button', { name: 'Locate alien settlement' }).tap();
    else { await page.getByRole('button', { name: 'Locate alien settlement' }).focus(); await page.keyboard.press('Enter'); }
    await expect(page.locator('#settlement-progress')).toBeVisible();
    await expect(page.locator('#settlement-progress')).toContainText('0/3');
    await page.screenshot({ path: info.outputPath('settlement-alive.png') });
    const terrain = (await state()).world.terrain;
    for (const [i, label] of ['crown', 'mortar', 'root'].entries()) {
      await page.getByRole('button', { name: 'Locate colony ' + label }).click();
      const box = await page.locator('#world-canvas').boundingBox(), target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (mobile) await page.touchscreen.tap(target.x, target.y); else await page.mouse.move(target.x, target.y);
      await page.waitForTimeout(1300);
      if (mobile) await page.locator('#fire-button').click(); else await page.mouse.click(target.x, target.y);
      await expect(page.locator('#settlement-progress')).toContainText((i + 1) + '/3');
      await expect.poll(() => peer.evaluate(() => window.lastBattle?.combat.sites.filter(s => s.settlement && s.state === 'conquered').length)).toBe(i + 1);
      if(i < 2) await expect(page.locator('#settlement-progress')).toContainText('Destroy all structures');
    }
    await expect(page.locator('#settlement-progress')).toContainText('Permanently conquered');
    await page.getByRole('button', { name: 'Locate alien settlement' }).click();
    await page.screenshot({ path: info.outputPath('settlement-conquered.png') });
    expect((await state()).world.terrain).toEqual(terrain);
    expect(logs.filter(e => e.event === 'objective.conquered' && members.some(s => s.id === e.targetId) && e.saved)).toHaveLength(3);
    await post(owner, '/api/campaigns/leave', {});
    await expect(page).toHaveURL(/\/campaigns\//); await expect(peer).toHaveURL(/\/campaigns\//);
    await Promise.all([page.goto('about:blank'), peer.goto('about:blank')]); await app.close();
    app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
    await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    await post(owner, '/api/campaigns/enter', { id }); await page.goto(base + '/?campaign=' + id);
    await expect(page.locator('#connection')).toContainText('live');
    await page.getByRole('button', { name: 'Locate alien settlement' }).click();
    await expect(page.locator('#settlement-progress')).toBeVisible();
    await expect(page.locator('#settlement-progress')).toContainText('3/3');
    await expect(page.locator('#settlement-progress')).toContainText('Permanently conquered');
    expect((await state()).combat.sites.filter(s => s.settlement && s.state === 'conquered')).toHaveLength(3);
    if (!mobile) { await page.setViewportSize({ width: 1280, height: 720 }); await expect(page.locator('#settlement-progress')).toBeVisible(); }
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(c => c.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-settlement-')) throw Error('Unexpected test directory');
    await rm(dir, { recursive: true, force: true });
  }
});
