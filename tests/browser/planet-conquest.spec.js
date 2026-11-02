import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { newGroundEnemy } from '../../public/enemy-profiles.js';
import { freshLife } from '../../public/survival.js';

for (const mobile of [false, true]) test(`planet conquest ribbon follows the shared saved result / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(45000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-planet-conquest-'));
  const contexts = [];
  let app = createApp({ dataDir: dir, logSink: () => {} });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port, base = `http://127.0.0.1:${port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    const peer = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(owner, peer);
    const post = async (client, route, data) => {
      const response = await client.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.ok(), await response.text()).toBe(true); return response.json();
    };
    const credentials = { name: 'Conquest pilot', kind: 'demo', email: 'conquest@frontier.test', password: 'isolated conquest password 123!' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Last hostile facility' });
    await post(owner, '/api/campaigns/enter', { id });
    const route = `/api/campaign-world/${id}`, read = async () => (await owner.request.get(base + route + '/world')).json();
    const initial = await read(), last = initial.combat.sites.find(site => site.kind === 'alert');
    await post(owner, '/api/campaigns/leave', {});
    // A disposable, nearly finished campaign isolates the real final-HE-shot,
    // snapshot delivery and saved-banner path. No developer world participates.
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      for (const site of saved.sites) {
        site.guardsRemaining = 0; site.pending = null; site.nextCall = 1e9;
        site.state = site.id === last.id ? 'hostile' : 'conquered'; site.hp = site.id === last.id ? 1 : 0;
        if (site.state === 'conquered') site.conqueredAt = saved.now;
      }
      saved.enemies = [newGroundEnemy('hunter', ++saved.serial, { x: last.x + 25, y: last.y + 25 })];
      saved.enemies[0].frenzyRecoveryUntil = 1e9;
      saved.director.sleeping = [{ ...newGroundEnemy('hunter', ++saved.serial, { x: 450, y: 300 }), frenzyRecoveryUntil: 1e9 }];
      saved.director.nextRaid = 1e9;
      saved.director.nextPulse = 1e9; // Isolate the final-shot UI from ordinary city arrivals.
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('victory-core', initial.me.id, 20, 20, 99);
      db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(last.x - 4, last.y + 1.5, initial.me.id);
      db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(initial.me.id, JSON.stringify({ ...freshLife(), deployed: true, shield: 0 }));
      const tank = { id: 'victory-tank', owner: initial.me.id, occupant: initial.me.id, health: 200, hurt: 0,
        x: last.x - 4, y: last.y + 1.5, podX: last.x - 8, podY: last.y + 8, elapsed: 99, angle: Math.PI / 2, turret: Math.PI / 2, weapon: 'HE', secondary: 'APCR' };
      db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
    } finally { db.close(); }
    await post(owner, '/api/campaigns/enter', { id });
    const page = await owner.newPage(), peerPage = await peer.newPage(), errors = [];
    for (const value of [page, peerPage]) value.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/?campaign=' + id);
    await expect(page.locator('#connection')).toContainText('live');
    await expect(page.locator('#planet-conquest')).toBeHidden();
    const invite = await post(owner, '/api/campaigns/invite', { id });
    const admission = await post(peer, '/api/campaigns/join', { code: invite.code });
    await peerPage.goto(base + admission.next); await expect(peerPage.locator('#connection')).toContainText('live');
    await page.bringToFront();
    await page.locator('#hud-menu-button').click(); await page.locator('#locate-station').click();
    const battlefield = await page.locator('#world-canvas').boundingBox();
    await page.mouse.move(battlefield.x + battlefield.width / 2, battlefield.y + battlefield.height / 2);
    // Firing follows the physical turret, so let the tank finish traversing.
    await expect.poll(async () => (await read()).me.turret).toBeCloseTo(Math.PI / 2, 1);
    await post(owner, route + '/fire', { x: last.x + 1.5, y: last.y + 1.5, weapon: 'HE' });
    await expect.poll(async () => (await read()).combat.conquest?.state).toBe('conquered');
    for (const value of [page, peerPage]) {
      await expect(value.locator('#planet-conquest')).toBeVisible();
      await expect(value.locator('#planet-conquest')).toContainText('CONQUERED');
      await expect(value.locator('#planet-conquest-detail')).toHaveText('2 survivors remain');
      await expect(value.locator('#start-drill')).toBeDisabled();
      await expect(value.locator('#start-drill')).toHaveText('Planet conquered');
      await expect(value.locator('#frenzy-test')).toBeHidden();
    }
    const banner = await page.locator('#planet-conquest').boundingBox(), header = await page.locator('.hud-header').boundingBox();
    expect(banner.y + banner.height).toBeLessThanOrEqual(header.y);
    expect(await page.locator('#planet-conquest').evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('planet-conquered.png') });
    await page.reload(); await expect(page.locator('#planet-conquest')).toBeVisible();
    await post(owner, '/api/campaigns/leave', {});
    await expect(page).toHaveURL(/\/campaigns\//); await expect(peerPage).toHaveURL(/\/campaigns\//);
    await Promise.all([page.goto('about:blank'), peerPage.goto('about:blank')]); await app.close();
    app = createApp({ dataDir: dir, logSink: () => {} });
    await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    await post(owner, '/api/campaigns/enter', { id }); await page.goto(base + '/?campaign=' + id);
    await expect(page.locator('#planet-conquest')).toBeVisible();
    await expect(page.locator('#planet-conquest-detail')).toHaveText('2 survivors remain');
    expect((await read()).combat.conquest).toMatchObject({ state: 'conquered', survivors: 2 });
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(context => context.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-planet-conquest-')) throw Error('Unexpected fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
