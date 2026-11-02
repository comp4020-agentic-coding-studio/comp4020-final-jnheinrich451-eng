import { expect, it } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.js';
import { cinemaPosition, environmentAt } from '../public/colony-ambience.js';

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
  await expect.poll(async () => (await state()).colony.shipments, { timeout: 11000, interval: 200 }).toBe(1);
  expect((await state()).colony).toMatchObject({ materials: 56, storage: { sundrop: 0 }, shipment: null, decorations: { pennant: true } });
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
