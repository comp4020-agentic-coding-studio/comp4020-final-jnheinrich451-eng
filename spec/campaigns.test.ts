import { expect, it, vi } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.js';
import { createCombat } from '../public/combat.js';
import { newAirbase } from '../public/aircraft.js';
import { resetWorld } from '../world-maintenance.js';

const password = 'a unique campaign password 123!';
const worldRoute = (id: string, action = 'world') => `/api/campaign-world/${id}/${action}`;

it.each([false, true])('saves flak consumption, aircraft loss and an offline=%s pilot together before reporting damage', async offline => fixture(async h => {
  const owner = await h.account('flak-save'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data;
  const pilot = offline ? 'offline-pilot' : initial.me.id;
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);
    world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
    if (offline) db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run('offline-token',pilot,'Disconnected',60,50,0);
    db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('flak-core',pilot,10,10,99);
    const base = newAirbase('flak-base',pilot,20,66);
    Object.assign(base.aircraft,{health:40,state:'flying',x:60,y:50,speed:6,angle:0,occupant:pilot,leftBase:true});
    db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    for(const s of saved.sites)Object.assign(s,{state:'conquered',hp:0,pending:null,conqueredAt:-100000});
    saved.enemies=[];
    saved.flakShells=[{id:++saved.serial,sourceId:'saved-aa',targetId:base.aircraft.id,x:60,y:50,fromX:60,fromY:35,at:saved.now-1000,landAt:saved.now+50,impacted:false}];
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
  });
  await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);
  await vi.waitFor(async()=>expect((await owner.request(worldRoute(id))).data.airbases[0].aircraft.state).toBe('destroyed'));
  h.database(id,(db:DatabaseSync)=>{
    const plane = JSON.parse(db.prepare('SELECT value FROM airbases WHERE id=?').get('flak-base')!.value as string).aircraft;
    const life = JSON.parse(db.prepare('SELECT value FROM robot_states WHERE scout_id=?').get(pilot)!.value as string);
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    expect(plane).toMatchObject({state:'destroyed',health:0,occupant:null});
    expect(life).toMatchObject({life:'disabled',health:0,lostVehicle:'aircraft'});
    expect(saved.flakShells[0].impacted).toBe(true);
  });
  await h.restart();await owner.request('/api/campaigns/enter',{id});
  expect((await owner.request(worldRoute(id))).data.airbases[0].aircraft).toMatchObject({state:'destroyed',health:0,occupant:null});
}),15000);

it('adds the complete settlement once and retains its partial conquest across restart', async () => fixture(async h => {
  const owner = await h.account('colony'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data;
  expect(initial.combat.sites.filter((s: any) => s.settlement)).toHaveLength(3);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    saved.sites = saved.sites.filter((s: any) => !s.settlement);
    Object.assign(saved.sites[0], { state: 'conquered', hp: 0, conqueredAt: 42 });
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    db.prepare("DELETE FROM meta WHERE key='alien-settlement-v1'").run();
  });
  await owner.request('/api/campaigns/enter', { id });
  const migrated = (await owner.request(worldRoute(id))).data;
  expect(migrated.combat.sites.filter((s: any) => s.settlement)).toHaveLength(3);
  expect(migrated.combat.sites[0]).toMatchObject({ state: 'conquered', conqueredAt: 42 });
  expect(migrated.world.terrain).toEqual(initial.world.terrain);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    Object.assign(saved.sites.find((s: any) => s.settlement), { state: 'conquered', hp: 0, conqueredAt: 50 });
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
  });
  await h.restart(); await owner.request('/api/campaigns/enter', { id });
  const members = (await owner.request(worldRoute(id))).data.combat.sites.filter((s: any) => s.settlement);
  expect(members).toHaveLength(3);
  expect(members.filter((s: any) => s.state === 'conquered')).toHaveLength(1);
  expect((await readdir(path.join(h.dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith('before-settlement-'))).toHaveLength(2);
}), 15000);

it('serializes named-room construction and boarding races, with private attributable outcome logs', async () => fixture(async h => {
  const owner = await h.account('raceowner'), friend = await h.account('racefriend'), id = await h.open(owner);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await friend.request('/api/campaigns/join', { code }); await h.connect(friend, id);
  const a = (await owner.request(worldRoute(id))).data.me.id, b = (await friend.request(worldRoute(id))).data.me.id;
  expect((await friend.request('/api/campaigns/invite', { id })).status).toBe(403);
  expect((await friend.request('/api/campaigns/revoke-invites', { id })).status).toBe(403);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);
    world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
    for (const [pilot, x, y, cy] of [[a, 22.9, 18.5, 10], [b, 24.5, 16.9, 30]]) {
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-' + pilot, pilot, 10, cy, 99);
      db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(x, y, pilot);
    }
    const tank = { id: 'shared-tank', owner: a, occupant: null, health: 180, hurt: 0, x: 24.5, y: 18.5, podX: 40, podY: 40, elapsed: 99, angle: 0, turret: 0, weapon: 'HE', secondary: 'APCR' };
    db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
  });
  await owner.request('/api/campaigns/enter', { id }); await h.connect(owner, id);
  await friend.request('/api/campaigns/enter', { id }); await h.connect(friend, id);
  const placed = await Promise.all([owner, friend].map(c => c.request(worldRoute(id, 'buildings'), { x: 30, y: 22 })));
  expect(placed.map(r => r.status).sort()).toEqual([201, 409]);
  const winner = placed.findIndex(r => r.status === 201), building = placed[winner].data.building;
  expect((await [owner, friend][1 - winner].request(worldRoute(id, 'dismantle'), { id: building.id })).status).toBe(403);
  const boards = await Promise.all([owner, friend].map(c => c.request(worldRoute(id, 'tanks/board'), { id: 'shared-tank' })));
  expect(boards.map(r => r.status).sort()).toEqual([200, 409]);
  const states = await Promise.all([owner, friend].map(c => c.request(worldRoute(id))));
  expect(states[0].data.tanks).toEqual(states[1].data.tanks);
  expect(states[0].data.buildings).toEqual(states[1].data.buildings);
  expect(states[0].data.tanks[0].occupant).toBe([a, b][boards.findIndex(r => r.status === 200)]);
  await expect.poll(() => h.logs.filter((e: any) => e.action === 'tanks/board').length).toBe(2);
  const outcomes = h.logs.filter((e: any) => e.action === 'tanks/board');
  expect(new Set(outcomes.map((e: any) => e.actorId))).toEqual(new Set([a, b]));
  expect(outcomes.every((e: any) => e.campaignId === id && e.requestId && e.targetId === 'shared-tank')).toBe(true);
  expect(outcomes.map((e: any) => e.outcome).sort()).toEqual(['accepted', 'denied']);
  expect(h.logs.some((e: any) => e.action === 'auth/login' && e.reason === 'session_established' && e.actorId === a)).toBe(true);
  const serialized = JSON.stringify(h.logs);
  for (const secret of [password, code, code.replaceAll('-', ''), 'raceowner@frontier.test', ...owner.cookies.values(), ...friend.cookies.values()]) expect(serialized).not.toContain(secret);
}), 20000);
async function fixture(run: (h: any) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-campaigns-'));
  const logs: any[] = [];
  const logSink = (line: string) => logs.push(JSON.parse(line));
  let app = createApp({ dataDir: dir, logSink }), base = '';
  const streams: AbortController[] = [];
  async function listen() { await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(app.server.address() as any).port}`; }
  function client() {
    const cookies = new Map<string, string>();
    const header = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    return { cookies, header, async request(route: string, data?: any, withOrigin = true) {
      const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST', headers: { Cookie: header(), ...(data === undefined ? {} : { 'Content-Type': 'application/json', ...(withOrigin ? { Origin: base } : {}) }) }, body: data === undefined ? undefined : JSON.stringify(data) });
      for (const raw of response.headers.getSetCookie()) { const [key, value] = raw.split(';')[0].split('='); if (value) cookies.set(key, value); else cookies.delete(key); }
      return { status: response.status, data: await response.json() };
    } };
  }
  async function account(name: string) {
    const c = client(), credentials = { name, email: `${name}@frontier.test`, password, kind: 'demo' };
    expect((await c.request('/api/auth/register', credentials)).status).toBe(200);
    const mail = await c.request('/api/auth/inbox');
    expect((await c.request('/api/auth/verify', { token: mail.data.messages[0].href.split('#token=')[1] })).status).toBe(200);
    expect((await c.request('/api/auth/login', credentials)).status).toBe(200); return c;
  }
  async function connect(c: any, id: string) {
    const controller = new AbortController(); streams.push(controller);
    const response = await fetch(base + worldRoute(id, 'events'), { headers: { Cookie: c.header() }, signal: controller.signal });
    expect(response.status).toBe(200); let output = '';
    void (async () => { try { for await (const chunk of response.body as any) output += new TextDecoder().decode(chunk); } catch { /* closed */ } })();
    return { abort: () => controller.abort(), output: () => output };
  }
  async function open(c: any, name = 'Operation Caldera') {
    const created = await c.request('/api/campaigns/create', { name }); expect(created.status).toBe(200);
    const id = created.data.id; expect((await c.request('/api/campaigns/enter', { id })).status).toBe(200);
    await connect(c, id); return id;
  }
  const database = (id: string | null, fn: (db: DatabaseSync) => any) => {
    const db = new DatabaseSync(id ? path.join(dir, 'campaigns', id, 'world.sqlite') : path.join(dir, 'world.sqlite'));
    try { return fn(db); } finally { db.close(); }
  };
  async function restart(reset = false) { streams.splice(0).forEach(s => s.abort()); await app.close(); if (reset) await resetWorld(dir); app = createApp({ dataDir: dir, logSink }); await listen(); }
  try { await listen(); await run({ logs, client, account, connect, open, database, restart, dir, base: () => base, server: () => app.server }); }
  finally { vi.restoreAllMocks(); streams.forEach(s => s.abort()); await app.close(); await rm(dir, { recursive: true, force: true }); }
}

it('adds conquest to a pre-stage campaign once, backing up and preserving occupied terrain', async () => fixture(async h => {
  const owner = await h.account('migration'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data, oldSite = initial.combat.sites[0];
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    delete saved.sites;
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('existing-sentry', oldSite.x, oldSite.y, initial.me.id, Date.now());
  });
  expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(200);
  const migrated = (await owner.request(worldRoute(id))).data;
  expect(migrated.combat.sites).toHaveLength(1);
  expect(migrated.combat.sites[0]).not.toMatchObject({ x: oldSite.x, y: oldSite.y });
  expect(migrated.buildings.some((b: any) => b.id === 'existing-sentry')).toBe(true);
  expect(migrated.world.terrain).toEqual(initial.world.terrain);
  await h.restart(); await owner.request('/api/campaigns/enter', { id });
  expect((await owner.request(worldRoute(id))).data.combat.sites).toEqual(migrated.combat.sites);
  expect((await readdir(path.join(h.dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith('before-conquest-'))).toHaveLength(2);
}), 15000);

it.each(['mortar', 'modifier', 'contaminator', 'laser', 'anti-air'])('adds a %s once with a backup, preserving conquered sites and player construction across restart', async kind => fixture(async h => {
  const marker = kind === 'anti-air' ? 'anti-air-v1' : kind === 'laser' ? 'laser-tower-v1' : kind === 'contaminator' ? 'air-contaminator-v1' : kind === 'mortar' ? 'mortar-outpost-v1' : 'environment-modifier-v1';
  const owner = await h.account('outpost'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data;
  expect(initial.combat.sites.some((s: any) => s.kind === kind && !s.settlement)).toBe(true);
  await owner.request('/api/campaigns/leave', {});
  let oldSite: any;
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    saved.sites = saved.sites.filter((s: any) => s.kind !== kind || s.settlement);
    // Rehearse older migrations against a save from before the later fog stage.
    if (kind !== 'anti-air') {
      saved.sites = saved.sites.filter((s: any) => s.kind !== 'anti-air');
      db.prepare("DELETE FROM meta WHERE key='anti-air-v1'").run();
    }
    if (!['laser', 'anti-air'].includes(kind)) {
      saved.sites = saved.sites.filter((s: any) => s.kind !== 'laser');
      db.prepare("DELETE FROM meta WHERE key='laser-tower-v1'").run();
    }
    if (!['contaminator', 'laser', 'anti-air'].includes(kind)) {
      saved.sites = saved.sites.filter((s: any) => s.kind !== 'contaminator');
      db.prepare("DELETE FROM meta WHERE key='air-contaminator-v1'").run();
    }
    Object.assign(saved.sites[0], { state: 'conquered', hp: 0, pending: null, conqueredAt: 42 });
    oldSite = structuredClone(saved.sites[0]); delete saved.acidShells;
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    db.prepare('DELETE FROM meta WHERE key=?').run(marker);
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('kept-sentry', 24, 18, initial.me.id, 'saved');
  });
  await owner.request('/api/campaigns/enter', { id });
  const migrated = (await owner.request(worldRoute(id))).data;
  expect(migrated.combat.sites.filter((s: any) => s.kind === kind && !s.settlement)).toHaveLength(1);
  expect(migrated.combat.sites.find((s: any) => s.kind === 'alert')).toEqual(oldSite);
  expect(migrated.buildings.some((b: any) => b.id === 'kept-sentry')).toBe(true);
  expect(migrated.world.terrain).toEqual(initial.world.terrain);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    Object.assign(saved.sites.find((s: any) => s.kind === kind && !s.settlement), { state: 'conquered', hp: 0, conqueredAt: 50 });
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
  });
  await h.restart(); await owner.request('/api/campaigns/enter', { id });
  const resumed = (await owner.request(worldRoute(id))).data;
  expect(resumed.combat.sites.filter((s: any) => s.kind === kind && !s.settlement)).toEqual([expect.objectContaining({ state: 'conquered', hp: 0, conqueredAt: 50 })]);
  expect((await readdir(path.join(h.dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith(`before-${kind}-`))).toHaveLength(2);
}), 15000);

it('lists available planets and rejects unknown templates without creating a save', async () => fixture(async h => {
  const owner = await h.account('planet');
  const catalogue = (await owner.request('/api/campaigns/list')).data;
  expect(catalogue.planets.map((p: any) => p.id)).toEqual(['caldera-v1']);
  for (const template of ['unavailable', null, { id: 'caldera-v1' }]) {
    expect((await owner.request('/api/campaigns/create', { name: 'Invalid', template })).status).toBe(400);
  }
  expect((await owner.request('/api/campaigns/list')).data.campaigns).toHaveLength(0);
  expect((await owner.request('/api/campaigns/create', { name: 'Selected world', template: catalogue.planets[0].id })).status).toBe(200);
  expect((await owner.request('/api/campaigns/list')).data.campaigns[0]).toMatchObject({ name: 'Selected world', template: 'caldera-v1' });
}));

it('isolates reads, writes and streams while preserving legacy saves and campaign landing across restart', async () => fixture(async h => {
  const a = await h.account('alpha'), b = await h.account('bravo');
  const legacyId = (await a.request('/api/world')).data.me.id;
  const aid = await h.open(a), bid = await h.open(b);
  await expect(resetWorld(path.join(h.dir, 'campaigns', aid))).rejects.toThrow('World is in use');
  const third = await h.account('charlie');
  const thirdId = (await third.request('/api/campaigns/create', { name: 'Standby campaign' })).data.id;
  expect((await third.request('/api/campaigns/enter', { id: thirdId })).status).toBe(503);
  expect((await a.request(worldRoute(aid))).data.me.id).toBe(legacyId);
  expect((await b.request(worldRoute(aid))).status).toBe(403);
  expect((await b.request(worldRoute(aid, 'events'))).status).toBe(403);
  expect((await a.request(worldRoute(bid, 'cores'), { x: 24, y: 18 })).status).toBe(403);
  expect((await a.request(worldRoute(aid, 'cores'), { x: 24, y: 18 })).status).toBe(201);
  expect((await b.request(worldRoute(bid))).data.cores).toHaveLength(0);
  expect((await a.request('/api/world')).data.cores).toHaveLength(0);
  expect((await a.request('/api/campaigns/list')).data.campaigns.map((c: any) => c.id)).toEqual([aid]);
  await h.restart();
  expect((await a.request(worldRoute(aid))).status).toBe(403);
  expect((await a.request('/api/campaigns/enter', { id: aid })).status).toBe(200);
  const state = (await a.request(worldRoute(aid))).data;
  expect(state.cores).toHaveLength(1); expect(state.me).toMatchObject({ id: legacyId, deploying: true });
  expect((await readdir(path.join(h.dir, 'backups'))).some(n => n.startsWith('before-campaigns-'))).toBe(true);
}), 15000);

it('redeems codes once, remembers account membership and closes all access on owner exit', async () => fixture(async h => {
  const owner = await h.account('owner'), a = await h.account('friend'), b = h.client(), id = await h.open(owner);
  const invite = (await owner.request('/api/campaigns/invite', { id })).data;
  const results = await Promise.all([a.request('/api/campaigns/join', { code: invite.code }), b.request('/api/campaigns/join', { code: invite.code })]);
  expect(results.map(r => r.status).sort()).toEqual([200, 400]);
  // Ensure the durable account is also admitted if the guest won the race.
  if (results[0].status !== 200) { const code = (await owner.request('/api/campaigns/invite', { id })).data.code; expect((await a.request('/api/campaigns/join', { code })).status).toBe(200); }
  const stream = await h.connect(a, id);
  expect((await a.request('/api/campaigns/invite', { id })).status).toBe(403);
  expect((await owner.request('/api/campaigns/leave', {})).status).toBe(200);
  await expect.poll(stream.output).toContain('room-ended');
  expect((await a.request(worldRoute(id))).status).toBe(403);
  expect((await a.request('/api/campaigns/enter', { id })).status).toBe(409);
  expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(200); await h.connect(owner, id);
  expect((await a.request('/api/campaigns/enter', { id })).status).toBe(200);
}), 15000);

it('pauses solo simulation, resumes on joining and freezes only during owner reconnect grace', async () => fixture(async h => {
  const owner = await h.account('pause'), guest = h.client(), id = await h.open(owner);
  expect((await owner.request('/api/campaigns/pause', { id, paused: true })).data.room.soloPaused).toBe(true);
  const before = (await owner.request(worldRoute(id))).data.combat.time;
  await new Promise(r => setTimeout(r, 250)); expect((await owner.request(worldRoute(id))).data.combat.time).toBe(before);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  const joined = await guest.request('/api/campaigns/join', { code }); expect(joined.status).toBe(200);
  expect(joined.data.room).toMatchObject({ paused: false, players: 2 }); expect(joined.data.room.notice).toContain('resumed');
  await h.connect(guest, id);
  expect((await guest.request('/api/campaigns/pause', { id, paused: true })).data.room.paused).toBe(false);
  // Close every owner response using an account logout: explicit revocation closes
  // the room immediately, unlike a transient transport interruption.
  await owner.request('/api/auth/logout', {});
  expect((await guest.request(worldRoute(id))).status).toBe(403);
}), 15000);

it('freezes for reconnect, resumes the same visit and closes after the 30-second grace', async () => fixture(async h => {
  const owner = await h.account('reconnect');
  const id = (await owner.request('/api/campaigns/create', { name: 'Reconnect' })).data.id;
  await owner.request('/api/campaigns/enter', { id }); const stream = await h.connect(owner, id);
  stream.abort();
  await expect.poll(async () => (await owner.request(worldRoute(id))).data.room.state).toBe('reconnecting');
  const frozenState = (await owner.request(worldRoute(id))).data, time = frozenState.combat.time;
  await new Promise(r => setTimeout(r, 250)); const stayed = (await owner.request(worldRoute(id))).data; expect(stayed.combat.time).toBe(time);
  expect(stayed.logistics.time).toBe(frozenState.logistics.time); expect(stayed.logistics.supplies).toBe(frozenState.logistics.supplies);
  const again = await h.connect(owner, id); expect((await owner.request(worldRoute(id))).data.room.state).toBe('open');
  again.abort(); await expect.poll(async () => (await owner.request(worldRoute(id))).data.room.state).toBe('reconnecting');
  const now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now + 31000);
  await expect.poll(async () => (await owner.request(worldRoute(id))).status, { timeout: 2500 }).toBe(403);
}), 15000);

it('retains guest contributions under host management while expiring the guest personal visit', async () => fixture(async h => {
  const owner = await h.account('host'), guest = h.client(), id = await h.open(owner);
  expect((await guest.request('/api/campaigns/create', { name: 'Forbidden' })).status).toBe(403);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await guest.request('/api/campaigns/join', { code }); await h.connect(guest, id);
  const guestPilot = (await guest.request(worldRoute(id))).data.me.id;
  expect(h.logs.some((e: any) => e.event === 'participant.connected' && e.pilotId === guestPilot && e.actorId !== guestPilot && e.campaignId === id && e.kind === 'guest')).toBe(true);
  expect((await guest.request(worldRoute(id, 'cores'), { x: 24, y: 18 })).status).toBe(201);
  await guest.request('/api/campaigns/leave', {});
  const state = (await owner.request(worldRoute(id))).data;
  expect(state.cores[0].owner).toBe(guestPilot); expect(state.room.abandoned).toContain(guestPilot);
  expect((await guest.request('/api/campaigns/enter', { id })).status).toBe(403);
  const newCode = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await guest.request('/api/campaigns/join', { code: newCode });
  const newState = (await guest.request(worldRoute(id))).data;
  expect(newState.me.id).not.toBe(guestPilot); expect(newState.me.body).toBe('orbital');
  const ownerPilot = (await owner.request(worldRoute(id))).data.me.id;
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('host-core', ownerPilot, 38, 18, 999);
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('guest-sentry', 35, 18, guestPilot, 'fixture');
  });
  await owner.request('/api/campaigns/enter', { id }); await h.connect(owner, id);
  expect((await owner.request(worldRoute(id, 'sentry-mode'), { id: 'guest-sentry', weapon: 'HEAVY_FLAME' })).status).toBe(200);
  expect((await owner.request(worldRoute(id, 'dismantle'), { id: 'guest-sentry' })).status).toBe(200);
  expect((await owner.request(worldRoute(id))).data.buildings.some((b: any) => b.id === 'guest-sentry')).toBe(false);
}), 15000);

it('retains enemies, pending strikes and hazard capacity through campaign closure, restart and legacy reset', async () => fixture(async h => {
  const owner = await h.account('combat'), id = await h.open(owner);
  await owner.request('/api/campaigns/leave', {});
  const checkpoint = h.database(id, (db: DatabaseSync) => {
    const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);
    const combat = createCombat(world); expect(combat.start([])).toBeNull();
    expect(combat.lob({ id: 'test-gun', x: 24, y: 18 }, 24, 30, null, 'GAS')).toBeNull();
    const saved = combat.checkpoint(); db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved)); return saved;
  });
  await h.restart(true);
  await owner.request('/api/auth/login', { kind: 'demo', email: 'combat@frontier.test', password });
  expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(200);
  const state = (await owner.request(worldRoute(id))).data;
  expect(state.combat.enemies).toHaveLength(checkpoint.enemies.length);
  expect(state.combat.salvos).toHaveLength(1); expect(state.combat.salvos[0].weapon).toBe('GAS');
  expect(state.combat.time).toBe(checkpoint.now);
}), 15000);

it('enforces four distinct players and preserves a code when admission is full; rejects missing Origin', async () => fixture(async h => {
  const owner = await h.account('capacity'), id = await h.open(owner);
  expect((await owner.request('/api/campaigns/invite', { id }, false)).status).toBe(403);
  const guests = [];
  for (let i = 0; i < 3; i++) {
    const guest = h.client(); guests.push(guest);
    const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
    expect((await guest.request('/api/campaigns/join', { code })).status).toBe(200); await h.connect(guest, id);
  }
  const spare = h.client(), code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  expect((await spare.request('/api/campaigns/join', { code })).status).toBe(409);
  await guests[0].request('/api/campaigns/leave', {});
  expect((await spare.request('/api/campaigns/join', { code })).status).toBe(200);
}), 15000);

it('rejects a delayed command from the previous room instance after the owner closes and reopens it', async () => fixture(async h => {
  const owner = await h.account('delayed'), id = await h.open(owner);
  const payload = JSON.stringify({ x: 24, y: 18 });
  const received = new Promise<void>(resolve => h.server().once('request', () => resolve()));
  let finish: () => void = () => {};
  const result = new Promise<number>((resolve, reject) => {
    const request = http.request(h.base() + worldRoute(id, 'cores'), { method: 'POST', headers: { Cookie: owner.header(), Origin: h.base(), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, response => { response.resume(); resolve(response.statusCode!); });
    request.on('error', reject); request.write(payload.slice(0, -1)); finish = () => request.end(payload.slice(-1));
  });
  await received; await owner.request('/api/campaigns/leave', {});
  await owner.request('/api/campaigns/enter', { id }); await h.connect(owner, id);
  finish(); expect(await result).toBe(403);
  expect((await owner.request(worldRoute(id))).data.cores).toHaveLength(0);
}), 15000);

it('promotes a visiting guest to an account without replacing their campaign pilot or core', async () => fixture(async h => {
  const owner = await h.account('promotehost'), guest = h.client(), id = await h.open(owner);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await guest.request('/api/campaigns/join', { code }); await h.connect(guest, id);
  const pilot = (await guest.request(worldRoute(id))).data.me.id;
  await guest.request(worldRoute(id, 'cores'), { x: 24, y: 18 });
  const credentials = { name: 'Promoted', email: 'promoted@frontier.test', password, kind: 'demo' };
  expect((await guest.request('/api/auth/register', credentials)).status).toBe(200);
  const inbox = (await guest.request('/api/auth/inbox')).data;
  await guest.request('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
  await guest.request('/api/auth/login', credentials);
  expect((await guest.request('/api/campaigns/enter', { id })).status).toBe(200);
  const state = (await guest.request(worldRoute(id))).data;
  expect(state.me.id).toBe(pilot); expect(state.cores[0].owner).toBe(pilot); expect(state.room.abandoned).not.toContain(pilot);
}), 15000);
