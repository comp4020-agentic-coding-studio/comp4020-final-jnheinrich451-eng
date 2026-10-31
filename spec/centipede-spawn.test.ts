import { expect, it } from 'vitest';
import { CENTIPEDE_SPAWN, centipedeReservations, centipedeSpawnView, tickCentipedeSpawns } from '../public/centipede-spawn.js';
import { createDirector } from '../public/encounter-director.js';
import { islandAt } from '../public/island-pressure.js';
import { pressureAllowance, updatePressure } from '../public/pressure-budget.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { canStand } from '../public/world.js';

function fixture(split = false) {
  const world: any = { width: split ? 180 : 80, height: 70, terrain: Array.from({ length: (split ? 180 : 80) * 70 }, (_, i) =>
    split && [60, 120].includes(i % 180) ? 0 : 2), sites: [], tanks: [], cores: [] };
  const root = (id: string, x: number) => ({ id, kind: 'modifier', x, y: 30, hp: 480, state: 'hostile' });
  world.sites = split ? [root('left', 20), root('middle', 80), root('right', 140)] : [root('root', 30)];
  const contacts: any[] = world.sites.map((s: any, i: number) => ({ id: 'pilot-' + i, x: s.x + 16, y: 35, medium: 'ground' }));
  const enemies: any[] = [], sleeping: any[] = [], buildings: any[] = [], external: any[] = [], events: any[] = [];
  let director: any = createDirector('centipede-tests'), now = 0, serial = 100;
  const pending = () => external.concat(centipedeReservations(director));
  const capacity = () => Math.max(0, 24 - enemies.filter(e => e.hp > 0).length - pending().length);
  const tick = (seconds = .1, conquered = false) => {
    now += seconds * 1000;
    updatePressure(director, world, contacts, enemies, now, seconds, pending().length);
    return tickCentipedeSpawns({ world, buildings, contacts, enemies, sleeping, director, now, dt: seconds, conquered,
      capacity, admit: (p: any, producer: string) => pressureAllowance(director, world, contacts, enemies, pending(), p, producer, capacity()),
      nextId: () => ++serial, events, reservations: pending });
  };
  const refill = () => { for (const state of Object.values(director.pressure?.islands || {}) as any[]) state.credit = 2; };
  return { world, contacts, enemies, sleeping, buildings, external, events, tick, refill,
    get director() { return director; }, get now() { return now; },
    reload() { director = JSON.parse(JSON.stringify(director)); } };
}
function birth(f: ReturnType<typeof fixture>) {
  f.tick(60); expect(centipedeReservations(f.director)).toHaveLength(1);
  f.tick(10); expect(f.enemies.filter(e => e.kind === 'centipede')).toHaveLength(1);
  return f.enemies.find(e => e.kind === 'centipede');
}

it('warns only at a living Blight Root after active time, then creates one legal shared-health body', () => {
  const f = fixture();
  f.world.sites.push({ id: 'other', kind: 'alert', x: 12, y: 12, hp: 100, state: 'hostile' });
  f.tick(59); expect(centipedeReservations(f.director)).toEqual([]);
  f.tick(1); const warning = centipedeSpawnView(f.director).warnings[0];
  expect(warning).toMatchObject({ rootId: 'root', kind: 'centipede', at: 70000, windup: 10000 });
  expect(warning.trail.every((p: any) => canStand(f.world, [], p.x, p.y, null, .42))).toBe(true);
  expect(centipedeReservations(f.director)).toHaveLength(1);
  f.tick(9.9); expect(f.enemies).toHaveLength(0);
  f.tick(.1); expect(f.enemies).toHaveLength(1);
  expect(f.enemies[0]).toMatchObject({ kind: 'centipede', rootId: 'root', siteId: 'root', hp: 2400, maxHp: 2400 });
  expect(f.enemies[0].body).toHaveLength(8);
  expect(centipedeReservations(f.director)).toEqual([]);
});

it('preserves a pending birth and source across checkpoint reload without duplicate IDs or warnings', () => {
  const f = fixture(); f.tick(60);
  const warning = structuredClone(centipedeSpawnView(f.director).warnings[0]);
  f.reload(); f.tick(5);
  expect(centipedeSpawnView(f.director).warnings[0]).toEqual(warning);
  f.tick(5); const id = f.enemies[0].id;
  f.tick(1); expect(f.enemies.map(e => e.id)).toEqual([id]);
  expect(f.events.filter(e => e.event === 'centipede.warning')).toHaveLength(1);
});

it('does not accumulate absent-island time or queue arrivals when global slots are full', () => {
  const f = fixture(), contact = f.contacts.pop();
  f.tick(3600); expect(f.director.centipedes.roots.root.activeMs).toBe(0);
  f.contacts.push(contact); f.enemies.push(...Array.from({ length: 24 }, (_, i) => newGroundEnemy('hunter', i, { x: 5, y: 5 })));
  f.tick(60); expect(centipedeReservations(f.director)).toEqual([]);
  f.enemies.length = 0; f.tick(12);
  expect(centipedeReservations(f.director)).toHaveLength(1);
  expect(f.enemies).toHaveLength(0);
});

it('counts pending and sleeping giants against one-per-island and two-global limits', () => {
  const f = fixture(true); f.tick(60); f.tick(1);
  expect(centipedeReservations(f.director)).toHaveLength(2);
  f.tick(9); f.tick(1);
  expect(f.enemies.filter(e => e.kind === 'centipede')).toHaveLength(2);
  f.sleeping.push(...f.enemies.splice(0)); f.tick(100);
  expect(centipedeReservations(f.director)).toEqual([]);
  expect(f.sleeping).toHaveLength(2);
});

it('cancels a root birth when the warned footprint is occupied rather than silently relocating it', () => {
  const f = fixture(); f.tick(60);
  const warning = centipedeSpawnView(f.director).warnings[0];
  f.buildings.push({ id: 'new-sentry', x: Math.floor(warning.x), y: Math.floor(warning.y) });
  f.tick(10); expect(f.enemies).toHaveLength(0);
  expect(f.events.some(e => e.event === 'centipede.arrival.cancelled')).toBe(true);
  // A subsequent attempt may get a new warning; it must never skip the windup.
  expect(centipedeSpawnView(f.director).warnings.every((p: any) => p.at > f.now)).toBe(true);
});

it('root destruction cancels unborn units and disables brood without deleting the giant or its children', () => {
  const f = fixture(), mother = birth(f); f.refill(); f.tick(20);
  expect(centipedeSpawnView(f.director).warnings[0]).toMatchObject({ kind: 'brood', motherId: mother.id });
  const child = { ...newGroundEnemy('hunter', 500, { x: 10, y: 10 }), broodMotherId: mother.id }; f.enemies.push(child);
  f.world.sites[0].state = 'conquered'; f.world.sites[0].hp = 0;
  f.tick(.1); expect(mother.broodDisabled).toBe(true);
  expect(centipedeReservations(f.director)).toEqual([]);
  f.tick(500); expect(f.enemies.map(e => e.id)).toEqual([mother.id, child.id]);
  expect(mother.hp).toBe(2400);
});

it('planet conquest cancels every warning and preserves existing surviving bodies', () => {
  const f = fixture(), mother = birth(f); f.refill(); f.tick(20);
  expect(centipedeReservations(f.director).length).toBeGreaterThan(0);
  f.tick(.1, true); expect(centipedeReservations(f.director)).toEqual([]);
  expect(f.enemies).toEqual([mother]); expect(mother.broodDisabled).toBe(true);
  f.tick(10000, true); expect(f.enemies).toEqual([mother]);
});

it('uses shared credits once, caps offspring at four including sleeping/reserved, and never emits recursive giants', () => {
  const f = fixture(), mother = birth(f), island = islandAt(f.world, mother.x, mother.y)!;
  f.refill(); f.tick(20);
  expect(centipedeReservations(f.director)).toHaveLength(2);
  expect(f.director.pressure.islands[island].credit).toBe(0);
  f.reload(); f.tick(2);
  expect(f.enemies.filter(e => e.broodMotherId === mother.id)).toHaveLength(2);
  f.refill(); f.tick(18); f.tick(2);
  expect(f.enemies.filter(e => e.broodMotherId === mother.id)).toHaveLength(4);
  f.sleeping.push(...f.enemies.splice(1, 2)); f.refill(); f.tick(100);
  expect(centipedeReservations(f.director)).toEqual([]);
  expect(f.enemies.concat(f.sleeping).filter(e => e.kind === 'centipede')).toHaveLength(1);
});

it('the brood roster can produce every existing land type while respecting live, sleeping and pending lens limits', () => {
  const f = fixture(), mother = birth(f), kinds = new Set<string>();
  for (let wave = 0; wave < 7; wave++) {
    f.enemies.splice(1); f.refill(); mother.nextBrood = f.now;
    f.tick(1); for (const p of centipedeReservations(f.director)) kinds.add(p.kind);
    f.tick(2);
  }
  expect([...kinds].sort()).toEqual(['breaker', 'bulwark', 'heavy-lens', 'hunter', 'twin-lens']);
  f.enemies.splice(1); mother.broodWave = 4; mother.nextBrood = f.now; f.refill();
  f.sleeping.push(...Array.from({ length: 3 }, (_, i) => newGroundEnemy('twin-lens', 700 + i, { x: 5, y: 5 })));
  f.external.push({ kind: 'heavy-lens', x: 5, y: 7 }); f.tick(1);
  expect(centipedeReservations(f.director).map((p: any) => p.kind)).toEqual(['hunter', 'hunter']);
});

it('a second root cannot bypass the island replacement cooldown after a giant dies', () => {
  const f = fixture(), mother = birth(f);
  f.world.sites.push({ id: 'other-root', kind: 'modifier', x: 20, y: 35, hp: 480, state: 'hostile' });
  f.tick(60); mother.hp = 0; f.tick(.1);
  expect(f.director.centipedes.cooldowns[islandAt(f.world, mother.x, mother.y)!]).toBeGreaterThan(179000);
  f.tick(178); expect(centipedeReservations(f.director)).toEqual([]);
  f.refill(); f.tick(2); expect(centipedeReservations(f.director)).toHaveLength(1);
  expect(f.enemies.filter(e => e.hp > 0)).toHaveLength(0);
});

it('a dead root cancels its initial warning even when other hostile facilities remain', () => {
  const f = fixture(); f.tick(60); f.world.sites[0].hp = 0;
  f.tick(10); expect(f.enemies).toHaveLength(0); expect(centipedeReservations(f.director)).toEqual([]);
  expect(CENTIPEDE_SPAWN.replacement).toBeGreaterThan(CENTIPEDE_SPAWN.first);
});
