// Ground conditioning for the peaceful expedition, shared by server and client.
// No combat import and no clock: only tickColony's active room time moves it.
// Level 0 is wild meadow; level 8 is conditioned ground that admits construction.
// Distances are Chebyshev distances from a bed's centre tile (bed.x, bed.y).
import { bedReady } from './colony-crops.js';
import { decorationItems, decorationCells } from './colony-ambience.js';
import { industryItems, machineCells } from './colony-industry.js';
import { settlementItems, settlementCells } from './colony-settlement.js';

export const GROUND = Object.freeze({ levels: 8, startRadius: 10, nearReach: 2, farReach: 4, stepSeconds: 5, revertSteps: 6 });
const GROUND_MESSAGE = 'Grow a crop nearby to condition this ground first.';
/** Terrain kinds that can carry ground: shore, meadow and terrace. Water and rock never condition. */
export const LAND_KINDS = Object.freeze([1, 2, 4]);
const LAND = LAND_KINDS;
const inside = (world, x, y) => x >= 0 && y >= 0 && x < world.width && y < world.height;
const landIndex = (world, i) => LAND.includes(world.terrain[i]);

/** Run-length text such as "0:300 8:121 0:12"; JSON-plain and cheap to diff. @param {ArrayLike<number>} levels */
export function encodeGround(levels) {
  const tokens = [];
  let level = -1, count = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] === level) { count++; continue; }
    if (count) tokens.push(`${level}:${count}`);
    level = levels[i]; count = 1;
  }
  if (count) tokens.push(`${level}:${count}`);
  return tokens.join(' ');
}
const decodeCache = new Map();
/** Read-only decode; copy before mutating. Short or garbled text pads with wild ground and never throws. */
export function decodeGround(cells, size) {
  const text = typeof cells === 'string' ? cells : '', length = Number.isSafeInteger(size) && size > 0 ? size : 0;
  const cached = decodeCache.get(text);
  if (cached && cached.size === length) return cached.levels;
  const levels = new Uint8Array(length);
  let index = 0;
  for (const token of text.split(' ')) {
    if (index >= length) break;
    const match = /^(\d+):(\d+)$/.exec(token);
    if (!match) continue;
    const end = Math.min(length, index + Number(match[2]));
    levels.fill(Math.min(GROUND.levels, Number(match[1])), index, end); index = end;
  }
  if (decodeCache.size >= 4) decodeCache.delete(decodeCache.keys().next().value);
  decodeCache.set(text, { size: length, levels });
  return levels;
}

/** Every saved construction footprint: hub, pad, beds, sprinklers, camp, machines, belts and furnishings. @param {any} state */
function constructionCells(state) {
  const cells = [];
  for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) cells.push({ x: state.hub.x + dx, y: state.hub.y + dy });
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    cells.push({ x: state.pad.x + dx, y: state.pad.y + dy });
    for (const bed of state.beds || []) cells.push({ x: bed.x + dx, y: bed.y + dy });
  }
  for (const sprinkler of state.sprinklers || []) cells.push({ x: sprinkler.x, y: sprinkler.y });
  for (const item of decorationItems(state)) cells.push(...decorationCells(item.kind, item.x, item.y));
  for (const item of industryItems(state)) cells.push(...machineCells(item.kind, item.x, item.y));
  for (const item of settlementItems(state)) cells.push(...settlementCells(item));
  return cells;
}
/** Tiles that never revert: the starting clearing and one tile around every construction cell. @param {any} state */
function heldMask(state) {
  const { width, height } = state.world, mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (Math.hypot(x + .5 - state.hub.x, y + .5 - state.hub.y) <= GROUND.startRadius) mask[y * width + x] = 1;
  for (const cell of constructionCells(state)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = cell.x + dx, y = cell.y + dy;
    if (inside(state.world, x, y)) mask[y * width + x] = 1;
  }
  return mask;
}

/** Deterministic initial ground for a new save or an old save without one; never mutates state. @param {any} state */
export function createGround(state) {
  const { world } = state, held = heldMask(state), levels = new Uint8Array(world.width * world.height);
  for (let i = 0; i < levels.length; i++) if (held[i] && landIndex(world, i)) levels[i] = GROUND.levels;
  return { version: 1, revision: 0, elapsed: 0, steps: 0, cells: encodeGround(levels) };
}
/** Shared cached decode for readers inside this module; never handed out. @param {any} state */
const levelsOf = state => decodeGround(state.ground ? state.ground.cells : '', state.world.width * state.world.height);
/** A private copy of the levels; absent ground means wild, there is no silent legacy mode. @param {any} state */
export const groundLevels = state => Uint8Array.from(levelsOf(state));
/** @param {any} state */
export const groundAt = (state, x, y) => inside(state.world, x, y) ? levelsOf(state)[y * state.world.width + x] : 0;
/** @param {any} state */
export const groundConditioned = (state, x, y) => groundAt(state, x, y) >= GROUND.levels;
/** @param {any} state @param {Array<{x:number,y:number}>} cells */
export const groundPlacementError = (state, cells) => cells.every(cell => groundConditioned(state, cell.x, cell.y)) ? null : GROUND_MESSAGE;
/** @param {any} state */
export function groundSummary(state) {
  const levels = levelsOf(state), summary = { conditioned: 0, land: 0, frontier: 0 };
  for (let i = 0; i < levels.length; i++) {
    if (!landIndex(state.world, i)) continue;
    summary.land++;
    if (levels[i] >= GROUND.levels) summary.conditioned++;
    else if (levels[i] > 0) summary.frontier++;
  }
  return summary;
}

const liveBed = bed => !!bed.crop && (bed.water > 0 || bedReady(bed));
/** One five-second step over the whole district; returns whether any level changed. @param {any} state */
function conditionStep(state, levels, step) {
  const { width, height } = state.world, gains = new Uint8Array(width * height), held = heldMask(state);
  const far = step % 2 === 0, revert = step % GROUND.revertSteps === 0;
  for (const bed of state.beds || []) {
    if (!liveBed(bed)) continue;
    for (let dy = -GROUND.farReach; dy <= GROUND.farReach; dy++) for (let dx = -GROUND.farReach; dx <= GROUND.farReach; dx++) {
      const x = bed.x + dx, y = bed.y + dy;
      if ((far || Math.max(Math.abs(dx), Math.abs(dy)) <= GROUND.nearReach) && inside(state.world, x, y)) gains[y * width + x] = 1;
    }
  }
  let changed = false;
  for (let i = 0; i < levels.length; i++) {
    if (!landIndex(state.world, i)) continue;
    if (gains[i]) { if (levels[i] < GROUND.levels) { levels[i]++; changed = true; } }
    else if (revert && levels[i] > 0 && !held[i]) { levels[i]--; changed = true; }
  }
  return changed;
}
/** Advances whole steps only, so tickGround(state, 40) equals eight calls with 5. @param {any} state */
export function tickGround(state, dt) {
  const ground = state.ground;
  if (!ground || typeof ground !== 'object' || !Number.isFinite(dt) || dt <= 0) return false;
  // A hand-edited save must not stall the clock or freeze the room: heal the counters.
  if (!Number.isFinite(ground.elapsed) || ground.elapsed < 0) ground.elapsed = 0;
  if (!Number.isSafeInteger(ground.steps) || ground.steps < 0) ground.steps = 0;
  if (!Number.isSafeInteger(ground.revision) || ground.revision < 0) ground.revision = 0;
  ground.elapsed += dt;
  if (ground.elapsed < GROUND.stepSeconds) return false;
  const levels = groundLevels(state);
  let changed = false;
  while (ground.elapsed >= GROUND.stepSeconds) {
    if (conditionStep(state, levels, ground.steps)) { ground.cells = encodeGround(levels); ground.revision++; changed = true; }
    ground.elapsed -= GROUND.stepSeconds; ground.steps++;
  }
  if (ground.elapsed < 1e-9) ground.elapsed = 0;
  return changed;
}
