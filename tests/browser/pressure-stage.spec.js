import { test, expect } from '@playwright/test';
import { leaveClosedRoom } from './room-helper.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { freshLife } from '../../public/survival.js';
import { islandAt } from '../../public/island-pressure.js';
import { updatePressure } from '../../public/pressure-budget.js';

test('two players receive the same roaming warning and arrivals across a battlefield reload', async ({ browser }, info) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-pressure-browser-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }), contexts = [], errors = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const owner = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const peer = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(owner, peer);
    // Observe the game's own stream without replacing its messages or controls.
    for (const context of contexts) await context.addInitScript(() => {
      const Native = window.EventSource; window.__pressureFrames = [];
      window.EventSource = class extends Native {
        constructor(url, options) {
          super(url, options);
          this.addEventListener('message', event => {
            const state = JSON.parse(event.data), site = state.combat?.sites.find(s => s.pending?.kind === 'roaming');
            window.__pressureFrames.push({ revision: state.revision, time: state.combat?.time, players: state.room?.players,
              warning: site ? { siteId: site.id, ...site.pending } : null,
              enemies: (state.combat?.enemies || []).filter(e => e.pressureKind === 'roaming').map(e => ({
                id: e.id, x: e.x, y: e.y, hp: e.hp, siteId: e.siteId, pressureIsland: e.pressureIsland,
                investigation: e.investigation, rally: e.rally })) });
            if (window.__pressureFrames.length > 150) window.__pressureFrames.shift();
          });
        }
      };
    });
    const post = async (context, route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.ok(), await response.text()).toBe(true); return response.json();
    };
    for (const [context, name] of [[owner, 'owner'], [peer, 'peer']]) {
      const credentials = { name: `Pressure ${name}`, email: `pressure-${name}@frontier.test`, kind: 'demo', password: 'isolated pressure browser password 123!' };
      await post(context, '/api/auth/register', credentials);
      const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
      await post(context, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
      await post(context, '/api/auth/login', credentials);
    }
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Shared roaming pressure', template: 'caldera-v1' });
    await post(owner, '/api/campaigns/enter', { id });
    const route = `/api/campaign-world/${id}`, read = async context => (await context.request.get(base + route + '/world')).json();
    const page = await owner.newPage(), peerPage = await peer.newPage();
    for (const target of [page, peerPage]) target.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    const invitation = await post(owner, '/api/campaigns/invite', { id });
    await post(peer, '/api/campaigns/join', { code: invitation.code });
    const initial = await read(owner), peerInitial = await read(peer);
    await post(owner, '/api/campaigns/leave', {}); await leaveClosedRoom(page); await page.goto('about:blank');

    // This disposable save retains real terrain and an existing remote source.
    // Only its initial roaming deadline is shortened; normal warning, admission,
    // spawning, movement and SSE delivery all remain production behavior.
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    let sourceId, island;
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      const contacts = [{ id: initial.me.id, x: 220.5, y: 90.5, medium: 'ground' },
        { id: peerInitial.me.id, x: 216.5, y: 94.5, medium: 'ground' }];
      island = islandAt(world, contacts[0].x, contacts[0].y);
      const source = saved.sites.find(s => s.kind !== 'aquatic-hive' && s.state === 'hostile' &&
        islandAt(world, s.x + 1.5, s.y + 1.5) === island && contacts.every(p => Math.hypot(p.x - s.x - 1.5, p.y - s.y - 1.5) > 50));
      expect(source).toBeTruthy(); sourceId = source.id;
      for (const site of saved.sites) {
        site.guardsRemaining = 0; site.pending = null;
        if (site.id !== sourceId) { site.state = 'conquered'; site.hp = 0; site.conqueredAt = saved.now; }
      }
      saved.enemies = []; saved.director.sleeping = [];
      updatePressure(saved.director, { ...world, sites: saved.sites }, contacts, [], saved.now, 0);
      saved.director.pressure.islands[island].nextRoam = 8000;
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      for (const p of contacts) {
        db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(p.x, p.y, p.id);
        db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(p.id, JSON.stringify({ ...freshLife(), deployed: true, shield: 0 }));
      }
    } finally { db.close(); }

    await post(owner, '/api/campaigns/enter', { id });
    await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    await post(peer, '/api/campaigns/enter', { id });
    await peerPage.goto(base + '/?campaign=' + id); await expect(peerPage.locator('#connection')).toContainText('live');
    for (const target of [page, peerPage]) await expect(target.locator('#world-canvas')).toBeVisible();
    const warning = await (await page.waitForFunction(() => window.__pressureFrames.find(f => f.warning && f.players === 2)?.warning,
      null, { timeout: 12000, polling: 50 })).jsonValue();
    expect(warning).toMatchObject({ siteId: sourceId, kind: 'roaming', pressureIsland: island });
    expect(warning.points.length).toBeGreaterThan(0); expect(warning.points.length).toBeLessThanOrEqual(2);
    await Promise.all([
      page.reload(),
      peerPage.waitForFunction(at => window.__pressureFrames.some(f => f.warning?.at === at), warning.at, { timeout: 5000 }),
    ]);
    await expect(page.locator('#connection')).toContainText('live');
    const continued = await (await page.waitForFunction(at => window.__pressureFrames.find(f => f.warning?.at === at)?.warning,
      warning.at, { timeout: 5000, polling: 25 })).jsonValue();
    expect(continued).toEqual(warning);
    await Promise.all([page, peerPage].map(target => target.waitForFunction(() => window.__pressureFrames.some(f => f.enemies.length > 0), null, { timeout: 7000 })));
    const [ownerFrames, peerFrames] = await Promise.all([page, peerPage].map(target => target.evaluate(() => window.__pressureFrames)));
    const shared = ownerFrames.find(a => a.enemies.length > 0 && peerFrames.some(b => b.revision === a.revision));
    expect(shared).toBeTruthy();
    const sameRevision = peerFrames.find(frame => frame.revision === shared.revision);
    expect(sameRevision.enemies).toEqual(shared.enemies); expect(sameRevision.players).toBe(2);
    for (const enemy of shared.enemies) {
      expect(enemy.siteId).toBe(sourceId); expect(enemy.pressureIsland).toBe(island);
      expect(enemy.investigation).toMatchObject(warning.focus);
    }
    const latest = await read(owner);
    expect(latest.combat.sites.find(s => s.id === sourceId).pending).toBeNull();
    expect(latest.combat.encounters.sequence).toBe(0); // This was roaming, not a manual or natural raid.
    await page.screenshot({ path: info.outputPath('shared-roaming-arrival.png') });
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(context => context.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-pressure-browser-')) throw Error('Unexpected fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
