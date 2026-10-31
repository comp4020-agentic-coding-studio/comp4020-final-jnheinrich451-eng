import { expect, it } from 'vitest';
import { createCombat } from '../public/combat.js';
import { makeSite } from '../public/conquest.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { freshLogistics } from '../public/logistics.js';
import { freshLife } from '../public/survival.js';
import { centipedeReservations } from '../public/centipede-spawn.js';

function fixture() {
  const world: any = { width: 180, height: 120, terrain: Array.from({ length: 180 * 120 }, (_, i) => i % 180 >= 120 ? 0 : 2),
    spawn: { x: 30.5, y: 30.5 }, sites: [{ ...makeSite('modifier', 'root', 85, 85), guardsRemaining: 0, nextCall: 1e9 }],
    cores: [], tanks: [], ships: [], airbases: [], artillery: [], rails: [], logistics: freshLogistics() };
  const saved: any = createCombat(world, null, null, 'centipede-admission').checkpoint();
  saved.enemies = Array.from({ length: 21 }, (_, i) => ({ ...newGroundEnemy('hunter', i + 1, { x: 98.5 + i % 7, y: 88.5 + Math.floor(i / 7) }),
    siteId: 'root', homeX: 98.5, homeY: 88.5 }));
  saved.serial = 100;
  saved.director.nextRaid = 1e9;
  saved.director.centipedes = { version: 1, roots: { root: { activeMs: 60000, cooldown: 0, giantId: null, retryAt: 0 } }, cooldowns: {}, serial: 1, cursor: 0, nextPulse: 0,
    pending: [{ id: 'centipede-arrival-1', kind: 'centipede', rootId: 'root', pressureIsland: 'island:0',
      x: 86.5, y: 77.5, at: 100000, windup: 10000, angle: 0, points: [{ x: 86.5, y: 77.5, kind: 'centipede' }],
      trail: [{ x: 86.5, y: 77.5 }, { x: 86.5, y: 82.75 }] }] };
  return { world, saved };
}
function population(saved: any) {
  return saved.enemies.filter((e: any) => e.hp > 0).length
    + saved.sites.reduce((n: number, s: any) => n + (s.pending?.points.length || 0), 0)
    + (saved.frenzy?.phase === 'warning' ? saved.frenzy.points.length : 0)
    + centipedeReservations(saved.director).length;
}

it('manual drill keeps the reserved giant slot and cannot overbook the shared population', () => {
  const { world, saved } = fixture(), combat = createCombat(world, saved);
  expect(combat.start([])).toBeNull();
  const after = combat.checkpoint();
  expect(after.enemies).toHaveLength(23); expect(centipedeReservations(after.director)).toHaveLength(1);
  expect(population(after)).toBe(24);
});

it('manual frenzy reserves only remaining slots beside a pending giant', () => {
  const { world, saved } = fixture(), combat = createCombat(world, saved);
  expect(combat.startFrenzy({ id: 'caller', ...world.spawn }, [])).toBeNull();
  expect(combat.checkpoint().frenzy.points).toHaveLength(2);
  expect(population(combat.checkpoint())).toBe(24);
});

it('naval contact cannot consume the root warning reservation', () => {
  const { world, saved } = fixture(), ship: any = { id: 'ship', kind: 'gunship', x: 150.5, y: 60.5, angle: 0,
    berthX: 150.5, berthY: 60.5, health: 300, elapsed: 20 };
  world.ships.push(ship);
  const combat = createCombat(world, saved);
  expect(combat.contact(ship)).toBeNull();
  expect(combat.checkpoint().enemies.filter((e: any) => e.kind === 'swimmer')).toHaveLength(2);
  expect(population(combat.checkpoint())).toBe(24);
});

it('sleeping survivors and site producers respect the new reservation during a real combat tick', () => {
  const { world, saved } = fixture();
  saved.director.sleeping = Array.from({ length: 3 }, (_, i) => ({ ...newGroundEnemy('hunter', 200 + i, { x: 72.5 + i, y: 74.5 }), siteId: 'root', homeX: 72.5, homeY: 74.5 }));
  const p = { id: 'pilot', x: 80.5, y: 70.5, body: 'robot', ...freshLife(), shield: 0 };
  const combat = createCombat(world, saved);
  combat.tick(.1, [], [], [p]);
  const after = combat.checkpoint();
  expect(after.enemies).toHaveLength(23); expect(after.director.sleeping).toHaveLength(1);
  expect(centipedeReservations(after.director)).toHaveLength(1); expect(population(after)).toBe(24);
});

it('final conquest clears a pending giant before any producer can hatch it', () => {
  const { world, saved } = fixture(); saved.sites[0].state = 'conquered'; saved.sites[0].hp = 0;
  const combat = createCombat(world, saved); combat.tick(.1, [], [], []);
  expect(combat.snapshot().conquest.state).toBe('conquered');
  expect(centipedeReservations(combat.checkpoint().director)).toEqual([]);
  expect(combat.snapshot().enemies).toHaveLength(21);
});
