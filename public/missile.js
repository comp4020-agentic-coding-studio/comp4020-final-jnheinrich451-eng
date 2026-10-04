import { airbaseAt } from './footprints.js';
import { dockAt } from './ship.js';
import { tileAt, isLanding } from './world.js';
import { tankBlocks } from './tank.js';
import { coreBlocks } from './core.js';
import { artilleryBlocks, railCorridor } from './footprints.js';
import { fieldCapacityError } from './hazards.js';

export const MISSILE = Object.freeze({ size: 4, width: 12, height: 18, count: 12, interval: .25, reload: 15, minRange: 15, range: 100, maxBatteries: 4, maxVolleys: 2 });
export const MISSILE_HE = Object.freeze({ radius: 2, lethalRadius: .7, damage: 110, edgeDamage: 15, craterSize: 8 });
export const isMissile = gun => gun?.kind === 'missile';
export const batteryCenter = gun => ({ x: gun.x + 2, y: gun.y + 2 });
export function targetBox(target, rotated = false) {
  const width = rotated ? MISSILE.height : MISSILE.width, height = rotated ? MISSILE.width : MISSILE.height;
  return { x: target.x - width / 2, y: target.y - height / 2, width, height };
}
export const inTargetBox = (box, x, y) => x >= box.x && y >= box.y && x <= box.x + box.width && y <= box.y + box.height;
export function missileTargetError(gun, world, target, rotated = false) {
  if (!target || ![target.x, target.y].every(Number.isFinite)) return 'Choose a bombardment area.';
  const b = targetBox(target, rotated), origin = batteryCenter(gun);
  if (b.x < 0 || b.y < 0 || b.x + b.width > world.width || b.y + b.height > world.height) return 'The whole 12 x 18 target area must fit inside the map.';
  const nearest = Math.hypot(Math.max(b.x - origin.x, 0, origin.x - b.x - b.width), Math.max(b.y - origin.y, 0, origin.y - b.y - b.height));
  const farthest = Math.max(...[b.x, b.x + b.width].flatMap(x => [b.y, b.y + b.height].map(y => Math.hypot(x - origin.x, y - origin.y))));
  if (nearest < MISSILE.minRange || farthest > MISSILE.range) return 'Keep the whole target area between 15 and 100 tiles from the battery.';
  return null;
}
export function missileFireError(gun, world, target = gun.target, rotated = gun.rotated, volleys = [], fields = [], salvos = []) {
  if (!['HE', 'INCENDIARY', 'GAS'].includes(gun.ammo || 'HE')) return 'Choose HE, incendiary or gas.';
  if (gun.reload > .001) return `Battery reloading (${gun.reload.toFixed(1)}s).`;
  if (volleys.length >= MISSILE.maxVolleys) return 'Two missile volleys are already in flight. Wait for their impacts.';
  return missileTargetError(gun, world, target, rotated) || fieldCapacityError(fields, salvos, gun.ammo || 'HE', MISSILE.width * MISSILE.height);
}
export function missilePlacementError(world, buildings, occupants, x, y, owner) {
  if (![x, y].every(Number.isInteger)) return 'Choose the top-left tile of the 4 x 4 battery.';
  if (world.artillery?.some(g => isMissile(g) && g.owner === owner)) return 'One missile battery per scout in this field test.';
  if ((world.artillery || []).filter(isMissile).length >= MISSILE.maxBatteries) return 'This field test allows four missile batteries.';
  for (let cy = y; cy < y + 4; cy++) for (let cx = x; cx < x + 4; cx++) {
    if(airbaseAt(world,cx,cy))return 'Keep the airbase runway and apron clear.';
  if(dockAt(world,cx,cy))return 'Keep the shoreline dock clear.';
    if (tankBlocks(world, cx + .5, cy + .5, .5)) return 'A tank or incoming pod occupies this footprint.';
    if (cx < 0 || cy < 0 || cx >= world.width || cy >= world.height) return 'The full 4 x 4 battery must fit inside the map.';
    if (tileAt(world, cx, cy) === 0) return 'Ocean is restricted. All 16 battery tiles need solid ground.';
    if (tileAt(world, cx, cy) === 3) return 'The full 4 x 4 battery needs clear land.';
    if (isLanding(cx, cy) || world.cores?.some(c => coreBlocks(c, cx, cy)) || buildings.some(b => b.x === cx && b.y === cy)) return 'Keep landing space and solid machinery clear.';
    if (railCorridor(world, cx, cy) || artilleryBlocks(world, cx, cy)) return 'Rails or another facility occupy this footprint.';
    if (occupants.some(p => p.life !== 'disabled' && Math.abs(p.x - cx - .5) < .75 && Math.abs(p.y - cy - .5) < .75)) return 'A unit occupies the battery footprint.';
  }
  return null;
}
export function makeBarrage(gun, target, rotated, seed) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const origin = batteryCenter(gun), box = targetBox(target, rotated), flight = 6 + Math.min(1, Math.hypot(target.x - origin.x, target.y - origin.y) / 100) * 4;
  const missiles = Array.from({ length: 12 }, (_, index) => {
    // Scatter in both axes while retaining one strike per sector for coverage.
    const col = index % 3, row = Math.floor(index / 3), u = (col + .5) * 4 - 6 + (random() - .5) * 2.2, v = (row + .5) * 4.5 - 9 + (random() - .5) * 2.2;
    const sector = rotated ? { x: box.x + row * 4.5, y: box.y + col * 4, width: 4.5, height: 4 } : { x: box.x + col * 4, y: box.y + row * 4.5, width: 4, height: 4.5 };
    return { x: target.x + (rotated ? v : u), y: target.y + (rotated ? u : v), sector, launch: index * .25, flight, phase: random() * Math.PI * 2, craterSize: MISSILE_HE.craterSize * (.9 + random() * .2), landed: false };
  });
  return { id: seed, owner: gun.id, weapon: gun.ammo || 'HE', x: origin.x, y: origin.y, box, age: 0, missiles };
}
export function tickBattery(gun, dt) {
  const before = `${gun.reload}:${gun.operator}`;
  gun.reload = Math.max(0, gun.reload - dt);
  if (gun.operator) { gun.lease = Math.max(0, gun.lease - dt); if (!gun.lease) gun.operator = null; }
  return before !== `${gun.reload}:${gun.operator}`;
}
