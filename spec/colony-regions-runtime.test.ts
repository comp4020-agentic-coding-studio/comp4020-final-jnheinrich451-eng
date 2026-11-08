import { expect, it } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createColonizationRuntime } from '../colonization-runtime.js';
import { createColony, colonyAction } from '../public/colonization.js';
import { regionAction, regionDiscoveries } from '../public/colony-regions.js';

async function fixture(run: (h: any) => Promise<void>, seed?: (state: any) => any[]) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-region-runtime-'));
  const state: any = createColony('morrow-v1');
  const gardeners = seed?.(state) || [];
  const initial = new DatabaseSync(path.join(dir, 'colony.sqlite'));
  initial.exec('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE gardeners(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
  initial.prepare('INSERT INTO meta VALUES (?,?)').run('colony-v1', JSON.stringify(state));
  for (const person of gardeners) initial.prepare('INSERT INTO gardeners VALUES (?,?)').run(person.id, JSON.stringify(person));
  initial.close();
  const profiles: Record<string, any> = { owner: { id: 'owner', name: 'Aster' }, friend: { id: 'friend', name: 'Basil' } };
  let runtime: any, base = '', paused = false;
  const streams: AbortController[] = [];
  const audit = { context: () => ({}), bind() {}, result() {}, emit() {}, received() {}, broadcast() {} };
  const start = async () => {
    runtime = createColonizationRuntime(dir, { planetTemplate: 'morrow-v1', audit, campaignId: 'isolated-region-test', clientBuild: 'test',
      authorized: (req: any) => !!req.campaignIdentity, frozen: () => paused, roomView: () => ({ ownerPilot: 'owner', paused }) });
    runtime.server.prependListener('request', (req: any) => { req.campaignIdentity = profiles[req.headers['x-surveyor'] as string]; });
    await new Promise<void>(resolve => runtime.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${runtime.server.address().port}`;
  };
  const request = async (who: string, route = 'world', data?: any) => {
    const response = await fetch(`${base}/api/${route}`, { method: data === undefined ? 'GET' : 'POST', headers: { 'x-surveyor': who, Origin: base, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json() };
  };
  const open = async (who: string) => {
    const controller = new AbortController(); streams.push(controller);
    const response = await fetch(`${base}/api/events`, { headers: { 'x-surveyor': who }, signal: controller.signal });
    expect(response.status).toBe(200); const packets: any[] = [];
    void (async () => {
      let buffer = '';
      try { for await (const chunk of response.body as any) {
        buffer += new TextDecoder().decode(chunk);
        let index: number;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.slice(0, index); buffer = buffer.slice(index + 2);
          if (event.startsWith('data: ')) packets.push(JSON.parse(event.slice(6)));
        }
      } } catch { /* disposable stream closed */ }
    })();
    return packets;
  };
  const stop = async () => { streams.splice(0).forEach(controller => controller.abort()); await runtime.close(); };
  const saved = () => JSON.parse(runtime.db.prepare("SELECT value FROM meta WHERE key='colony-v1'").get().value);
  await start();
  try { await run({ dir, original: state, request, open, saved, pause: (value: boolean) => { paused = value; },
    order: (who: string, data: any) => request(who, 'colony', { requestId: randomUUID(), ...data }),
    person: (id: string) => JSON.parse(runtime.db.prepare('SELECT value FROM gardeners WHERE id=?').get(id).value),
    restart: async () => { await stop(); await start(); } }); }
  finally { await stop();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-region-runtime-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true }); }
}

it('commits travel with the player, sends region-local worlds and keeps unviewed home production running', async () => fixture(async h => {
  const owner = await h.open('owner'), peer = await h.open('friend');
  const travelOrder = { action: 'travel-region', regionId: 'home', destination: 'blossom-grove', requestId: randomUUID() };
  const result = await h.order('owner', travelOrder); expect(result.status).toBe(200);
  expect(h.person('owner')).toMatchObject({ regionId: 'blossom-grove', x: 8.5, y: 25.5 });
  await expect.poll(() => owner.at(-1)?.me.regionId).toBe('blossom-grove');
  expect(owner.some((packet: any) => packet.world?.regionId === 'blossom-grove')).toBe(true);
  const remote = (await h.request('owner')).data;
  expect(remote.world.regionId).toBe('blossom-grove'); expect(remote.colony.beds).toEqual([]);
  expect(remote.colony.exploration).not.toHaveProperty('worlds');
  expect(remote.players.map((p: any) => p.id)).toEqual(['owner']); expect(remote.crew).toHaveLength(2);
  await expect.poll(() => peer.at(-1)?.players.length).toBe(1);
  expect(peer.at(-1).players[0].id).toBe('friend'); expect(peer.at(-1).colony.regionId).toBe('home');
  expect((await h.order('owner', travelOrder)).data.replayed).toBe(true);
  expect((await h.request('owner', 'input', { x: 1, y: 0, seq: 1, regionId: 'home' })).status).toBe(409);
  expect((await h.order('owner', { action: 'build-bed', regionId: 'blossom-grove', x: 12, y: 25 })).status).toBe(409);
  expect((await h.order('owner', { action: 'travel-region', destination: 'home' })).status).toBe(409);
  const backup = new DatabaseSync(path.join(h.dir, 'colony-before-expansion-v1.sqlite'), { readOnly: true });
  try { const previous = JSON.parse(backup.prepare("SELECT value FROM meta WHERE key='colony-v1'").get()!.value as string);
    expect(previous).not.toHaveProperty('exploration'); expect(previous.world).toEqual(h.original.world);
  } finally { backup.close(); }
  expect((await h.order('friend', { action: 'travel-region', regionId: 'home', destination: 'lake-basin' })).status).toBe(200);
  await expect.poll(() => h.saved().beds[0].growth, { timeout: 5000 }).toBeGreaterThan(.5);
  expect(h.saved().world).toEqual(h.original.world);
  h.pause(true);
  const beforeRestart = (await h.request('owner')).data;
  await h.restart();
  const restored = (await h.request('owner')).data;
  expect(restored.me).toEqual(beforeRestart.me); expect(restored.world).toEqual(beforeRestart.world);
  expect(h.saved().beds[0].growth).toBeGreaterThan(.5);
  await h.open('owner'); h.pause(false);
  expect((await h.order('owner', { action: 'travel-region', regionId: 'blossom-grove', destination: 'home' })).status).toBe(200);
  const home = (await h.request('owner')).data;
  expect(home.world.terrain).toEqual(h.original.world.terrain); expect(home.colony.beds).toHaveLength(1);
}, state => {
  const actor = { id: 'owner' };
  const bed = colonyAction(state, actor, 'build-bed', { x: 31, y: 32 });
  colonyAction(state, actor, 'plant', { bedId: bed.targetId, crop: 'sundrop' });
  colonyAction(state, actor, 'water', { bedId: bed.targetId }); return [];
}), 12000);

it('awards one shared discovery under concurrent orders and preserves the receipt on restart', async () => fixture(async h => {
  await h.open('owner'); await h.open('friend');
  const point = regionDiscoveries('blossom-grove')[0];
  const request = { action: 'discover-region', regionId: 'blossom-grove', discoveryId: point.id, requestId: randomUUID() };
  const results = await Promise.all(['owner', 'friend'].map(who => h.order(who, request)));
  expect(results.map(result => result.status)).toEqual([200, 200]);
  expect(results.filter(result => result.data.reward === 3)).toHaveLength(1);
  expect(h.saved().materials).toBe(43); expect(h.saved().exploration.discoveries).toEqual([point.id]);
  expect(h.saved().settlement.stored[point.furnishing]).toBe(1);
  const receipt = await h.order('owner', request); expect(receipt.data.replayed).toBe(true);
  await h.restart(); await h.open('owner');
  expect((await h.order('owner', request)).data.replayed).toBe(true);
  expect((await h.order('owner', { ...request, requestId: randomUUID() })).data.reward).toBeUndefined();
  expect(h.saved().materials).toBe(43);
  expect(h.saved().settlement.stored[point.furnishing]).toBe(1);
}, state => {
  const owner: any = { id: 'owner', name: 'Aster', x: 36.5, y: 31.5, angle: 0, regionId: 'home' };
  regionAction(state, owner, 'travel-region', { regionId: 'home', destination: 'blossom-grove' });
  const point = regionDiscoveries('blossom-grove')[0]; owner.x = point.x; owner.y = point.y;
  return [owner, { ...owner, id: 'friend', name: 'Basil' }];
}), 10000);

it('rejects a broken expansion backup without moving the player or changing the garden', async () => fixture(async h => {
  await h.open('owner');
  const backup = path.join(h.dir, 'colony-before-expansion-v1.sqlite');
  await writeFile(backup, '');
  const command = { action: 'travel-region', destination: 'lake-basin', regionId: 'home', requestId: randomUUID() };
  expect((await h.order('owner', command)).status).toBe(500);
  expect(h.person('owner').regionId).toBe('home'); expect(h.saved()).not.toHaveProperty('exploration');
  await unlink(backup);
  expect((await h.order('owner', command)).status).toBe(200);
  const bytes = await readFile(backup);
  expect((await h.order('owner', { action: 'travel-region', destination: 'home', regionId: 'lake-basin' })).status).toBe(200);
  expect((await h.order('owner', command)).data.replayed).toBe(true);
  // Replaying the original journey acknowledges it without teleporting again.
  expect(h.person('owner').regionId).toBe('home'); expect(await readFile(backup)).toEqual(bytes);
}), 10000);
