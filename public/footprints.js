// Pure geometry shared by movement, construction, ray tests and presentation.
import { isCurve, isCompact, curveBounds, insideBounds } from './track.js';
export const isCompactTurn = gun => !!gun.move?.fromShape && gun.move.fromShape !== gun.shape && !gun.move.curve;
// Circle against the translating/rotating 3x3 body, matching gunPosition rendering.
// Half-step padding bounds the motion between samples, so fast corner motion cannot tunnel.
export function compactTurnHits(gun, x, y, radius = .21) {
  const move = gun.move, steps = 64;
  const fromAngle = move.fromShape === 'NS' ? Math.PI / 2 : 0, toAngle = gun.shape === 'NS' ? Math.PI / 2 : 0;
  const travel = Math.hypot(gun.x - move.fromX, gun.y - move.fromY);
  const padding = (travel + Math.SQRT2 * 1.5 * Math.abs(toAngle - fromAngle)) / (2 * steps);
  if (x < Math.min(gun.x, move.fromX) - 2 - radius || x > Math.max(gun.x, move.fromX) + 3 + radius || y < Math.min(gun.y, move.fromY) - 2 - radius || y > Math.max(gun.y, move.fromY) + 3 + radius) return false;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, angle = fromAngle + (toAngle - fromAngle) * t, cos = Math.cos(angle), sin = Math.sin(angle);
    const dx = x - (move.fromX + (gun.x - move.fromX) * t + .5), dy = y - (move.fromY + (gun.y - move.fromY) * t + .5);
    const qx = Math.max(0, Math.abs(dx * cos + dy * sin) - 1.5), qy = Math.max(0, Math.abs(-dx * sin + dy * cos) - 1.5);
    if (qx * qx + qy * qy < (radius + padding) ** 2) return true;
  }
  return false;
}
export function artilleryUnitBlocks(world, x, y, radius = .21) {
  return world.artillery?.some(g => {
    if (isCompactTurn(g)) return compactTurnHits(g, x, y, radius);
    return [-radius, radius].some(dx => [-radius, radius].some(dy => artilleryBlocks({ artillery: [g] }, x + dx, y + dy)));
  });
}
export function gunCells(gun) {
  const cells = new Map();
  if (gun.kind === 'missile') {
    for (let y = gun.y; y < gun.y + 4; y++) for (let x = gun.x; x < gun.x + 4; x++) cells.set(`${x},${y}`, { x, y });
    return [...cells.values()];
  }
  if (gun.move?.bounds) {
    const b = gun.move.bounds;
    for (let y = b.minY; y <= b.maxY; y++) for (let x = b.minX; x <= b.maxX; x++) cells.set(`${x},${y}`, { x, y });
  }
  for (const center of [gun, ...(gun.move ? [{ x: gun.move.fromX, y: gun.move.fromY }] : [])]) {
    for (let y = center.y - 1; y <= center.y + 1; y++) for (let x = center.x - 1; x <= center.x + 1; x++) cells.set(`${x},${y}`, { x, y });
  }
  return [...cells.values()];
}
export const artilleryBlocks = (world, x, y) => world.artillery?.some(g => g.kind === 'missile' ? Math.floor(x) >= g.x && Math.floor(x) < g.x + 4 && Math.floor(y) >= g.y && Math.floor(y) < g.y + 4 : (Math.abs(g.x - Math.floor(x)) <= 1 && Math.abs(g.y - Math.floor(y)) <= 1) || (g.move?.bounds && insideBounds(g.move.bounds, Math.floor(x), Math.floor(y))) || (g.move && Math.abs(g.move.fromX - Math.floor(x)) <= 1 && Math.abs(g.move.fromY - Math.floor(y)) <= 1));
export const railCorridor = (world, x, y) => world.rails?.some(r => isCurve(r) ? insideBounds(curveBounds(r), x, y) : isCompact(r) ? r.x === x && r.y === y : r.shape === 'EW' ? r.x === x && Math.abs(r.y - y) <= 1 : r.y === y && Math.abs(r.x - x) <= 1);

export const airbaseAt=(world,x,y)=>world.airbases?.some(b=>x>=b.x&&x<b.x+6&&y>=b.y&&y<b.y+10)||false;
export const hangarBlocks=(world,x,y)=>world.airbases?.some(b=>x>=b.x+4&&x<b.x+6&&y>=b.y+1&&y<b.y+4)||false;
