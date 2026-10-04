import { airbaseAt } from './footprints.js';
import { dockAt } from './ship.js';
// Deployment geometry and simulation timing, shared by server and presentation.
import { artilleryBlocks, railCorridor } from './footprints.js';
import { POD, podCells } from './pod.js';
import { tankBlocks, tankPodCell } from './tank.js';
export const CORE = Object.freeze({ ...POD, max: 8 });
export function coreCells(x, y) {
  return podCells(x, y).map(cell => ({ ...cell, role: cell.x === x + 2 && cell.y === y ? 'sentry' : cell.x === x + 2 && cell.y === y + 1 ? 'exit' : cell.role }));
}
export function coreCell(core, x, y) {
  const dx = Math.floor(x) - core.x, dy = Math.floor(y) - core.y;
  if (dx >= 0 && dx < 3 && dy >= 0 && dy < 3) return dx === 2 && dy === 1 ? 'exit' : 'core';
  if ((dx >= 0 && dx < 3 && dy >= -4 && dy < 7) || (dy >= 0 && dy < 3 && dx >= -4 && dx < 7)) return 'floor';
  return null;
}
export function coreBlocks(core, x, y) {
  const cell = coreCell(core, x, y);
  return cell && (core.elapsed < CORE.duration || cell === 'core');
}
export function coreExit(core) {
  const progress = Math.max(0, Math.min(1, (core.elapsed - CORE.exit) / (CORE.duration - CORE.exit)));
  return { x: core.x + 2.5 + progress * 1.1, y: core.y + 1.5 };
}
export function coreSentries(cores) {
  return cores.filter(c => c.elapsed >= CORE.duration).map(c => ({ id: `core-${c.id}`, coreId: c.id, owner: c.owner, x: c.x + 2, y: c.y }));
}
export function corePlacementError(world, buildings, occupants, x, y, owner) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return 'Choose a tile for the central block.';
  const cores = world.cores || [];
  if (cores.some(c => c.owner === owner)) return 'Your core is already deployed. This field test provides one per scout.';
  if (cores.length >= CORE.max) return 'This island has reached its core limit.';
  for (const cell of coreCells(x, y)) {
    if(airbaseAt(world,cell.x,cell.y))return 'Keep the airbase runway and apron clear.';
  if(dockAt(world,cell.x,cell.y))return 'Keep the shoreline dock clear.';
    if (tankBlocks(world, cell.x + .5, cell.y + .5, .5) || world.tanks?.some(t => tankPodCell(t, cell.x, cell.y))) return 'A tank or cargo pod occupies the deployment footprint.';
    if (railCorridor(world, cell.x, cell.y) || artilleryBlocks(world, cell.x, cell.y)) return 'A railway corridor occupies the deployment footprint.';
    if (cell.x < 0 || cell.y < 0 || cell.x >= world.width || cell.y >= world.height) return 'All four panels must fit inside the island map.';
    if (world.terrain[cell.y * world.width + cell.x] === 0) return 'The full cross-shaped footprint needs land.';
    if (cell.x >= 23 && cell.x <= 25 && cell.y >= 17 && cell.y <= 19) return 'Keep the original landing pad clear.';
    if (cores.some(c => coreCell(c, cell.x, cell.y))) return 'Another core or its panels occupy this site.';
    if (buildings.some(b => b.x === cell.x && b.y === cell.y)) return 'An existing facility occupies the deployment footprint.';
    if (occupants.some(p => Math.abs(p.x - cell.x - .5) < .75 && Math.abs(p.y - cell.y - .5) < .75)) return 'A unit is inside the deployment footprint.';
  }
  return null;
}
