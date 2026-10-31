import { fieldHelicopterBlocks } from './footprints.js';
import { bridgeAt } from './bridge-geometry.js';
import { clampStrike } from './strike-aim.js';
import { airbaseAt, hostileAt } from './footprints.js';
import { dockAt } from './ship.js';
import { tileAt } from './world.js';
import { tankBlocks } from './tank.js';
import { coreBlocks } from './core.js';
import { artilleryBlocks, railCorridor } from './footprints.js';
import { fieldCapacityError } from './hazards.js';
import { turnTurret, angleDelta } from './turret.js';

export const MISSILE = Object.freeze({ size: 4, width: 12, height: 18, count: 12, interval: .25, reload: 15, minRange: 15, range: 200, maxBatteries: 4, maxVolleys: 2,
  // Turreted launcher: deploys while operated, turns and elevates toward the aim,
  // fires at its actual pose and stows after a quiet period.
  deploy: 2.5, stow: 6, turnSpeed: Math.PI / 3, elevationSpeed: 15, minElevation: 20, maxElevation: 65, aligned: 2 * Math.PI / 180, muzzle: 1.2 });
export const MISSILE_HE = Object.freeze({ radius: 2, lethalRadius: .7, damage: 110, edgeDamage: 15, craterSize: 8 });
export const isMissile = gun => gun?.kind === 'missile';
export const batteryCenter = gun => ({ x: gun.x + 2, y: gun.y + 2 });
export function targetBox(target, rotated = false) {
  const width = rotated ? MISSILE.height : MISSILE.width, height = rotated ? MISSILE.width : MISSILE.height;
  return { x: target.x - width / 2, y: target.y - height / 2, width, height };
}
export const missileAim = (gun, world, target, rotated = false) => clampStrike(batteryCenter(gun), world, target, rotated ? MISSILE.height : MISSILE.width, rotated ? MISSILE.width : MISSILE.height, MISSILE.range);
export const inTargetBox = (box, x, y) => x >= box.x && y >= box.y && x <= box.x + box.width && y <= box.y + box.height;
export function missileTargetError(gun, world, target, rotated = false) {
  if (!target || ![target.x, target.y].every(Number.isFinite)) return 'Choose a bombardment area.';
  target = missileAim(gun, world, target, rotated);
  const b = targetBox(target, rotated), origin = batteryCenter(gun);
  if (b.x < 0 || b.y < 0 || b.x + b.width > world.width || b.y + b.height > world.height) return 'The whole 12 x 18 target area must fit inside the map.';
  const nearest = Math.hypot(Math.max(b.x - origin.x, 0, origin.x - b.x - b.width), Math.max(b.y - origin.y, 0, origin.y - b.y - b.height));
  const farthest = Math.max(...[b.x, b.x + b.width].flatMap(x => [b.y, b.y + b.height].map(y => Math.hypot(x - origin.x, y - origin.y))));
  if (nearest < MISSILE.minRange || farthest > MISSILE.range + 1e-8) return `Keep the whole target area between ${MISSILE.minRange} and ${MISSILE.range} tiles from the battery.`;
  return null;
}
// Elevation follows range: nearer areas fire flatter, farther areas steeper.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const elevationForRange = range => MISSILE.minElevation + (clamp(range, MISSILE.minRange, MISSILE.range) - MISSILE.minRange) / (MISSILE.range - MISSILE.minRange) * (MISSILE.maxElevation - MISSILE.minElevation);
export const rangeForElevation = elevation => MISSILE.minRange + (clamp(elevation, MISSILE.minElevation, MISSILE.maxElevation) - MISSILE.minElevation) / (MISSILE.maxElevation - MISSILE.minElevation) * (MISSILE.range - MISSILE.minRange);
// The pose that puts the area on a target; tests and old saves use it too.
export function batteryPose(gun, world, target, rotated = gun.rotated) {
  const origin = batteryCenter(gun), aim = missileAim(gun, world, target, rotated);
  return { angle: Math.atan2(aim.x - origin.x, -(aim.y - origin.y)), elevation: elevationForRange(Math.hypot(aim.x - origin.x, aim.y - origin.y)) };
}
// Aim is not saved, so old saves start stowed, facing north at mid elevation.
/** @param {any} gun @param {any} world */
export function batteryState(gun, world) {
  const pose = gun.target && world ? batteryPose(gun, world, gun.target) : { angle: 0, elevation: elevationForRange(40) };
  return { angle: gun.angle ?? pose.angle, elevation: gun.elevation ?? pose.elevation, deploy: gun.deploy ?? 0 };
}
// Where the launcher actually points: the area the next volley would strike.
export function batteryTarget(gun, world, rotated = gun.rotated) {
  const { angle, elevation } = batteryState(gun, world), origin = batteryCenter(gun), range = rangeForElevation(elevation);
  return missileAim(gun, world, { x: origin.x + Math.sin(angle) * range, y: origin.y - Math.cos(angle) * range }, rotated);
}
export function batteryAligned(gun, world, target = gun.target, rotated = gun.rotated) {
  if (!target) return false;
  const pose = batteryPose(gun, world, target, rotated), now = batteryState(gun, world);
  return Math.abs(angleDelta(now.angle, pose.angle)) <= MISSILE.aligned && Math.abs(now.elevation - pose.elevation) <= 1;
}
export function missileFireError(gun, world, target = batteryTarget(gun, world, gun.rotated), rotated = gun.rotated, volleys = [], fields = [], salvos = []) {
  if (!['HE', 'INCENDIARY', 'GAS'].includes(gun.ammo || 'HE')) return 'Choose HE, incendiary or gas.';
  if ((gun.deploy ?? 0) < 1) return `Launcher deploying (${((1 - (gun.deploy ?? 0)) * MISSILE.deploy).toFixed(1)}s).`;
  if (gun.reload > .001) return `Battery reloading (${gun.reload.toFixed(1)}s).`;
  if (volleys.filter(b=>b.kind!=='submarine').length >= MISSILE.maxVolleys) return 'Two missile volleys are already in flight. Wait for their impacts.';
  return missileTargetError(gun, world, target, rotated) || fieldCapacityError(fields, salvos, gun.ammo || 'HE', MISSILE.width * MISSILE.height);
}
export function missilePlacementError(world, buildings, occupants, x, y, owner) {
  if (![x, y].every(Number.isInteger)) return 'Choose the top-left tile of the 4 x 4 battery.';
  if (world.artillery?.some(g => isMissile(g) && g.owner === owner)) return 'One missile battery per scout in this field test.';
  if ((world.artillery || []).filter(isMissile).length >= MISSILE.maxBatteries) return 'This field test allows four missile batteries.';
  for (let cy = y; cy < y + 4; cy++) for (let cx = x; cx < x + 4; cx++) {
    if(bridgeAt(world,cx,cy))return 'Keep bridges clear of missile batteries.';
    if (hostileAt(world, cx, cy)) return 'An alien station occupies the battery footprint.';
    if(fieldHelicopterBlocks(world,cx+.5,cy+.5,.5))return 'Keep the helicopter landing area clear.';
    if(airbaseAt(world,cx,cy))return 'Keep the airbase runway and apron clear.';
  if(dockAt(world,cx,cy))return 'Keep the shoreline dock clear.';
    if (tankBlocks(world, cx + .5, cy + .5, .5)) return 'A tank or incoming pod occupies this footprint.';
    if (cx < 0 || cy < 0 || cx >= world.width || cy >= world.height) return 'The full 4 x 4 battery must fit inside the map.';
    if (tileAt(world, cx, cy) === 0) return 'Ocean is restricted. All 16 battery tiles need solid ground.';
    if (tileAt(world, cx, cy) === 3) return 'The full 4 x 4 battery needs clear land.';
    if (world.cores?.some(c => coreBlocks(c, cx, cy)) || buildings.some(b => b.x === cx && b.y === cy)) return 'Keep solid machinery clear.';
    if (railCorridor(world, cx, cy) || artilleryBlocks(world, cx, cy)) return 'Rails or another facility occupy this footprint.';
    if (occupants.some(p => p.life !== 'disabled' && Math.abs(p.x - cx - .5) < .75 && Math.abs(p.y - cy - .5) < .75)) return 'A unit occupies the battery footprint.';
  }
  return null;
}
export function makeBarrage(gun, target, rotated, seed) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  // Missiles keep one speed at every range, so a longer shot takes longer to land.
  const origin = batteryCenter(gun), box = targetBox(target, rotated), flight = 6 + Math.min(MISSILE.range, Math.hypot(target.x - origin.x, target.y - origin.y)) / 25;
  // Missiles leave the raised pod's tubes, ahead of the turntable along the bearing.
  const { angle, elevation } = batteryState(gun, null), reach = MISSILE.muzzle * Math.cos(elevation * Math.PI / 180), fx = Math.sin(angle), fy = -Math.cos(angle);
  const missiles = Array.from({ length: 12 }, (_, index) => {
    // Scatter in both axes while retaining one strike per sector for coverage.
    const col = index % 3, row = Math.floor(index / 3), u = (col + .5) * 4 - 6 + (random() - .5) * 2.2, v = (row + .5) * 4.5 - 9 + (random() - .5) * 2.2;
    const sector = rotated ? { x: box.x + row * 4.5, y: box.y + col * 4, width: 4.5, height: 4 } : { x: box.x + col * 4, y: box.y + row * 4.5, width: 4, height: 4.5 };
    const across = (col - 1) * .28, along = (row - 1.5) * .12;
    return { x: target.x + (rotated ? v : u), y: target.y + (rotated ? u : v), sector, launch: index * .25, flight, phase: random() * Math.PI * 2, craterSize: MISSILE_HE.craterSize * (.9 + random() * .2), landed: false,
      originX: origin.x + fx * (reach + along) - fy * across, originY: origin.y + fy * (reach + along) + fx * across };
  });
  return { id: seed, owner: gun.id, weapon: gun.ammo || 'HE', x: origin.x, y: origin.y, box, age: 0, missiles };
}
// Deploy while operated; turn and elevate toward the operator's aim once raised;
// stow after a quiet period with no volley of its own in flight.
/** @param {any} gun @param {number} dt @param {any} [world] @param {boolean} [busy] */
export function tickBattery(gun, dt, world = null, busy = false) {
  const state = () => JSON.stringify([gun.reload, gun.operator, gun.angle, gun.elevation, gun.deploy]), before = state();
  gun.reload = Math.max(0, gun.reload - dt);
  if (gun.operator) { gun.lease = Math.max(0, gun.lease - dt); if (!gun.lease) gun.operator = null; }
  if (world) {
    Object.assign(gun, batteryState(gun, world));
    gun.idle = gun.operator || busy ? 0 : (gun.idle || 0) + dt;
    if (gun.operator) gun.deploy = Math.min(1, gun.deploy + dt / MISSILE.deploy);
    else gun.deploy = Math.max(0, gun.deploy - Math.max(0, Math.min(dt, gun.idle - MISSILE.stow)) / MISSILE.deploy);
    if (gun.operator && gun.deploy >= 1 && gun.target) {
      const pose = batteryPose(gun, world, gun.target), delta = pose.elevation - gun.elevation;
      gun.angle = turnTurret(gun.angle, pose.angle, dt, MISSILE.turnSpeed);
      gun.elevation += Math.sign(delta) * Math.min(Math.abs(delta), MISSILE.elevationSpeed * dt);
    }
  }
  return before !== state();
}
// Browser view of the launcher between snapshots: the same tick on a copy.
export function predictBattery(gun, world, dt, target = gun.target) {
  const view = { ...gun, target };
  if (dt > 0) tickBattery(view, dt, world, true); else Object.assign(view, batteryState(gun, world));
  return view;
}
