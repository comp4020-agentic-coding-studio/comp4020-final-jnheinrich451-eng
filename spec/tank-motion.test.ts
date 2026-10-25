import { expect, it } from 'vitest';
import { driveTank, TANK_DRIVE } from '../public/tank-motion.js';
import { CombatEffects } from '../public/effects.js';
import { createWorld, canStand } from '../public/world.js';
import { TANK } from '../public/tank.js';
import { freshLogistics } from '../public/logistics.js';

const body = () => ({ x: 10.5, y: 10.5, angle: 0, turret: 1, driveSpeed: 0, vx: 0, vy: 0 });
const clear = () => true;
it('accelerates, brakes within a tank length, and reverses more slowly without turning the turret', () => {
  const p = body();
  driveTank(p, { x: 0, y: -1 }, .1, clear);
  expect(p.driveSpeed).toBeCloseTo(.3); expect(p.y).toBeGreaterThan(10.2);
  for (let i = 0; i < 10; i++) driveTank(p, { x: 0, y: -1 }, .1, clear);
  expect(p.driveSpeed).toBe(TANK_DRIVE.speed);
  const y = p.y;
  for (let i = 0; i < 6; i++) driveTank(p, { x: 0, y: 0 }, .1, clear);
  expect(p.driveSpeed).toBe(0); expect(y - p.y).toBeGreaterThan(.65); expect(y - p.y).toBeLessThan(.8);
  for (let i = 0; i < 10; i++) driveTank(p, { x: 0, y: 1 }, .1, clear);
  expect(p.driveSpeed).toBe(-TANK_DRIVE.reverse); expect(p.angle).toBeCloseTo(0); expect(p.turret).toBe(1);
});
it('brakes before reversing, limits hull turns and keeps steering independent of throttle', () => {
  const p = { ...body(), driveSpeed: 3 };
  driveTank(p, { x: 0, y: 1 }, .1, clear);
  expect(p.driveSpeed).toBeGreaterThan(0); expect(p.y).toBeLessThan(10.5);
  driveTank(p, { x: 1, y: 0 }, .1, clear);
  expect(p.angle).toBeGreaterThan(0); expect(p.angle).toBeLessThan(TANK_DRIVE.turnSpeed * .1);
  const diagonal = { ...body(), angle: Math.PI / 4 };
  for (let i = 0; i < 20; i++) driveTank(diagonal, { x: 1, y: -1 }, .1, clear);
  expect(diagonal.driveSpeed).toBe(TANK_DRIVE.speed);
});
it('uses bounded swept movement and stops against obstacles without sliding through them', () => {
  const p = { ...body(), driveSpeed: 3 };
  let checks = 0;
  driveTank(p, { x: 0, y: -1 }, 10, (_x: number, y: number) => { checks++; return y >= 10.3; });
  expect(p.y).toBeGreaterThanOrEqual(10.3); expect(p.driveSpeed).toBe(0); expect(checks).toBeLessThanOrEqual(6);
  expect(driveTank(p, { x: 0, y: -1 }, NaN, clear)).toBe(false);
});
it('turns more tightly from rest and brakes through a fast corner without sideways sliding',()=>{
  const slow=body(),fast={...body(),driveSpeed:TANK_DRIVE.speed};
  driveTank(slow,{x:1,y:0},.1,clear);driveTank(fast,{x:1,y:0},.1,clear);
  expect(slow.angle).toBeGreaterThan(fast.angle*1.7);
  expect(fast.driveSpeed).toBeLessThan(TANK_DRIVE.speed);
  expect(fast.y).toBeLessThan(10.3);expect(fast.x).toBeLessThan(10.55);
  expect(fast.turret).toBe(1);
  for(let i=0;i<30;i++)driveTank(fast,{x:1,y:0},.1,clear);
  expect(fast.driveSpeed).toBe(0);
  const parked={x:fast.x,y:fast.y},angle=fast.angle;driveTank(fast,{x:1,y:0},.1,clear);expect(fast.x).toBe(parked.x);expect(fast.y).toBe(parked.y);expect(fast.angle).not.toBe(angle);
});
it('gives the same trajectory at 10 Hz and 40 Hz', () => {
  const a = body(), b = body();
  for (let i = 0; i < 10; i++) driveTank(a, { x: 1, y: 0 }, .1, clear);
  for (let i = 0; i < 40; i++) driveTank(b, { x: 1, y: 0 }, .025, clear);
  expect(a.x).toBeCloseTo(b.x, 8); expect(a.y).toBeCloseTo(b.y, 8); expect(a.angle).toBeCloseTo(b.angle, 8);
});
it('crosses completed three-wide bridge flooring and stops before unfinished water', () => {
  const world: any = { ...createWorld(), width: 32, height: 32, terrain: Array(32 * 32).fill(2),
    cores: [], tanks: [], ships: [], rails: [], artillery: [], airbases: [], sites: [], logistics: freshLogistics() };
  for (let y = 0; y < 32; y++) for (let x = 12; x <= 17; x++) world.terrain[y * 32 + x] = 0;
  // Completed bridge cells use the same authoritative flooring as normal driving.
  const bridge = { id: 'bridge', from: { x: 11, y: 10 }, to: { x: 18, y: 10 }, elapsed: 999 };
  world.logistics.bridges.push(bridge);
  const p = { ...body(), angle: Math.PI / 2 };
  const canDrive = (x: number, y: number) => canStand(world, [], x, y, 'tank', TANK.radius);
  for (let i = 0; i < 45; i++) driveTank(p, { x: 0, y: -1 }, .1, canDrive);
  expect(p.x).toBeGreaterThan(18.5);
  world.logistics.bridges = [];
  const stopped = { ...body(), angle: Math.PI / 2 };
  for (let i = 0; i < 20; i++) driveTank(stopped, { x: 0, y: -1 }, .1, canDrive);
  expect(stopped.x).toBeLessThan(12 - TANK.radius); expect(stopped.driveSpeed).toBe(0);
});
it('keeps recoil cosmetic, uses the accepted shot bearing and respects reduced motion', () => {
  const effects = Object.create(CombatEffects.prototype);
  effects.muzzles = [{ owner: 'tank', weapon: 'MAGNETIC', angle: Math.PI / 2, born: 0 }];
  effects.reduced = false;
  expect(effects.tankRecoil('tank', 125).x).toBeLessThan(0);
  effects.reduced = true;
  expect(effects.tankRecoil('tank', 125)).toMatchObject({ x: -0, y: 0 });
  expect(effects.tankRecoil('tank', 300).barrel).toBe(0);
});

it.each([0,Math.PI/2,Math.PI,-Math.PI/2])('W drives along saved heading %s and S reverses without aiming the hull',angle=>{
 const p={...body(),angle},start={...p};for(let i=0;i<15;i++)driveTank(p,{x:0,y:-1},.1,clear);
 const forward=(p.x-start.x)*Math.sin(angle)-(p.y-start.y)*Math.cos(angle),sideways=(p.x-start.x)*Math.cos(angle)+(p.y-start.y)*Math.sin(angle);
 expect(forward).toBeGreaterThan(2);expect(sideways).toBeCloseTo(0);expect(p.turret).toBe(1);
 for(let i=0;i<30;i++)driveTank(p,{x:0,y:1},.1,clear);expect(p.driveSpeed).toBe(-TANK_DRIVE.reverse);expect(Math.cos(p.angle-angle)).toBeCloseTo(1);
});
