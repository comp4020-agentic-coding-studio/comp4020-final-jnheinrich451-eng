import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.js';
import { corePlacementError } from '../public/core.js';
import { createPlanet } from '../public/planet-templates.js';
import { makeSite } from '../public/conquest.js';

const worldRoute = (id: string) => `/api/campaign-world/${id}/world`;
const readMeta = (db: DatabaseSync, key: string) => JSON.parse(db.prepare('SELECT value FROM meta WHERE key=?').get(key)!.value as string);
const writeMeta = (db: DatabaseSync, key: string, value: unknown) => db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));

async function fixture(run: (h: any) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-landing-layout-'));
  let app = createApp({ dataDir: dir, logSink: () => {} }), base = '';
  const streams: AbortController[] = [];
  async function listen() {
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(app.server.address() as any).port}`;
  }
  function client() {
    const cookies = new Map<string, string>();
    const header = () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    return { header, async request(route: string, data?: unknown) {
      const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST',
        headers: { Cookie: header(),
          ...(data === undefined ? {} : { Origin: base, 'Content-Type': 'application/json' }) },
        body: data === undefined ? undefined : JSON.stringify(data) });
      for (const raw of response.headers.getSetCookie()) {
        const [key, value] = raw.split(';')[0].split('=');
        if (value) cookies.set(key, value); else cookies.delete(key);
      }
      const result = await response.json();
      expect(response.ok, JSON.stringify(result)).toBe(true);
      return result;
    } };
  }
  const database = (id: string, work: (db: DatabaseSync) => any) => {
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try { return work(db); } finally { db.close(); }
  };
  async function connect(c: any, id: string) {
    const controller = new AbortController(); streams.push(controller);
    const response = await fetch(`${base}/api/campaign-world/${id}/events`, { headers: { Cookie: c.header() }, signal: controller.signal });
    expect(response.ok).toBe(true);
    void (async () => { try { for await (const chunk of response.body as any) { void chunk; } } catch { /* fixture closes the stream */ } })();
  }
  async function restart() { streams.splice(0).forEach(s => s.abort()); await app.close(); app = createApp({ dataDir: dir, logSink: () => {} }); await listen(); }
  try {
    await listen();
    const owner = client(), credentials = { name: 'Landing planner', kind: 'demo', email: 'landing-layout@frontier.test', password: 'isolated landing layout password 123!' };
    await owner.request('/api/auth/register', credentials);
    const mail = await owner.request('/api/auth/inbox');
    await owner.request('/api/auth/verify', { token: mail.messages[0].href.split('#token=')[1] });
    await owner.request('/api/auth/login', credentials);
    await run({ owner, client, database, restart, connect });
  } finally {
    streams.forEach(s => s.abort());
    await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-landing-layout-')) throw Error('Unexpected fixture path');
    await rm(dir, { recursive: true, force: true });
  }
}

it.each(['caldera-v1', 'vesper-v1', 'sirocco-v1'])('saves four shared clear landing choices and dense objective membership on new %s campaigns', async template => fixture(async h => {
  const { owner } = h;
  const { id } = await owner.request('/api/campaigns/create', { name: 'Four footholds', template });
  await owner.request('/api/campaigns/enter', { id });
  await h.connect(owner, id);
  const first = await owner.request(worldRoute(id));
  expect(first.me.body).toBe('orbital'); expect(first.cores).toEqual([]);
  expect(first.world.frontierLayout).toMatchObject({ version: 1 });
  expect(first.world.landingZones).toHaveLength(4);
  expect(new Set(first.world.landingZones.map((z: any) => z.id)).size).toBe(4);
  const world = { ...first.world, sites: first.combat.sites, cores: first.cores, tanks: first.tanks, ships: first.ships,
    airbases: first.airbases, artillery: first.artillery, rails: first.rails, logistics: first.logistics };
  for (const zone of first.world.landingZones) {
    expect(Number.isInteger(zone.x) && Number.isInteger(zone.y)).toBe(true);
    expect(corePlacementError(world, first.buildings, [], zone.x, zone.y, first.me.id)).toBeNull();
    for (const site of first.combat.sites) expect(Math.hypot(site.x - zone.x, site.y - zone.y)).toBeGreaterThanOrEqual(zone.radius + 30);
  }
  const manifest = h.database(id, (db: DatabaseSync) => readMeta(db, 'frontier-layout-v1'));
  expect(manifest.groups.length).toBeGreaterThan(24);
  const siteIds = new Set(first.combat.sites.map((s: any) => s.id));
  for (const group of manifest.groups) {
    expect(group.requiredIds.length).toBeGreaterThanOrEqual(3);
    for (const memberId of group.requiredIds) expect(siteIds.has(memberId)).toBe(true);
  }
  if (template === 'vesper-v1') expect(first.combat.sites.some((s: any) => s.kind === 'aquatic-hive')).toBe(true);
  const peer = h.client(), invite = await owner.request('/api/campaigns/invite', { id });
  await peer.request('/api/campaigns/join', { code: invite.code });
  expect((await peer.request(worldRoute(id))).world.landingZones).toEqual(first.world.landingZones);
  // Orbital readers do not reserve a choice or create a ground object.
  expect((await owner.request(worldRoute(id))).cores).toEqual([]);
  await owner.request('/api/campaigns/leave', {});
  let savedSites: any;
  h.database(id, (db: DatabaseSync) => {
    const saved = readMeta(db, 'combat-checkpoint-v1');
    Object.assign(saved.sites[0], { hp: 0, state: 'conquered', conqueredAt: 20, guardsRemaining: 0, guardRoster: [], pending: null });
    saved.sites[1].hp = 37; savedSites = structuredClone(saved.sites);
    writeMeta(db, 'combat-checkpoint-v1', saved);
  });
  await h.restart(); await owner.request('/api/campaigns/enter', { id });
  const after = await owner.request(worldRoute(id));
  expect(after.world.terrain).toEqual(first.world.terrain);
  expect(after.world.mountains).toEqual(first.world.mountains);
  expect(after.world.waterKinds).toEqual(first.world.waterKinds);
  expect(after.world.landingZones).toEqual(first.world.landingZones);
  expect(after.combat.sites).toEqual(savedSites);
  expect(h.database(id, (db: DatabaseSync) => readMeta(db, 'frontier-layout-v1'))).toEqual(manifest);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    // The new layout manifest is authoritative if compatibility markers go
    // missing: reopening must restore markers, not add a second city layout.
    db.prepare("DELETE FROM meta WHERE key IN ('seeded-fronts-v1','seeded-fronts-v2')").run();
  });
  await h.restart(); await owner.request('/api/campaigns/enter', { id });
  const repaired = await owner.request(worldRoute(id));
  expect(repaired.combat.sites).toEqual(savedSites);
  expect(repaired.world.terrain).toEqual(first.world.terrain);
  expect(repaired.world.landingZones).toEqual(first.world.landingZones);
  h.database(id, (db: DatabaseSync) => {
    expect(readMeta(db, 'frontier-layout-v1')).toEqual(manifest);
    expect(readMeta(db, 'seeded-fronts-v1')).toEqual(manifest);
    expect(readMeta(db, 'seeded-fronts-v2').supersededBy).toBe('frontier-layout-v1');
  });
}), 20000);

it('leaves an existing campaign without landing metadata unchanged on reopening', async () => fixture(async h => {
  const { owner } = h, { id } = await owner.request('/api/campaigns/create', { name: 'Existing Caldera' });
  await owner.request('/api/campaigns/enter', { id }); await owner.request(worldRoute(id));
  await owner.request('/api/campaigns/leave', {});
  const oldWorld: any = createPlanet('caldera-v1'); oldWorld.terrain[100 * oldWorld.width + 200] = 4;
  const oldSites = [{ ...makeSite('modifier', 'legacy-ruin', 200, 110), state: 'conquered', hp: 0, conqueredAt: 1234 },
    { ...makeSite('alert', 'legacy-crown', 200, 60), hp: 217 }];
  h.database(id, (db: DatabaseSync) => {
    // Model a saved pre-layout campaign with completed old migration markers.
    writeMeta(db, 'world', oldWorld); db.prepare("DELETE FROM meta WHERE key='frontier-layout-v1'").run();
    const saved = readMeta(db, 'combat-checkpoint-v1'); saved.sites = oldSites;
    saved.planetConquest = { version: 1, requiredIds: oldSites.map(s => s.id), announced: false };
    writeMeta(db, 'combat-checkpoint-v1', saved);
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('legacy-foundation', 24, 18, 'legacy-owner', 'saved');
  });
  for (let run = 0; run < 2; run++) {
    await h.restart(); await owner.request('/api/campaigns/enter', { id });
    const after = await owner.request(worldRoute(id));
    expect(after.world.landingZones).toBeUndefined(); expect(after.world.frontierLayout).toBeUndefined();
    expect(after.world.terrain).toEqual(oldWorld.terrain); expect(after.combat.sites).toEqual(oldSites);
    expect(after.buildings).toContainEqual(expect.objectContaining({ id: 'legacy-foundation', x: 24, y: 18 }));
    expect(h.database(id, (db: DatabaseSync) => db.prepare("SELECT value FROM meta WHERE key='frontier-layout-v1'").get())).toBeUndefined();
    await owner.request('/api/campaigns/leave', {});
  }
}), 20000);
