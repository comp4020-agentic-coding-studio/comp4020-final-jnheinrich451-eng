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
import { cargoCells } from '../public/cargo-pods.js';

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-aa-sentry-'));
  const tokens = [randomUUID(), randomUUID()];
  let app = createApp({ dataDir: dir, logSink: () => {} }); await app.close();
  const db = new DatabaseSync(path.join(dir, 'world.sqlite'));
  const world = { ...createWorld(), version: 3, width: 128, height: 96, terrain: Array(128 * 96).fill(2), sites: [] };
  world.terrain[61 * 128 + 80] = 3; // An orbital wall would cover this rock.
  const logistics = freshLogistics(); logistics.groundSupplies = 500;
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
  db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(logistics));
  for (const [i, id] of ['a', 'b'].entries()) {
    db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i], id, 'AA sentry pilot ' + i, 24.5 + i * 3, 18.5, 0);
    db.prepare('INSERT INTO robot_states VALUES (?,?)').run(id, JSON.stringify({ ...freshLife(), deployed: true }));
  }
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('support', 'a', 10, 10, 99);
  db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('legacy-sentry', 45, 10, 'a', '2026-10-01');
  db.close();
  let base = '', controllers: AbortController[] = [];
  async function open() {
    app = createApp({ dataDir: dir, logSink: () => {} });
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
    void (async () => { try { for await (const _ of response.body as any) { /* consume real snapshots */ } } catch { /* closing */ } })();
  };
  const restart = async (edit?: (db: DatabaseSync) => void) => {
    controllers.forEach(c => c.abort()); controllers = []; await app.close();
    if (edit) { const saved = new DatabaseSync(path.join(dir, 'world.sqlite')); try { edit(saved); } finally { saved.close(); } }
    await open();
  };
  const close = async () => {
    controllers.forEach(c => c.abort()); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-aa-sentry-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  };
  return { state, post, connect, restart, close };
}

it('charges the fixed AA price, validates all orbital walls and local support, and protects the fixed loadout', async () => {
  const f = await fixture();
  try {
    await f.connect();
    expect((await f.post('buildings', { kind: 'forged', x: 80, y: 64 })).status).toBe(400);
    const blocked = await f.post('buildings', { kind: 'aa-sentry', x: 80, y: 60 });
    expect(blocked.status).toBe(409); expect(blocked.body.error).toContain('Pod wall');
    expect((await f.post('buildings', { kind: 'aa-sentry', x: 80, y: 64, method: 'factory', factoryId: 'support' })).status).toBe(409);
    expect((await f.state()).logistics).toMatchObject({ supplies: 1200, groundSupplies: 500 });
    const orbital = await f.post('buildings', { kind: 'aa-sentry', x: 80, y: 64, owner: 'b', weapon: 'HEAVY_FLAME', health: 9999 });
    expect(orbital.status).toBe(201);
    const id = orbital.body.building.id;
    expect(orbital.body.building).toMatchObject({ kind: 'aa-sentry', weapon: 'AA35', owner: 'a', purchase: { paid: 80, pool: 'supplies' } });
    expect((await f.post('buildings', { kind: 'aa-sentry', x: 80, y: 64 })).status).toBe(409);
    const local = await f.post('buildings', { kind: 'aa-sentry', x: 24, y: 24, method: 'factory', factoryId: 'support' });
    expect(local.status).toBe(201);
    const s = await f.state(), localId = local.body.building.id;
    expect(s.logistics).toMatchObject({ supplies: 1120, groundSupplies: 480 });
    expect(s.logistics.jobs[id]).toMatchObject({ kind: 'aa-sentry', method: 'orbital', cost: 80 });
    expect(s.logistics.jobs[localId]).toMatchObject({ kind: 'aa-sentry', method: 'factory', duration: 60, cost: 20 });
    expect(cargoCells(s.logistics.cargoPods.find((p: any) => p.id === id))).toHaveLength(5);
    expect(s.logistics.cargoPods.some((p: any) => p.id === localId)).toBe(false);
    expect(s.logistics.purchases['sentry:' + id]).toMatchObject({ paid: 80, kind: 'aa-sentry' });
    expect(s.logistics.purchases['sentry:' + localId]).toMatchObject({ paid: 20, kind: 'aa-sentry' });
    for (const weapon of ['APCR', 'HEAVY_FLAME', 'AA35']) expect((await f.post('sentry-mode', { id, weapon })).status).toBe(409);
    expect((await f.post('sentry-mode', { id, weapon: 'APCR' }, 1)).status).toBe(403);
    expect((await f.post('sentry-mode', { id: 'legacy-sentry', weapon: 'AA35' })).status).toBe(400);
    expect((await f.post('sentry-mode', { id: 'legacy-sentry', weapon: 'HEAVY_FLAME' })).status).toBe(200);
    await f.restart();
    const resumed = await f.state();
    expect(resumed.buildings.find((b: any) => b.id === id)).toMatchObject({ kind: 'aa-sentry', weapon: 'AA35', owner: 'a' });
    expect(resumed.buildings.find((b: any) => b.id === 'legacy-sentry')).toMatchObject({ weapon: 'HEAVY_FLAME' });
    expect(resumed.buildings.find((b: any) => b.id === 'legacy-sentry').kind).toBeUndefined();
    expect(resumed.logistics.jobs[localId].remaining).toBeGreaterThan(50);
    expect(resumed.logistics.purchases['sentry:' + id]).toEqual(s.logistics.purchases['sentry:' + id]);
  } finally { await f.close(); }
});

it('finishes saved AA construction and atomically cleans equipment and jobs when cancelled or dismantled', async () => {
  const f = await fixture();
  try {
    await f.connect();
    const a = await f.post('buildings', { kind: 'aa-sentry', x: 24, y: 24, method: 'factory', factoryId: 'support' });
    const b = await f.post('buildings', { kind: 'aa-sentry', x: 28, y: 24, method: 'factory', factoryId: 'support' });
    expect([a.status, b.status]).toEqual([201, 201]);
    const id = a.body.building.id, removed = b.body.building.id;
    expect((await f.post('logistics/cancel', { id: removed })).status).toBe(200);
    expect((await f.post('logistics/cancel', { id: removed })).status).toBe(409);
    expect((await f.state()).logistics.groundSupplies).toBe(470);
    await f.restart(db => {
      expect(db.prepare('SELECT id FROM equipment WHERE id=?').get('sentry:' + removed)).toBeUndefined();
      const l = JSON.parse((db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get() as any).value);
      l.jobs[id].remaining = .05;
      db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
    });
    await f.connect();
    await expect.poll(async () => (await f.state()).logistics.jobs[id]).toBeUndefined();
    expect((await f.state()).logistics.durability['sentry:' + id]).toMatchObject({ health: 140, max: 140 });
    const pending = await f.post('buildings', { kind: 'aa-sentry', x: 28, y: 24, method: 'factory', factoryId: 'support' });
    expect(pending.status).toBe(201);
    expect((await f.post('dismantle', { id: pending.body.building.id }, 1)).status).toBe(403);
    expect((await f.post('dismantle', { id: pending.body.building.id })).status).toBe(200);
    await f.restart(db => {
      expect(db.prepare('SELECT id FROM equipment WHERE id=?').get('sentry:' + pending.body.building.id)).toBeUndefined();
    });
    const resumed = await f.state();
    expect(resumed.logistics.jobs[pending.body.building.id]).toBeUndefined();
    expect(resumed.buildings.some((item: any) => item.id === pending.body.building.id)).toBe(false);
    expect(resumed.buildings.find((item: any) => item.id === id)).toMatchObject({ kind: 'aa-sentry', weapon: 'AA35' });
  } finally { await f.close(); }
});

it('recovers half the actual AA payment after destruction without regenerating salvage on restart', async () => {
  const f = await fixture();
  try {
    await f.connect();
    const orbital = await f.post('buildings', { kind: 'aa-sentry', x: 80, y: 64 });
    const local = await f.post('buildings', { kind: 'aa-sentry', x: 24, y: 24, method: 'factory', factoryId: 'support' });
    expect([orbital.status, local.status]).toEqual([201, 201]);
    const ids = [orbital.body.building.id, local.body.building.id];
    await f.restart(db => {
      const l = JSON.parse((db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get() as any).value);
      for (const id of ids) { delete l.jobs[id]; l.durability['sentry:' + id] = { health: 0, max: 140, armor: 2 }; }
      db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
    });
    await f.connect();
    await expect.poll(async () => (await f.state()).buildings.some((b: any) => ids.includes(b.id))).toBe(false);
    const s = await f.state(), wrecks = ids.map(id => Object.values(s.logistics.recovery).find((w: any) => w.sourceId === id)) as any[];
    expect(wrecks.map(w => w.amount)).toEqual([40, 10]);
    await f.restart(db => {
      for (const id of ids) expect(db.prepare('SELECT id FROM equipment WHERE id=?').get('sentry:' + id)).toBeUndefined();
    });
    expect((await f.state()).logistics.recovery).toEqual(s.logistics.recovery);
  } finally { await f.close(); }
});

it('rolls the hull, equipment, job and payment back together if AA equipment cannot be persisted', async () => {
  const f = await fixture();
  try {
    await f.restart(db => db.exec("CREATE TRIGGER reject_test_equipment BEFORE INSERT ON equipment WHEN NEW.id LIKE 'sentry:%' BEGIN SELECT RAISE(ABORT,'isolated AA write failure'); END"));
    const failed = await f.post('buildings', { kind: 'aa-sentry', x: 80, y: 64 });
    expect(failed.status).toBe(500);
    const s = await f.state();
    expect(s.logistics).toMatchObject({ supplies: 1200, groundSupplies: 500, jobs: {} });
    expect(s.buildings.some((b: any) => b.x === 80 && b.y === 64)).toBe(false);
    expect(s.logistics.cargoPods || []).toEqual([]); expect(s.logistics.purchases || {}).toEqual({});
    await f.restart(db => {
      expect(db.prepare("SELECT * FROM equipment WHERE id LIKE 'sentry:%'").all()).toEqual([]);
      db.exec('DROP TRIGGER reject_test_equipment');
    });
    expect((await f.post('buildings', { kind: 'aa-sentry', x: 80, y: 64 })).status).toBe(201);
    expect((await f.state()).logistics.supplies).toBe(1120);
  } finally { await f.close(); }
});
