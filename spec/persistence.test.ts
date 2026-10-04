import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';
import { DatabaseSync } from 'node:sqlite';
import { createWorld } from '../public/world.js';

it('preserves committed buildings across a database reopen and enforces ownership and concurrent placement', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-spec-'));
  let app = createApp({ dataDir });
  async function listen() {
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    return `http://127.0.0.1:${address.port}`;
  }
  let base = await listen();
  const guest = async () => {
    const response = await fetch(`${base}/api/world`);
    return { cookie: response.headers.get('set-cookie')!.split(';')[0], state: await response.json() };
  };
  const post = (route: string, cookie: string, data: unknown) => fetch(`${base}/api/${route}`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  try {
    const a = await guest(), b = await guest();
    expect(a.state.me.id).not.toBe(b.state.me.id);
    const results = await Promise.all([post('buildings', a.cookie, { x: 28, y: 18 }), post('buildings', b.cookie, { x: 28, y: 18 })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const winnerIndex = results.findIndex(r => r.status === 201);
    const { building } = await results[winnerIndex].json();
    const winner = winnerIndex === 0 ? a : b, loser = winnerIndex === 0 ? b : a;
    expect((await post('dismantle', loser.cookie, { id: building.id })).status).toBe(403);
    expect((await post('buildings', a.cookie, { x: 0, y: 0 })).status).toBe(409);
    expect((await post('input', a.cookie, { x: 1000, y: 0 })).status).toBe(400);
    expect((await post('input', a.cookie, null)).status).toBe(400);
    const csrf = await fetch(`${base}/api/buildings`, { method: 'POST', headers: { Cookie: a.cookie, 'Content-Type': 'application/json', Origin: 'https://other.invalid' }, body: '{"x":29,"y":18}' });
    expect(csrf.status).toBe(403);
    await app.close(); app = createApp({ dataDir }); base = await listen();
    const returned = await (await fetch(`${base}/api/world`, { headers: { Cookie: winner.cookie } })).json();
    expect(returned.buildings.map((item: { id: string }) => item.id)).toContain(building.id);
    expect(returned.me.id).toBe(winner.state.me.id);
    expect(returned.world).toEqual(winner.state.world);
    expect((await post('dismantle', winner.cookie, { id: building.id })).status).toBe(200);
  } finally { await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});

it('adds elevation to a legacy cannon save without moving it or resetting carriage progress', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-legacy-gun-'));
  let app = createApp({ dataDir }); await app.close();
  const legacy = { id: 'old-gun', owner: 'existing-player', x: 21, y: 13, shape: 'EW', angle: 1.4129, aim: 1.5, target: { x: 30, y: 13 },
    move: { fromX: 20, fromY: 13, elapsed: .4 }, brace: 1.2, reload: 3 };
  const db = new DatabaseSync(path.join(dataDir, 'world.sqlite'));
  db.prepare('INSERT INTO artillery VALUES (?,?)').run(legacy.id, JSON.stringify(legacy)); db.close();
  try {
    for (let reopen = 0; reopen < 2; reopen++) {
      app = createApp({ dataDir });
      await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
      const address = app.server.address(); if (!address || typeof address === 'string') throw new Error('Missing port');
      const state = await (await fetch(`http://127.0.0.1:${address.port}/api/world`)).json();
      expect(state.artillery).toHaveLength(1);
      expect(state.artillery[0]).toMatchObject({ ...legacy, target: null, elevation: 75, operator: null, inputTime: 0 });
      await app.close();
    }
  } finally {
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-legacy-gun-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});

it('migrates a legacy world once, retaining the original terrain backup and construction records', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-map-migration-'));
  let app = createApp({ dataDir }); await app.close();
  const old = createWorld(); old.terrain[10 * 48 + 20] = 4; const original = JSON.stringify(old);
  const db = new DatabaseSync(path.join(dataDir, 'world.sqlite'));
  db.prepare('UPDATE meta SET value=? WHERE key=?').run(original, 'world'); db.prepare('DELETE FROM meta WHERE key=?').run('world-before-expansion-v2');
  db.prepare('INSERT INTO rails VALUES (?,?,?,?)').run(20, 13, 'EW', 'a');
  db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('saved-sentry', 28, 18, 'a', '2026-10-02'); db.close();
  try {
    for (let i = 0; i < 2; i++) {
      app = createApp({ dataDir }); await app.close();
      const saved = new DatabaseSync(path.join(dataDir, 'world.sqlite'), { readOnly: true });
      const expanded = JSON.parse(saved.prepare('SELECT value FROM meta WHERE key=?').get('world')!.value as string);
      expect([expanded.width, expanded.height]).toEqual([128, 96]);
      for (let y = 0; y < 36; y++) expect(expanded.terrain.slice(y * 128, y * 128 + 48)).toEqual(old.terrain.slice(y * 48, (y + 1) * 48));
      expect(saved.prepare('SELECT value FROM meta WHERE key=?').get('world-before-expansion-v2')!.value).toBe(original);
      expect(saved.prepare('SELECT * FROM rails').all()).toMatchObject([{ x: 20, y: 13, shape: 'EW', owner: 'a' }]);
      expect(saved.prepare('SELECT * FROM buildings').all()).toMatchObject([{ id: 'saved-sentry', x: 28, y: 18, owner: 'a' }]); saved.close();
    }
  } finally {
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-map-migration-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
