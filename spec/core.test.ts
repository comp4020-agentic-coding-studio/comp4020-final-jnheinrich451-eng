import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CORE, coreCells, coreCell, coreExit, corePlacementError } from '../public/core.js';
import { createWorld, canStand, tileAt, placementError, findPath } from '../public/world.js';
import { createApp } from '../server.js';
import { createCombat } from '../public/combat.js';

it('reserves exactly 57 tiles, converts covered rocks to walkable floor and leaves the corners unchanged', () => {
  const base = createWorld(), core = { id: 'core', owner: 'player', x: 29, y: 13, elapsed: 0 };
  const world = { ...base, cores: [core] }, cells = coreCells(core.x, core.y);
  expect(cells).toHaveLength(57); expect(new Set(cells.map(c => `${c.x},${c.y}`)).size).toBe(57);
  expect(cells.filter(c => c.role === 'core')).toHaveLength(7);
  expect(cells.filter(c => c.role === 'floor')).toHaveLength(48);
  expect(coreCell(core, 25, 9)).toBeNull();
  expect(tileAt(world, 33, 14)).toBe(3);
  expect(canStand(world, [], 32.5, 14.5)).toBe(false);
  const combat = createCombat(world); combat.start([]);
  expect(combat.snapshot().enemies.every(e => !coreCell(core, e.x, e.y))).toBe(true);
  core.elapsed = CORE.duration;
  expect(tileAt(world, 33, 14)).toBe(4); expect(base.terrain[14 * base.width + 33]).toBe(3);
  expect(canStand(world, [], 33.5, 14.5)).toBe(true);
  expect(canStand(world, [], core.x + .5, core.y + .5)).toBe(false);
  expect(canStand(world, [], core.x + 2.5, core.y + 1.5)).toBe(true);
  expect(canStand(world, [], coreExit(core).x, coreExit(core).y)).toBe(true);
  expect(findPath(world, [], coreExit(core), { x: 33, y: 14 })).toBeTruthy();
  expect(tileAt(world, 25, 9)).toBe(tileAt(base, 25, 9));
  expect(placementError(world, [], [], 33, 14)).toContain('panels');
});

it('rejects water, reserved land, occupied panels and duplicate ownership but permits natural rocks', () => {
  const world = { ...createWorld(), cores: [] as Array<{ id: string; owner: string; x: number; y: number; elapsed: number }> };
  expect(corePlacementError(world, [], [], 29, 13, 'a')).toBeNull();
  expect(corePlacementError(world, [], [], 0, 0, 'a')).toBeTruthy();
  expect(corePlacementError(world, [], [], 8, 8, 'a')).toContain('land');
  expect(corePlacementError(world, [], [], 24, 18, 'a')).toContain('pad');
  expect(corePlacementError(world, [{ x: 33, y: 14 }], [], 29, 13, 'a')).toContain('facility');
  expect(corePlacementError(world, [], [{ x: 33.5, y: 14.5 }], 29, 13, 'a')).toContain('unit');
  world.cores.push({ id: 'one', owner: 'a', x: 29, y: 13, elapsed: 0 });
  expect(corePlacementError(world, [], [], 29, 13, 'b')).toContain('Another core');
  expect(corePlacementError(world, [], [], 20, 10, 'a')).toContain('already');
});

it('saves a deployment once, locks controls while incoming, resumes after reopen and preserves the existing world', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-core-'));
  let app = createApp({ dataDir }), stream = new AbortController(), base = '';
  async function listen() {
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const address = app.server.address(); if (!address || typeof address === 'string') throw new Error('No server address');
    base = `http://127.0.0.1:${address.port}`;
  }
  try {
    await listen(); const guest = await fetch(`${base}/api/world`), cookie = guest.headers.get('set-cookie')!.split(';')[0];
    const original = await guest.json();
    const connect = async () => {
      const response = await fetch(`${base}/api/events`, { headers: { Cookie: cookie }, signal: stream.signal });
      const reader = response.body!.getReader();
      void (async () => { try { while (!(await reader.read()).done) { /* Drain snapshots like EventSource. */ } } catch { /* Test closes the stream. */ } })();
    };
    const post = (route: string, data: unknown) => fetch(`${base}/api/${route}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const state = async () => (await fetch(`${base}/api/world`, { headers: { Cookie: cookie } })).json();
    await post('buildings', { x: 28, y: 21 });
    await connect();
    const drops = await Promise.all([post('cores', { x: 29, y: 13 }), post('cores', { x: 29, y: 13 })]);
    expect(drops.map(r => r.status).sort()).toEqual([200, 201]);
    const first = await state(); expect(first.cores).toHaveLength(1);
    expect((await post('fire', { x: 33, y: 14 })).status).toBe(409);
    expect((await post('input', { x: 1, y: 0 })).status).toBe(409);
    expect((await post('buildings', { x: 32, y: 14 })).status).toBe(409);
    await expect.poll(async () => (await state()).cores[0].elapsed).toBeGreaterThan(.2);
    stream.abort(); await app.close(); app = createApp({ dataDir }); await listen();
    const reopened = await state(); expect(reopened.cores[0].id).toBe(first.cores[0].id);
    expect(reopened.cores[0].elapsed).toBeGreaterThan(.2);
    const paused = reopened.cores[0].elapsed;
    await new Promise(resolve => setTimeout(resolve, 180)); expect((await state()).cores[0].elapsed).toBe(paused);
    stream = new AbortController(); await connect();
    await expect.poll(async () => (await state()).me.deploying, { timeout: 6500 }).toBe(false);
    const landed = await state(); expect(landed.me.body).toBe('robot'); expect(landed.me.x).toBeCloseTo(32.6);
    expect(landed.cores[0].elapsed).toBe(CORE.duration);
    expect(landed.buildings).toHaveLength(2); expect(landed.buildings.some((b: { coreId?: string }) => b.coreId === first.cores[0].id)).toBe(true);
    expect(landed.world.terrain).toEqual(original.world.terrain);
    expect((await post('cores', { x: 18, y: 10 })).status).toBe(409);
    expect((await post('fire', { x: 35, y: 14.5, weapon: 'HE' })).status).toBe(409);
    expect((await post('fire', { x: 35, y: 14.5, weapon: 'APCR' })).status).toBe(409);
    expect((await post('fire', { x: 35, y: 14.5, weapon: 'FLAME' })).status).toBe(200);
    expect((await post('fire', { x: 35, y: 14.5, weapon: 'LASER' })).status).toBe(200);
    await post('input', { x: 0, y: 1, aim: Math.PI / 2 });
    await expect.poll(async () => (await state()).me.vy).toBeGreaterThan(0);
    await expect.poll(async () => (await state()).me.angle).toBeCloseTo(Math.PI / 2);
    await post('input', { x: 0, y: 0, aim: Math.PI / 2 });
    await expect.poll(async () => (await state()).me.vy).toBe(0);
    expect((await state()).me.y).toBeGreaterThan(landed.me.y);
    stream.abort(); await app.close(); app = createApp({ dataDir }); await listen();
    const saved = await state(); expect(saved.cores[0].elapsed).toBe(CORE.duration); expect(saved.me.x).toBeCloseTo(32.6);
  } finally { stream.abort(); await app.close(); await rm(dataDir, { recursive: true, force: true }); }
}, 10000);
