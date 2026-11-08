import { expect, it } from 'vitest';
import { mkdtemp, rm, readdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.js';
import { cinemaPosition, environmentAt } from '../public/colony-ambience.js';
import { STRUGGLE, fishGenome, simulateStruggle } from '../public/colony-fish.js';

const route = (id: string, action = 'world') => `/api/campaign-world/${id}/${action}`;
async function fixture(run: (h: any) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-runtime-'));
  const logs: any[] = [], controllers: AbortController[] = [];
  let app: ReturnType<typeof createApp>, base = '';
  const start = async () => {
    app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(app.server.address() as any).port}`;
  };
  await start();
  const client = () => {
    const cookies = new Map<string, string>();
    const ownStreams: AbortController[] = [];
    return {
      disconnect: () => ownStreams.splice(0).forEach(controller => controller.abort()),
      request: async (pathname: string, data?: any, headers: Record<string, string> = {}) => {
        const response = await fetch(base + pathname, { method: data === undefined ? 'GET' : 'POST',
          headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), Origin: base, 'Content-Type': 'application/json', ...headers },
          body: data === undefined ? undefined : JSON.stringify(data) });
        for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], split = pair.indexOf('='); cookies.set(pair.slice(0, split), pair.slice(split + 1)); }
        return { status: response.status, data: await response.json() };
      },
      connect: async (id: string) => {
        const controller = new AbortController(); controllers.push(controller); ownStreams.push(controller);
        const response = await fetch(base + route(id, 'events'), { headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') }, signal: controller.signal });
        expect(response.status).toBe(200);
        const packets: any[] = [];
        void (async () => {
          let buffer = '';
          try {
            for await (const chunk of response.body as any) {
              buffer += new TextDecoder().decode(chunk);
              let at;
              while ((at = buffer.indexOf('\n\n')) >= 0) {
                const event = buffer.slice(0, at); buffer = buffer.slice(at + 2);
                const data = event.split('\n').find(line => line.startsWith('data: '));
                if (data && !event.startsWith('event:')) packets.push(JSON.parse(data.slice(6)));
              }
            }
          } catch { /* isolated stream closes */ }
        })();
        return { controller, packets };
      },
    };
  };
  const account = async (name: string) => {
    const user = client(), credentials = { kind: 'demo', name, email: `${name}@frontier.test`, password: 'a peaceful expedition password 123!' };
    expect((await user.request('/api/auth/register', credentials)).status).toBe(200);
    const inbox = (await user.request('/api/auth/inbox')).data;
    expect((await user.request('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] })).status).toBe(200);
    expect((await user.request('/api/auth/login', credentials)).status).toBe(200);
    return user;
  };
  const create = async (owner: any, name = 'Quiet morning', template = 'caldera-v1') => {
    const saved = await owner.request('/api/campaigns/create', { name, template, mode: 'colonization' });
    expect(saved.status, JSON.stringify(saved.data)).toBe(200);
    const entered = await owner.request('/api/campaigns/enter', { id: saved.data.id });
    expect(entered.data.next).toBe('/colony/?campaign=' + saved.data.id);
    // The admission names the garden's light for the menu's descent, and nothing else about the save.
    expect(Object.keys(entered.data.light).sort()).toEqual(['cloud', 'daylight', 'rain', 'warmth']);
    for (const value of Object.values(entered.data.light)) expect(value).toBeGreaterThanOrEqual(0);
    await owner.connect(saved.data.id);
    return saved.data.id;
  };
  const updateSaved = (id: string, change: (state: any) => void) => {
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'colony.sqlite'));
    try { const state = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='colony-v1'").get()!.value as string); change(state); db.prepare("UPDATE meta SET value=? WHERE key='colony-v1'").run(JSON.stringify(state)); }
    finally { db.close(); }
  };
  const restart = async () => {
    controllers.splice(0).forEach(c => c.abort()); await app.close(); await start();
  };
  try { await run({ account, create, client, restart, updateSaved, dir, logs }); }
  finally {
    controllers.forEach(c => c.abort()); await app!.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-runtime-')) throw Error('Unsafe fixture path');
    await rm(dir, { recursive: true, force: true });
  }
}

it('backs up industry lazily, resolves co-op cargo races and resumes durable jobs without offline production', async () => fixture(async h => {
  const owner = await h.account('wheat'), friend = await h.account('barley');
  const id = await h.create(owner), state = async () => (await owner.request(route(id))).data.colony;
  const order = (user: any, data: any) => user.request(route(id, 'colony'), { requestId: randomUUID(), ...data });
  const backupPath = path.join(h.dir, 'campaigns', id, 'colony-before-industry-v1.sqlite');
  expect((await order(owner, { action: 'build-industry', kind: 'generator', x: 36, y: 31 })).status).toBe(409);
  expect(await readdir(path.dirname(backupPath))).not.toContain(path.basename(backupPath));
  expect(await state()).not.toHaveProperty('industry');
  await owner.request('/api/campaigns/leave', {});
  h.updateSaved(id, (s: any) => { s.storage.sundrop = 5; });
  await owner.request('/api/campaigns/enter', { id }); await owner.connect(id);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await friend.request('/api/campaigns/join', { code }); const peer = await friend.connect(id);
  const build = { action: 'build-industry', kind: 'processor', x: 30, y: 30, requestId: randomUUID() };
  const created = await order(owner, build); expect(created.status).toBe(200);
  expect((await order(owner, build)).data.replayed).toBe(true);
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  try {
    const saved = JSON.parse(backup.prepare("SELECT value FROM meta WHERE key='colony-v1'").get()!.value as string);
    expect(saved).not.toHaveProperty('industry'); expect(saved.storage.sundrop).toBe(5); expect(saved.materials).toBe(40);
    expect(backup.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
  } finally { backup.close(); }
  const processorId = created.data.targetId;
  expect((await order(owner, { action: 'industry-load', machineId: processorId, revision: 0, item: 'sundrop', amount: 2 })).status).toBe(200);
  const unload = { action: 'industry-unload', machineId: processorId, revision: 1 };
  const races = await Promise.all([owner, friend].map(user => order(user, unload)));
  expect(races.map(result => result.status).sort()).toEqual([200, 409]);
  expect((await state()).storage.sundrop).toBe(5);
  const generator = await order(owner, { action: 'build-industry', kind: 'generator', x: 34, y: 30 }); expect(generator.status).toBe(200);
  expect((await order(owner, { action: 'industry-load', machineId: generator.data.targetId, revision: 0, item: 'sundrop' })).status).toBe(200);
  expect((await order(owner, { action: 'industry-load', machineId: processorId, revision: 2, item: 'sundrop', amount: 2 })).status).toBe(200);
  await expect.poll(() => peer.packets.at(-1)?.colony.industry.machines.find((m: any) => m.id === processorId).job?.elapsed || 0).toBeGreaterThan(.2);
  await friend.request('/api/campaigns/leave', {});
  await owner.request('/api/campaigns/pause', { id, paused: true });
  const paused = await state();
  await new Promise(resolve => setTimeout(resolve, 350));
  expect((await state()).industry).toEqual(paused.industry);
  await owner.request('/api/campaigns/leave', {}); await h.restart();
  await owner.request('/api/campaigns/enter', { id });
  expect((await state()).industry).toEqual(paused.industry);
  await owner.connect(id);
  expect((await order(owner, build)).data.replayed).toBe(true);
  expect((await state()).industry.machines).toHaveLength(2);
  // The processor's OUT sides are free, so the finished batch goes straight to the shared reserve.
  await expect.poll(async () => (await state()).industry.storage.provisions || 0, { timeout: 15000, interval: 200 }).toBe(2);
  const completed = (await state()).industry.machines.find((m: any) => m.id === processorId);
  const recover = { action: 'industry-unload', machineId: processorId, revision: completed.revision, requestId: randomUUID() };
  expect((await order(owner, recover)).status).toBe(200); expect((await order(owner, recover)).data.replayed).toBe(true);
  expect((await state()).industry.storage).toEqual({ provisions: 2, biomass: 1 });
  const ship = { action: 'ship-provisions', requestId: randomUUID() };
  expect((await order(owner, ship)).status).toBe(200);
  await owner.request('/api/campaigns/leave', {}); await h.restart();
  await owner.request('/api/campaigns/enter', { id }); await owner.connect(id);
  expect((await order(owner, ship)).data.replayed).toBe(true);
  await expect.poll(async () => (await state()).shipments, { timeout: 11000, interval: 200 }).toBe(1);
  // The reward lands as six crates beside the pad; materials rise only when they are collected.
  const delivered = await state(); expect(delivered.materials).toBe(12); expect(delivered.crates.reduce((total: number, crate: any) => total + crate.materials, 0)).toBe(24);
  expect((await order(owner, ship)).data.replayed).toBe(true);
  expect((await state()).industry.storage.provisions).toBe(0);
}), 40000);

it('refuses industry mutation when its old-garden backup is invalid and preserves a valid backup on a restored save', async () => fixture(async h => {
  const owner = await h.account('millet'), id = await h.create(owner);
  const backupPath = path.join(h.dir, 'campaigns', id, 'colony-before-industry-v1.sqlite');
  const state = async () => (await owner.request(route(id))).data.colony;
  const build = () => owner.request(route(id, 'colony'), { action: 'build-industry', kind: 'generator', x: 30, y: 30, requestId: randomUUID() });
  // Simulate an interrupted old backup in this disposable fixture only.
  await writeFile(backupPath, '');
  expect((await build()).status).toBe(500);
  expect(await state()).not.toHaveProperty('industry'); expect((await state()).materials).toBe(40);
  await unlink(backupPath);
  expect((await build()).status).toBe(200);
  const originalBackup = await readFile(backupPath);
  await owner.request('/api/campaigns/leave', {});
  h.updateSaved(id, (s: any) => { delete s.industry; s.materials = 40; });
  await owner.request('/api/campaigns/enter', { id }); await owner.connect(id);
  expect((await build()).status).toBe(200);
  expect(await readFile(backupPath)).toEqual(originalBackup);
  expect((await state()).industry.machines).toHaveLength(1);
}), 15000);

it('shares a peaceful garden, awards one concurrent harvest and retains a shipment and request receipt across restart', async () => fixture(async h => {
  const owner = await h.account('aster'), friend = await h.account('clover');
  const id = await h.create(owner), state = async () => (await owner.request(route(id))).data;
  expect(await readdir(path.join(h.dir, 'campaigns', id))).not.toContain('world.sqlite');
  const initial = await state();
  expect(initial).toMatchObject({ mode: 'colonization', room: { mode: 'colonization', paused: false }, colony: { materials: 40 } });
  expect(initial.combat).toBeUndefined(); expect(initial.logistics).toBeUndefined();
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  expect((await friend.request('/api/campaigns/join', { code })).data.next).toContain('/colony/');
  const peer = await friend.connect(id);
  const build = { action: 'build-bed', x: 32, y: 32, requestId: randomUUID() };
  const first = await owner.request(route(id, 'colony'), build); expect(first.status).toBe(200);
  const bedId = first.data.targetId;
  expect((await owner.request(route(id, 'colony'), build)).data.replayed).toBe(true);
  expect((await owner.request(route(id, 'colony'), { ...build, x: 20 })).status).toBe(409);
  const plant = { action: 'plant', bedId, crop: 'sundrop', requestId: randomUUID() };
  expect((await friend.request(route(id, 'colony'), plant)).status).toBe(200);
  expect((await owner.request(route(id, 'colony'), { action: 'water', bedId, requestId: randomUUID() })).status).toBe(200);
  await expect.poll(() => peer.packets.at(-1)?.colony.beds[0]?.water).toBeGreaterThan(80);
  expect((await state()).colony.beds).toHaveLength(1);
  await owner.request('/api/campaigns/leave', {});
  // Seed only elapsed growth in a CLOSED disposable save; no public time shortcut.
  h.updateSaved(id, (s: any) => { s.beds[0].growth = 45; });
  await owner.request('/api/campaigns/enter', { id }); await owner.connect(id);
  await friend.request('/api/campaigns/enter', { id }); await friend.connect(id);
  const harvests = await Promise.all([owner, friend].map(user => user.request(route(id, 'colony'), { action: 'harvest', bedId, requestId: randomUUID() })));
  expect(harvests.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await state()).colony.storage.sundrop).toBe(2);
  const ship = { action: 'ship', requestId: randomUUID() };
  expect((await owner.request(route(id, 'colony'), ship)).status).toBe(200);
  const accepted = (await state()).colony.shipment;
  await owner.request('/api/campaigns/leave', {}); await h.restart();
  await owner.request('/api/campaigns/enter', { id });
  const beforeConnect = await state();
  expect(beforeConnect.colony.shipment.id).toBe(accepted.id);
  expect(beforeConnect.colony.shipments).toBe(0);
  await owner.connect(id);
  expect((await owner.request(route(id, 'colony'), ship)).data.replayed).toBe(true);
  await expect.poll(async () => (await state()).colony.shipments, { timeout: 20000, interval: 200 }).toBe(1);
  expect((await state()).colony).toMatchObject({ materials: 40, storage: { sundrop: 0 }, shipment: null, decorations: { pennant: true } });
  expect((await state()).colony.crates.reduce((total: number, crate: any) => total + crate.materials, 0)).toBe(16);
  expect((await owner.request(route(id, 'colony'), ship)).data.replayed).toBe(true);
  expect((await state()).colony.shipments).toBe(1);
  expect(h.logs.some((e: any) => e.event === 'colony.order' && e.command === 'harvest')).toBe(true);
}), 25000);

it('rejects cross-mode, cross-room and cross-origin orders and freezes growth when its owner disconnects', async () => fixture(async h => {
  const owner = await h.account('fern'), stranger = await h.account('reed');
  const id = await h.create(owner, 'Fern garden', 'sirocco-v1'), state = async () => (await owner.request(route(id))).data;
  const peerRoom = await h.create(stranger, 'Reed garden', 'vesper-v1');
  expect((await stranger.request(route(id))).status).toBe(403);
  for (const action of ['fire', 'orbital/strike', 'tanks', 'frenzy/test']) expect((await owner.request(route(id, action), {})).status).toBe(404);
  expect((await owner.request(route(id, 'colony'), { action: 'build-bed', x: 32, y: 32, requestId: randomUUID() }, { Origin: 'https://unrelated.example' })).status).toBe(403);
  expect((await owner.request(route(id, 'colony'), { action: 'build-bed', x: 32, y: 32, requestId: '' })).status).toBe(400);
  expect((await state()).colony.beds).toHaveLength(0);
  expect((await stranger.request(route(peerRoom))).data.world.template).toBe('vesper-v1');
  await owner.request('/api/campaigns/pause', { id, paused: true });
  const paused = await state();
  expect(paused.room.paused).toBe(true);
  expect((await owner.request(route(id, 'colony'), { action: 'build-bed', x: 32, y: 32, requestId: randomUUID() })).status).toBe(409);
  const peerTime = (await stranger.request(route(peerRoom))).data.colony.time;
  await expect.poll(async () => (await stranger.request(route(peerRoom))).data.colony.time).toBeGreaterThan(peerTime + .3);
  expect((await state()).colony.time).toBe(paused.colony.time);
  await owner.request('/api/campaigns/pause', { id, paused: false });
  await expect.poll(async () => (await state()).colony.time).toBeGreaterThan(paused.colony.time);
  const guest = h.client();
  await guest.request('/api/auth/guest', { name: 'Little leaf' });
  const invite = (await owner.request('/api/campaigns/invite', { id })).data.code;
  expect((await guest.request('/api/campaigns/join', { code: invite })).status).toBe(200);
  const guestStream = await guest.connect(id);
  owner.disconnect();
  await expect.poll(() => guestStream.packets.at(-1)?.room.paused).toBe(true);
  const disconnected = await state(), secondRoomTime = (await stranger.request(route(peerRoom))).data.colony.time;
  await expect.poll(async () => (await stranger.request(route(peerRoom))).data.colony.time).toBeGreaterThan(secondRoomTime + .5);
  expect((await state()).colony.time).toBe(disconnected.colony.time);
  expect((await guest.request(route(id, 'colony'), { action: 'build-bed', x: 32, y: 32, requestId: randomUUID() })).status).toBe(409);
  await owner.connect(id);
  await expect.poll(async () => (await state()).colony.time).toBeGreaterThan(disconnected.colony.time);
  await owner.request('/api/campaigns/leave', {});
  expect((await owner.request(route(id))).status).toBe(403);
  await owner.request('/api/campaigns/enter', { id });
  const frozen = await state(); expect(frozen.room.paused).toBe(true);
  await expect.poll(async () => (await stranger.request(route(peerRoom))).data.colony.time).toBeGreaterThan(peerTime + 1);
  expect((await state()).colony.time).toBe(frozen.colony.time);
}), 15000);

it('leases robot input, rejects stale sequences and preserves its last saved position', async () => fixture(async h => {
  const owner = await h.account('moss'), id = await h.create(owner), state = async () => (await owner.request(route(id))).data;
  const start = await state();
  expect((await owner.request(route(id, 'input'), { x: 1, y: 0, seq: 10 })).status).toBe(200);
  await expect.poll(async () => (await state()).me.x).toBeGreaterThan(start.me.x + .2);
  await owner.request(route(id, 'input'), { x: 0, y: 0, seq: 11 });
  const stopped = await state();
  await owner.request(route(id, 'input'), { x: -1, y: 0, seq: 9 });
  await expect.poll(async () => (await state()).colony.time).toBeGreaterThan(stopped.colony.time + .5);
  expect((await state()).me.x).toBe(stopped.me.x);
  await owner.request(route(id, 'input'), { x: 1, y: 0, seq: 12 });
  const sent = await state();
  await expect.poll(async () => (await state()).colony.time).toBeGreaterThan(sent.colony.time + .8);
  const expired = await state();
  await expect.poll(async () => (await state()).colony.time).toBeGreaterThan(expired.colony.time + .5);
  expect((await state()).me.x).toBe(expired.me.x);
  await owner.request('/api/campaigns/leave', {}); await h.restart();
  await owner.request('/api/campaigns/enter', { id });
  expect((await state()).me.x).toBe(expired.me.x);
}), 15000);

it('shares host atmosphere and cinema across guests, protects workers and restores the saved presentation after restart', async () => fixture(async h => {
  const owner = await h.account('amber'), friend = await h.account('lumen');
  const id = await h.create(owner, 'Camp by the garden', 'morrow-v1');
  const world = async () => (await owner.request(route(id))).data;
  const invite = (await owner.request('/api/campaigns/invite', { id })).data.code;
  expect((await friend.request('/api/campaigns/join', { code: invite })).status).toBe(200);
  const peer = await friend.connect(id);
  const order = (user: any, action: string, data: any = {}) => user.request(route(id, 'colony'), { action, ...data, requestId: randomUUID() });
  expect((await order(friend, 'set-environment', { lighting: 'night', weather: 'rain', isHost: true })).status).toBe(403);
  expect((await order(owner, 'set-environment', { lighting: 'sunset', weather: 'rain' })).status).toBe(200);
  await expect.poll(() => peer.packets.at(-1)?.colony.environment?.weather).toBe('rain');
  expect(environmentAt(peer.packets.at(-1).colony)).toMatchObject({ weather: 'rain', lightingPreset: 'sunset', rain: 1 });
  const fireRequest = { action: 'build-campfire', x: 31, y: 34, requestId: randomUUID() };
  expect((await owner.request(route(id, 'colony'), fireRequest)).status).toBe(200);
  expect((await owner.request(route(id, 'colony'), fireRequest)).data.replayed).toBe(true);
  expect((await world()).colony.decorations.items).toHaveLength(1);
  expect((await order(friend, 'build-cinema', { x: 40, y: 34 })).status).toBe(200);
  expect((await order(owner, 'cinema-play', { revision: 0 })).status).toBe(200);
  await expect.poll(async () => cinemaPosition((await world()).colony)).toBeGreaterThan(.3);
  expect((await order(friend, 'cinema-pause', { revision: 1 })).status).toBe(200);
  const paused = (await world()).colony;
  await expect.poll(async () => (await world()).colony.time).toBeGreaterThan(paused.time + .3);
  expect(cinemaPosition((await world()).colony)).toBe(cinemaPosition(paused));
  expect((await order(owner, 'cinema-restart', { revision: 1 })).status).toBe(409);
  // Existing arrival protection rejects a prop under either starting worker.
  expect((await order(owner, 'build-campfire', { x: 36, y: 31 })).status).toBe(409);
  await owner.request('/api/campaigns/leave', {}); await h.restart();
  await owner.request('/api/campaigns/enter', { id }); await owner.connect(id);
  const reopened = (await world()).colony;
  expect(reopened.environment).toEqual(paused.environment);
  expect(reopened.decorations.items).toHaveLength(2);
  expect(cinemaPosition(reopened)).toBe(cinemaPosition(paused));
  await friend.request('/api/campaigns/enter', { id });
  const late = await friend.connect(id);
  await expect.poll(() => late.packets.at(-1)?.colony.environment?.lighting).toBe('sunset');
  expect(late.packets.at(-1).colony.cinema).toEqual(reopened.cinema);
  expect((await order(friend, 'cinema-play', { revision: 2 })).status).toBe(200);
  await expect.poll(async () => cinemaPosition((await world()).colony)).toBeGreaterThan(cinemaPosition(paused) + .3);
}), 15000);

it('conditions the ground of an old save once at load, behind a backup that a second restart never rewrites', async () => fixture(async h => {
  const owner = await h.account('clover'), id = await h.create(owner);
  const state = async () => (await owner.request(route(id))).data.colony;
  const order = (data: any) => owner.request(route(id, 'colony'), { requestId: randomUUID(), ...data });
  const backupPath = path.join(h.dir, 'campaigns', id, 'colony-before-ground-v1.sqlite');
  const fresh = await state();
  expect(typeof fresh.ground?.cells).toBe('string');
  expect(await readdir(path.dirname(backupPath))).not.toContain(path.basename(backupPath));
  await owner.request('/api/campaigns/leave', {});
  // An outlying bed from before this stage sits outside the start disc; its footprint and ring must stay usable.
  h.updateSaved(id, (s: any) => { delete s.ground; s.beds.push({ id: 'bed-old', x: 48, y: 28, crop: null, growth: 0, water: 0, harvests: 0, revision: 0 }); s.nextId = 9; });
  await h.restart();
  await owner.request('/api/campaigns/enter', { id }); await owner.connect(id);
  const migrated = await state();
  expect(typeof migrated.ground?.cells).toBe('string'); expect(migrated.ground.revision).toBe(0);
  expect(migrated.beds.map((bed: any) => bed.id)).toContain('bed-old');
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  try {
    const saved = JSON.parse(backup.prepare("SELECT value FROM meta WHERE key='colony-v1'").get()!.value as string);
    expect(saved).not.toHaveProperty('ground'); expect(saved.beds.map((bed: any) => bed.id)).toContain('bed-old');
    expect(backup.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
  } finally { backup.close(); }
  expect((await order({ action: 'build-sprinkler', x: 50, y: 28 })).status).toBe(200);
  expect((await order({ action: 'build-sprinkler', x: 52, y: 28 })).data.error).toBe('Grow a crop nearby to condition this ground first.');
  const original = await readFile(backupPath);
  await owner.request('/api/campaigns/leave', {}); await h.restart();
  await owner.request('/api/campaigns/enter', { id }); await owner.connect(id);
  expect(await readFile(backupPath)).toEqual(original);
  const reopened = await state();
  expect(reopened.ground.cells).toBe(migrated.ground.cells); expect(reopened.ground.revision).toBe(0);
  expect(reopened.sprinklers).toHaveLength(1);
}), 15000);

it('replaces an unreadable pre-ground backup instead of refusing to open the expedition', async () => fixture(async h => {
  const owner = await h.account('bramble'), id = await h.create(owner);
  const dir = path.join(h.dir, 'campaigns', id), backupPath = path.join(dir, 'colony-before-ground-v1.sqlite');
  await owner.request('/api/campaigns/leave', {});
  h.updateSaved(id, (s: any) => { delete s.ground; });
  await writeFile(backupPath, 'not a database');
  await h.restart();
  expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(200);
  await owner.connect(id);
  const migrated = (await owner.request(route(id))).data.colony;
  expect(typeof migrated.ground?.cells).toBe('string');
  const files = await readdir(dir);
  expect(files.filter(name => name.startsWith('colony-before-ground-v1-invalid-'))).toHaveLength(1);
  expect(await readFile(path.join(dir, files.find(name => name.includes('-invalid-'))!), 'utf8')).toBe('not a database');
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  try {
    expect(JSON.parse(backup.prepare("SELECT value FROM meta WHERE key='colony-v1'").get()!.value as string)).not.toHaveProperty('ground');
    expect(backup.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
  } finally { backup.close(); }
}), 15000);

it('seats a worker on a rest pad, stands it up on movement or when the pad is stored, and keeps the seat across a restart', async () => fixture(async h => {
  const owner = await h.account('juniper'), id = await h.create(owner, 'A quiet corner', 'morrow-v1');
  let stream = await owner.connect(id);
  const world = async () => (await owner.request(route(id))).data;
  const me = () => stream.packets.at(-1)?.me;
  const order = (action: string, data: any = {}) => owner.request(route(id, 'colony'), { action, ...data, requestId: randomUUID() });
  // A walkable rest pad one tile east of the arrival tile (36.5, 31.5); the shuttle delivers and assembles it.
  expect((await order('build-furnishing', { kind: 'parking-seat', x: 37, y: 31 })).status).toBe(200);
  const pad = (await world()).colony.settlement.items[0];
  expect((await order('rest', { itemId: pad.id })).status).toBe(404);
  await expect.poll(async () => (await world()).colony.settlement.items[0].status, { timeout: 20000, interval: 250 }).toBe('ready');
  const before = (await world()).colony;
  const seated = await order('rest', { itemId: pad.id });
  expect(seated.status).toBe(200); expect(seated.data.message).toBe('Taking a seat.');
  await expect.poll(() => me()?.activity?.kind).toBe('sit');
  expect(me()).toMatchObject({ x: 37.5, y: 31.5, activity: { kind: 'sit', itemId: pad.id } });
  expect(me().activity).not.toHaveProperty('from');
  // Resting changes nothing in the shared garden.
  expect((await world()).colony.settlement.revision).toBe(before.settlement.revision);
  expect((await world()).colony.materials).toBe(before.materials);
  // Any movement stands the worker up where it came from, then walks.
  expect((await owner.request(route(id, 'input'), { x: 1, y: 0, seq: 1 })).status).toBe(200);
  await expect.poll(() => me()?.activity).toBeNull();
  await owner.request(route(id, 'input'), { x: 0, y: 0, seq: 2 });
  expect(me().x).toBeGreaterThanOrEqual(36.5); expect(me().x).toBeLessThan(37.5);
  // Storing the pad under a seated worker ends the rest on the next tick.
  expect((await order('rest', { itemId: pad.id })).status).toBe(200);
  await expect.poll(() => me()?.activity?.kind).toBe('sit');
  await expect.poll(async () => (await world()).colony.settlement.deliveries.length, { timeout: 15000, interval: 250 }).toBe(0);
  const current = (await world()).colony.settlement.items[0];
  expect((await order('furnishing-store', { itemId: current.id, revision: current.revision })).status).toBe(200);
  await expect.poll(() => me()?.activity).toBeNull();
  expect((await order('furnishing-retrieve', { kind: 'parking-seat', x: 37, y: 31 })).status).toBe(200);
  await expect.poll(async () => (await world()).colony.settlement.items[0]?.status, { timeout: 20000, interval: 250 }).toBe('ready');
  const again = (await world()).colony.settlement.items[0];
  expect((await order('rest', { itemId: again.id })).status).toBe(200);
  await expect.poll(() => me()?.activity?.kind).toBe('sit');
  // The seat is part of the worker's own record, so it survives leaving and a restart.
  await owner.request('/api/campaigns/leave', {}); await h.restart();
  await owner.request('/api/campaigns/enter', { id }); stream = await owner.connect(id);
  await expect.poll(() => me()?.activity?.kind).toBe('sit');
  expect(me()).toMatchObject({ x: 37.5, y: 31.5 });
  expect((await order('stand')).data.message).toBe('Back to the garden.');
  await expect.poll(() => me()?.activity).toBeNull();
}), 60000);

it('adopts the companion, has it follow the connected worker, feeds it a catch and keeps it across a restart', async () => fixture(async h => {
  const owner = await h.account('wren'), id = await h.create(owner, 'A companion', 'morrow-v1');
  let stream = await owner.connect(id);
  const world = async () => (await owner.request(route(id))).data;
  const me = () => stream.packets.at(-1)?.me;
  const order = (action: string, data: any = {}) => owner.request(route(id, 'colony'), { action, ...data, requestId: randomUUID() });
  const adopted = await order('adopt-pet');
  expect(adopted.status).toBe(200); expect(adopted.data.message).toContain('scuttles down');
  expect((await order('adopt-pet')).status).toBe(409);
  const start = (await world()).colony.pet;
  expect(start).toMatchObject({ name: 'Spider', pets: 0, fed: 0 });
  // The worker stands at the arrival tile; the spider walks over from the pad on its own.
  await expect.poll(async () => { const w = (await world()).colony; return Math.hypot(w.pet.x - me().x, w.pet.y - me().y); }, { timeout: 10000, interval: 200 }).toBeLessThan(2.4);
  await expect.poll(() => stream.packets.at(-1)?.colony.pet.moving).toBe(false);
  // Petting from reach purrs; with a fish in the creel it feeds.
  expect((await order('pet-pet')).data.fed).toBe(false);
  const pond = { kind: 'pond', x: 39, y: 33, dir: 0 };
  const placed = await order('build-furnishing', pond);
  expect([placed.status, placed.data.message]).toEqual([200, expect.any(String)]);
  expect((await order('fish')).status).toBe(409); // too far from the pond and no lake in reach
  await expect.poll(async () => (await world()).colony.settlement.items[0].status, { timeout: 20000, interval: 250 }).toBe('ready');
  // Two diagonal steps bring the worker against the pond's north-west corner, within casting reach.
  expect((await owner.request(route(id, 'input'), { x: 1, y: 1, seq: 1 })).status).toBe(200);
  await expect.poll(() => me().x, { timeout: 5000 }).toBeGreaterThan(37.4);
  await owner.request(route(id, 'input'), { x: 1, y: 1, seq: 2 });
  await expect.poll(() => me().x, { timeout: 5000 }).toBeGreaterThan(38.4);
  await owner.request(route(id, 'input'), { x: 0, y: 0, seq: 3 });
  expect((await order('fish')).status).toBe(200);
  // Each bite is hooked with E; the angler records a fight and the server replays it. This simple
  // angler loses the odd hard fish, which simply recasts, so it tries a few bites.
  let caught: any = null, genome: any = null;
  for (let attempt = 0; attempt < 4 && !caught?.data.landed; attempt++) {
    await expect.poll(() => me()?.activity?.bite, { timeout: 14000, interval: 100 }).toBe(true);
    const hooked = await order('reel');
    expect(hooked.status).toBe(200); expect(hooked.data.fight.seed).toMatch(new RegExp(`^${me().id}:\\d+$`));
    genome = fishGenome(hooked.data.fight.seed, 'morrow-v1');
    const toggles: number[] = [];
    let held = false, played: any = null;
    for (let t = 0; t <= STRUGGLE.limit && !played?.done; t += 1 / 30) {
      played = simulateStruggle(genome.seed, genome.difficulty, toggles, t);
      const want = played.fish > played.y + played.size * .5 + (played.v > 0 ? .06 : -.02);
      if (!played.done && want !== held) { toggles.push(Math.round(t * 1000) / 1000); held = want; }
    }
    // The room clock has to cover the recording before the server accepts it.
    await new Promise(resolve => setTimeout(resolve, played.t * 1000 + 300));
    caught = await order('land', { toggles, until: played.t });
    expect(caught.status).toBe(200); expect(caught.data.landed).toBe(played.done === 'landed');
  }
  expect(caught.data.landed).toBe(true);
  expect(caught.data.fish).toMatchObject({ name: genome.name, length: genome.length });
  expect((await world()).colony.fishing).toMatchObject({ treats: 1 });
  await owner.request(route(id, 'input'), { x: -1, y: 0, seq: 4 });
  await expect.poll(() => me()?.activity).toBeNull();
  await owner.request(route(id, 'input'), { x: 0, y: 0, seq: 5 });
  await expect.poll(async () => { const w = (await world()).colony; return Math.hypot(w.pet.x - me().x, w.pet.y - me().y); }, { timeout: 10000, interval: 200 }).toBeLessThan(1.6);
  expect((await order('pet-pet')).data.fed).toBe(true);
  expect((await world()).colony).toMatchObject({ fishing: { treats: 0 }, pet: { fed: 1, pets: 2, friend: me().id } });
  await owner.request('/api/campaigns/leave', {}); await h.restart();
  await owner.request('/api/campaigns/enter', { id }); stream = await owner.connect(id);
  expect((await world()).colony.pet).toMatchObject({ fed: 1, pets: 2 });
  expect((await world()).colony.fishing.catches).toHaveLength(1);
}), 90000);
