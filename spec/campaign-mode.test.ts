import { expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createCampaigns } from '../campaigns/service.js';
import { COLONY_PLANETS } from '../public/colony-planets.js';

// Exercise the real registry and router with a tiny runtime: mode admission and
// registry migration must not depend on either simulation being initialized.
async function fixture(run: (h: any) => Promise<void>, oldRegistry = false) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-mode-'));
  const db = new DatabaseSync(path.join(dir, 'world.sqlite'));
  const actors: Record<string, any> = {
    owner: { id: 'owner-pilot', name: 'Aster', kind: 'demo', accountId: 'owner-account', credential: 'owner-session' },
    guest: { id: 'guest-identity', name: 'Clover', kind: 'guest', accountId: null, credential: 'guest-session' },
  };
  const oldId = '11111111-1111-4111-8111-111111111111';
  if (oldRegistry) db.exec(`
    CREATE TABLE campaigns(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, template TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE campaign_members(campaign_id TEXT NOT NULL, identity_id TEXT NOT NULL, account_id TEXT, pilot_id TEXT NOT NULL, PRIMARY KEY(campaign_id,identity_id));
    INSERT INTO campaigns VALUES ('${oldId}','owner-account','Original world','caldera-v1',1234);
    INSERT INTO campaign_members VALUES ('${oldId}','owner-pilot','owner-account','owner-pilot');
    CREATE TABLE preserved_data(value TEXT); INSERT INTO preserved_data VALUES ('keep me');
  `);
  const audit = { result() {}, emit() {}, bind() {}, actor() {}, received() {}, context() { return {}; } };
  const created: any[] = [], streams = new Set<http.ServerResponse>();
  const legacy = { db, accounts: { sessionByHash: () => true },
    identity: (req: http.IncomingMessage) => actors[String(req.headers['x-actor'] || 'owner')], validIdentity: () => true };
  const createRuntime = (_directory: string, options: any) => {
    created.push(options);
    const server = http.createServer((req, res) => {
      if (req.url === '/api/events') {
        streams.add(res); res.on('close', () => streams.delete(res));
        res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write('data: {}\n\n'); return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ mode: options.mode, room: options.roomView() }));
    });
    return { server, close: async () => { for (const res of streams) res.end(); },
      abandon() {}, endPlayerAccess() {}, checkpoint() {}, stopInputs() {}, broadcast() {} };
  };
  let service = createCampaigns({ dataDir: dir, legacy, createRuntime, audit });
  const server = http.createServer((req, res) => { void service.route(req, res, () => { res.writeHead(404); res.end(); }); });
  const controllers: AbortController[] = [];
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const request = async (action: string, data?: any, who = 'owner') => {
      const response = await fetch(base + '/api/campaigns/' + action, {
        method: data === undefined ? 'GET' : 'POST', headers: { 'x-actor': who, Origin: base, 'Content-Type': 'application/json' },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      return { status: response.status, data: await response.json() };
    };
    const connect = async (id: string, who = 'owner') => {
      const controller = new AbortController(); controllers.push(controller);
      const response = await fetch(`${base}/api/campaign-world/${id}/events`, { headers: { 'x-actor': who }, signal: controller.signal });
      expect(response.status).toBe(200);
      void (async () => { try { for await (const _chunk of response.body as any) { /* drain */ } } catch { /* fixture closes */ } })();
      return controller;
    };
    const restart = async () => {
      controllers.splice(0).forEach(c => c.abort()); await service.close();
      service = createCampaigns({ dataDir: dir, legacy, createRuntime, audit });
    };
    await run({ request, connect, restart, created, db, dir, oldId });
  } finally {
    controllers.forEach(c => c.abort()); await service.close();
    server.closeIdleConnections(); await new Promise<void>(resolve => server.close(() => resolve())); db.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-mode-')) throw Error('Unsafe test directory');
    await rm(dir, { recursive: true, force: true });
  }
}

it('backs up an old registry once and preserves combat identity and unrelated records', async () => fixture(async h => {
  expect(h.db.prepare('SELECT * FROM campaigns WHERE id=?').get(h.oldId)).toMatchObject({ name: 'Original world', mode: 'combat', created_at: 1234 });
  expect(h.db.prepare('SELECT * FROM preserved_data').get()).toMatchObject({ value: 'keep me' });
  const backups = (await readdir(path.join(h.dir, 'backups'))).filter(name => name.startsWith('before-campaign-modes-'));
  expect(backups).toHaveLength(1);
  const backup = new DatabaseSync(path.join(h.dir, 'backups', backups[0]), { readOnly: true });
  try {
    expect(backup.prepare('PRAGMA table_info(campaigns)').all().some(column => column.name === 'mode')).toBe(false);
    expect(backup.prepare('SELECT name FROM campaigns').get()!.name).toBe('Original world');
  } finally { backup.close(); }
  const entered = await h.request('enter', { id: h.oldId });
  expect(entered.data.next).toBe('/?campaign=' + h.oldId); expect(h.created[0].mode).toBe('combat');
  await h.restart();
  expect((await readdir(path.join(h.dir, 'backups'))).filter(name => name.startsWith('before-campaign-modes-'))).toEqual(backups);
  expect((await h.request('list')).data.campaigns[0].mode).toBe('combat');
}, true));

it('persists explicit peaceful mode, routes invites to it and retains the shared save limit', async () => fixture(async h => {
  for (const mode of ['peace', '', null, {}, 1]) expect((await h.request('create', { name: 'Rejected', mode })).status).toBe(400);
  const peaceful = await h.request('create', { name: 'Meadowlight', template: 'sirocco-v1', mode: 'colonization' });
  expect(peaceful.status).toBe(200);
  const id = peaceful.data.id, entered = await h.request('enter', { id });
  expect(entered.data.next).toBe('/colony/?campaign=' + id);
  expect(entered.data.room.mode).toBe('colonization'); expect(h.created[0]).toMatchObject({ mode: 'colonization', planetTemplate: 'sirocco-v1' });
  await h.connect(id);
  const code = (await h.request('invite', { id })).data.code;
  const joined = await h.request('join', { code }, 'guest');
  expect(joined.data.next).toBe('/colony/?campaign=' + id);
  expect((await h.request('list', undefined, 'guest')).data).toMatchObject({ campaigns: [], active: id, activeMode: 'colonization' });
  await h.request('leave', {}, 'guest'); await h.request('leave', {});
  const combat = await h.request('create', { name: 'Default combat' });
  expect((await h.request('enter', { id: combat.data.id })).data.next).toBe('/?campaign=' + combat.data.id);
  await h.request('leave', {});
  expect((await h.request('create', { name: 'Third', mode: 'colonization' })).status).toBe(200);
  expect((await h.request('create', { name: 'Fourth', mode: 'colonization' })).status).toBe(409);
  await h.restart();
  const listing = (await h.request('list')).data;
  expect(listing.campaigns.find((c: any) => c.id === id)).toMatchObject({ mode: 'colonization', name: 'Meadowlight', template: 'sirocco-v1' });
  expect(listing.campaigns.find((c: any) => c.id === combat.data.id).mode).toBe('combat');
  expect((await h.request('enter', { id })).data.next).toBe('/colony/?campaign=' + id);
}));

it('lists a separate colony catalog and routes every new civilian planet only to its peaceful runtime', async () => fixture(async h => {
  const list = (await h.request('list')).data;
  expect(list.planets.map((p: any) => p.id)).toEqual(['caldera-v1', 'vesper-v1', 'sirocco-v1']);
  expect(list.colonyPlanets).toEqual(COLONY_PLANETS);
  for (const planet of COLONY_PLANETS) {
    expect((await h.request('create', { name: 'Invalid combat destination', mode: 'combat', template: planet.id })).status).toBe(400);
  }
  expect((await h.request('create', { name: 'Unknown colony', mode: 'colonization', template: 'missing' })).status).toBe(400);
  for (const [i, planet] of COLONY_PLANETS.entries()) {
    // The first new colony intentionally omits template: the mode selects its default.
    const saved = await h.request('create', { name: planet.name, mode: 'colonization', ...(i ? { template: planet.id } : {}) });
    expect(saved.status).toBe(200);
    const entered = await h.request('enter', { id: saved.data.id });
    expect(entered.status).toBe(200);
    expect(entered.data.next).toBe('/colony/?campaign=' + saved.data.id);
    expect(h.created.at(-1)).toMatchObject({ mode: 'colonization', planetTemplate: planet.id });
    await h.request('leave', {});
  }
  await h.restart();
  const restored = (await h.request('list')).data.campaigns;
  expect(new Set(restored.map((c: any) => c.template))).toEqual(new Set(COLONY_PLANETS.map(p => p.id)));
  expect(restored.every((c: any) => c.mode === 'colonization')).toBe(true);
}));
