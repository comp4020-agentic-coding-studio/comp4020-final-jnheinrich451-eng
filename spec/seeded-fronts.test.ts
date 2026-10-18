import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { expandWorld } from '../public/expansion.js';
import { expandPlanet } from '../public/planet-world.js';
import { seedFronts, seedDenseFronts, DENSE_REGIONS } from '../public/seeded-fronts.js';
import { settlements } from '../public/settlement.js';
import { makeSite, tickSites, damageSites, ALERT } from '../public/conquest.js';
import { createCombat, blastDamage } from '../public/combat.js';
import { HE } from '../public/weapons.js';

const planet = () => ({ ...expandPlanet(expandWorld(createWorld())), sites: [] as any[] });

it('densifies whole continents deterministically without replacing old groups or central landing space', () => {
  for (let seed = 0; seed < 24; seed++) {
    const world = planet(); world.sites = seedFronts(world, [], [], String(seed)).sites;
    Object.assign(world.sites[0], { state: 'conquered', hp: 0 }); world.sites[1].hp = 42;
    const before = JSON.stringify(world), added = seedDenseFronts(world, [], [], String(seed));
    expect(added).toEqual(seedDenseFronts(world, [], [], String(seed))); expect(JSON.stringify(world)).toBe(before);
    const combined = world.sites.concat(added.sites), groups = settlements(combined);
    expect(groups.length).toBeGreaterThanOrEqual(22); expect(groups.length).toBeLessThanOrEqual(24);
    for (const region of DENSE_REGIONS) {
      expect(groups.filter(g => g.region === region.id).length).toBeLessThanOrEqual(region.count);
      expect(groups.filter(g => g.region === region.id).length).toBeGreaterThanOrEqual(region.count - 2);
    }
    for (const site of added.sites) {
      const center = world.regions.find((r: any) => r.id === site.encounter.region);
      expect(Math.hypot(site.x + 1.5 - center.x, site.y + 1.5 - center.y)).toBeGreaterThanOrEqual(39);
      for (const old of world.sites) expect(Math.hypot(site.x - old.x, site.y - old.y)).toBeGreaterThanOrEqual(14);
      for (let y = site.y - 5; y < site.y + 8; y++) for (let x = site.x - 5; x < site.x + 8; x++) expect([1, 2]).toContain(world.terrain[y * world.width + x]);
    }
    expect(new Set(combined.map((s: any) => s.id)).size).toBe(combined.length);
  }
});

it('keeps completed groups in the density count and skips construction safely', () => {
  const world = planet(); world.sites = seedFronts(world, [], [], 'completed').sites;
  world.sites.push(...seedDenseFronts(world, [], [], 'completed').sites);
  world.sites.forEach((s: any) => Object.assign(s, { hp: 0, state: 'conquered' }));
  const occupied = [];
  for (let y = 0; y < world.height; y += 20) for (let x = 0; x < world.width; x += 20) occupied.push({ x, y });
  const before = JSON.stringify(world), blocked = seedDenseFronts(world, occupied, [], 'completed');
  expect(blocked.sites).toEqual([]); expect(JSON.stringify(world)).toBe(before);
  const full = planet(); full.sites = seedFronts(full, [], [], '3').sites;
  full.sites.push(...seedDenseFronts(full, [], [], '3').sites);
  full.sites.forEach((s: any) => Object.assign(s, { hp: 0, state: 'conquered' }));
  expect(seedDenseFronts(full, [], [], '3').sites).toEqual([]);
});

it('varies bounded compound layouts across seeds, leaves the terrain and original region intact, and retains staging space', () => {
  const world = planet(), before = JSON.stringify(world), layouts = new Set();
  for (let seed = 0; seed < 24; seed++) {
    const plan = seedFronts(world, [], [], String(seed));
    expect(plan).toEqual(seedFronts(world, [], [], String(seed)));
    expect(plan.manifest.groups).toHaveLength(7); expect(plan.sites.length).toBeLessThanOrEqual(21);
    layouts.add(JSON.stringify(plan.sites.map(s => [s.kind, s.x, s.y])));
    expect(new Set(plan.sites.map(s => s.id)).size).toBe(plan.sites.length);
    for (const site of plan.sites) {
      expect(site.x >= 128 || site.y >= 96).toBe(true);
      const center = world.regions!.find((r: any) => r.id === site.encounter.region)!;
      expect(Math.hypot(site.x + 1.5 - center.x, site.y + 1.5 - center.y)).toBeGreaterThanOrEqual(39);
      for (let y = site.y - 5; y < site.y + 8; y++) for (let x = site.x - 5; x < site.x + 8; x++) expect([1, 2]).toContain(world.terrain[y * world.width + x]);
    }
  }
  expect(layouts.size).toBe(24); expect(JSON.stringify(world)).toBe(before);
});

it('skips occupied regions without displacing construction, conquered records or salvage', () => {
  const world = planet(), old = { ...makeSite('alert', 'old', 220, 90), hp: 0, state: 'conquered' };
  world.sites = [old];
  const buildings = [];
  for (let y = 0; y < world.height; y += 20) for (let x = 128; x < world.width; x += 20) buildings.push({ x, y });
  for (let y = 96; y < world.height; y += 20) for (let x = 0; x < 128; x += 20) buildings.push({ x, y });
  const before = JSON.stringify(world), plan = seedFronts(world, buildings, [], 'occupied');
  expect(plan.sites).toEqual([]); expect(plan.manifest.skipped).toHaveLength(7);
  expect(JSON.stringify(world)).toBe(before);
});

it('saves actual membership and permanent partial conquest, and still accepts distant HE', () => {
  const world = planet(); world.sites = seedFronts(world, [], [], 'membership').sites;
  const group = settlements(world.sites)[0], site = group.members[0];
  damageSites(world.sites, site.x + 1.5, site.y + 1.5, { ...HE, damage: 1000, edgeDamage: 1000 }, 20, blastDamage);
  expect(site.state).toBe('conquered'); expect(settlements(world.sites)[0].cleared).toBe(1);
  const saved = createCombat(world).checkpoint(), restored = planet(); createCombat(restored, saved);
  expect(restored.sites).toEqual(world.sites);
  expect(settlements(restored.sites)[0].state).toBe('hostile');
  // Missing records never count as completed objectives.
  const missing = world.sites.filter((s: any) => s.id !== group.requiredIds[1]);
  expect(settlements(missing)[0].state).toBe('hostile');
});

it.each(['tankPod', 'yard', 'bridge', 'floor', 'recycler'])('protects existing %s infrastructure in an expanded region', kind => {
  const world: any = planet(), original = seedFronts(world, [], [], 'protected').sites[0];
  const { x, y } = original;
  world.logistics = { floors: [], bridges: [], recyclers: [], shipyards: [] };
  if (kind === 'tankPod') world.tanks = [{ x: 24, y: 18, podX: x, podY: y, elapsed: 99 }];
  if (kind === 'yard') world.logistics.shipyards = [{ dock: { x, y } }];
  if (kind === 'bridge') world.logistics.bridges = [{ from: { x, y }, to: { x: x + 6, y } }];
  if (kind === 'floor') world.logistics.floors = [y * world.width + x];
  if (kind === 'recycler') world.logistics.recyclers = [{ x, y }];
  const before = JSON.stringify(world), plan = seedFronts(world, [], [], 'protected');
  expect(plan.sites.some(s => x >= s.x - 5 && x < s.x + 8 && y >= s.y - 5 && y < s.y + 8)).toBe(false);
  expect(JSON.stringify(world)).toBe(before);
});

it('keeps remote guards dormant, consumes saved mixed rosters only on successful arrivals, and shares the living cap', () => {
  const world = planet(); world.sites = seedFronts(world, [], [], 'guards').sites;
  const enemies: any[] = []; let serial = 0;
  const tick = (now: number, people: any[], blocked = () => false, reserved = 0) => tickSites(world.sites, world, [], people, enemies, now, () => ++serial, blocked, reserved);
  tick(100000, []); expect(enemies).toHaveLength(0); expect(world.sites.every((s: any) => !s.pending && !s.awake)).toBe(true);
  const site = world.sites.find((s: any) => s.guardRoster.length)!;
  const people = [{ id: 'visitor', x: site.x - 9, y: site.y, body: 'robot', life: 'active', health: 100 }];
  tick(100100, people, () => false, ALERT.globalMax - 1);
  expect(site.pending.points).toHaveLength(1);
  tick(103000, people, () => true); expect(enemies).toHaveLength(0); expect(site.guardRoster).toEqual(['hunter', 'breaker', 'hunter']);
  tick(105100, people, () => false, ALERT.globalMax - 1); tick(108000, people, () => false, ALERT.globalMax - 1);
  expect(enemies).toHaveLength(1); expect(enemies[0].kind).toBe('hunter'); expect(site.guardRoster).toEqual(['breaker', 'hunter']);
  const restored = JSON.parse(JSON.stringify(world));
  for (const s of restored.sites) s.alarmUntil = 0;
  tickSites(restored.sites, restored, [], people, enemies, 121000, () => ++serial);
  tickSites(restored.sites, restored, [], people, enemies, 124000, () => ++serial);
  expect(enemies.filter(e => e.kind === 'breaker')).toHaveLength(1);
  expect(restored.sites.find((s: any) => s.id === site.id).guardRoster).toEqual([]);
  expect(enemies.length).toBeLessThanOrEqual(ALERT.globalMax);
});
