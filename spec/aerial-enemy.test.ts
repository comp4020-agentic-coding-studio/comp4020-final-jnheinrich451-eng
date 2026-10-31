import { expect, it } from 'vitest';
import { AERIAL, aerialPointClear, aerialLineClear, aerialGroundTargets, newAerialEnemy, tickAerialEnemies } from '../public/aerial-enemy.js';
import { freshLogistics, facilityTargets } from '../public/logistics.js';
import { freshLife } from '../public/survival.js';
import { islandAt } from '../public/island-pressure.js';
import { createVesper } from '../public/vesper-world.js';

function world(): any {
  return { width: 96, height: 80, terrain: Array(96 * 80).fill(2), waterKinds: Array(96 * 80).fill(0),
    mountains: Array(96 * 80).fill(0), tanks: [], ships: [], airbases: [], sites: [], cores: [],
    artillery: [], rails: [], logistics: freshLogistics() };
}
const robot = (id = 'p', x = 30.5, y = 30.5): any => ({ id, x, y, body: 'robot', ...freshLife(), vx: 0, vy: 0 });
const insect = (w: any, x = 24.5, y = 30.5): any => newAerialEnemy(1, { x, y }, { siteId: 'source', pressureIsland: islandAt(w, x, y)! });
function simulation(w = world(), enemies: any[] = [insect(w)], robots: any[] = [robot()], shots: any[] = []) {
  let now = 0, serial = 100;
  const events: any[] = [];
  const tick = (dt = .05) => {
    now += dt * 1000;
    return tickAerialEnemies(w, enemies, robots, facilityTargets(w), shots, now, dt, () => ++serial, event => events.push(event));
  };
  const advance = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 20); i++) tick(); };
  return { w, enemies, robots, shots, events, tick, advance, time: () => now };
}

it('creates a durable fixed-height air enemy with no random or runtime-only state', () => {
  const w = world(), e = insect(w);
  expect(e).toMatchObject({ kind: 'skimmer', domain: 'air', height: 2.5, hp: 180, maxHp: 180, siteId: 'source', attack: null });
  expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  expect(aerialPointClear(w, e)).toBe(true);
  expect(aerialPointClear(w, { x: -.5, y: 20 })).toBe(false);
  expect(aerialPointClear(w, { x: NaN, y: 20 })).toBe(false);
});

it('uses typed robot/tank/AA/recycler/builder targets without hitting crew, structures, air or ships', () => {
  const w = world(), foot = robot('foot'), driver = robot('driver'), utilityDriver = robot('utility-driver');
  w.tanks = [{ id: 'tank', x: 30.5, y: 30.5, elapsed: 99, health: 200, occupant: driver.id },
    { id: 'aa', kind: 'aa', x: 30.5, y: 30.5, elapsed: 99, health: 200 }];
  w.logistics.recyclers = [{ id: 'recycler', x: 30.5, y: 30.5, remaining: 0, occupant: utilityDriver.id },
    { id: 'builder', kind: 'builder', x: 30.5, y: 30.5, remaining: 0 },
    { id: 'assembling', x: 30.5, y: 30.5, remaining: 5 }];
  w.logistics.facilities = [{ id: 'factory', kind: 'factory', x: 30, y: 30, remaining: 0 }];
  const facilities = facilityTargets(w);
  w.ships = [{ id: 'ship', berthX: 30, x: 30.5, y: 30.5, elapsed: 99, health: 300 },
    { id: 'sub', kind: 'submarine', depth: 'submerged', berthX: 30, x: 30.5, y: 30.5, elapsed: 99, health: 300 }];
  const flying = { ...robot('air'), body: 'aircraft' }, shielded = { ...robot('shielded'), shield: 2 };
  const people = [foot, driver, utilityDriver, flying, shielded, { ...robot('disabled'), life: 'disabled' }, { ...robot('orbital'), body: 'orbital' }];
  expect(aerialGroundTargets(w, people, facilities).map(t => t.id).sort())
    .toEqual(['foot', 'recycler:builder', 'recycler:recycler', 'vehicle:aa', 'vehicle:tank']);
  const shots: any[] = [{ id: 10, sourceId: 1, weapon: 'SKIMMER', x: 30.5, y: 30.5, at: 0, landAt: 100, impacted: false }];
  tickAerialEnemies(w, [], people, facilities, shots, 150, .15, () => 11);
  expect(foot.health).toBe(80); expect(w.tanks.map((v: any) => v.health)).toEqual([180, 180]);
  for (const id of ['recycler', 'builder']) expect(w.logistics.durability['recycler:' + id].health).toBe(140);
  expect(w.logistics.durability['factory:factory'].health).toBe(400);
  expect(w.logistics.durability['recycler:assembling'].health).toBe(160);
  for (const person of [driver, utilityDriver, flying, shielded]) expect(person.health).toBe(100);
  expect(w.ships.map((s: any) => s.health)).toEqual([300, 300]);
  tickAerialEnemies(w, [], people, facilities, shots, 250, .1, () => 12);
  expect(foot.health).toBe(80);
});

it('warns at one predicted point, lets the player dodge, and circles during cooldown', () => {
  const s = simulation(); s.robots[0].vx = 2;
  s.tick();
  const attack = structuredClone(s.enemies[0].attack);
  expect(attack.x).toBeGreaterThan(s.robots[0].x); expect(attack.fireAt - attack.at).toBe(AERIAL.warning);
  expect(s.robots[0].health).toBe(100);
  s.robots[0].x = 35; s.robots[0].y = 35; s.robots[0].vx = -2;
  s.advance(1); expect(s.enemies[0].attack).toEqual(attack); expect(s.shots).toHaveLength(0);
  s.advance(.3); expect(s.shots).toHaveLength(1);
  expect(s.shots[0]).toMatchObject({ x: attack.x, y: attack.y, weapon: 'SKIMMER', impacted: false });
  s.advance(.3); expect(s.shots[0].impacted).toBe(true); expect(s.robots[0].health).toBe(100);
  expect(s.enemies[0].flight.phase).toBe('circling');
  s.advance(2); expect(s.events.filter(e => e.event === 'enemy.weapon.warning')).toHaveLength(1);
});

it('resumes the same warning after serialization and resolves a released shot after shooter/source loss exactly once', () => {
  const s = simulation(); s.enemies[0].angle = .8; s.tick(); s.advance(.4);
  const resumedWorld = structuredClone(s.w), resumedEnemies = structuredClone(s.enemies), resumedRobots = structuredClone(s.robots), shots: any[] = [];
  tickAerialEnemies(resumedWorld, resumedEnemies, resumedRobots, [], shots, 1250, .8, () => 101);
  expect(shots).toHaveLength(1);
  expect(shots[0]).toMatchObject({ x: 30.5, y: 30.5, at: 1250, landAt: 1500, fromAngle: .8, impacted: false });
  resumedWorld.sites = [{ id: 'source', state: 'conquered', hp: 0 }]; resumedEnemies.length = 0;
  const checkpoint = JSON.parse(JSON.stringify({ world: resumedWorld, robots: resumedRobots, shots }));
  expect(checkpoint.shots[0].fromAngle).toBe(.8);
  tickAerialEnemies(checkpoint.world, [], checkpoint.robots, [], checkpoint.shots, 1500, .25, () => 102);
  expect(checkpoint.robots[0].health).toBe(80); expect(checkpoint.shots[0].impacted).toBe(true);
  tickAerialEnemies(checkpoint.world, [], checkpoint.robots, [], checkpoint.shots, 1600, .1, () => 103);
  expect(checkpoint.robots[0].health).toBe(80);
  tickAerialEnemies(checkpoint.world, [], checkpoint.robots, [], checkpoint.shots, 2300, .7, () => 104);
  expect(checkpoint.shots).toEqual([]);
});

it('killing the insect during its warning prevents release, while conquering its facility does not erase a survivor', () => {
  const killed = simulation(); killed.tick(); killed.enemies[0].hp = 0; killed.advance(2);
  expect(killed.shots).toHaveLength(0); expect(killed.robots[0].health).toBe(100);
  const survivor = simulation(); survivor.tick(); survivor.w.sites = [{ id: 'source', state: 'conquered', hp: 0 }]; survivor.advance(1.6);
  expect(survivor.robots[0].health).toBe(80);
});

it('flies over low obstacles and inland rivers but never crosses ocean even inside one connected landmass', () => {
  const low = world();
  for (let y = 0; y < low.height; y++) low.terrain[y * low.width + 20] = 3;
  expect(aerialLineClear(low, { x: 10.5, y: 30.5 }, { x: 30.5, y: 30.5 })).toBe(true);
  for (const water of [1, 2, 3]) {
    const w = world();
    for (let y = 20; y < 40; y++) for (let x = 20; x < 24; x++) {
      w.terrain[y * w.width + x] = 0; w.waterKinds[y * w.width + x] = water;
    }
    const from = { x: 10.5, y: 30.5 }, to = { x: 30.5, y: 30.5 };
    expect(islandAt(w, from.x, from.y)).toBe(islandAt(w, to.x, to.y));
    expect(aerialLineClear(w, from, to)).toBe(water !== 1);
  }
});

it('does not pursue across a sea-separated island or a mountain wall, and stays within its home leash', () => {
  for (const obstacle of ['ocean', 'mountain']) {
    const w = world();
    for (let y = 0; y < w.height; y++) for (let x = 20; x <= 22; x++) {
      if (obstacle === 'ocean') { w.terrain[y * w.width + x] = 0; w.waterKinds[y * w.width + x] = 1; }
      else w.mountains[y * w.width + x] = 2;
    }
    const e = insect(w, 15.5, 30.5), s = simulation(w, [e], [robot('p', 28.5, 30.5)]);
    s.advance(20); expect(e.x).toBeLessThan(20); expect(e.attack).toBeNull(); expect(s.events).toHaveLength(0);
    expect(Math.hypot(e.x - e.homeX, e.y - e.homeY)).toBeLessThanOrEqual(AERIAL.leash);
  }
});

it('honours actual generated Vesper mountain cells and inland water semantics', () => {
  const w: any = createVesper();
  const peak = w.mountains.findIndex((height: number) => height > 0);
  expect(peak).toBeGreaterThanOrEqual(0);
  expect(aerialPointClear(w, { x: peak % w.width + .5, y: Math.floor(peak / w.width) + .5 })).toBe(false);
  const inland = w.waterKinds.findIndex((kind: number, index: number) => kind > 1 && !w.mountains[index]);
  expect(inland).toBeGreaterThanOrEqual(0);
  const point = { x: inland % w.width + .5, y: Math.floor(inland / w.width) + .5 };
  expect(islandAt(w, point.x, point.y)).not.toBeNull();
  const sea = w.waterKinds.findIndex((kind: number) => kind === 1);
  expect(aerialPointClear(w, { x: sea % w.width + .5, y: Math.floor(sea / w.width) + .5 })).toBe(false);
});

it('retains a fixed last-seen position instead of following an unseen ground target', () => {
  const s = simulation(); s.robots[0].x = 36; s.tick();
  const last = structuredClone(s.enemies[0].flight.lastContact);
  s.robots[0].x = 85; s.advance(.5);
  expect(s.enemies[0].targetId).toBeNull(); expect(s.enemies[0].flight.lastContact).toEqual(last);
  expect(s.enemies[0].behavior).toBe('investigating');
});

it('does not queue unbounded attacks into a full projectile pool', () => {
  const w = world(), enemies = Array.from({ length: 4 }, (_, i) => ({ ...insect(w, 24.5, 28.5 + i), id: i + 1 }));
  const shots = Array.from({ length: AERIAL.maxShots }, (_, i) => ({ id: 100 + i, weapon: 'SKIMMER', x: 70, y: 70, at: 0, landAt: 10000, impacted: false }));
  const s = simulation(w, enemies, [robot()], shots); s.advance(2);
  expect(enemies.every(e => !e.attack)).toBe(true); expect(shots).toHaveLength(AERIAL.maxShots);
});
