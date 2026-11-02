import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { COLONY_PLANETS, colonyPlanetById } from '../public/colony-planets.js';
import { createColony, colonyAction, colonyCanStand, colonyPlacementError } from '../public/colonization.js';
import { createColonizationRuntime } from '../colonization-runtime.js';

const fingerprint = (terrain: number[]) => createHash('sha256').update(JSON.stringify(terrain)).digest('hex');
const legacyTerrain = {
  'caldera-v1': 'b81b569c52cce8d5fcb50f1aeb6b5038b8c693d7309fb38815454fc0c3451539',
  'vesper-v1': '4011d72b904c3a00833be918b5e3e4a296b5ef93304140bd24dc46c034646d24',
  'sirocco-v1': '643b6b42910591d64991c277708199b5308dba813d6e39f0bd86caa9e260c190',
};

it('preserves all three original colony geographies exactly', () => {
  for (const [id, expected] of Object.entries(legacyTerrain)) {
    const state = createColony(id);
    expect(fingerprint(state.world.terrain)).toBe(expected);
    expect(state.world.district).toBe('Firstlight Meadow');
    expect(state.world.spawn).toEqual({ x: 36.5, y: 31.5 });
  }
});

it('creates three distinct, deterministic civilian districts with accessible gardening land', () => {
  expect(COLONY_PLANETS.map(p => p.id)).toEqual(['morrow-v1', 'nacre-v1', 'aurelia-v1']);
  const generated = new Set<string>(), waterCounts: number[] = [], mineralCounts: number[] = [];
  for (const planet of COLONY_PLANETS) {
    const state = createColony(planet.id), world = state.world;
    expect(state).toEqual(createColony(planet.id));
    expect(colonyPlanetById(planet.id)).toBe(planet);
    expect(world).toMatchObject({ name: planet.name, district: planet.district, template: planet.id, width: 72, height: 56 });
    expect(new Set(world.terrain)).toEqual(new Set([0, 1, 2, 3]));
    const hash = fingerprint(world.terrain); generated.add(hash);
    expect(Object.values(legacyTerrain)).not.toContain(hash);
    expect(colonyCanStand(state, world.spawn.x, world.spawn.y)).toBe(true);
    for (const [x, y] of [[32, 31], [31, 28], [40, 33], [30, 33]]) expect(colonyPlacementError(state, 'bed', x, y)).toBeNull();
    expect(colonyPlacementError(state, 'sprinkler', 34, 32)).toBeNull();
    // Flood the real walkable tiles. Decoration is allowed on distant shore
    // fragments, but almost all usable land must connect to the arrival site.
    const start = 31 * world.width + 36, seen = new Set<number>([start]), queue = [start];
    for (let at = 0; at < queue.length; at++) {
      const index = queue[at], x = index % world.width, y = Math.floor(index / world.width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, next = ny * world.width + nx;
        if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height || seen.has(next)) continue;
        if (![1, 2].includes(world.terrain[next]) || (nx >= 35 && nx < 37 && ny >= 27 && ny < 29)) continue;
        seen.add(next); queue.push(next);
      }
    }
    const land = world.terrain.filter(t => t === 1 || t === 2).length;
    expect(seen.size / land).toBeGreaterThan(.98);
    for (const [x, y] of [[31, 28], [43, 28], [40, 33]]) expect(seen.has(y * world.width + x)).toBe(true);
    waterCounts.push(world.terrain.filter(t => t === 0).length);
    mineralCounts.push(world.terrain.filter(t => t === 1).length);
  }
  expect(generated.size).toBe(3);
  expect(waterCounts[1]).toBeGreaterThan(waterCounts[0]);
  expect(waterCounts[1]).toBeGreaterThan(waterCounts[2]);
  expect(mineralCounts[2]).toBeGreaterThan(mineralCounts[0]);
  expect(colonyPlanetById('caldera-v1')).toBeNull();
  expect(() => createColony('unlisted-world')).toThrow('available planet');
});

it('reopens saved terrain and construction without regenerating old or new districts', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-planets-'));
  const audit = { emit() {}, broadcast() {}, received() {}, result() {}, actor() {}, bind() {}, context() { return {}; } };
  let runtime: ReturnType<typeof createColonizationRuntime> | null = null;
  try {
    for (const template of [...Object.keys(legacyTerrain), ...COLONY_PLANETS.map(p => p.id)]) {
      const savedDir = path.join(dir, template);
      const options = { planetTemplate: template, campaignId: template, clientBuild: 'fixture', frozen: () => true,
        roomView: () => ({ paused: true }), authorized: () => true, audit };
      runtime = createColonizationRuntime(savedDir, options);
      await runtime.close(); runtime = null;
      const db = new DatabaseSync(path.join(savedDir, 'colony.sqlite'));
      let saved: any;
      try {
        saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='colony-v1'").get()!.value as string);
        colonyAction(saved, { id: 'fixture-gardener' }, 'build-bed', { x: 32, y: 31 });
        saved.world.terrain[0] = 2;
        saved.world.district = 'Original survey kept';
        db.prepare("UPDATE meta SET value=? WHERE key='colony-v1'").run(JSON.stringify(saved));
      } finally { db.close(); }
      runtime = createColonizationRuntime(savedDir, options);
      runtime.checkpoint();
      const reloaded = JSON.parse(runtime.db.prepare("SELECT value FROM meta WHERE key='colony-v1'").get()!.value as string);
      expect(reloaded).toEqual(saved);
      await runtime.close(); runtime = null;
    }
  } finally {
    await runtime?.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-planets-')) throw Error('Unsafe test directory');
    await rm(dir, { recursive: true, force: true });
  }
});
