import { expect, it } from 'vitest';
import { createWorld, SPEED } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { freshLife } from '../public/survival.js';
import { newGroundEnemy, assignBulwarkGuards } from '../public/enemy-profiles.js';
import { makeField, contactField, heatSpeed, lureRoute } from '../public/hazards.js';
import { createEnemyNavigator, NAVIGATION } from '../public/enemy-navigation.js';
import { guardStep } from '../public/guard.js';
import { freshLogistics } from '../public/logistics.js';
import { orbitalState } from '../public/orbital.js';

const world = (): any => ({ ...createWorld(), width: 48, height: 36, terrain: Array(48 * 36).fill(2), logistics: freshLogistics() });
function field(kind = 'bulwark', frozen = true) {
  const w = world(), saved = createCombat(w).checkpoint(); saved.serial = 1;
  saved.enemies = [{ ...newGroundEnemy(kind, 1, { x: 20.5, y: 18.5 }), ...(frozen ? { frenzyRecoveryUntil: 1e6 } : {}) }];
  return { w, c: createCombat(w, saved) };
}

it.each(['APCR', 'NAVAL_APCR', 'LASER', 'FLAME', 'HEAVY_FLAME'])('blocks %s with honest impact feedback and no ignition', weapon => {
  const { c } = field();
  const gun = { id: 'gun', x: 17.5, y: 18.5, turret: Math.PI / 2, mount: weapon === 'NAVAL_APCR' ? 'naval-secondary' : 'coax' };
  expect(c.shoot(gun, 20.5, 18.5, weapon)).toBeNull();
  c.tick(.3, []);
  expect(c.snapshot().enemies[0]).toMatchObject({ hp: 450, kind: 'bulwark' });
  expect(c.snapshot().enemies[0].burnUntil).toBeUndefined();
  expect(c.snapshot().impacts.flatMap(i => i.hits)).toContainEqual(expect.objectContaining({ id: 1, blocked: true, killed: false }));
});

it('takes real HE and charged magnetic damage, persisting health across restart', () => {
  const { w, c } = field(), gun = { id: 'tank', x: 17.5, y: 18.5, turret: Math.PI / 2, life: 'active', body: 'rover', tankWeapon: 'MAGNETIC' };
  c.shoot(gun, 20.5, 18.5, 'HE'); c.tick(.3, []);
  expect(c.snapshot().enemies[0].hp).toBe(375);
  const restored = createCombat(w, structuredClone(c.checkpoint()));
  expect(restored.shoot(gun, 20.5, 18.5, 'MAGNETIC')).toBeNull();
  restored.tick(.9, [], [], [gun]); expect(restored.snapshot().enemies[0].hp).toBe(375);
  restored.tick(.1, [], [], [gun]); expect(restored.snapshot().enemies[0].hp).toBe(195);
  expect(restored.snapshot().impacts.flatMap(i => i.hits)).toContainEqual(expect.objectContaining({ blocked: false }));
});

it.each(['HE', 'INCENDIARY', 'GAS'])('resolves heavy %s correctly without wasting a gas charge', weapon => {
  const { c } = field();
  expect(c.lob({ id: 'rail', x: 12.5, y: 18.5 }, 20.5, 18.5, { duration: .01, verticalSpeed: 1, gravity: 12, elevation: 75 }, weapon)).toBeNull();
  c.tick(.01, []);
  // Rail HE now deals 420 damage; ship/aircraft heavy shells keep their own profile.
  expect(c.snapshot().enemies[0].hp).toBe(weapon === 'HE' ? 30 : 450);
  if (weapon === 'GAS') expect(c.snapshot().fields[0].capacity).toBe(c.snapshot().fields[0].initialCapacity);
});

it('keeps orbital lasers ineffective while orbital HE can damage the armored unit', () => {
  for (const payload of ['HE', 'BEAM']) {
    const { w, c } = field();
    expect(c.orbitalOrder({ orderId: 'armor-orbital-test', sequence: 1, payload, target: { x: 20.5, y: 18.5 }, bearing: 1, end: { x: 28.5, y: 18.5 } }, { id: 'p', name: 'Pilot' }).error).toBeUndefined();
    c.tick(orbitalState(w).order.delay + .25, []);
    const hits = c.snapshot().impacts.flatMap(i => i.hits).filter(h => h.id === 1);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(h => h.blocked === (payload === 'BEAM'))).toBe(true);
  }
});

it('ignores gas lure and heat while leaving normal enemies vulnerable', () => {
  const w = world(), e = newGroundEnemy('bulwark', 1, { x: 20.5, y: 18.5 });
  const gas = makeField(1, 'GAS', e.x, e.y, 0), fire = makeField(2, 'INCENDIARY', e.x, e.y, 0);
  expect(contactField([gas, fire], e)).toBeNull(); expect(gas.capacity).toBe(gas.initialCapacity);
  expect(heatSpeed([fire], e)).toBe(1); expect(lureRoute(w, [], e, [gas], () => false)).toBeNull();
  expect(contactField([gas], { ...e, kind: 'breaker' })).toBe(gas);
  expect(gas.capacity).toBe(gas.initialCapacity! - 1);
});

it('shares route budgets while crossing heat and still respects water and rocks', () => {
  const w = world(), nav = createEnemyNavigator(w), start = { x: 10.5, y: 10.5 }, goals = [{ x: 12.5, y: 10.5 }];
  nav.begin([], (x: number) => x > 11, 0);
  expect(nav.route('hunter', start, goals).status).toBe('blocked');
  expect(nav.route('bulwark', start, goals, true).status).toBe('found');
  for (const terrain of [0, 3]) {
    w.terrain[10 * w.width + 12] = terrain; nav.begin([], () => true, 100);
    expect(nav.route('bulwark', start, goals, true).status).toBe('blocked');
  }
  w.terrain.fill(2); nav.begin([], () => false, 200);
  for (let i = 0; i < 30; i++) nav.route(i, { x: .5, y: .5 }, [{ x: 47.5, y: 35.5 }], i % 2 === 0);
  expect(nav.stats().expanded).toBeLessThanOrEqual(NAVIGATION.perTick);
});

it('lets hunters chase just below robot speed while heavy enemies remain slower', () => {
  const distance: number[] = [];
  for (const kind of ['hunter', 'breaker', 'bulwark']) {
    const { c } = field(kind, false), p = { id: 'runner', x: 26.5, y: 18.5, ...freshLife() };
    for (let i = 0; i < 10; i++) { p.x += SPEED * .1; c.tick(.1, [], [p]); }
    distance.push(c.snapshot().enemies[0].x - 20.5); expect(p.health).toBe(100);
  }
  expect(distance[0]).toBeCloseTo(2.6); expect(distance[0]).toBeLessThan(SPEED);
  expect(distance[1]).toBeCloseTo(.95); expect(distance[2]).toBeCloseTo(.65);
});

it('makes automatic robot and sentry weapons select a damageable enemy', () => {
  const { w, c } = field(), saved = c.checkpoint();
  saved.enemies.push({ ...newGroundEnemy('hunter', 2, { x: 17.5, y: 21.5 }), frenzyRecoveryUntil: 1e6 });
  const robot = { id: 'guard', x: 17.5, y: 18.5, ...freshLife(), guarding: true, turret: 0 }, state: any = {};
  guardStep(robot, state, saved.enemies, w, [], .1); expect(state.targetId).toBe(2);
  const combat = createCombat(w, saved); combat.tick(.1, [{ id: 'sentry', x: 17, y: 18 }]);
  expect(combat.snapshot().sentries.sentry.targetId).toBe(2);
});

it('upgrades finite mortar-compound guards once without changing pending, conquered or exhausted rosters', () => {
  const site = (id: string, extra = {}): any => ({ id, kind: 'mortar', encounter: { id }, state: 'hostile', guardsRemaining: 3, guardRoster: ['hunter', 'breaker', 'hunter'], ...extra });
  const sites = [site('live'), site('pending', { pending: { remaining: 2 } }), site('conquered', { state: 'conquered' }), site('empty', { guardsRemaining: 0, guardRoster: [] }), site('other', { kind: 'alert' })];
  const previous = structuredClone(sites);
  expect(assignBulwarkGuards(sites)).toBe(1);
  expect(sites[0].guardRoster).toEqual(['hunter', 'breaker', 'bulwark']); expect(sites[0].guardsRemaining).toBe(3);
  expect(sites.slice(1)).toEqual(previous.slice(1)); expect(assignBulwarkGuards(sites)).toBe(0);
});


it('spawns the upgraded guard through the existing warning and consumes its finite saved roster', async () => {
  const { makeSite, tickSites, ALERT } = await import('../public/conquest.js');
  const w = world(), site: any = { ...makeSite('mortar', 'armored-site', 20, 18), encounter: { id: 'bastion' }, guardsRemaining: 1, guardRoster: ['hunter'], awake: true };
  w.sites = [site]; assignBulwarkGuards(w.sites);
  const enemies: any[] = []; let serial = 0;
  tickSites(w.sites, w, [], [], enemies, 0, () => ++serial, () => false, ALERT.globalMax);
  expect(site.pending).toBeNull(); expect(site.guardRoster).toEqual(['bulwark']);
  tickSites(w.sites, w, [], [], enemies, 100, () => ++serial, () => false, ALERT.globalMax - 1);
  expect(site.pending.points).toHaveLength(1); expect(enemies).toHaveLength(0);
  const restored = JSON.parse(JSON.stringify(w));
  tickSites(restored.sites, restored, [], [], enemies, 2400, () => ++serial, () => false, ALERT.globalMax - 1);
  expect(enemies).toHaveLength(1); expect(enemies[0]).toMatchObject({ kind: 'bulwark', hp: 450, maxHp: 450 });
  expect(restored.sites[0].guardRoster).toEqual([]); expect(restored.sites[0].guardsRemaining).toBe(0);
  tickSites(restored.sites, restored, [], [], enemies, 20000, () => ++serial);
  expect(enemies).toHaveLength(1);
});

it('telegraphs a heavy Bulwark strike and lets the player escape its locked point', () => {
  for (const dodge of [false, true]) {
    const { w, c } = field('bulwark', false), p = { id: 'robot', x: 20.5, y: 19.1, ...freshLife() };
    c.tick(.1, [], [p]); expect(c.snapshot().enemies[0].attack).toMatchObject({ windup: 1800, radius: 1.1 });
    const restored = createCombat(w, structuredClone(c.checkpoint()));
    if (dodge) p.x += 3;
    for (let i = 0; i < 17; i++) restored.tick(.1, [], [p]); expect(p.health).toBe(100);
    restored.tick(.11, [], [p]); expect(p.health).toBe(dodge ? 100 : 25);
  }
});
