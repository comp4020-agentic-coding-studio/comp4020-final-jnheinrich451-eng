import { expect, it } from 'vitest';
import { createCombat } from '../public/combat.js';
import { freshLogistics } from '../public/logistics.js';
import { freshLife } from '../public/survival.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { AERIAL, newAerialEnemy } from '../public/aerial-enemy.js';
import { isAirEnemy } from '../public/target-domain.js';
import { aaAimSolution } from '../public/aa-vehicle.js';
import { driveTank } from '../public/tank-motion.js';
import { makeSite } from '../public/conquest.js';
import { newAirbase, bombPattern } from '../public/aircraft.js';
import { makeField } from '../public/hazards.js';

function field(): any {
  return { width: 256, height: 192, terrain: Array(256 * 192).fill(2), spawn: { x: 10, y: 10 },
    sites: [], cores: [], tanks: [], ships: [], airbases: [], artillery: [], rails: [], logistics: freshLogistics() };
}
const actor = (id = 'pilot', x = 60.5, y = 60.5): any => ({ id, x, y, body: 'robot', ...freshLife(), health: 10000 });
const ground = (id = 2, x = 25.5, y = 20.5, hp = 600): any =>
  ({ ...newGroundEnemy('hunter', id, { x, y }), hp, maxHp: hp, frenzyRecoveryUntil: 1e9 });
// A saved, far-future warning keeps the target still while testing weapon paths.
const air = (id = 1, x = 23.5, y = 20.5, hp: number = AERIAL.hp): any => ({ ...newAerialEnemy(id, { x, y }), hp, maxHp: hp,
  attack: { kind: 'skimmer', x, y, at: 0, fireAt: 1e9, targetId: 'stationary-fixture' } });
const aa = (w: any): any => {
  const tank = { id: 'aa', kind: 'aa', owner: 'pilot', occupant: 'pilot', x: 20.5, y: 20.5, angle: Math.PI / 2,
    turret: Math.PI / 2, elapsed: 99, health: 200, weapon: 'AA35', secondary: 'APCR', driveSpeed: 0 };
  w.tanks.push(tank); return tank;
};
function combat(w: any, enemies: any[], seed: string | null = null) {
  const saved = createCombat(w, null, null, seed).checkpoint(); saved.enemies = enemies; saved.serial = 100;
  if (saved.director) saved.director.nextRaid = 1e9;
  return createCombat(w, saved);
}
function advance(c: any, seconds: number, sources: any[] = [], robots: any[] = []) {
  for (let step = 0; step < Math.round(seconds * 20); step++) c.tick(.05, [], robots, sources);
}
const hp = (c: any, id: number) => c.snapshot().enemies.find((e: any) => e.id === id)?.hp || 0;
const reserved = (saved: any) => saved.sites.reduce((sum: number, s: any) => sum + (s.pending?.points.length || 0), 0)
  + (saved.frenzy?.phase === 'warning' ? saved.frenzy.points.length : 0);
const totalAir = (saved: any) => saved.enemies.concat(saved.director?.sleeping || []).filter((e: any) => e.hp > 0 && isAirEnemy(e)).length
  + saved.sites.reduce((sum: number, s: any) => sum + (s.pending?.points || []).filter(isAirEnemy).length, 0);

it.each(['air', 'ground'])('AA35 damages %s targets while its tracked hull is moving', domain => {
  const w = field(), tank = aa(w), target = domain === 'air' ? air(1, 28.5, 20.5) : ground(1, 27.5, 20.5);
  const c = combat(w, [target]), original = target.hp;
  driveTank(tank, { x: 0, y: -1 }, .1, () => true); tank.driveSpeed = 2;
  expect(c.shoot({ id: 'pilot', x: tank.x, y: tank.y, turret: Math.PI / 2 }, target.x, target.y, 'AA35')).toBeNull();
  expect(c.checkpoint().shells).toHaveLength(1);
  expect(c.checkpoint().shells.every((shell: any) => shell.domain === domain)).toBe(true);
  for (let step = 0; step < 5; step++) { driveTank(tank, { x: 0, y: -1 }, .05, () => true); c.tick(.05, []); }
  expect(tank.x).toBeGreaterThan(20.5); expect(hp(c, 1)).toBe(original - 20);
});

it('soft assist predicts near a flyer without overwriting the raw cursor, and free/forced-ground aim stays available', () => {
  const w = field(), tank = aa(w), flyer = { ...air(1, 29, 20.5), vx: 2, vy: 0 }, cursor = { x: 29.5, y: 20.75 };
  const solution = aaAimSolution(w, [], tank, [flyer], cursor.x, cursor.y);
  expect(solution).toMatchObject({ domain: 'air', targetId: flyer.id }); expect(solution.x).toBeGreaterThan(flyer.x);
  expect(cursor).toEqual({ x: 29.5, y: 20.75 });
  expect(aaAimSolution(w, [], tank, [flyer], 40, 25)).toEqual({ x: 40, y: 25, domain: 'ground', targetId: null });
  tank.aaGround = true;
  expect(aaAimSolution(w, [], tank, [flyer], cursor.x, cursor.y)).toEqual({ ...cursor, domain: 'ground', targetId: null });
});

it.each(['APCR', 'HE', 'MAGNETIC', 'FLAME'])('%s passes through a flyer to its ground target without damaging the flyer', weapon => {
  const w = field(), c = combat(w, [air(1, 22.5, 20.5), ground(2, 24.5, 20.5)]);
  const source = { ...actor('gun', 20.5, 20.5), body: 'rover', tankWeapon: 'MAGNETIC', turret: Math.PI / 2 };
  expect(c.shoot(source, 24.5, 20.5, weapon)).toBeNull(); advance(c, 1.5, [source]);
  expect(hp(c, 1)).toBe(AERIAL.hp); expect(hp(c, 2)).toBeLessThan(600);
});

it('rail MAC passes through an airborne target and still penetrates the armored surface target', () => {
  const w = field(), gun = { id: 'mac', kind: 'mac', owner: 'pilot', x: 10, y: 40, angle: Math.PI / 2 };
  w.artillery = [gun];
  const c = combat(w, [air(1, 20.5, 40.5), { ...ground(2, 30.5, 40.5, 1200), kind: 'bulwark' }]);
  expect(c.macFire(gun)).toBeNull(); advance(c, 3.5);
  expect(hp(c, 1)).toBe(AERIAL.hp); expect(hp(c, 2)).toBe(300);
});

it.each(['orbital', 'bomber'])('%s HE area damage affects the ground body but not the overhead flyer', source => {
  const w = field(); let point = { x: 60, y: 50 }, plane: any;
  if (source === 'bomber') {
    const base = newAirbase('runway', 'pilot', 40, 40); plane = base.aircraft;
    Object.assign(plane, { state: 'flying', x: 40, y: 50, speed: 6, angle: Math.PI / 2, payload: 'HEAVY' });
    w.airbases = [base]; point = bombPattern(plane)[0];
  }
  const c = combat(w, [air(1, point.x, point.y), ground(2, point.x, point.y, 10000)]);
  if (source === 'orbital') {
    expect(c.orbitalOrder({ orderId: 'air-domain-orbital', sequence: 1, payload: 'HEAVY', target: point, bearing: 0 }, { id: 'pilot', name: 'Pilot' }).error).toBeUndefined();
    c.tick(w.logistics.orbital.order.delay + 1, [], [], []);
  } else { expect(c.bombRun(plane)).toBeNull(); c.tick(2, []); }
  expect(hp(c, 1)).toBe(AERIAL.hp); expect(hp(c, 2)).toBeLessThan(10000);
});

it('ground fields spare a flyer without consuming gas, while the laser burns air above low cover but stops at mountains', () => {
  const w = field(), initial = combat(w, [air()]).checkpoint();
  initial.fields = [makeField(10, 'GAS', 23.5, 20.5, 0), makeField(11, 'INCENDIARY', 23.5, 20.5, 0)];
  const c = createCombat(w, initial); c.tick(.1, []);
  expect(hp(c, 1)).toBe(180); expect(c.snapshot().fields.find((f: any) => f.weapon === 'GAS').capacity).toBe(6);
  const gun = { id: 'robot', x: 20.5, y: 20.5, turret: Math.PI / 2 };
  expect(c.shoot(gun, 23.5, 20.5, 'LASER')).toBeNull(); expect(hp(c, 1)).toBe(156);
  advance(c, 1); expect(hp(c, 1)).toBeCloseTo(146);
  const low = field(); low.terrain[20 * low.width + 22] = 3;
  const overCover = combat(low, [air()]); overCover.shoot(gun, 23.5, 20.5, 'LASER'); advance(overCover, 1);
  expect(hp(overCover, 1)).toBe(146);
  const blocked = field(); blocked.mountains = Array(blocked.width * blocked.height).fill(0); blocked.mountains[20 * blocked.width + 22] = 2;
  const obscured = combat(blocked, [air()]); expect(obscured.shoot(gun, 23.5, 20.5, 'LASER')).toBeNull(); advance(obscured, 1);
  expect(hp(obscured, 1)).toBe(180);
});

it('AA automatic defense prioritises air and preserves its hull cooldown across boarding and disembarking', () => {
  const w = field(), tank = aa(w); tank.occupant = null;
  const c = combat(w, [air(1, 28.5, 20.5), ground(2, 24.5, 20.5)]);
  c.tick(.01, []); expect(tank.aaGuard.targetId).toBe(1); expect(tank.aaAim.domain).toBe('air');
  expect(c.checkpoint().shells).toHaveLength(1);
  const deadline = c.checkpoint().cooldowns.find(([key]: [string, number]) => key === 'aa:AA35')![1];
  tank.occupant = 'pilot'; c.tick(.05, []);
  const gun = { id: 'pilot', x: tank.x, y: tank.y, turret: Math.PI / 2 };
  expect(c.shoot(gun, 28.5, 20.5, 'AA35')).toBe('Weapon reloading.');
  expect(c.checkpoint().cooldowns.find(([key]: [string, number]) => key === 'aa:AA35')![1]).toBe(deadline);
  advance(c, .25); expect(hp(c, 1)).toBe(160); expect(hp(c, 2)).toBe(600);
  tank.aaGround = true; expect(c.shoot(gun, 24.5, 20.5, 'AA35')).toBeNull();
  const manualDeadline = c.checkpoint().cooldowns.find(([key]: [string, number]) => key === 'aa:AA35')![1];
  tank.occupant = null; c.tick(.01, []);
  expect(c.checkpoint().cooldowns.find(([key]: [string, number]) => key === 'aa:AA35')![1]).toBe(manualDeadline);
});

it('restores accepted AA projectile domains and damage identically without rereading a changed aim mode', () => {
  const w = field(), tank = aa(w), c = combat(w, [air(1, 34.5, 20.5, 500)]);
  expect(c.shoot({ id: 'pilot', x: tank.x, y: tank.y, turret: Math.PI / 2 }, 34.5, 20.5, 'AA35')).toBeNull();
  c.tick(.05, []); expect(c.checkpoint().shells).toHaveLength(1);
  tank.aaGround = true;
  const saved = c.checkpoint(), restoredWorld = structuredClone(w), restored = createCombat(restoredWorld, structuredClone(saved));
  advance(c, .25); advance(restored, .25);
  expect(restored.checkpoint()).toEqual(c.checkpoint()); expect(hp(c, 1)).toBe(480);
});

it('a destroyed flyer over valid land leaves one recyclable remains record after restart', () => {
  const w = field(), tank = aa(w), c = combat(w, [air(1, 28.5, 20.5, 20)]);
  c.shoot({ id: 'pilot', x: tank.x, y: tank.y, turret: Math.PI / 2 }, 28.5, 20.5, 'AA35'); advance(c, .3);
  expect(hp(c, 1)).toBe(0); expect(w.logistics.crates).toHaveLength(1);
  expect(w.logistics.crates[0]).toMatchObject({ kind: 'remains', enemyKind: 'skimmer', amount: 8 });
  const restored = createCombat(w, c.checkpoint()); advance(restored, 1);
  expect(w.logistics.crates).toHaveLength(1); expect(w.logistics.crates[0].amount).toBe(8);
});

it('held AA fire alternates every 125 ms through 100 ms simulation ticks, then stops without a queued burst', () => {
  const w = field(), tank = aa(w), c = combat(w, [air(1, 40.5, 20.5, 2000)]);
  const source = { ...actor('pilot', tank.x, tank.y), body:'rover', turret:tank.turret,
    tankWeapon:'AA35', vehicleId:tank.id, aaFire:true, aimPoint:{x:40.5,y:20.5} };
  const rounds = new Map<number, any>();
  const collect = () => c.snapshot().shots.filter((s:any)=>s.mount==='aa-35mm').forEach((s:any)=>rounds.set(s.id,s));
  expect(c.shoot(source,40.5,20.5,'AA35')).toBeNull(); collect();
  for(let step=0;step<9;step++){c.tick(.1,[],[],[source]);collect();}
  expect([...rounds.values()].map(s=>s.at)).toEqual([0,125,250,375,500,625,750,875]);
  expect([...rounds.values()].map(s=>s.barrel)).toEqual([0,1,0,1,0,1,0,1]);
  source.aaFire=false;
  for(let step=0;step<5;step++){c.tick(.1,[],[],[source]);collect();}
  expect(rounds.size).toBe(8);expect(hp(c,1)).toBe(1840);
  expect(c.checkpoint().shells).toHaveLength(0);
});

it('automatic AA uses the same alternating 125 ms cadence instead of quantizing to 200 ms', () => {
  const w=field(),tank=aa(w);tank.occupant=null;
  const c=combat(w,[air(1,40.5,20.5,2000)]),rounds=new Map<number,any>();
  for(let step=0;step<10;step++){
    c.tick(.1,[]);
    for(const s of c.snapshot().shots.filter((shot:any)=>shot.mount==='aa-35mm'))rounds.set(s.id,s);
  }
  expect(rounds.size).toBe(8);
  const accepted=[...rounds.values()];
  expect(accepted.map(s=>s.barrel)).toEqual([0,1,0,1,0,1,0,1]);
  expect(accepted.slice(1).map((s,i)=>s.at-accepted[i].at)).toEqual(Array(7).fill(125));
});

it('AA keeps the next barrel across restart, rejects cooldown spam and never restores a held trigger', () => {
  const w=field(),tank=aa(w),c=combat(w,[air(1,40.5,20.5,1000)]);
  const source={...actor('pilot',tank.x,tank.y),body:'rover',turret:tank.turret,tankWeapon:'AA35',
    vehicleId:tank.id,aaFire:true,aimPoint:{x:40.5,y:20.5}};
  expect(c.shoot(source,40.5,20.5,'AA35')).toBeNull();
  expect(c.shoot(source,40.5,20.5,'AA35')).toBe('Weapon reloading.');
  expect(tank.aaNextBarrel).toBe(1);
  c.tick(.1,[],[],[source]);
  const saved=c.checkpoint(),resumedWorld=structuredClone(w),resumed=createCombat(resumedWorld,structuredClone(saved));
  const released={...source,aaFire:false};
  for(let step=0;step<5;step++)resumed.tick(.1,[],[],[released]);
  expect(resumed.snapshot().shots.filter((s:any)=>s.mount==='aa-35mm')).toHaveLength(0);
  expect(resumedWorld.tanks[0].aaNextBarrel).toBe(1);expect(hp(resumed,1)).toBe(980);
  expect(resumed.shoot(released,40.5,20.5,'AA35')).toBeNull();
  expect(resumed.snapshot().shots.filter((s:any)=>s.mount==='aa-35mm').at(-1)).toMatchObject({barrel:1});
  expect(resumedWorld.tanks[0].aaNextBarrel).toBe(0);
});

it('a stalled tick cannot unload accumulated AA fire after the game resumes', () => {
  const w=field(),tank=aa(w),c=combat(w,[]);
  const source={...actor('pilot',tank.x,tank.y),body:'rover',turret:tank.turret,tankWeapon:'AA35',
    vehicleId:tank.id,aaFire:true,aimPoint:{x:60.5,y:20.5}};
  expect(c.shoot(source,60.5,20.5,'AA35')).toBeNull();
  c.tick(5,[],[],[source]);
  const late=c.snapshot().shots.filter((s:any)=>s.mount==='aa-35mm');
  expect(late.length).toBeLessThanOrEqual(2);
  expect(late.every((s:any)=>s.at>=4875)).toBe(true);
  const before=c.checkpoint().cooldowns.find(([key]:[string,number])=>key==='aa:AA35')![1];
  expect(before).toBeGreaterThanOrEqual(5000);
  source.aaFire=false;c.tick(.5,[],[],[source]);
  expect(c.snapshot().shots.filter((s:any)=>s.mount==='aa-35mm'&&s.at>5000)).toHaveLength(0);
});

it('actual city pressure creates a skimmer and includes sleeping bodies plus pending arrivals in both caps', () => {
  const w = field(), person = actor();
  w.sites = [80, 95].map((x, index) => ({ ...makeSite('modifier', 'city-' + index, x, 60), guardsRemaining: 0 }));
  const initial = combat(w, [], 'city-air-integration').checkpoint();
  initial.director.sleeping = [1, 2, 3].map((id, index) => air(id, 180.5 + index * 3, 150.5));
  const c = createCombat(w, initial); let pendingSeen = false, spawnedSeen = false;
  for (let step = 0; step < 240; step++) {
    c.tick(.1, [], [], [person]); const saved = c.checkpoint();
    pendingSeen ||= saved.sites.some((s: any) => s.pending?.points.some(isAirEnemy));
    spawnedSeen ||= saved.enemies.some((e: any) => isAirEnemy(e) && e.domain === 'air' && e.height === 2.5 && e.siteId);
    expect(totalAir(saved)).toBeLessThanOrEqual(4);
    expect(saved.enemies.filter((e: any) => e.hp > 0).length + reserved(saved)).toBeLessThanOrEqual(24);
  }
  expect(pendingSeen).toBe(true); expect(spawnedSeen).toBe(true); expect(totalAir(c.checkpoint())).toBe(4);
});

it('source destruction cancels an unborn flyer and final conquest preserves survivors while closing all new arrivals', () => {
  const w = field(), person = actor();
  w.sites = [{ ...makeSite('modifier', 'source', 80, 60), hp: 1, guardsRemaining: 0 }];
  const c = combat(w, [air(50, 40.5, 60.5)], 'city-air-ending');
  c.tick(.05, [], [], [person]); expect(w.sites[0].pending?.points.some(isAirEnemy)).toBe(true);
  expect(c.shoot({ id: 'gun', x: 76.5, y: 61.5 }, 81.5, 61.5, 'HE')).toBeNull(); advance(c, 1, [person]);
  expect(w.sites[0].state).toBe('conquered'); expect(w.sites[0].pending).toBeNull();
  expect(c.snapshot().conquest).toMatchObject({ state: 'conquered', survivors: 1 });
  const resumed = createCombat(w, c.checkpoint()); advance(resumed, 8, [person]);
  expect(resumed.snapshot().enemies.map((e: any) => e.id)).toEqual([50]);
  expect(reserved(resumed.checkpoint())).toBe(0); expect(resumed.snapshot().encounters?.nextRaid).toBeNull();
});
