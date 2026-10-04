import { airbaseAt, hangarBlocks } from './footprints.js';
import { dockAt, shipBlocks } from './ship.js';
// World coordinates are measured in tiles; artwork never determines collision.
import { CORE, coreCell, coreBlocks } from './core.js';
import { artilleryBlocks, artilleryUnitBlocks, railCorridor } from './footprints.js';
import { TANK, tankBlocks, tankPodCell } from './tank.js';
export const TERRAIN = { WATER: 0, SAND: 1, GRASS: 2, ROCK: 3, FLOOR: 4 };
export const LABELS = ['Open water', 'Sand', 'Grassland', 'Rock', 'Metal flooring'];
export const SPEED = 3;
export const MAX_BUILDINGS = 60;
const bridgeIndexes = new WeakMap();

export function createWorld() {
  const width = 48, height = 36;
  const terrain = Array(width * height).fill(TERRAIN.WATER);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - 25) / 16, dy = (y - 18) / 12;
      const angle = Math.atan2(dy, dx);
      const edge = 1 + 0.09 * Math.sin(angle * 5) + 0.055 * Math.cos(angle * 9);
      const distance = Math.hypot(dx, dy);
      // Authored inlet on the west coast, plus an offshore island for later navy tests.
      const inlet = x < 18 && Math.hypot((x - 13) / 5, (y - 19) / 2.3) < 1;
      if (distance < edge && !inlet) terrain[y * width + x] = distance > edge - 0.14 ? 1 : 2;
      if (Math.hypot((x - 7) / 3, (y - 8) / 3) < 1) terrain[y * width + x] = 1;
      if (terrain[y * width + x] === 2 && ((x === 33 && y >= 12 && y <= 15) || (y === 25 && x >= 27 && x <= 30))) terrain[y * width + x] = 3;
    }
  }
  // Guarantee an accessible, clear landing area regardless of future generator edits.
  for (let y = 16; y <= 20; y++) for (let x = 22; x <= 26; x++) terrain[y * width + x] = 2;
  return { version: 1, id: 'caldera-01', name: 'Caldera', width, height, terrain, spawn: { x: 24.5, y: 18.5 } };
}

export function tileAt(world, x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (world.tanks?.some(t => t.elapsed >= TANK.duration && tankPodCell(t, x, y))) return TERRAIN.FLOOR;
  if (world.cores?.some(c => c.elapsed >= CORE.duration && coreCell(c, x, y))) return TERRAIN.FLOOR;
  if (world.bridges?.length) {
    if (!bridgeIndexes.has(world)) bridgeIndexes.set(world, new Set(world.bridges.map(b => b.y * world.width + b.x)));
    if (x >= 0 && x < world.width && y >= 0 && y < world.height && bridgeIndexes.get(world).has(y * world.width + x)) return TERRAIN.FLOOR;
  }
  return x < 0 || y < 0 || x >= world.width || y >= world.height ? 0 : world.terrain[y * world.width + x];
}

export function isLanding(x, y) {
  return x >= 23 && x <= 25 && y >= 17 && y <= 19;
}

/** @param {string|null} [ignoreTank] */
export function canStand(world, buildings, x, y, ignoreTank = null, radius = .21) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (shipBlocks(world, x, y, radius)) return false;
  if (tankBlocks(world, x, y, radius, ignoreTank)) return false;
  if (artilleryUnitBlocks(world, x, y, radius)) return false;
  for (const dx of [-radius, radius]) for (const dy of [-radius, radius]) {
    const tx = Math.floor(x + dx), ty = Math.floor(y + dy);
    const tile = tileAt(world, tx, ty);
    if (hangarBlocks(world,tx,ty) || tile === 0 || tile === 3 || world.cores?.some(c => coreBlocks(c, tx, ty)) || buildings.some(b => b.x === tx && b.y === ty)) return false;
  }
  return true;
}

// Rails may cross the landing pad. Find nearby clear ground if a carriage parks there.
export function clearSpawn(world, buildings) {
  if (canStand(world, buildings, world.spawn.x, world.spawn.y)) return { ...world.spawn };
  const sx = Math.floor(world.spawn.x), sy = Math.floor(world.spawn.y);
  for (let radius = 1; radius < Math.max(world.width, world.height); radius++) {
    for (let y = Math.max(0, sy - radius); y <= Math.min(world.height - 1, sy + radius); y++) {
      for (let x = Math.max(0, sx - radius); x <= Math.min(world.width - 1, sx + radius); x++) {
        if (Math.max(Math.abs(x - sx), Math.abs(y - sy)) === radius && canStand(world, buildings, x + .5, y + .5)) return { x: x + .5, y: y + .5 };
      }
    }
  }
  return null;
}

export function placementError(world, buildings, players, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= world.width || y >= world.height) return 'Select a tile inside the survey area.';
  if(airbaseAt(world,x,y))return 'Keep the airbase runway and apron clear.';
  if (dockAt(world,x,y)) return 'Keep the shoreline boarding point clear.';
  const tile = tileAt(world, x, y);
  if (tankBlocks(world, x + .5, y + .5, .5)) return 'A tank or incoming pod occupies this site.';
  if (tile === 0) return 'Open water. Sentries need solid ground.';
  if (tile === 3) return 'Rock obstructs this site.';
  if (isLanding(x, y)) return 'Keep the landing pad clear.';
  if (railCorridor(world, x, y) || artilleryBlocks(world, x, y)) return 'Keep the railway carriage corridor clear.';
  if (world.cores?.some(c => coreCell(c, x, y))) return 'Keep core machinery, exits and panels clear in this field test.';
  if (buildings.some(b => b.x === x && b.y === y)) return 'This tile is already occupied.';
  if (players.some(p => Math.abs(p.x - (x + 0.5)) < 0.75 && Math.abs(p.y - (y + 0.5)) < 0.75)) return 'A scout is too close to this site.';
  if (buildings.length >= MAX_BUILDINGS) return 'This outpost has reached its 60-foundation limit.';
  return null;
}

export function findPath(world, buildings, start, goal, blocked = (x, y) => false) {
  const gx = Math.floor(goal.x), gy = Math.floor(goal.y);
  if (!canStand(world, buildings, gx + 0.5, gy + 0.5) || blocked(gx + .5, gy + .5)) return null;
  const sx = Math.floor(start.x), sy = Math.floor(start.y);
  const first = sy * world.width + sx, last = gy * world.width + gx;
  const previous = new Int32Array(world.width * world.height).fill(-1);
  const queue = [first]; previous[first] = first;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current === last) {
      const path = [];
      for (let at = last; at !== first; at = previous[at]) path.push({ x: at % world.width + 0.5, y: Math.floor(at / world.width) + 0.5 });
      return path.reverse();
    }
    const x = current % world.width, y = Math.floor(current / world.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = ny * world.width + nx;
      if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height || previous[next] !== -1) continue;
      if (!blocked(nx + .5, ny + .5) && canStand(world, buildings, nx + 0.5, ny + 0.5)) { previous[next] = current; queue.push(next); }
    }
  }
  return null;
}
