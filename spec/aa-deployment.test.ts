import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.js';
import { createWorld } from '../public/world.js';
import { freshLogistics } from '../public/logistics.js';
import { freshLife } from '../public/survival.js';
import { TANK, tankArrivalPosition, tankPodCells } from '../public/tank.js';
import { makeSite } from '../public/conquest.js';
import { newAerialEnemy } from '../public/aerial-enemy.js';

// Every test uses its own SQLite world, identities and HTTP server. Existing
// campaigns and the development server are never rewritten by these fixtures.
async function fixture(kind?: 'aa' | 'legacy') {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-aa-deployment-'));
  const tokens = [randomUUID(), randomUUID()], lines: string[] = [];
  let app = createApp({ dataDir: dir, logSink: (line: string) => lines.push(line) });
  await app.close();
  const db = new DatabaseSync(path.join(dir, 'world.sqlite'));
  const world = { ...createWorld(), version: 3, width: 128, height: 96, terrain: Array(128 * 96).fill(2), sites: [] };
  const logistics = freshLogistics(); logistics.groundSupplies = 500;
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
  db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(logistics));
  for (const [i, id] of ['a', 'b'].entries()) {
    db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i], id, 'AA pilot ' + i, kind ? 31.5 : 24.5, kind ? 19.5 : 18.5, Math.PI / 2);
    db.prepare('INSERT INTO robot_states VALUES (?,?)').run(id, JSON.stringify({ ...freshLife(), deployed: true }));
  }
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('support', 'a', 10, 10, TANK.duration);
  if (kind) db.prepare('INSERT INTO tanks VALUES (?,?)').run('ready', JSON.stringify({
    id: 'ready', owner: 'a', occupant: 'a', podX: 30, podY: 19, x: 31.5, y: 19.5,
    elapsed: TANK.duration, health: 200, hurt: 0, angle: Math.PI / 2, turret: Math.PI / 2,
    ...(kind === 'aa' ? { kind: 'aa' } : {}), weapon: kind === 'aa' ? 'AA35' : 'HE', secondary: 'APCR',
  }));
  db.close();
  let base = '', controllers: AbortController[] = [];
  async function open() {
    app = createApp({ dataDir: dir, logSink: (line: string) => lines.push(line) });
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(app.server.address() as any).port}`;
  }
  await open();
  const state = async (i = 0) => (await fetch(base + '/api/world', { headers: { Cookie: 'frontier=' + tokens[i] } })).json();
  const post = async (route: string, data: any = {}, i = 0) => {
    const response = await fetch(base + '/api/' + route, { method: 'POST', headers: { Cookie: 'frontier=' + tokens[i], 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return { status: response.status, body: await response.json() };
  };
  const connect = async (i = 0) => {
    const controller = new AbortController(); controllers.push(controller);
    const response = await fetch(base + '/api/events', { headers: { Cookie: 'frontier=' + tokens[i] }, signal: controller.signal });
    void (async () => { try { for await (const _ of response.body as any) { /* consume SSE */ } } catch { /* fixture disconnect */ } })();
  };
  const restart = async (edit?: (db: DatabaseSync) => void) => {
    controllers.forEach(c => c.abort()); controllers = []; await app.close();
    if (edit) { const saved = new DatabaseSync(path.join(dir, 'world.sqlite')); try { edit(saved); } finally { saved.close(); } }
    await open();
  };
  const close = async () => {
    controllers.forEach(c => c.abort()); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-aa-deployment-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  };
  const disconnect = async () => {
    controllers.forEach(c=>c.abort());controllers=[];
    await expect.poll(async()=>(await state()).players.some((p:any)=>p.id==='a')).toBe(false);
  };
  return { state, post, connect, restart, close, lines, disconnect };
}

it('charges 120 ORB or 30 GND once, validates the full pod and resumes an AA construction order', async () => {
  const f = await fixture();
  try {
    expect((await f.post('tanks', { kind: 'aa', x: 30, y: 19 })).status).toBe(409);
    await f.connect();
    expect((await f.post('tanks', { kind: 'forged', x: 30, y: 19 })).status).toBe(400);
    expect((await f.post('tanks', { kind: 'aa', emergency: true, x: 30, y: 19 })).status).toBe(400);
    const orbital = await f.post('tanks', { kind: 'aa', x: 30, y: 19, owner: 'b', health: 9999 });
    expect(orbital.status).toBe(201);
    const id = orbital.body.tank.id;
    expect(orbital.body.tank).toMatchObject({ kind: 'aa', weapon: 'AA35', secondary: 'APCR', owner: 'a', health: 200, purchase: { paid: 120, pool: 'supplies' } });
    expect(tankPodCells(30, 19)).toHaveLength(5);
    expect((await f.post('tanks', { kind: 'aa', x: 30, y: 19 })).body.tank.id).toBe(id);
    expect((await f.post('tanks', { x: 30, y: 19 })).status).toBe(409);
    expect((await f.post('tanks', { kind: 'aa', x: 31, y: 19 })).status).toBe(409);
    expect((await f.post('tanks', { kind: 'aa', x: 80, y: 60, method: 'factory', factoryId: 'support' })).status).toBe(409);
    const local = await f.post('tanks', { kind: 'aa', x: 25, y: 25, method: 'factory', factoryId: 'support' });
    expect(local.status).toBe(201);
    const localId = local.body.tank.id, before = await f.state();
    expect(before.logistics.supplies).toBe(1080); expect(before.logistics.groundSupplies).toBe(470);
    expect(before.logistics.purchases['tank:' + id]).toMatchObject({ paid: 120, pool: 'supplies' });
    expect(before.logistics.purchases['tank:' + localId]).toMatchObject({ paid: 30, pool: 'groundSupplies' });
    expect(before.logistics.jobs[localId]).toMatchObject({ kind: 'aa-tank', cost: 30, method: 'factory' });
    await f.restart();
    const resumed = await f.state();
    expect(resumed.tanks).toHaveLength(2);
    expect(resumed.tanks.find((t: any) => t.id === localId)).toMatchObject({ kind: 'aa', weapon: 'AA35', health: 200 });
    expect(resumed.logistics.jobs[localId].remaining).toBeGreaterThan(50);
    // Complete only this isolated saved job; verify the ordinary construction
    // completion path, rather than waiting a minute in an API regression.
    await f.restart(db => {
      const l = JSON.parse((db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get() as any).value);
      l.jobs[localId].remaining = .05;
      db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
    });
    await f.connect();
    await expect.poll(async () => (await f.state()).logistics.jobs[localId]).toBeUndefined();
    expect((await f.state()).tanks.find((t: any) => t.id === localId)).toMatchObject({ elapsed: TANK.duration, kind: 'aa', weapon: 'AA35', x: 26.5, y: 25.5 });
  } finally { await f.close(); }
});

it('keeps AA free aim separate from firing, restricts its loadout and resumes the same mobile hull', async () => {
  const f = await fixture('aa');
  try {
    await f.connect(); await f.connect(1);
    expect((await f.post('tanks/board', { id: 'ready' }, 1)).status).toBe(409);
    const initial = await f.state(), aim = { x: initial.me.x + 10, y: initial.me.y - 10 };
    for (const weapon of ['HE', 'MAGNETIC']) expect((await f.post('tank-weapon', { weapon })).status).toBe(400);
    expect((await f.post('tank-weapon', { slot: 'secondary', weapon: 'HEAVY_FLAME' })).status).toBe(400);
    expect((await f.post('tank-weapon', { weapon: 'AA35' })).status).toBe(200);
    expect((await f.post('input', { x: 0, y: 0, aim: Math.PI / 4, target: aim, aaGround: false })).status).toBe(200);
    await expect.poll(async () => (await f.state()).tanks[0].turret).toBeCloseTo(Math.PI / 4, 4);
    const aimed = await f.state();
    expect(aimed.me.aim).toBe(Math.PI / 4);
    expect(aimed.tanks[0].aaAim).toMatchObject({ ...aim, targetId: null, domain: 'ground' });
    expect(aimed.combat.shots).toHaveLength(0);
    expect((await f.post('fire', { ...aim, weapon: 'HE' })).status).toBe(409);
    expect((await f.post('fire', { ...aim, weapon: 'AA35', kind: 'aa', vehicleId: 'ready' }, 1)).status).toBe(409);
    expect((await f.post('fire', { ...aim, weapon: 'AA35' })).status).toBe(200);
    const fired = await f.state();
    const muzzle=fired.combat.shots.filter((s: any) => s.mount === 'aa-35mm');
    expect(muzzle).toHaveLength(1);
    expect(Math.hypot(muzzle[0].x - initial.me.x, muzzle[0].y - initial.me.y)).toBeCloseTo(.16, 4);
    expect((await f.post('input', { x: 0, y: 0, aim: Math.PI / 4, target: aim, aaGround: true })).status).toBe(200);
    expect((await f.post('fire', { ...aim, weapon: 'APCR' })).status).toBe(200);
    expect((await f.post('input', { x: 0, y: -1, aim: Math.PI / 4, target: aim, aaGround: false })).status).toBe(200);
    await expect.poll(async () => (await f.state()).me.x).toBeGreaterThan(initial.me.x + .1);
    await f.post('input', { x: 0, y: 0, aim: Math.PI / 4, target: aim });
    await f.restart(); await f.connect();
    const restored = await f.state();
    expect(restored.me).toMatchObject({ body: 'rover', vehicleId: 'ready', tankWeapon: 'AA35', tankSecondary: 'APCR', vx: 0 });
    expect(restored.tanks[0]).toMatchObject({ kind: 'aa', health: 200, aaAim: null, aaGround: false });
    expect(restored.combat.shots).toHaveLength(0);
    expect((await f.post('tanks/exit')).status).toBe(200);
    expect((await f.state()).me.body).toBe('robot');
    expect((await f.post('fire', { ...aim, weapon: 'AA35' })).status).toBe(409);
    await f.restart();
    const logs = f.lines.map(line => JSON.parse(line));
    expect(logs.some(line => line.weapon === 'AA35' && line.unitType === 'aa-vehicle' && String(line.command).includes('twin 35 mm'))).toBe(true);
  } finally { await f.close(); }
});

it('preserves legacy tank weapons and rejects claiming AA guns through request fields', async () => {
  const f = await fixture('legacy');
  try {
    await f.connect();
    expect((await f.post('tank-weapon', { weapon: 'AA35' })).status).toBe(400);
    expect((await f.post('fire', { x: 40, y: 19, weapon: 'AA35', kind: 'aa', vehicleId: 'ready' })).status).toBe(409);
    expect((await f.post('tank-weapon', { weapon: 'MAGNETIC' })).status).toBe(200);
    expect((await f.post('tank-weapon', { slot: 'secondary', weapon: 'HEAVY_FLAME' })).status).toBe(200);
    await f.restart();
    expect((await f.state()).tanks[0]).toMatchObject({ weapon: 'MAGNETIC', secondary: 'HEAVY_FLAME' });
    expect((await f.state()).tanks[0].kind).toBeUndefined();
  } finally { await f.close(); }
});

it('holds AA fire from fresh ordered input and stops on release, stale input, expiry and lifecycle changes', async () => {
  const f=await fixture('aa');
  try {
    await f.connect();await f.connect(1);
    const state=await f.state(),aim={x:state.me.x+20,y:state.me.y};
    const input=(aaFire:boolean,aaFireSequence:number)=>({x:0,y:0,aim:Math.PI/2,target:aim,aaGround:false,aaFire,aaFireSequence});
    const latest=(s:any)=>Math.max(0,...s.combat.shots.filter((shot:any)=>shot.mount==='aa-35mm').map((shot:any)=>shot.id));
    const waitTicks=async(ms:number)=>{
      const start=(await f.state()).combat.time;
      await expect.poll(async()=>(await f.state()).combat.time,{timeout:4000,interval:40}).toBeGreaterThanOrEqual(start+ms);
    };
    expect((await f.post('input',{...input(true,1),aaFire:'yes'})).status).toBe(400);
    expect((await f.post('input',{...input(true,1),aaFireSequence:-1})).status).toBe(400);
    expect((await f.post('input',input(true,1),1)).status).toBe(409);
    expect((await f.post('input',input(true,1))).status).toBe(200);
    await expect.poll(async()=>(await f.state()).combat.shots.filter((s:any)=>s.mount==='aa-35mm').length).toBeGreaterThanOrEqual(2);
    expect((await f.post('input',input(false,2))).status).toBe(200);
    const released=latest(await f.state());
    // A delayed older held packet must not undo the newer release.
    expect((await f.post('input',input(true,1))).status).toBe(200);
    await waitTicks(500);expect(latest(await f.state())).toBeLessThanOrEqual(released);

    expect((await f.post('input',input(true,3))).status).toBe(200);
    await expect.poll(async()=>latest(await f.state())).toBeGreaterThan(released);
    await waitTicks(700);const expired=latest(await f.state());
    await waitTicks(300);expect(latest(await f.state())).toBeLessThanOrEqual(expired);

    expect((await f.post('input',input(true,4))).status).toBe(200);
    await expect.poll(async()=>latest(await f.state())).toBeGreaterThan(expired);
    await f.disconnect();await f.connect();
    const disconnected=latest(await f.state());
    await waitTicks(500);expect(latest(await f.state())).toBeLessThanOrEqual(disconnected);
    // A new page starts its input sequence at one after the previous SSE closes.
    expect((await f.post('input',input(true,1))).status).toBe(200);
    await expect.poll(async()=>latest(await f.state())).toBeGreaterThan(disconnected);
    await f.restart();await f.connect();
    await waitTicks(500);
    expect((await f.state()).combat.shots.filter((s:any)=>s.mount==='aa-35mm')).toHaveLength(0);
  } finally {await f.close();}
},15000);

it('records half the AA payment as salvage and charges its own price for a replacement without duplicate wrecks', async () => {
  const f = await fixture();
  try {
    await f.connect();
    const deployed = await f.post('tanks', { kind: 'aa', x: 30, y: 19 });
    expect(deployed.status).toBe(201);
    const id = deployed.body.tank.id;
    await f.restart(db => {
      const t = JSON.parse((db.prepare('SELECT value FROM tanks WHERE id=?').get(id) as any).value);
      Object.assign(t, { health: 0, destroyed: true, elapsed: TANK.duration, ...tankArrivalPosition(t, TANK.duration) });
      db.prepare('UPDATE tanks SET value=? WHERE id=?').run(JSON.stringify(t), id);
    });
    const wrecks = Object.values((await f.state()).logistics.recovery) as any[];
    expect(wrecks).toHaveLength(1);
    expect(wrecks[0]).toMatchObject({ sourceId: id, amount: 60, paid: 120, kind: 'aa', pool: 'supplies' });
    expect(wrecks[0].id).toMatch(new RegExp('^tank:' + id + ':'));
    await f.connect(); await f.connect(1);
    expect((await f.post('vehicles/replace', { kind: 'tank', id }, 1)).status).toBe(404);
    expect((await f.post('vehicles/replace', { kind: 'tank', id, emergency: true })).status).toBe(400);
    const replaced = await f.post('vehicles/replace', { kind: 'tank', id });
    expect(replaced.status).toBe(200);
    expect(replaced.body.vehicle).toMatchObject({ kind: 'aa', weapon: 'AA35', health: 200, purchase: { paid: 120 } });
    expect((await f.post('vehicles/replace', { kind: 'tank', id })).body.vehicle.id).toBe(replaced.body.vehicle.id);
    expect((await f.state()).logistics.supplies).toBe(960);
    await f.restart();
    expect(Object.values((await f.state()).logistics.recovery)).toHaveLength(1);
    expect((await f.state()).tanks.find((t: any) => t.id === replaced.body.vehicle.id)).toMatchObject({ kind: 'aa', weapon: 'AA35' });
  } finally { await f.close(); }
});

it('still supplies an emergency HE tank when the only surviving vehicle is AA', async () => {
  const f = await fixture();
  try {
    await f.connect();
    expect((await f.post('tanks', { kind: 'aa', x: 30, y: 19 })).status).toBe(201);
    await f.restart(db => {
      const l = JSON.parse((db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get() as any).value);
      l.supplies = 0;
      db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
    });
    await f.connect();
    const emergency = await f.post('tanks', { x: 40, y: 24, emergency: true });
    expect(emergency.status).toBe(201);
    expect(emergency.body.tank).toMatchObject({ weapon: 'HE', emergency: true, purchase: { paid: 0 } });
    expect(emergency.body.tank.kind).toBeUndefined();
  } finally { await f.close(); }
});

it('allows a ground exit and orbital deployment beneath airborne enemies in a saved campaign', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-aa-ground-domain-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }), cookies = new Map<string, string>();
  const controller = new AbortController();
  try {
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(app.server.address() as any).port}`;
    const cookie = () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    const request = async (route: string, data?: unknown) => {
      const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST',
        headers: { Cookie: cookie(), ...(data === undefined ? {} : { Origin: base, 'Content-Type': 'application/json' }) },
        body: data === undefined ? undefined : JSON.stringify(data) });
      for (const raw of response.headers.getSetCookie()) { const [key, value] = raw.split(';')[0].split('='); if (value) cookies.set(key, value); else cookies.delete(key); }
      const body = await response.json(); expect(response.ok, JSON.stringify(body)).toBe(true); return body;
    };
    const credentials = { kind: 'demo', name: 'Air separation', email: 'aa-ground@frontier.test', password: 'isolated aa domain password 123!' };
    await request('/api/auth/register', credentials);
    const inbox = await request('/api/auth/inbox');
    await request('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await request('/api/auth/login', credentials);
    const { id } = await request('/api/campaigns/create', { name: 'Overhead contacts', template: 'caldera-v1' });
    await request('/api/campaigns/enter', { id });
    const route = '/api/campaign-world/' + id, initial = await request(route + '/world');
    await request('/api/campaigns/leave', {});
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const read = (key: string) => JSON.parse((db.prepare('SELECT value FROM meta WHERE key=?').get(key) as any).value);
      const write = (key: string, value: any) => db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(value), key);
      const world = { ...createWorld(), version: 3, width: 128, height: 96, terrain: Array(128 * 96).fill(2) };
      write('world', world);
      const saved = read('combat-checkpoint-v1'), source = makeSite('hive', 'domain-source', 105, 80);
      saved.sites = [source]; saved.planetConquest = null;
      saved.enemies = [{ x: 32.6, y: 19.5 }, { x: 40.5, y: 20.5 }].map((point, i) => ({
        ...newAerialEnemy(800 + i, point, { siteId: source.id, now: saved.now }),
        // Keep the real warning phase pending while testing physical occupancy.
        attack: { kind: 'skimmer', ...point, at: saved.now, fireAt: saved.now + 60000, targetId: initial.me.id },
      }));
      saved.serial = 900; saved.director.sleeping = []; saved.director.nextPulse = 1e9;
      if(saved.director.pressure)saved.director.pressure.nextRoam = 1e9;
      write('combat-checkpoint-v1', saved);
      const logistics = freshLogistics(); logistics.groundSupplies = 500; write('logistics-v1', logistics);
      db.prepare('UPDATE scouts SET x=?,y=?,angle=? WHERE id=?').run(31.5, 19.5, Math.PI / 2, initial.me.id);
      db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(initial.me.id, JSON.stringify({ ...freshLife(), deployed: true }));
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('support', initial.me.id, 10, 10, TANK.duration);
      db.prepare('INSERT INTO tanks VALUES (?,?)').run('exit-tank', JSON.stringify({ id: 'exit-tank', owner: initial.me.id, occupant: initial.me.id,
        podX: 30, podY: 19, x: 31.5, y: 19.5, elapsed: TANK.duration, health: 200, angle: Math.PI / 2, turret: Math.PI / 2, weapon: 'HE', secondary: 'APCR' }));
      // All ordinary exits are solid except the eastern opening, occupied only
      // by the projected position of the first hovering enemy.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !(dx === 1 && dy === 0)) {
        db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run(`exit-wall-${dx}-${dy}`, 31 + dx, 19 + dy, initial.me.id, 'fixture');
      }
    } finally { db.close(); }
    await request('/api/campaigns/enter', { id });
    const response = await fetch(base + route + '/events', { headers: { Cookie: cookie() }, signal: controller.signal });
    expect(response.ok).toBe(true);
    void (async () => { try { for await (const _ of response.body as any) { /* consume SSE */ } } catch { /* fixture closes */ } })();
    expect((await request(route + '/world')).combat.enemies.filter((e: any) => e.kind === 'skimmer')).toHaveLength(2);
    await request(route + '/tanks/exit', {});
    expect((await request(route + '/world')).me).toMatchObject({ body: 'robot', x: 32.6, y: 19.5 });
    const deployment = await request(route + '/tanks', { kind: 'aa', x: 40, y: 20 });
    expect(deployment.tank).toMatchObject({ kind: 'aa', podX: 40, podY: 20 });
    expect((await request(route + '/world')).combat.enemies.filter((e: any) => e.kind === 'skimmer')).toHaveLength(2);
  } finally {
    controller.abort(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-aa-ground-domain-')) throw Error('Unsafe campaign fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
