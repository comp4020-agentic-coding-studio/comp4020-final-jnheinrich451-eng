import { expect, it } from 'vitest';
import { reportSectorAttack, investigationPoint, territoryVisible, DEFENSE } from '../public/sector-defense.js';
import { createWorld, canStand } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { seedConquest, tickSites, ALERT, siteCenter } from '../public/conquest.js';

function setup() {
  const world: any = { ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2), tanks: [], ships: [], cores: [], rails: [], artillery: [], airbases: [], sites: [] };
  world.sites = seedConquest(world, [], []);
  world.sites.push(...seedConquest(world, [], [], 'mortar'));
  for (const s of world.sites) s.guardsRemaining = 0;
  return { world, alert: world.sites[0], mortar: world.sites[1] };
}

it('reports impact positions to local defenses once per second, without recursive propagation', () => {
  const { world, alert, mortar } = setup(), p = siteCenter(mortar), events: any[] = [];
  const remote = { ...alert, id: 'remote', x: 40, y: 15 }; world.sites.push(remote);
  const enemies: any[] = [{ hp: 60, x: p.x + 8, y: p.y }, { hp: 60, x: p.x + 14, y: p.y }];
  expect(reportSectorAttack(world.sites, enemies, p.x, p.y, 100, e => events.push(e))).toBe(true);
  expect(alert.defenseReport).toMatchObject({ x: p.x, y: p.y, until: 8100 });
  expect(remote.defenseReport).toBeUndefined(); expect(enemies[0].investigation).toEqual(alert.defenseReport);
  expect(enemies[1].investigation).toBeUndefined(); expect(alert.defenseReport.targetId).toBeUndefined();
  expect(reportSectorAttack(world.sites, enemies, p.x, p.y, 500, e => events.push(e))).toBe(false);
  expect(events).toHaveLength(1); expect(reportSectorAttack(world.sites, enemies, 5, 5, 1200)).toBe(false);
});

it('only intact alert stations call warned, capped reinforcements near a reported attack', () => {
  const { world, alert, mortar } = setup(), p = siteCenter(mortar), enemies: any[] = []; let serial = 0;
  reportSectorAttack(world.sites, enemies, p.x, p.y, 100);
  tickSites(world.sites, world, [], [], enemies, 100, () => ++serial);
  expect(alert.pending).toMatchObject({ kind: 'reinforcement', origin: p, at: 100 + ALERT.warning });
  expect(mortar.pending).toBeNull(); expect(enemies).toEqual([]);
  tickSites(world.sites, world, [], [], enemies, 100 + ALERT.warning, () => ++serial);
  expect(enemies).toHaveLength(2); expect(enemies.every(e => Math.hypot(e.x - p.x, e.y - p.y) < 6)).toBe(true);
  for (let now = 2400; now <= 60000; now += 100) {
    reportSectorAttack(world.sites, enemies, p.x, p.y, now);
    tickSites(world.sites, world, [], [], enemies, now, () => ++serial);
  }
  expect(enemies).toHaveLength(ALERT.max);
  alert.state = 'conquered'; alert.pending = null; enemies.length = 0;
  reportSectorAttack(world.sites, enemies, p.x, p.y, 62000);
  tickSites(world.sites, world, [], [], enemies, 65000, () => ++serial);
  expect(alert.pending).toBeNull(); expect(mortar.pending).toBeNull(); expect(enemies).toEqual([]);
});

it('a final strike alerts surviving neighbors without reviving conquered territory', () => {
  const { world, alert, mortar } = setup(), p = siteCenter(mortar);
  mortar.state = 'conquered'; mortar.conqueredAt = 100;
  expect(reportSectorAttack(world.sites, [], p.x, p.y, 100)).toBe(true);
  expect(alert.alarmUntil).toBe(8100); expect(mortar.defenseReport).toBeUndefined();
  expect(reportSectorAttack(world.sites, [], p.x, p.y, 1200)).toBe(false);
});

it('a sleeping station dispatches its initial guards to the reported front without an extra wave', () => {
  const { world, alert, mortar } = setup(), p = siteCenter(mortar), enemies: any[] = []; let serial = 0;
  alert.guardsRemaining = ALERT.guards;
  reportSectorAttack(world.sites, enemies, p.x, p.y, 100);
  tickSites(world.sites, world, [], [], enemies, 100, () => ++serial);
  expect(alert.pending).toMatchObject({ kind: 'guards', origin: p });
  tickSites(world.sites, world, [], [], enemies, 100 + ALERT.warning, () => ++serial);
  expect(enemies).toHaveLength(ALERT.guards); expect(alert.guardsRemaining).toBe(0);
  expect(enemies.every(e => Math.hypot(e.x - p.x, e.y - p.y) < 6)).toBe(true);
  expect(alert.pending).toBeNull(); expect(alert.nextCall).toBe(100 + ALERT.warning + ALERT.interval);
});

it('saves a finite investigation and warned arrival, with no remote live target knowledge', () => {
  const { world, alert, mortar } = setup(), p = siteCenter(mortar), combat = createCombat(world);
  expect(combat.shoot({ id: 'remote', x: p.x - 40, y: p.y, turret: Math.PI / 2 }, p.x, p.y, 'LASER')).toBeNull();
  expect(alert.defenseReport).toBeUndefined(); // Empty ground / out of weapon reach.
  expect(combat.lob({ id: 'remote', x: p.x - 40, y: p.y }, p.x, p.y)).toBeNull();
  for (let i = 0; i < 80 && !alert.pending; i++) combat.tick(.1, []);
  expect(alert.pending).toBeTruthy(); expect(alert.sensor.marks).toEqual([]);
  const saved = combat.checkpoint(), resumedWorld = structuredClone(world), resumed = createCombat(resumedWorld, saved);
  expect(resumed.snapshot().time).toBe(saved.now); expect(resumedWorld.sites[0].pending).toEqual(alert.pending);
  for (let i = 0; i < 100; i++) resumed.tick(.1, []);
  expect(resumedWorld.sites[0].alarm).toBe(false); expect(resumedWorld.sites[0].defenseReport.until).toBeLessThan(resumed.snapshot().time);
  expect(resumed.snapshot().enemies.every(e => !e.targetId)).toBe(true);
});

it('investigates accessible ground beside a struck solid structure, respecting local bounds', () => {
  const { world, mortar } = setup(), p = siteCenter(mortar), enemy = { x: p.x - 6, y: p.y };
  const goal = investigationPoint(p, enemy, (x: number, y: number) => canStand(world, [], x, y));
  expect(goal).toBeTruthy(); expect(canStand(world, [], goal!.x, goal!.y)).toBe(true);
  expect(goal!.x).toBeLessThan(p.x); expect(investigationPoint(p, enemy, () => false)).toBeNull();
});

it('a bullet hit inside territory sends nearby defenders toward the victim instead of the shooter', () => {
  const { world, mortar } = setup(), p = siteCenter(mortar), saved = createCombat(world).checkpoint();
  saved.serial = 2;
  saved.enemies = [0, 4].map((dy, index) => ({ id: index + 1, x: p.x - 8, y: p.y + dy, hp: 60, angle: 0,
    siteId: mortar.id, homeX: p.x - 8, homeY: p.y + dy, path: [], reroute: 0, behavior: 'guarding' }));
  const combat = createCombat(world, saved);
  combat.shoot({ id: 'distant', x: p.x - 20, y: p.y, turret: Math.PI / 2 }, p.x - 8, p.y, 'APCR');
  for (let i = 0; i < 15; i++) combat.tick(.1, []);
  const enemies = combat.snapshot().enemies;
  expect(enemies.find(e => e.id === 1)!.hp).toBe(42);
  expect(enemies.find(e => e.id === 2)!.y).toBeLessThan(p.y + 4);
  expect(world.sites[0].defenseReport).toMatchObject({ x: p.x - 8, y: p.y });
  expect(enemies.every(e => !e.targetId)).toBe(true);
});

it('shows territorial shading only in orbital or zoomed-out views', () => {
  expect(territoryVisible(.7)).toBe(false); expect(territoryVisible(.35)).toBe(true);
  expect(territoryVisible(1, true)).toBe(true); expect(DEFENSE.memory).toBeLessThan(ALERT.interval);
});
