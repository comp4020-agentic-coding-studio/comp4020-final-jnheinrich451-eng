import { readyFactory, LOGISTICS_SIZE, LOCAL_KINDS } from './logistics.js';
import { POD } from './pod.js';
import { AIR } from './aircraft.js';
import { MISSILE } from './missile.js';
import { dockDimensions } from './naval-scale.js';

// Construction support is an admission rule, not a power network or unit cap.
export const CONSTRUCTION = Object.freeze({ radius: 24 });
export const needsConstruction = kind => LOCAL_KINDS.includes(kind);
export const constructionCores = world => [
  ...(world.cores || []).filter(c => c.elapsed >= POD.duration && !c.destroyed && (c.health === undefined || c.health > 0)),
  ...(world.logistics?.facilities || []).filter(f=>readyFactory(f)&&!world.logistics?.jobs?.[f.id]).map(f => ({ ...f, x: f.x - .5, y: f.y - .5 })),
];

function corners(x, y, width, height, angle = 0) {
  return [-1, 1].flatMap(dx => [-1, 1].map(dy => ({
    x: x + dx * width / 2 * Math.cos(angle) - dy * height / 2 * Math.sin(angle),
    y: y + dx * width / 2 * Math.sin(angle) + dy * height / 2 * Math.cos(angle),
  })));
}

// The entire land footprint must fit inside ONE friendly core's circle.
// For docks only the shore platform needs support; the sea structure is exempt.
/** @param {any} [ship] */
export function constructionError(world, kind, x, y, ship = null) {
  if (!needsConstruction(kind)) return null;
  const cores = constructionCores(world);
  if (!cores.length) return 'Deploy a friendly core and wait for its panels to open.';
  let points;
  if(kind==='helipad') points=corners(x+1.5,y+1.5,3,3);
  else if (kind === 'airbase') points = corners(x + AIR.width / 2, y + AIR.height / 2, AIR.width, AIR.height);
  else if (kind === 'missile') points = corners(x + MISSILE.size / 2, y + MISSILE.size / 2, MISSILE.size, MISSILE.size);
  else if (['artillery','mac'].includes(kind)) points = corners(x + .5, y + .5, 3, 3);
  else if (LOGISTICS_SIZE[kind]) points = corners(x + LOGISTICS_SIZE[kind]/2, y + LOGISTICS_SIZE[kind]/2, LOGISTICS_SIZE[kind], LOGISTICS_SIZE[kind]);
  else if (ship?.dock) points = corners(ship.dock.x, ship.dock.y, ship.dockStyle === 'unfolding' ? dockDimensions(ship).width : 1, 1, ship.dock.angle);
  else if(kind==='tank') points=corners(x+.5,y+.5,3,3);
  else points=corners(x+.5,y+.5,1,1);
  if (cores.some(c => points.every(p => Math.hypot(p.x - c.x - 1.5, p.y - c.y - 1.5) <= CONSTRUCTION.radius + 1e-8))) return null;
  return `Keep the ${kind === 'ship' ? 'shore platform' : 'whole facility'} within ${CONSTRUCTION.radius} tiles of a completed friendly core or factory. Follow the blue construction circle.`;
}
