import { hangarBlocks } from './footprints.js';
import { tileAt } from './world.js';
import { coreBlocks } from './core.js';
import { artilleryBlocks } from './footprints.js';

// Exact tile-boundary traversal plus nearest ray/circle hit. Friendly structures
// can stop a shot without receiving damage. Walkable floor is transparent.
export function raycast(world, buildings, origin, dx, dy, range, enemies = [], radius = .38) {
  let distance = range, enemy = null, blocked = false;
  const occupied = new Set(buildings.map(b => `${b.x},${b.y}`));
  let x = Math.floor(origin.x), y = Math.floor(origin.y), entered = 0;
  const stepX = dx >= 0 ? 1 : -1, stepY = dy >= 0 ? 1 : -1;
  const deltaX = Math.abs(dx) < 1e-10 ? Infinity : Math.abs(1 / dx);
  const deltaY = Math.abs(dy) < 1e-10 ? Infinity : Math.abs(1 / dy);
  let nextX = deltaX === Infinity ? Infinity : (dx >= 0 ? x + 1 - origin.x : origin.x - x) * deltaX;
  let nextY = deltaY === Infinity ? Infinity : (dy >= 0 ? y + 1 - origin.y : origin.y - y) * deltaY;
  const solid = (cx, cy) => cx < 0 || cy < 0 || cx >= world.width || cy >= world.height || tileAt(world, cx, cy) === 3 || occupied.has(`${cx},${cy}`) || hangarBlocks(world,cx,cy) || artilleryBlocks(world, cx, cy) || world.cores?.some(c => coreBlocks(c, cx, cy));
  while (entered <= range) {
    if (solid(x, y)) { distance = entered; blocked = true; break; }
    if (Math.abs(nextX - nextY) < 1e-8) {
      // At a corner, touching either solid adjacent tile still blocks the ray.
      entered = nextX;
      if (entered <= range && (solid(x + stepX, y) || solid(x, y + stepY))) { distance = entered; blocked = true; break; }
      x += stepX; y += stepY; nextX += deltaX; nextY += deltaY;
    } else if (nextX < nextY) { entered = nextX; x += stepX; nextX += deltaX; }
    else { entered = nextY; y += stepY; nextY += deltaY; }
  }
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const ex = e.x - origin.x, ey = e.y - origin.y, along = ex * dx + ey * dy;
    const discriminant = radius * radius - (ex * ex + ey * ey - along * along);
    if (discriminant < 0 || along + Math.sqrt(discriminant) < 0) continue;
    const hit = Math.max(0, along - Math.sqrt(discriminant));
    if (hit < distance - 1e-8) { distance = hit; enemy = e; blocked = false; }
  }
  return { x: origin.x + dx * distance, y: origin.y + dy * distance, distance, enemy, blocked };
}
