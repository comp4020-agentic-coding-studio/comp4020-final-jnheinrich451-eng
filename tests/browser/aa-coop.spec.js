import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { freshLife } from '../../public/survival.js';
import { newAerialEnemy } from '../../public/aerial-enemy.js';
import { newGroundEnemy } from '../../public/enemy-profiles.js';
import { groupKey } from '../../public/encounter-director.js';

test('two players share air-only sentry combat, moving AA fire and reconnect without replay', async ({ browser }, info) => {
  test.setTimeout(90000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-aa-coop-'));
  const logs = [], contexts = [], errors = [];
  const stagingAbort = new AbortController();
  let app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
  const report = { scope: 'Automated local two-browser named-campaign combat rehearsal; staged initial terrain/contacts, normal unit HP/damage. Not human playtesting, natural spawn cadence or Fly capacity evidence.' };
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port, base = `http://127.0.0.1:${port}`;
    const context = async mobile => {
      const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
      contexts.push(c);
      await c.addInitScript(() => {
        const Native = window.EventSource;
        window.coopFrames = []; window.coopRaf = [];
        let last = 0;
        const frame = time => { if (last) window.coopRaf.push(time - last); last = time; if (window.coopRaf.length > 1800) window.coopRaf.shift(); requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
        window.EventSource = class extends Native {
          constructor(...args) {
            super(...args);
            this.addEventListener('message', event => {
              const s = JSON.parse(event.data);
              if (!s.combat) return;
              window.coopFrames.push({ at: Date.now(), revision: s.revision, time: s.combat.time, players: s.room?.players,
                roomState: s.room?.state, buildings: (s.buildings || []).map(b => ({ id: b.id, kind: b.kind, weapon: b.weapon })),
                enemies: s.combat.enemies.map(e => ({ id: e.id, kind: e.kind, hp: e.hp, attack: e.attack })),
                shots: s.combat.shots.map(p => ({ id: p.id, owner: p.owner, mount: p.mount, barrel: p.barrel, at: p.at, domain: p.domain })),
                aerial: (s.combat.aerialShots || []).map(p => ({ id: p.id, impacted: p.impacted })),
                tanks: s.tanks.map(t => ({ id: t.id, x: t.x, y: t.y, health: t.health })),
                remains: (s.logistics?.crates || []).filter(r => r.kind === 'remains').map(r => ({ id: r.id, amount: r.amount })) });
              if (window.coopFrames.length > 500) window.coopFrames.shift();
            });
          }
        };
      });
      return c;
    };
    const owner = await context(false), peer = await context(true);
    const post = async (c, route, data = {}) => {
      const response = await c.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.status(), await response.text()).toBeLessThan(300); return response.json();
    };
    for (const [c, name] of [[owner, 'AA commander'], [peer, 'AA driver']]) {
      const credentials = { name, email: name.replaceAll(' ', '-').toLowerCase() + '@frontier.test', password: 'isolated aa cooperative rehearsal 123!', kind: 'demo' };
      await post(c, '/api/auth/register', credentials);
      const inbox = await (await c.request.get(base + '/api/auth/inbox')).json();
      await post(c, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
      await post(c, '/api/auth/login', credentials);
    }
    const { id } = await post(owner, '/api/campaigns/create', { name: 'AA cooperative combat' });
    await post(owner, '/api/campaigns/enter', { id });
    const route = `/api/campaign-world/${id}`, read = async c => (await c.request.get(base + route + '/world')).json();
    // Invitation creation requires a connected owner. A temporary real SSE
    // stream avoids loading the menu during disposable-save preparation.
    const cookie = (await owner.cookies(base)).map(c => c.name + '=' + c.value).join('; ');
    const stagingStream = await fetch(base + route + '/events', { headers: { Cookie: cookie }, signal: stagingAbort.signal });
    expect(stagingStream.status).toBe(200);
    const hostId = (await read(owner)).me.id, { code } = await post(owner, '/api/campaigns/invite', { id });
    await post(peer, '/api/campaigns/join', { code });
    const peerId = (await read(peer)).me.id;
    expect(peerId).not.toBe(hostId);
    await post(peer, '/api/campaigns/leave'); await post(owner, '/api/campaigns/leave'); stagingAbort.abort();

    // Only this disposable save is staged. Real deployment, combat, movement,
    // snapshots, persistence and lifecycle then run through production code.
    const savePath = path.join(dir, 'campaigns', id, 'world.sqlite');
    const db = new DatabaseSync(savePath);
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); world.waterKinds?.fill(0); world.mountains?.fill(0);
      db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      const source = saved.sites[0];
      for (const site of saved.sites) {
        site.guardsRemaining = 0; site.pending = null; site.nextCall = 1e9;
        if (site !== source) { site.state = 'conquered'; site.hp = 0; site.conqueredAt = saved.now; }
      }
      source.x = world.width - 30; source.y = world.height - 30;
      saved.director.nextRaid = 1e9; saved.director.sleeping = [];
      saved.director.groups = Object.fromEntries(saved.sites.map(s => [groupKey(s), { next: 1e9, wave: 0 }]));
      saved.enemies = [[24.5, 20.5], [30.5, 16.5], [36.5, 17.5], [42.5, 20.5]].map(([x, y], i) => newAerialEnemy(9001 + i, { x, y }, { now: saved.now }));
      saved.enemies.push(newGroundEnemy('hunter', 9010, { x: 17.5, y: 46.5 }), newGroundEnemy('hunter', 9011, { x: 46.5, y: 49.5 }));
      saved.serial = 9011;
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'coop-aa-tank', kind: 'aa', owner: peerId, occupant: peerId, health: 200, hurt: 0,
        x: 32.5, y: 33.5, podX: 28, podY: 36, elapsed: 20, angle: 0, turret: 0, weapon: 'AA35', secondary: 'APCR' };
      db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
      for (const [pilot, x, y] of [[hostId, 38.5, 38.5], [peerId, tank.x, tank.y]]) {
        db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(x, y, pilot);
        db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(pilot, JSON.stringify({ ...freshLife(), deployed: true, shield: 0 }));
      }
    } finally { db.close(); }
    const checkpoint = () => {
      const saved = new DatabaseSync(savePath, { readOnly: true });
      try { return JSON.parse(saved.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value); }
      finally { saved.close(); }
    };
    const open = async c => {
      const page = await c.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live'); return page;
    };
    await post(owner, '/api/campaigns/enter', { id }); let host = await open(owner);
    await post(peer, '/api/campaigns/enter', { id }); let driver = await open(peer);
    await expect.poll(async () => (await read(owner)).room.players).toBe(2);
    await expect(driver.locator('#aa-loadout')).toBeVisible();
    await expect.poll(() => Object.values(checkpoint().director.pressure?.islands || {}).some(p => p.active === 2 && p.multiplier === 1.7)).toBe(true);
    report.pressureMultiplier = 1.7;

    // The desktop commander actually selects and deploys the new catalogue card.
    await host.locator('#build-mode').click();
    await expect(host.locator('#aa-sentry-card')).toBeVisible();
    await host.screenshot({ path: info.outputPath('aa-sentry-catalogue-desktop.png') });
    await host.locator('#aa-sentry-card').click();
    await expect(host.locator('#site-title')).toContainText('AA sentry');
    await host.locator('#coordinate-details summary').click();
    await host.locator('#tile-x').fill('32'); await host.locator('#tile-y').fill('30');
    await host.locator('#select-tile').click(); await expect(host.locator('#place-building')).toBeEnabled();
    await host.screenshot({ path: info.outputPath('aa-sentry-placement-desktop.png') });
    const clickedAt = Date.now(); await host.locator('#place-building').click();
    await expect.poll(async () => (await read(owner)).buildings.some(b => b.kind === 'aa-sentry')).toBe(true);
    const sentry = (await read(owner)).buildings.find(b => b.kind === 'aa-sentry');
    await Promise.all([host, driver].map(page => page.waitForFunction(id => window.coopFrames.some(f => f.buildings.some(b => b.id === id && b.kind === 'aa-sentry')), sentry.id)));
    report.buildClickToPeerSnapshotMs = await driver.evaluate(({ id, clickedAt }) => window.coopFrames.find(f => f.buildings.some(b => b.id === id)).at - clickedAt, { id: sentry.id, clickedAt });
    // Successful placement already closes the deployment panel.
    await expect(host.locator('#site-title')).not.toBeVisible();
    expect((await read(owner)).combat.enemies.filter(e => [9010, 9011].includes(e.id)).map(e => e.hp)).toEqual([60, 60]);

    // Touch-held fire on the phone and forward input move/fire concurrently.
    await driver.locator('#hud-menu-button').click().then(()=>driver.locator('#center').click());
    await driver.locator('#hud-menu-button').click().then(()=>driver.locator('#zoom-out').click());
    let target;
    await expect.poll(async () => {
      const state = await read(peer);
      target = state.combat.enemies.find(e => e.kind === 'skimmer' && e.hp > 0 && Math.hypot(e.x - state.me.x, e.y - state.me.y) < 15);
      return !!target;
    }).toBe(true);
    const state = await read(peer), bounds = await driver.locator('#world-canvas').boundingBox();
    const zoom = Number((await driver.locator('#zoom-label').textContent()).replace('%', '')) / 100;
    const pixel = { x: bounds.x + bounds.width / 2 + (target.x - state.me.x) * 48 * zoom, y: bounds.y + bounds.height / 2 + (target.y - state.me.y) * 48 * zoom };
    await driver.touchscreen.tap(pixel.x, pixel.y);
    await expect.poll(async () => (await read(peer)).tanks.find(t => t.id === 'coop-aa-tank').aaAim?.domain).toBe('air');
    const touch = await peer.newCDPSession(driver), trigger = await driver.locator('#fire-button').boundingBox();
    const beforeMove = (await read(peer)).me;
    await driver.keyboard.down('w');
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: trigger.x + trigger.width / 2, y: trigger.y + trigger.height / 2, id: 1 }] });
    await expect.poll(() => driver.evaluate(id => new Set(window.coopFrames.flatMap(f => f.shots.filter(s => s.owner === id && s.mount === 'aa-35mm').map(s => s.id))).size, peerId)).toBeGreaterThanOrEqual(3);
    await expect.poll(async () => Math.hypot((await read(peer)).me.x - beforeMove.x, (await read(peer)).me.y - beforeMove.y)).toBeGreaterThan(.1);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await driver.keyboard.up('w');
    await expect.poll(() => host.evaluate(id => window.coopFrames.some(f => f.shots.some(s => s.owner === id && s.mount === 'aa-35mm')), peerId)).toBe(true);
    await expect.poll(() => host.evaluate(id => window.coopFrames.some(f => f.shots.some(s => s.owner === id && s.mount === 'aa-35mm')), sentry.id), { timeout: 12000 }).toBe(true);
    await expect.poll(async () => (await read(owner)).combat.enemies.filter(e => e.kind === 'skimmer' && e.hp > 0).length, { timeout: 15000 }).toBeLessThan(4);
    await expect.poll(async () => (await read(owner)).logistics.crates.filter(r => r.kind === 'remains').length).toBeGreaterThan(0);

    await host.screenshot({ path: info.outputPath('aa-coop-desktop.png') });
    await driver.screenshot({ path: info.outputPath('aa-coop-phone.png') });
    const frames = await Promise.all([host, driver].map(page => page.evaluate(() => window.coopFrames)));
    const common = frames[0].filter(a => frames[1].some(b => b.revision === a.revision && b.time === a.time));
    expect(common.length).toBeGreaterThan(2);
    for (const a of common) {
      const b = frames[1].find(b => b.revision === a.revision && b.time === a.time);
      expect(b.enemies).toEqual(a.enemies); expect(b.shots).toEqual(a.shots); expect(b.tanks).toEqual(a.tanks); expect(b.remains).toEqual(a.remains);
    }
    report.matchingSharedSnapshots = common.length;
    report.sentryShotIds = new Set(frames[0].flatMap(f => f.shots.filter(s => s.owner === sentry.id && s.mount === 'aa-35mm').map(s => s.id))).size;
    expect(frames[0].flatMap(f => f.shots.filter(s => s.owner === sentry.id)).every(s => s.domain === 'air')).toBe(true);
    report.allObservedSentryShotsAirOnly = true;
    report.groundHpBeforeManualFire = [60, 60];
    report.observedBileWarnings = new Set(frames[0].flatMap(f => f.enemies.filter(e => e.kind === 'skimmer' && e.attack).map(e => e.id))).size;
    report.observedBileProjectiles = new Set(frames[0].flatMap(f => f.aerial.map(s => s.id))).size;
    report.rafScope = 'Desktop then emulated phone requestAnimationFrame intervals in one local Chrome process, including loading and screenshot work; not physical-phone FPS or Fly server timings.';
    report.rafIntervals = await Promise.all([host, driver].map(page => page.evaluate(() => {
      const samples = window.coopRaf.slice().sort((a, b) => a - b);
      return { samples: samples.length, medianMs: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)], maxMs: samples.at(-1) };
    })));

    // Closing the non-owner tab while its trigger is held must leave no leased
    // human fire running in the still-active room, or replay on return.
    await driver.locator('#world-canvas').focus(); await driver.keyboard.down('Space');
    const startTime = (await read(owner)).combat.time;
    await expect.poll(async () => (await read(owner)).combat.shots.some(s => s.owner === peerId && s.mount === 'aa-35mm' && s.at > startTime)).toBe(true);
    const disconnectLog = logs.length;
    await driver.close();
    // Room membership keeps a reconnect grace reservation; transport loss is
    // established by its attributed disconnect, not by deleting that seat.
    await expect.poll(() => logs.slice(disconnectLog).some(e => e.event === 'participant.disconnected' && e.pilotId === peerId)).toBe(true);
    await host.waitForTimeout(550);
    const stopped = (await read(owner)).combat.time;
    await host.waitForTimeout(500);
    expect((await read(owner)).combat.shots.filter(s => s.owner === peerId && s.mount === 'aa-35mm' && s.at > stopped)).toEqual([]);
    driver = await open(peer);
    expect((await read(peer)).me.id).toBe(peerId);
    await expect.poll(async () => (await read(owner)).room.players).toBe(2);
    const reopened = (await read(owner)).combat.time; await host.waitForTimeout(550);
    expect((await read(owner)).combat.shots.filter(s => s.owner === peerId && s.mount === 'aa-35mm' && s.at > reopened)).toEqual([]);
    report.heldFireDisconnectAndReturn = 'passed';

    // Owner loss freezes the room; a real local server reopen preserves sentry
    // identity/type and accepted combat state without issuing a new build.
    await host.close(); await expect.poll(async () => (await read(peer)).room.state).toBe('reconnecting');
    const frozen = (await read(peer)).combat.time; await driver.waitForTimeout(250);
    expect((await read(peer)).combat.time).toBe(frozen);
    await driver.close(); await app.close();
    app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
    await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    await post(owner, '/api/campaigns/enter', { id }); host = await open(owner);
    await post(peer, '/api/campaigns/enter', { id }); driver = await open(peer);
    await expect.poll(async () => (await read(owner)).room.players).toBe(2);
    expect((await read(owner)).buildings.filter(b => b.id === sentry.id)).toMatchObject([{ kind: 'aa-sentry', weapon: 'AA35' }]);
    report.pauseRestartAndReturn = 'passed';
    expect(errors).toEqual([]);
    report.browserErrors = errors;
    report.loggedEnemyLaunches = logs.filter(e => e.event === 'enemy.weapon.launched' && e.weapon === 'SKIMMER').length;
    report.loggedDisconnects = logs.filter(e => e.event === 'participant.disconnected').length;
    report.validatedAt = new Date().toISOString();
    const evidence = JSON.stringify(report, null, 2);
    await writeFile(info.outputPath('aa-coop.json'), evidence);
    await info.attach('local-aa-coop-evidence', { body: evidence, contentType: 'application/json' });
  } finally {
    stagingAbort.abort();
    await Promise.all(contexts.map(c => c.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-aa-coop-')) throw Error('Unexpected fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
