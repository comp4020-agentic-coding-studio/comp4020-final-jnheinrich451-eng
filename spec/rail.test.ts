import { expect, it } from 'vitest';
import { createWorld, canStand, placementError } from '../public/world.js';
import { corePlacementError } from '../public/core.js';
import { railSegment, railError, carriageError, moveCarriage, tickCarriage, artilleryFireError, artillerySolution, artilleryAim, RAIL } from '../public/rail.js';
import { createCombat, blastDamage } from '../public/combat.js';
import { ARTILLERY_HE, RAIL_HE } from '../public/weapons.js';
import { raycast } from '../public/raycast.js';
import { curveEnds, curveBounds } from '../public/track.js';
import { gunPosition } from '../public/rail.js';

const field = () => ({ ...createWorld(), terrain: Array(48 * 36).fill(2), rails: railSegment(20, 13, 'EW'), artillery: [] as any[], cores: [] });
const cannon = () => ({ id: 'gun', owner: 'a', x: 20, y: 13, shape: 'EW', angle: Math.PI / 2, aim: Math.PI / 2, elevation: 88.5, input: null as any, inputTime: 0, target: null as any, move: null as any, brace: 0, reload: 0, operator: null as string | null, lease: 0 });

it.each(['HE','INCENDIARY','GAS'])('admits %s at 180 tiles and retains the six-tile inner limit',weapon=>{
  const world={...field(),width:512,height:384},gun=cannon(),combat=createCombat(world);
  for(const distance of [6,180]){
    const target={x:gun.x+.5+distance,y:gun.y+.5},aim=artilleryAim(gun,target);
    gun.elevation=aim.elevation;gun.angle=aim.angle;
    expect(artillerySolution(gun).range).toBeCloseTo(distance);
    expect(artilleryFireError(gun,world)).toBeNull();
    expect(combat.lob({id:'gun',x:gun.x+.5,y:gun.y+.5},target.x,target.y,artillerySolution(gun),weapon)).toBeNull();
  }
  expect(combat.lob({id:'gun',x:20.5,y:13.5},201,13.5,null,weapon)).toContain('180');
  expect(combat.lob({id:'gun',x:20.5,y:13.5},25.5,13.5,null,weapon)).toContain('6');
});

it.each(['NE', 'SE', 'SW', 'NW'])('traverses and reverses a %s curve with full reservation and independent turret bearing', shape => {
  const world = field(), curve = { x: 12, y: 12, shape }, [a, b] = curveEnds(curve);
  world.rails = [...railSegment(a.x, a.y, a.shape), ...railSegment(b.x, b.y, b.shape), curve];
  expect(railError(world, [], curve.x, curve.y, shape)).toBeNull();
  const gun = { ...cannon(), x: a.x, y: a.y, shape: a.shape, heading: a.dx || a.dy }; world.artillery.push(gun);
  const apron = curveBounds(curve);
  expect(moveCarriage(gun, 1, world, [], [{ x: apron.minX + .5, y: apron.minY + .5 }])).toContain('unit');
  expect(moveCarriage(gun, 1, world, [], [])).toBeNull();
  expect([gun.x, gun.y, gun.shape]).toEqual([b.x, b.y, b.shape]);
  expect(canStand(world, [], apron.minX + .5, apron.minY + .5)).toBe(false);
  const angle = gun.angle, half = gun.move.duration / 2;
  tickCarriage(gun, half); const p = gunPosition(gun);
  expect(Math.hypot(p.x - curve.x - .5, p.y - curve.y - .5)).toBeCloseTo(3);
  expect(gun.angle).toBeCloseTo(angle);
  // Serialized movement contains everything needed to resume the curve.
  const reopened = JSON.parse(JSON.stringify(gun)); expect(gunPosition(reopened)).toEqual(p);
  tickCarriage(gun, half + .01); expect(gun.move).toBeNull();
  expect(moveCarriage(gun, -1, world, [], [])).toBeNull(); tickCarriage(gun, gun.move.duration);
  expect([gun.x, gun.y, gun.shape]).toEqual([a.x, a.y, a.shape]);
});

it('validates straight rail connections and reserves a clear carriage corridor', () => {
  const world = field();
  expect(railError(world, [], 20, 13, 'EW')).toBeNull();
  expect(railError(world, [], 20, 13, 'NS')).toBeNull(); // Crossing straights now join in one tile.
  expect(railError(world, [], 20, 13, 'NE')).toBeTruthy();
  world.terrain[12 * 48 + 18] = 3;
  expect(railError(world, [], 20, 13, 'EW')).toContain('corridor');
  expect(placementError(world, [], [], 20, 12)).toBeTruthy();
  expect(corePlacementError(world, [], [], 19, 14, 'a')).toContain('railway');
  expect(railError(world, [], .5, 13, 'EW')).toBeTruthy();
});

it('requires three supporting rails and validates the entire 3x3 and swept footprint', () => {
  const world = field(), gun = cannon();
  expect(carriageError(world, [], [], 20, 13, 'EW')).toBeNull();
  expect(carriageError(world, [], [], 18, 13, 'EW')).toContain('three');
  expect(carriageError(world, [{ x: 19, y: 12 }], [], 20, 13, 'EW')).toContain('facility');
  expect(carriageError(world, [], [{ x: 21.5, y: 14.5 }], 20, 13, 'EW')).toContain('unit');
  world.artillery.push(gun);
  expect(canStand(world, [], 19.5, 12.5)).toBe(false);
  expect(raycast(world, [], { x: 16.5, y: 13.5 }, 1, 0, 10).x).toBe(19);
  expect(moveCarriage(gun, 1, world, [], [{ x: 22.5, y: 13.5 }])).toContain('unit');
  expect(moveCarriage(gun, 1, world, [], [])).toBeNull();
  expect(canStand(world, [], 19.5, 13.5)).toBe(false);
  expect(canStand(world, [], 22.5, 13.5)).toBe(false);
  expect(moveCarriage(gun, 1, world, [], [])).toContain('already');
  tickCarriage(gun, RAIL.moveTime);
  expect(canStand(world, [], 19.5, 13.5)).toBe(true);
  expect(artilleryFireError(gun, world)).toContain('Stabilizers');
  expect(moveCarriage(gun, 1, world, [], [])).toContain('three');
});

it('manual traverse and elevation use server time, stop on stale input and preserve bracing/reload', () => {
  const world = field(), gun = cannon(); gun.operator = 'a'; gun.lease = 5; gun.brace = 1.2;
  gun.input = { traverse: 1, elevate: -1 }; gun.inputTime = RAIL.inputTime;
  tickCarriage(gun, .1); expect(gun.angle).toBeCloseTo(Math.PI / 2 + RAIL.turnSpeed * .1); expect(gun.elevation).toBeCloseTo(87.7);
  expect(artilleryFireError(gun, world)).toContain('Stabilizers');
  for (let i = 0; i < 20; i++) tickCarriage(gun, .1);
  expect(gun.angle).toBeCloseTo(Math.PI / 2 + RAIL.turnSpeed * .35); expect(gun.elevation).toBeCloseTo(85.7);
  expect(artilleryFireError(gun, world)).toBeNull();
  gun.elevation = 45; expect(artilleryFireError(gun, world)).toContain('outside'); gun.elevation = 88.5;
  gun.reload = 6; expect(artilleryFireError(gun, world)).toContain('reloading');
  tickCarriage(gun, 6); expect(gun.operator).toBeNull(); expect(gun.reload).toBe(0);
});

it('high and low trajectories agree on range while high elevation gives a longer, steeper flight', () => {
  const gun = cannon(); gun.elevation = 15; const low = artillerySolution(gun);
  gun.elevation = 75; const high = artillerySolution(gun);
  expect(low.range).toBeCloseTo(90); expect(high.range).toBeCloseTo(low.range);
  expect(high.duration).toBeGreaterThan(low.duration); expect(high.height).toBeGreaterThan(low.height);
  expect(high.verticalSpeed * high.duration - .5 * high.gravity * high.duration ** 2).toBeCloseTo(0);
  gun.elevation = 45; expect(artillerySolution(gun).range).toBeCloseTo(180);
  gun.elevation = 88.5; gun.operator = 'a'; gun.lease = 5; gun.input = { traverse: 0, elevate: 1 }; gun.inputTime = 5;
  tickCarriage(gun, 5); expect(gun.elevation).toBe(RAIL.maxElevation);
  const enlarged = { ...field(), width: 512, height: 384 }; gun.elevation = 45; gun.brace = 0;
  expect(artilleryFireError(gun, enlarged)).toBeNull();
});

it('heavy HE flies over intervening cover, damages once on arrival and leaves an independent eight-tile decal', () => {
  const world = field(), initial = createCombat(world); initial.start([]);
  // This tests ballistic arrival/damage, independent of pursuit speed.
  const saved = initial.checkpoint(); saved.enemies[0].frenzyRecoveryUntil = 1e6;
  const combat = createCombat(world, saved), enemy = combat.snapshot().enemies[0];
  world.terrain[Math.floor(enemy.y) * 48 + Math.floor(enemy.x) - 4] = 3;
  const original = [...world.terrain];
  expect(combat.lob({ id: 'gun', x: enemy.x - 8, y: enemy.y }, enemy.x, enemy.y)).toBeNull();
  expect(combat.snapshot().impacts).toHaveLength(0); expect(combat.snapshot().salvos).toHaveLength(1);
  combat.tick(.1, []); expect(combat.snapshot().kills).toBe(0);
  for (let i = 0; i < 15; i++) combat.tick(.1, []);
  expect(combat.snapshot().salvos).toHaveLength(0);
  expect(combat.snapshot().enemies.some(e => e.id === enemy.id)).toBe(false);
  expect(combat.snapshot().impacts).toHaveLength(1); expect(combat.snapshot().impacts[0].radius).toBe(6);
  expect(combat.snapshot().marks.find(m => m.kind === 'crater')?.size).toBe(8);
  expect(blastDamage(3.5, RAIL_HE)).toBeGreaterThan(0); expect(blastDamage(6.01, RAIL_HE)).toBe(0); expect(world.terrain).toEqual(original);
  const kills = combat.snapshot().kills; combat.tick(.5, []); expect(combat.snapshot().kills).toBe(kills);
});

it('saves the stronger rail HE profile while retaining already accepted shells',()=>{
  const world=field(),combat=createCombat(world);
  expect(combat.lob({id:'gun',x:10,y:20},20,20)).toBeNull();
  const saved=combat.checkpoint();
  expect(saved.salvos[0].profile).toMatchObject({radius:6,lethalRadius:2.2,damage:420,edgeDamage:60});
  expect(blastDamage(0,saved.salvos[0].profile)).toBe(420);
  expect(blastDamage(6,saved.salvos[0].profile)).toBe(60);
  saved.salvos[0].profile={...ARTILLERY_HE}; // A pre-upgrade shot keeps its launch balance.
  const restored=createCombat(world,saved);
  expect(restored.snapshot().salvos[0].profile).toMatchObject({radius:3,damage:140,edgeDamage:20});
  expect(restored.lob({id:'gun',x:10,y:20},20,20)).toBeNull();
  expect(restored.snapshot().salvos[1].profile.damage).toBe(420);
});

it('a ballistic shell retains its launch trajectory when the gun changes bearing or elevation', () => {
  const world = field(), gun = cannon(), solution = artillerySolution(gun), combat = createCombat(world);
  expect(combat.lob({ id: gun.id, x: gun.x + .5, y: gun.y + .5 }, solution.x, solution.y, solution)).toBeNull();
  gun.angle = 0; gun.elevation = 15;
  const shot = combat.snapshot().salvos[0];
  expect(shot.targetX).toBeCloseTo(solution.x); expect(shot.duration).toBeCloseTo(solution.duration);
  for (let i = 0; i < Math.floor(solution.duration * 10); i++) combat.tick(.1, []);
  expect(combat.snapshot().impacts).toHaveLength(0);
  combat.tick(.1, []);
  expect(combat.snapshot().salvos).toHaveLength(0);
  expect(combat.snapshot().impacts[0].x).toBeCloseTo(solution.x);
  expect(combat.snapshot().impacts[0].y).toBeCloseTo(solution.y);
});
