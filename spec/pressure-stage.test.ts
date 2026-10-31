import { expect, it } from 'vitest';
import { createCombat } from '../public/combat.js';
import { makeSite } from '../public/conquest.js';
import { makeAquaticHive } from '../public/aquatic-hive.js';
import { islandAt } from '../public/island-pressure.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { freshLife } from '../public/survival.js';
import { freshLogistics } from '../public/logistics.js';

// Small generated, disposable terrain makes timing/cap interactions observable
// without reading a developer save or relying on a particular authored city.
function field(split = false): any {
  const width = split ? 360 : 180, height = 180, terrain = Array(width * height).fill(2);
  if (split) for (let y = 0; y < height; y++) for (let x = 160; x < 200; x++) terrain[y * width + x] = 0;
  return { width, height, terrain, spawn: { x: 60.5, y: 60.5 }, sites: [], cores: [], tanks: [], ships: [], airbases: [], artillery: [], rails: [], logistics: freshLogistics() };
}
const player = (id = 'a', x = 60.5, y = 60.5): any => ({ id, x, y, body: 'robot', ...freshLife(), shield: 0, health: 10000 });
const site = (id = 'source', x = 130, y = 130): any => ({ ...makeSite('modifier', id, x, y), guardsRemaining: 0 });
function campaign(world: any, seed = 'pressure-stage') {
  const saved = createCombat(world, null, null, seed).checkpoint();
  saved.director.nextRaid = 1e9;
  return createCombat(world, saved);
}
function advance(combat: any, seconds: number, people: any[] = [], robots: any[] = []) {
  for (let index = 0; index < Math.round(seconds * 4); index++) combat.tick(.25, [], robots, people);
}
const budget = (combat: any, world: any, person: any) => combat.checkpoint().director.pressure.islands[islandAt(world, person.x, person.y)!];
function reservationCount(saved: any) {
  return saved.sites.reduce((sum: number, source: any) => sum + (source.pending?.points.length || 0), 0)
    + (saved.frenzy?.phase === 'warning' ? saved.frenzy.points.length : 0);
}
function warning() {
  const world = field(), person = player(); world.sites = [site()];
  const combat = campaign(world, 'quiet-roaming');
  advance(combat, 89, [person]);
  expect(combat.snapshot().enemies).toHaveLength(0);
  expect(reservationCount(combat.checkpoint())).toBe(0);
  for (let count = 0; count < 300 && !world.sites.some((source: any) => source.pending?.kind === 'roaming'); count++) combat.tick(.25, [], [], [person]);
  const saved = combat.checkpoint(), source = saved.sites.find((entry: any) => entry.pending?.kind === 'roaming');
  expect(source, 'A living remote source should eventually dispatch one warned roaming group.').toBeDefined();
  expect(saved.now).toBeGreaterThanOrEqual(90000); expect(saved.now).toBeLessThanOrEqual(153000);
  expect(source.pending.points.length).toBeGreaterThanOrEqual(1); expect(source.pending.points.length).toBeLessThanOrEqual(2);
  expect(saved.enemies).toHaveLength(0);
  return { world, person, combat, saved, pending: source.pending };
}

it('shares one island clock, accelerates actual city arrivals once, and ignores duplicate pilot contacts', () => {
  const cases = [1, 2, 4].map(count => {
    const world = field(); world.sites = [site('city', 90, 80)];
    const people = Array.from({ length: count }, (_, i) => player(String(i), 70.5 + i, 81.5));
    const combat = campaign(world); advance(combat, 11, people);
    const state = budget(combat, world, people[0]);
    expect(state.active).toBe(count); expect(state.multiplier).toBeCloseTo(1 + .7 * (count - 1));
    expect(state.clock).toBeCloseTo(11000 * (1 + .7 * (count - 1)));
    expect(state.credit).toBeLessThanOrEqual(2);
    return { world, people, combat, count: combat.snapshot().enemies.length };
  });
  expect(cases[0].count).toBeGreaterThan(0); expect(cases[1].count).toBeGreaterThan(cases[0].count);
  expect(cases[2].count).toBeGreaterThanOrEqual(cases[1].count); expect(cases[2].count).toBeLessThanOrEqual(6);
  const world = field(); world.sites = [site('city', 90, 80)];
  const duplicated = campaign(world), p = cases[0].people[0];
  advance(duplicated, 11, [p, { ...p }, { ...p }]);
  expect(duplicated.checkpoint()).toEqual(cases[0].combat.checkpoint());
});

it('destroying nearby production weakens replenishment while another hostile source remains', () => {
  const populations = [false, true].map(damaged => {
    const world = field(), people = [player('a', 70.5, 81.5)];
    world.sites = [site('a', 90, 80), site('b', 90, 90), site('c', 80, 90)].map((source, index) => ({ ...source,
      encounter: { id: 'city', requiredIds: ['a', 'b', 'c'] }, ...(damaged && index > 0 ? { state: 'conquered', hp: 0 } : {}) }));
    const combat = campaign(world); advance(combat, 20, people);
    expect(budget(combat, world, people[0]).strength).toBeCloseTo(damaged ? 1 / 3 : 1);
    expect(combat.snapshot().conquest.state).toBe('contested');
    return combat.snapshot().enemies.length;
  });
  expect(populations[0]).toBeGreaterThan(populations[1]); expect(populations[1]).toBeGreaterThan(0);
});

it('clears absent-island credit and unborn pressure without banking a return burst', () => {
  const world = field(); world.sites = [site('city', 90, 80)];
  const p = player('a', 70.5, 81.5), combat = campaign(world);
  combat.tick(.25, [], [], [p]); expect(reservationCount(combat.checkpoint())).toBeGreaterThan(0);
  const clock = budget(combat, world, p).clock;
  advance(combat, 180);
  expect(reservationCount(combat.checkpoint())).toBe(0); expect(combat.snapshot().enemies).toHaveLength(0);
  expect(budget(combat, world, p)).toMatchObject({ active: 0, multiplier: 0, credit: 0, nextRoam: null, clock });
  advance(combat, 4, [p]);
  expect(combat.snapshot().enemies).toHaveLength(0); expect(reservationCount(combat.checkpoint())).toBe(0);
});

it('freezes an empty island while a teammate keeps another island active', () => {
  const world = field(true), left = player('left', 70.5, 81.5), right = player('right', 220.5, 81.5);
  world.sites = [site('left-city', 90, 80), site('right-city', 240, 80)];
  const combat = campaign(world); advance(combat, 5, [left, right]);
  const before = combat.checkpoint(), clock = budget(combat, world, left).clock;
  const population = [...before.enemies, ...before.director.sleeping].filter((enemy: any) => enemy.siteId === 'left-city').length;
  expect(population).toBeGreaterThan(0);
  advance(combat, 25, [right]);
  const after = combat.checkpoint();
  expect(budget(combat, world, left)).toMatchObject({ clock, active: 0, credit: 0, nextRoam: null });
  expect(budget(combat, world, right).clock).toBeGreaterThan(clock);
  expect([...after.enemies, ...after.director.sleeping].filter((enemy: any) => enemy.siteId === 'left-city')).toHaveLength(population);
  expect(after.sites.find((source: any) => source.id === 'left-city').pending).toBeNull();
});

it('keeps natural ground raid strength fixed for one or four players instead of multiplying roster and cadence', () => {
  for (const count of [1, 4]) {
    const world = field(); world.sites = [site()];
    const saved = createCombat(world, null, null, 'fixed-natural-roster').checkpoint(); saved.director.nextRaid = 0;
    const combat = createCombat(world, saved), people = Array.from({ length: count }, (_, i) => player(String(i), 60.5 + i, 60.5));
    combat.tick(.25, [], [], people);
    const frenzy = combat.checkpoint().frenzy;
    expect(frenzy).toMatchObject({ source: 'natural', phase: 'warning' });
    expect(frenzy.points.map((point: any) => point.kind).sort()).toEqual(['breaker', 'bulwark', 'hunter', 'hunter', 'hunter', 'hunter']);
  }
});

it('a due raid retries scarce admission without locking onto the wrong producer turn', () => {
  const world = field(), person = player(); world.sites = [site()];
  const initial = campaign(world); initial.tick(.25, [], [], [person]);
  const saved = initial.checkpoint(); saved.serial = 21;
  saved.enemies = Array.from({ length: 21 }, (_, index) => {
    const point = { x: 73.5 + index % 7 * 2, y: 73.5 + Math.floor(index / 7) * 2 };
    return { ...newGroundEnemy('hunter', index + 1, point), eventSpawn: true, rally: point };
  });
  saved.director.nextRaid = 0; saved.director.nextPulse = 0;
  saved.director.pressure.cursor = 1; saved.director.pressure.turn = 0;
  const combat = createCombat(world, saved);
  combat.tick(.25, [], [], [person]); expect(combat.checkpoint().frenzy).toBeNull();
  for (let step = 0; step < 60 && !combat.checkpoint().frenzy; step++) combat.tick(.25, [], [], [person]);
  expect(combat.checkpoint().frenzy).toMatchObject({ source: 'natural', phase: 'warning' });
  expect(combat.checkpoint().enemies.length + reservationCount(combat.checkpoint())).toBeLessThanOrEqual(24);
});

it.each([2, 3, 4])('a due roaming arrival reaches its scarce producer turn with %i teammates', count => {
  const world = field(), people = Array.from({ length: count }, (_, index) => player(String(index), 60.5 + index, 60.5));
  world.sites = [site()];
  const initial = campaign(world); initial.tick(.25, [], [], people);
  const saved = initial.checkpoint(); saved.serial = 23;
  saved.enemies = Array.from({ length: 23 }, (_, index) => {
    const point = { x: 105.5 + index % 8 * 2, y: 75.5 + Math.floor(index / 8) * 2 };
    return { ...newGroundEnemy('hunter', index + 1, point), eventSpawn: true, rally: point };
  });
  saved.director.pressure.cursor = 0; saved.director.pressure.turn = 0;
  const state = saved.director.pressure.islands[islandAt(world, people[0].x, people[0].y)!];
  state.credit = 2; state.nextRoam = state.clock;
  const combat = createCombat(world, saved);
  for (let step = 0; step < 96 && !world.sites.some((source: any) => source.pending?.kind === 'roaming'); step++) {
    combat.tick(.25, [], [], people);
    const current = combat.checkpoint();
    expect(current.enemies.length + reservationCount(current)).toBeLessThanOrEqual(24);
  }
  const pending = world.sites.find((source: any) => source.pending?.kind === 'roaming')?.pending;
  expect(pending, 'A scaled retry must not permanently skip the unscaled roaming producer turn.').toBeDefined();
  expect(pending.points).toHaveLength(1);
});

it('a scarce natural raid reaches an eligible island when four contacts alternate full and available quotas', () => {
  const world = field(true), people = [player('a', 70.5, 80.5), player('b', 230.5, 80.5),
    player('c', 74.5, 80.5), player('d', 234.5, 80.5)];
  world.sites = [site('left-source', 130, 140), site('right-source', 300, 140)];
  const initial = campaign(world); initial.tick(.25, [], [], people);
  const saved = initial.checkpoint(); saved.serial = 21;
  saved.enemies = Array.from({ length: 21 }, (_, index) => {
    const left = index < 12, local = left ? index : index - 12;
    const point = { x: (left ? 90.5 : 250.5) + local % 6 * 2, y: 120.5 + Math.floor(local / 6) * 2 };
    return { ...newGroundEnemy('hunter', index + 1, point), eventSpawn: true, rally: point };
  });
  saved.director.nextRaid = 0; saved.director.nextPulse = 0; saved.director.focusCursor = 0;
  saved.director.pressure.cursor = 0; saved.director.pressure.turn = 0;
  for (const state of Object.values(saved.director.pressure.islands) as any[]) state.nextRoam = 1e9;
  const combat = createCombat(world, saved);
  for (let step = 0; step < 120 && !combat.checkpoint().frenzy; step++) {
    combat.tick(.25, [], [], people);
    const current = combat.checkpoint();
    expect(current.enemies.length + reservationCount(current)).toBeLessThanOrEqual(24);
  }
  expect(combat.checkpoint().frenzy).toMatchObject({ source: 'natural', phase: 'warning',
    pressureIsland: islandAt(world, people[1].x, people[1].y) });
});

it('keeps cleared land quiet, persists the same roaming warning, and investigates a fixed position after restart', () => {
  const { world, person, combat, saved, pending } = warning();
  const restoredWorld = structuredClone(world), restored = createCombat(restoredWorld, structuredClone(saved), null, 'ignored-restart-seed');
  expect(restored.checkpoint()).toEqual(saved);
  const moved = { ...person, x: person.x + 3, y: person.y + 2 };
  for (let i = 0; i < 12; i++) { combat.tick(.25, [], [], [moved]); restored.tick(.25, [], [], [{ ...moved }]); }
  expect(restored.checkpoint()).toEqual(combat.checkpoint());
  const enemies = restored.checkpoint().enemies;
  expect(enemies.length).toBeGreaterThanOrEqual(1); expect(enemies.length).toBeLessThanOrEqual(2);
  for (const enemy of enemies) {
    expect(enemy).toMatchObject({ kind: 'hunter', pressureKind: 'roaming', siteId: 'source', investigation: { x: person.x, y: person.y } });
    expect(enemy.investigation.until - enemy.emergedAt).toBe(30000);
    const point = pending.points.find((candidate: any) => candidate.x === enemy.homeX && candidate.y === enemy.homeY);
    expect(point).toBeDefined();
    expect(enemy.rally).toEqual({ x: (point.x + person.x) / 2, y: (point.y + person.y) / 2 });
  }
  const population = enemies.length; advance(restored, 45, [moved]);
  expect(restored.snapshot().enemies).toHaveLength(population);
  expect(reservationCount(restored.checkpoint())).toBe(0);
});

it('cancels a roaming warning when its island empties or a player enters its marked approach', () => {
  const { world, person, saved, pending } = warning();
  const absent = createCombat(structuredClone(world), structuredClone(saved)); advance(absent, 3);
  expect(absent.snapshot().enemies).toHaveLength(0); expect(reservationCount(absent.checkpoint())).toBe(0);
  const occupied = createCombat(structuredClone(world), structuredClone(saved));
  const moved = { ...person, x: pending.points[0].x, y: pending.points[0].y };
  advance(occupied, 3, [moved]);
  expect(occupied.snapshot().enemies.every((enemy: any) => Math.hypot(enemy.homeX - moved.x, enemy.homeY - moved.y) >= 12)).toBe(true);
  expect(reservationCount(occupied.checkpoint())).toBe(0);
});

it('destroying the real roaming source cancels its warning without claiming conquest while another site survives', () => {
  const { world, person, saved } = warning();
  saved.sites[0].hp = 1; saved.sites.push(site('other-source', 140, 95));
  const combat = createCombat(structuredClone(world), saved);
  expect(combat.shoot({ id: 'gun', x: 127, y: 131.5 }, 131.5, 131.5, 'HE')).toBeNull();
  advance(combat, 3, [person]);
  expect(combat.snapshot().sites.find((source: any) => source.id === 'source')?.state).toBe('conquered');
  expect(combat.snapshot().conquest.state).toBe('contested');
  expect(combat.snapshot().enemies).toHaveLength(0); expect(reservationCount(combat.checkpoint())).toBe(0);
});

it('final conquest cancels pending roaming and natural raids while preserving living and sleeping survivors on restart', () => {
  const { world, person, saved } = warning();
  saved.sites[0].hp = 1; saved.serial = 12;
  saved.enemies = [{ ...newGroundEnemy('hunter', 11, { x: 150.5, y: 150.5 }), hp: 23, rally: { x: 150.5, y: 150.5 }, siteId: 'source', homeX: 150.5, homeY: 150.5 }];
  saved.director.sleeping = [{ ...newGroundEnemy('hunter', 12, { x: 170.5, y: 160.5 }), hp: 17, siteId: 'source', homeX: 170.5, homeY: 160.5 }];
  saved.frenzy = { id: 'raid-pending', source: 'natural', phase: 'warning', origin: { x: person.x, y: person.y }, until: saved.now + 8000, points: [{ x: 43.5, y: 60.5, kind: 'hunter' }], members: [], orders: {}, nextPulse: 0 };
  saved.director.lastEvent = 'raid-pending';
  const combat = createCombat(structuredClone(world), saved);
  expect(combat.shoot({ id: 'gun', x: 127, y: 131.5 }, 131.5, 131.5, 'HE')).toBeNull();
  advance(combat, 3, [person]);
  expect(combat.snapshot().conquest).toMatchObject({ state: 'conquered', survivors: 2 });
  expect(reservationCount(combat.checkpoint())).toBe(0);
  const resumed = createCombat(structuredClone(world), combat.checkpoint()); advance(resumed, 180, [person]);
  expect(resumed.snapshot().enemies.map((enemy: any) => [enemy.id, enemy.hp]).sort()).toEqual([[11, 23], [12, 17]]);
  expect(reservationCount(resumed.checkpoint())).toBe(0);
  expect(resumed.snapshot().encounters?.nextRaid).toBeNull();
});

it('shares the 24 active-plus-reserved ceiling across initial guards, city pressure, aquatic spawns and a natural raid', () => {
  const world = field(true), people = [player('left', 150.5, 80.5), player('right', 220.5, 80.5)];
  world.sites = [
    { ...site('left-guards', 125, 95), awake: true, guardsRemaining: 4, guardRoster: ['hunter', 'breaker', 'hunter', 'bulwark'] },
    site('left-city', 145, 55), { ...site('right-guards', 215, 95), awake: true, guardsRemaining: 4, guardRoster: ['hunter', 'breaker', 'hunter', 'bulwark'] },
    site('right-city', 230, 55), makeAquaticHive('coastal-hive', 163, 79),
  ];
  const saved = createCombat(world, null, null, 'mixed-producers').checkpoint(); saved.director.nextRaid = 0;
  let combat = createCombat(world, saved);
  const producers = new Set<string>();
  let peak = 0;
  for (let step = 0; step < 240; step++) {
    // Saturate first, then open individual admission opportunities. Already
    // accepted guards/raids retain their bodies; fairness must not erase them
    // merely to make room for another producer on this island.
    if (step >= 80 && step % 16 === 0) {
      const casualty = combat.checkpoint();
      const enemy = casualty.enemies.find((entry: any) => entry.hp > 0 && entry.kind !== 'swimmer'
        && islandAt(world, entry.x, entry.y) === islandAt(world, people[0].x, people[0].y));
      if (enemy) { enemy.hp = 0; combat = createCombat(world, casualty); }
    }
    for (const person of people) { person.health = 10000; person.life = 'active'; person.shield = 0; }
    combat.tick(.25, [], people, people);
    const state = combat.checkpoint();
    const population = state.enemies.filter((enemy: any) => enemy.hp > 0).length + reservationCount(state);
    peak = Math.max(peak, population); expect(population).toBeLessThanOrEqual(24);
    for (const source of state.sites) if (source.pending) producers.add(source.pending.kind);
    if (state.frenzy) producers.add('raid');
    if (state.enemies.some((enemy: any) => enemy.variant === 'bile-spitter')) producers.add('aquatic');
  }
  expect([...producers]).toEqual(expect.arrayContaining(['guards', 'pressure', 'raid', 'aquatic']));
  expect(peak).toBeGreaterThanOrEqual(21);
  const living = combat.checkpoint().enemies.filter((enemy: any) => enemy.hp > 0);
  expect(living.some((enemy: any) => islandAt(world, enemy.x, enemy.y) === islandAt(world, people[0].x, people[0].y))).toBe(true);
  expect(living.some((enemy: any) => islandAt(world, enemy.x, enemy.y) === islandAt(world, people[1].x, people[1].y))).toBe(true);
});
