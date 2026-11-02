import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { freshLife } from '../../public/survival.js';
import { islandAt } from '../../public/island-pressure.js';
import { updatePressure } from '../../public/pressure-budget.js';
import { groupKey } from '../../public/encounter-director.js';

test('two players share a Root emergence, segmented siege and saved giant after restart', async ({ browser }, info) => {
  test.setTimeout(90000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-centipede-browser-'));
  const contexts = [], errors = [], logs = [], stagingAbort = new AbortController();
  let app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
  const report = { scope: 'Automated local two-browser test. Disposable flat terrain, source readiness and sentry placement are staged; warning, birth, movement, siege attacks, snapshots and persistence use production code and normal combat stats. Not Fly capacity or human balance evidence.' };
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port, base = `http://127.0.0.1:${port}`;
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
      contexts.push(context);
      await context.addInitScript(() => {
        const Native = window.EventSource; window.centipedeFrames = [];
        window.EventSource = class extends Native {
          constructor(...args) {
            super(...args); this.addEventListener('message', event => {
              const s = JSON.parse(event.data); if (!s.combat) return;
              window.centipedeFrames.push({ time: s.combat.time, revision: s.revision,
                warnings: s.combat.encounters?.centipedes?.warnings || [],
                enemies: s.combat.enemies.filter(e => e.kind === 'centipede').map(e => ({ id: e.id, rootId: e.rootId, hp: e.hp, x: e.x, y: e.y, body: e.body, attack: e.attack })),
                durability: s.logistics?.durability?.['sentry:centipede-target'] });
              if (window.centipedeFrames.length > 500) window.centipedeFrames.shift();
            });
          }
        };
      });
    }
    const [owner, peer] = contexts;
    const post = async (c, route, data = {}) => {
      const response = await c.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.ok(), await response.text()).toBe(true); return response.json();
    };
    for (const [c, name] of [[owner, 'Siege commander'], [peer, 'Siege observer']]) {
      const credentials = { name, email: name.replaceAll(' ', '-').toLowerCase() + '@frontier.test', password: 'isolated centipede browser password 123!', kind: 'demo' };
      await post(c, '/api/auth/register', credentials);
      const inbox = await (await c.request.get(base + '/api/auth/inbox')).json();
      await post(c, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
      await post(c, '/api/auth/login', credentials);
    }
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Shared centipede siege' });
    await post(owner, '/api/campaigns/enter', { id });
    const route = `/api/campaign-world/${id}`, read = async c => (await c.request.get(base + route + '/world')).json();
    const cookie = (await owner.cookies(base)).map(c => c.name + '=' + c.value).join('; ');
    const stream = await fetch(base + route + '/events', { headers: { Cookie: cookie }, signal: stagingAbort.signal });
    expect(stream.status).toBe(200);
    const ownerId = (await read(owner)).me.id, { code } = await post(owner, '/api/campaigns/invite', { id });
    await post(peer, '/api/campaigns/join', { code }); const peerId = (await read(peer)).me.id;
    await post(peer, '/api/campaigns/leave'); await post(owner, '/api/campaigns/leave'); stagingAbort.abort();
    const savePath = path.join(dir, 'campaigns', id, 'world.sqlite');
    const db = new DatabaseSync(savePath); let rootId;
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); world.waterKinds?.fill(0); world.mountains?.fill(0);
      db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      const root = saved.sites.find(s => s.kind === 'modifier'); expect(root).toBeTruthy(); rootId = root.id;
      root.x = 28; root.y = 18;
      for (const site of saved.sites) {
        site.guardsRemaining = 0; site.pending = null; site.nextCall = 1e9;
        if (site !== root) { site.state = 'conquered'; site.hp = 0; site.conqueredAt = saved.now; }
      }
      saved.enemies = []; saved.director.sleeping = []; saved.director.nextRaid = 1e9;
      saved.director.nextPulse = 1e9;
      saved.director.groups = Object.fromEntries(saved.sites.map(s => [groupKey(s), { next: 1e9, wave: 0 }]));
      const contacts = [{ id: ownerId, x: 35.5, y: 14.5, medium: 'ground' }, { id: peerId, x: 33.5, y: 16.5, medium: 'ground' }];
      const island = islandAt(world, root.x + 1.5, root.y + 1.5);
      updatePressure(saved.director, { ...world, sites: saved.sites }, contacts, [], saved.now, 0);
      saved.director.pressure.islands[island].credit = 2;
      saved.director.centipedes = { version: 1, roots: { [rootId]: { activeMs: 60000, cooldown: 0, giantId: null, retryAt: 0, island } }, cooldowns: {}, pending: [], serial: 0, cursor: 0, nextPulse: 0 };
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('centipede-target', 29, 5, ownerId, new Date().toISOString());
      for (const p of contacts) {
        db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(p.x, p.y, p.id);
        db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(p.id, JSON.stringify({ ...freshLife(), deployed: true, shield: 0 }));
      }
    } finally { db.close(); }
    const open = async c => {
      const page = await c.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live'); return page;
    };
    await post(owner, '/api/campaigns/enter', { id }); let host = await open(owner);
    await post(peer, '/api/campaigns/enter', { id }); let phone = await open(peer);
    const warning = await (await host.waitForFunction(() => window.centipedeFrames.find(f => f.warnings.some(w => w.kind === 'centipede'))?.warnings.find(w => w.kind === 'centipede'), null, { timeout: 10000 })).jsonValue();
    expect(warning.rootId).toBe(rootId); expect(warning.points).toHaveLength(1);
    await phone.waitForFunction(id => window.centipedeFrames.some(f => f.warnings.some(w => w.id === id)), warning.id);
    await host.screenshot({ path: info.outputPath('centipede-root-warning-desktop.png') });
    await expect.poll(async () => (await read(owner)).combat.enemies.filter(e => e.kind === 'centipede').length, { timeout: 15000 }).toBe(1);
    const giant = (await read(owner)).combat.enemies.find(e => e.kind === 'centipede');
    expect(giant.rootId).toBe(rootId); expect(giant.body).toHaveLength(8); expect(giant.hp).toBe(2400);
    await expect.poll(async () => Math.hypot((await read(owner)).combat.enemies.find(e => e.id === giant.id).x - giant.x, (await read(owner)).combat.enemies.find(e => e.id === giant.id).y - giant.y)).toBeGreaterThan(.1);
    await expect.poll(() => host.evaluate(id => window.centipedeFrames.some(f => f.enemies.some(e => e.id === id && e.attack?.targetId === 'sentry:centipede-target')), giant.id), { timeout: 15000 }).toBe(true);
    await host.screenshot({ path: info.outputPath('centipede-siege-desktop.png') });
    // Pan the emulated phone around the actual body, keeping its full six-tile
    // chain visible below the operations panel and above the combat controls.
    await phone.locator('#hud-menu-button').click().then(()=>phone.locator('#zoom-out').click());
    const state = await read(peer), creature = state.combat.enemies.find(e => e.id === giant.id), middle = creature.body[3];
    const zoom = Number((await phone.locator('#zoom-label').textContent()).replace('%', '')) / 100;
    await phone.mouse.move(170, 430); await phone.mouse.down({ button: 'middle' });
    await phone.mouse.move(170 + (state.me.x - middle.x) * 48 * zoom, 490 + (state.me.y - middle.y) * 48 * zoom, { steps: 8 });
    await phone.mouse.up({ button: 'middle' }); await phone.screenshot({ path: info.outputPath('centipede-siege-phone.png') });
    await expect.poll(async () => (await read(owner)).logistics.durability['sentry:centipede-target']?.health, { timeout: 10000 }).toBeLessThan(140);
    const frames = await Promise.all([host, phone].map(page => page.evaluate(() => window.centipedeFrames)));
    const common = frames[0].filter(a => a.enemies.length && frames[1].some(b => b.time === a.time && b.revision === a.revision));
    expect(common.length).toBeGreaterThan(2);
    for (const a of common) {
      const b = frames[1].find(b => b.time === a.time && b.revision === a.revision);
      expect(b.enemies).toEqual(a.enemies); expect(b.durability).toEqual(a.durability);
    }
    report.sharedSnapshots = common.length; report.bodySegments = 8; report.rootEmergence = 'passed'; report.facilitySiege = 'passed';
    await host.close(); await expect.poll(async () => (await read(peer)).room.state).toBe('reconnecting');
    const frozen = (await read(peer)).combat.enemies.find(e => e.id === giant.id);
    await phone.close(); await app.close();
    const frozenSave = new DatabaseSync(savePath, { readOnly: true }); let persisted;
    try { persisted = JSON.parse(frozenSave.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value).enemies.find(e => e.id === giant.id); } finally { frozenSave.close(); }
    expect(persisted.body).toEqual(frozen.body); expect(persisted.hp).toBe(frozen.hp); expect(persisted.rootId).toBe(rootId);
    app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
    await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    await post(owner, '/api/campaigns/enter', { id }); host = await open(owner);
    await post(peer, '/api/campaigns/enter', { id }); phone = await open(peer);
    const returned = (await read(owner)).combat.enemies.filter(e => e.kind === 'centipede');
    expect(returned).toHaveLength(1); expect(returned[0]).toMatchObject({ id: giant.id, rootId, hp: frozen.hp }); expect(returned[0].body).toHaveLength(8);
    expect(errors).toEqual([]); report.browserErrors = errors; report.serverRestart = 'passed'; report.validatedAt = new Date().toISOString();
    await writeFile(info.outputPath('centipede-coop.json'), JSON.stringify(report, null, 2));
  } finally {
    stagingAbort.abort(); await Promise.all(contexts.map(c => c.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-centipede-browser-')) throw Error('Unexpected fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
