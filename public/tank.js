import { airbaseAt } from './footprints.js';
import { dockAt } from './ship.js';
import { POD, podCells, podCell } from './pod.js';
import { artilleryBlocks, railCorridor } from './footprints.js';
export const TANK = Object.freeze({ max: 8, radius: .42, boardRange: 1.8, speed: 3, ...POD });
export const tankPodCells = (x, y) => podCells(x, y, 1);
export const tankPodCell = (tank, x, y) => podCell({ x: tank.podX, y: tank.podY }, x, y, 1);
/** @param {string|null} [ignore] */
export function tankBlocks(world, x, y, radius = .21, ignore = null) {
  return world.tanks?.some(t => {
    if (t.id === ignore || t.destroyed) return false;
    if (t.elapsed < POD.duration) return [-radius, radius].some(dx => [-radius, radius].some(dy => tankPodCell(t, x + dx, y + dy)));
    return Math.abs(t.x - x) < TANK.radius + radius && Math.abs(t.y - y) < TANK.radius + radius;
  }) || false;
}
export function tankPlacementError(world, buildings, occupants, x, y, owner) {
  if (![x, y].every(Number.isInteger)) return 'Choose a tile for the tank pod.';
  if (world.tanks?.some(t => t.owner === owner)) return 'Your tank is already deployed. One per scout in this field test.';
  if ((world.tanks?.length || 0) >= TANK.max) return 'This field test allows eight tanks.';
  for (const cell of tankPodCells(x, y)) {
    if(airbaseAt(world,cell.x,cell.y))return 'Keep the airbase runway and apron clear.';
  if(dockAt(world,cell.x,cell.y))return 'Keep the shoreline dock clear.';
    if (cell.x < 0 || cell.y < 0 || cell.x >= world.width || cell.y >= world.height) return 'The entire 17-tile cross must fit inside the map.';
    if (world.terrain[cell.y * world.width + cell.x] === 0) return 'Ocean is restricted. All tank pod panels need land.';
    if (cell.x >= 23 && cell.x <= 25 && cell.y >= 17 && cell.y <= 19) return 'Keep the landing pad clear.';
    if (world.cores?.some(c => podCell(c, cell.x, cell.y)) || world.tanks?.some(t => tankPodCell(t, cell.x, cell.y))) return 'Another pod or its panels occupy this site.';
    if (railCorridor(world, cell.x, cell.y) || artilleryBlocks(world, cell.x, cell.y) || buildings.some(b => b.x === cell.x && b.y === cell.y)) return 'A facility or rail corridor occupies the pod footprint.';
    if (tankBlocks(world, cell.x + .5, cell.y + .5, .5) || occupants.some(p => p.life !== 'disabled' && (p.hp === undefined || p.hp > 0) && Math.abs(p.x - cell.x - .5) < .75 && Math.abs(p.y - cell.y - .5) < .75)) return 'A unit is inside the pod footprint.';
  }
  return null;
}
export function tankArrivalPosition(tank, elapsed = tank.elapsed) {
  const progress = Math.max(0, Math.min(1, (elapsed - POD.exit) / (POD.duration - POD.exit)));
  return { x: tank.podX + .5 + progress * 2, y: tank.podY + .5 };
}
