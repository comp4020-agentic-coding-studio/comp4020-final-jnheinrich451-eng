import { airbaseAt } from './footprints.js';
import { dockAt } from './ship.js';
import { tileAt } from './world.js';
import { tankBlocks } from './tank.js';
import { CORE, coreBlocks } from './core.js';
import { gunCells, artilleryBlocks, compactTurnHits } from './footprints.js';
import { ARTILLERY_HE } from './weapons.js';
import { isCurve, isCompact, railPorts, joinedShape, curveEnds, curveCells, curveBounds, curvePoint } from './track.js';
import { turnTurret } from './turret.js';
import { switchAt, switchEntryError } from './switches.js';

export const RAIL = Object.freeze({ maxTiles: 256, maxGuns: 8, turnSpeed: Math.PI / 4, elevationSpeed: 8, minElevation: 10, maxElevation: 87, defaultElevation: 75, gravity: 12, inputTime: .35, moveTime: 1.2, braceTime: 1.2, leaseTime: 5 });
// Flat terrain, fixed launch speed, no drag. These are game units, not metres.
export function artillerySolution(gun) {
  const elevation = gun.elevation ?? RAIL.defaultElevation, pitch = elevation * Math.PI / 180;
  const speed = Math.sqrt(ARTILLERY_HE.range * RAIL.gravity), horizontalSpeed = speed * Math.cos(pitch), verticalSpeed = speed * Math.sin(pitch);
  const duration = 2 * verticalSpeed / RAIL.gravity, range = horizontalSpeed * duration;
  const origin = gunPosition(gun);
  return { x: origin.x + Math.sin(gun.angle) * range, y: origin.y - Math.cos(gun.angle) * range,
    range, elevation, duration, verticalSpeed, gravity: RAIL.gravity, height: verticalSpeed ** 2 / (2 * RAIL.gravity) };
}
// The upper ballistic branch gives steep descent; mechanics still traverse gradually.
export function artilleryAim(gun, target) {
  const origin = gunPosition(gun), dx = target.x - origin.x, dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy), minimum = ARTILLERY_HE.range * Math.sin(2 * RAIL.maxElevation * Math.PI / 180);
  const range = Math.max(minimum, Math.min(ARTILLERY_HE.range, distance));
  return { angle: distance < .001 ? gun.angle : Math.atan2(dy, dx) + Math.PI / 2,
    elevation: (Math.PI - Math.asin(range / ARTILLERY_HE.range)) * 90 / Math.PI,
    inRange: distance >= minimum && distance <= ARTILLERY_HE.range, minimum };
}
export function driveCarriage(gun, x, y, world, buildings, occupants) {
  if (gun.move) return null; // Never queue a turn or reverse midway through its reservation.
  const rail = world.rails.find(r => r.x === gun.x && r.y === gun.y);
  if (isCompact(rail)) {
    if (!x && !y) return null;
    // At a junction a perpendicular key chooses the branch, even while forward is held.
    const dx = gun.shape === 'NS' && x ? Math.sign(x) : y ? 0 : Math.sign(x);
    const dy = dx ? 0 : Math.sign(y);
    return compactMove(gun, dx, dy, world, buildings, occupants);
  }
  const direction = gun.shape === 'EW' ? x : y;
  if (!direction) return null;
  return moveCarriage(gun, direction * (gun.heading || 1), world, buildings, occupants);
}
export function railSegment(x, y, shape, length = 5) {
  if (isCurve({ shape }) || isCompact({ shape })) return [{ x, y, shape }];
  return Array.from({ length }, (_, i) => ({ x: x + (shape === 'EW' ? i - Math.floor(length / 2) : 0), y: y + (shape === 'NS' ? i - Math.floor(length / 2) : 0), shape }));
}
function groundError(world, buildings, x, y) {
  if(airbaseAt(world,x,y))return 'Keep the airbase runway and apron clear.';
  if(dockAt(world,x,y))return 'Keep the shoreline dock clear.';
  if (tankBlocks(world, x + .5, y + .5, .5)) return 'A tank or incoming pod blocks the carriage corridor.';
  if (artilleryBlocks({ artillery: world.artillery?.filter(g => g.kind === 'missile') }, x, y)) return 'A missile battery blocks the carriage corridor.';
  const core = world.cores?.find(c => coreBlocks(c, x, y));
  if (core) return core.elapsed < CORE.duration ? `Core deployment reserves tile ${x}:${y}. Wait for the panels to unfold.` : `Core machinery blocks the carriage corridor at ${x}:${y}.`;
  if (x < 0 || y < 0 || x >= world.width || y >= world.height || [0, 3].includes(tileAt(world, x, y))) return 'The full carriage corridor needs clear land.';
  if (buildings.some(b => b.x === x && b.y === y)) return 'A facility blocks the carriage corridor.';
  return null;
}
export function railError(world, buildings, x, y, shape, length = 5, owner = '') {
  if (![x, y].every(Number.isInteger) || (!['EW', 'NS'].includes(shape) && !isCurve({ shape }) && !isCompact({ shape })) || ![1, 5].includes(length)) return 'Choose straight track, a one-tile corner or a junction.';
  if (isCurve({ shape })) {
    const rail = { x, y, shape }, old = world.rails?.find(r => r.x === x && r.y === y);
    if (old && old.shape !== shape) return 'This track assembly position is occupied.';
    const bounds = curveBounds(rail);
    for (const other of world.rails || []) if (isCurve(other) && other !== old) {
      const b = curveBounds(other);
      if (bounds.minX <= b.maxX && bounds.maxX >= b.minX && bounds.minY <= b.maxY && bounds.maxY >= b.minY) return 'Keep curve turning aprons separate. Upgrade one curve to add its junction switch.';
    }
    for (const cell of curveCells(rail)) { const error = groundError(world, buildings, cell.x, cell.y); if (error) return error; }
    return !old && (world.rails?.length || 0) >= RAIL.maxTiles ? 'This field test allows 256 track pieces.' : null;
  }
  const segment = railSegment(x, y, shape, length);
  let added = 0;
  for (const r of segment) {
    const old = world.rails?.find(t => t.x === r.x && t.y === r.y);
    const result = joinedShape(old, shape);
    if (!result) return 'Track assemblies cannot overlap. Remove the old broad curve first.';
    if (old && old.shape !== result) {
      if (owner && old.owner !== owner) return 'Only the rail owner can add exits to this tile.';
      if (artilleryBlocks(world, r.x, r.y)) return 'Move the carriage clear before changing its track.';
    }
    if (!old) added++;
    for (let offset = isCompact({ shape: result }) ? 0 : -1; offset <= (isCompact({ shape: result }) ? 0 : 1); offset++) {
      const error = groundError(world, buildings, r.x + (shape === 'NS' ? offset : 0), r.y + (shape === 'EW' ? offset : 0));
      if (error) return error;
    }
  }
  return (world.rails?.length || 0) + added > RAIL.maxTiles ? 'This field test allows 256 rail tiles.' : null;
}
export function carriageError(world, buildings, occupants, x, y, shape, ignoreId = null, connectedMove = false) {
  if (![x, y].every(Number.isInteger) || !['EW', 'NS'].includes(shape)) return 'Select the middle tile of a straight track.';
  if (!connectedMove) for (const r of railSegment(x, y, shape, 3)) {
    const ports = railPorts(world.rails?.find(t => t.x === r.x && t.y === r.y));
    const needed = r.x < x ? 'E' : r.x > x ? 'W' : r.y < y ? 'S' : r.y > y ? 'N' : shape;
    if (![...needed].every(p => ports.includes(p))) return 'The cannon needs three connected straight rail tiles beneath it.';
  }
  const others = { ...world, artillery: (world.artillery || []).filter(g => g.id !== ignoreId) };
  for (const cell of gunCells({ x, y })) {
    const error = groundError(world, buildings, cell.x, cell.y);
    if (error) return error;
    if (artilleryBlocks(others, cell.x, cell.y)) return 'Another carriage occupies this space.';
    if (occupants.some(p => p.life !== 'disabled' && Math.abs(p.x - cell.x - .5) < .75 && Math.abs(p.y - cell.y - .5) < .75)) return 'A unit blocks the carriage footprint.';
  }
  return null;
}
function compactMove(gun, dx, dy, world, buildings, occupants) {
  const from = world.rails.find(r => r.x === gun.x && r.y === gun.y), x = gun.x + dx, y = gun.y + dy;
  const to = world.rails.find(r => r.x === x && r.y === y);
  const exit = dx > 0 ? 'E' : dx < 0 ? 'W' : dy > 0 ? 'S' : 'N', opposite = { E: 'W', W: 'E', N: 'S', S: 'N' }[exit];
  if (!railPorts(from).includes(exit) || !railPorts(to).includes(opposite)) return 'No connected rail in that direction.';
  const shape = dx ? 'EW' : 'NS', error = carriageError(world, buildings, occupants, x, y, shape, gun.id, true);
  if (error) return error;
  const turning = shape !== gun.shape, move = { fromX: gun.x, fromY: gun.y, elapsed: 0, duration: RAIL.moveTime, fromShape: gun.shape };
  if (turning) {
    // Physical swept clearance is temporary; the track junction itself is one tile.
    move.bounds = { minX: Math.min(gun.x, x) - 2, maxX: Math.max(gun.x, x) + 2, minY: Math.min(gun.y, y) - 2, maxY: Math.max(gun.y, y) + 2 };
    const others = { ...world, artillery: world.artillery.filter(g => g.id !== gun.id) };
    for (let cy = move.bounds.minY; cy <= move.bounds.maxY; cy++) for (let cx = move.bounds.minX; cx <= move.bounds.maxX; cx++) {
      const blocked = groundError(world, buildings, cx, cy); if (blocked) return blocked;
      if (artilleryBlocks(others, cx, cy)) return 'Another carriage blocks the turn.';
    }
    const sweptGun = { ...gun, x, y, shape, move };
    const blocker = occupants.find(p => p.life !== 'disabled' && compactTurnHits(sweptGun, p.x, p.y, p.hp === undefined ? .21 : .38));
    if (blocker) return `${blocker.name || 'A unit'} blocks the turn at ${Math.floor(blocker.x)}:${Math.floor(blocker.y)}.`;
  }
  gun.move = move; gun.x = x; gun.y = y; gun.shape = shape; gun.heading = dx || dy; gun.brace = RAIL.braceTime;
  return null;
}
export function moveCarriage(gun, step, world, buildings, occupants) {
  if (![-1, 1].includes(step)) return 'Choose one step forward or backward.';
  if (gun.move) return 'The carriage is already moving.';
  const direction = step * (gun.heading || 1), dx = gun.shape === 'EW' ? direction : 0, dy = gun.shape === 'NS' ? direction : 0;
  if (world.rails.some(r => isCompact(r) && ((r.x === gun.x && r.y === gun.y) || (r.x === gun.x + dx && r.y === gun.y + dy)))) return compactMove(gun, dx, dy, world, buildings, occupants);
  const entryError = switchEntryError(world, gun, dx, dy); if (entryError) return entryError;
  for (const rail of world.rails || []) if (isCurve(rail)) {
    if (switchAt(world, rail)?.route === 'straight') continue;
    const ends = curveEnds(rail);
    const from = ends.findIndex((e, i) => e.x === gun.x && e.y === gun.y && e.dx * (i ? -1 : 1) === dx && e.dy * (i ? -1 : 1) === dy);
    if (from < 0) continue;
    const to = ends[1 - from], error = carriageError(world, buildings, occupants, to.x, to.y, to.shape, gun.id);
    if (error) return error;
    const others = { ...world, artillery: (world.artillery || []).filter(g => g.id !== gun.id) };
    for (const cell of curveCells(rail)) {
      const blocked = groundError(world, buildings, cell.x, cell.y);
      if (blocked) return blocked;
      if (artilleryBlocks(others, cell.x, cell.y)) return 'Another carriage reserves this turn.';
      if (occupants.some(p => p.life !== 'disabled' && Math.abs(p.x - cell.x - .5) < .75 && Math.abs(p.y - cell.y - .5) < .75)) return 'A unit is inside the turning apron.';
    }
    gun.move = { fromX: gun.x, fromY: gun.y, elapsed: 0, duration: RAIL.moveTime * 3 * Math.PI / 2, curve: { x: rail.x, y: rail.y, shape: rail.shape }, reverse: from === 1, bounds: curveBounds(rail) };
    gun.x = to.x; gun.y = to.y; gun.shape = to.shape; gun.heading = step * (from ? -1 : 1) * (to.dx || to.dy); gun.brace = RAIL.braceTime;
    return null;
  }
  const x = gun.x + dx, y = gun.y + dy;
  const error = carriageError(world, buildings, occupants, x, y, gun.shape, gun.id);
  if (error) return error;
  gun.move = { fromX: gun.x, fromY: gun.y, elapsed: 0 }; gun.x = x; gun.y = y; gun.brace = RAIL.braceTime;
  return null;
}
export function artilleryFireError(gun, world) {
  const { x, y, range } = artillerySolution(gun);
  if (![x, y].every(Number.isFinite) || x < 0 || y < 0 || x >= world.width || y >= world.height) return 'Landing point outside this map. Adjust bearing or elevation.';
  if (gun.move) return 'Stop the carriage before firing.';
  if (gun.brace > .001) return 'Stabilizers are deploying.';
  if (gun.reload > .001) return 'The heavy cannon is reloading.';
  if (range < ARTILLERY_HE.minRange || range > ARTILLERY_HE.range + .000001) return 'Heavy HE range is 6 to 60 tiles.';
  return null;
}
export function tickCarriage(gun, dt) {
  // Lease heartbeats alone do not require a world broadcast or a disk write.
  const state = () => JSON.stringify([gun.reload, gun.brace, gun.move?.elapsed, gun.angle, gun.elevation, gun.operator]);
  const before = state();
  gun.reload = Math.max(0, gun.reload - dt);
  if (gun.move) { const duration = gun.move.duration || RAIL.moveTime; gun.move.elapsed = Math.min(duration, gun.move.elapsed + dt); if (gun.move.elapsed >= duration) gun.move = null; }
  else gun.brace = Math.max(0, gun.brace - dt);
  const inputDt = gun.operator ? Math.min(dt, gun.inputTime || 0, gun.lease) : 0;
  if (gun.input?.mode === 'pointer' && gun.target) {
    const desired = artilleryAim(gun, gun.target);
    gun.aim = desired.angle;
    gun.angle = turnTurret(gun.angle, desired.angle, inputDt, RAIL.turnSpeed);
    const delta = desired.elevation - (gun.elevation ?? RAIL.defaultElevation);
    gun.elevation = (gun.elevation ?? RAIL.defaultElevation) + Math.sign(delta) * Math.min(Math.abs(delta), RAIL.elevationSpeed * inputDt);
  } else {
    // Compatibility for saved-stage tools; the game UI uses pointer commands.
    gun.angle = ((gun.angle + (gun.input?.traverse || 0) * RAIL.turnSpeed * inputDt) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    gun.elevation = Math.max(RAIL.minElevation, Math.min(RAIL.maxElevation, (gun.elevation ?? RAIL.defaultElevation) + (gun.input?.elevate || 0) * RAIL.elevationSpeed * inputDt));
    gun.aim = gun.angle; gun.target = null;
  }
  gun.inputTime = Math.max(0, (gun.inputTime || 0) - dt);
  if (gun.operator) { gun.lease = Math.max(0, gun.lease - dt); if (!gun.lease) { gun.operator = null; gun.inputTime = 0; } }
  return before !== state();
}
export function gunPosition(gun, elapsed = 0) {
  if (gun.kind === 'missile') return { x: gun.x + 2, y: gun.y + 2, chassis: 0 };
  const t = gun.move ? Math.min(1, (gun.move.elapsed + elapsed) / (gun.move.duration || RAIL.moveTime)) : 1;
  if (gun.move?.curve) { const p = curvePoint(gun.move.curve, gun.move.reverse ? 1 - t : t); return { x: p.x + .5, y: p.y + .5, chassis: p.angle + Math.PI / 2 }; }
  const endAngle = gun.shape === 'NS' ? Math.PI / 2 : 0, startAngle = gun.move?.fromShape === 'NS' ? Math.PI / 2 : 0;
  return { x: (gun.move ? gun.move.fromX + (gun.x - gun.move.fromX) * t : gun.x) + .5, y: (gun.move ? gun.move.fromY + (gun.y - gun.move.fromY) * t : gun.y) + .5,
    chassis: gun.move?.fromShape ? startAngle + (endAngle - startAngle) * t : endAngle };
}
