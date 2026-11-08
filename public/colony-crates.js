// Material crates for the peaceful expedition, shared by server and client.
// The shuttle unloads its reward as cardboard crates beside the pad; a worker
// collects one by walking up to it, or a crate collector gathers them with
// power. A reward that has nowhere to land is credited directly: it is never lost.
import { decorationAt } from './colony-ambience.js';
import { INDUSTRY, industryAt, industryItems, reachableCrates } from './colony-industry.js';
import { settlementAt } from './colony-settlement.js';

export const CRATES = Object.freeze({ materials: 4, limit: 24, reach: 1.6, ringMin: 2, ringMax: 6 });
const LAND = [1, 2, 4];
const reject = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const land = (world, x, y) => x >= 0 && y >= 0 && x < world.width && y < world.height && LAND.includes(world.terrain[y * world.width + x]);
const hubCell = (state, x, y) => x >= state.hub.x - 1 && x < state.hub.x + 1 && y >= state.hub.y - 1 && y < state.hub.y + 1;
const padCell = (state, x, y) => Math.abs(x - state.pad.x) <= 1 && Math.abs(y - state.pad.y) <= 1;
const bedCell = (bed, x, y) => Math.abs(x - bed.x) <= 1 && Math.abs(y - bed.y) <= 1;

/** @param {any} state */
export const crateItems = state => Array.isArray(state?.crates) ? state.crates : [];
/** @param {any} state */
export const crateAt = (state, x, y) => crateItems(state).find(crate => crate.x === x && crate.y === y) || null;
/** Crates sit on the ground until collected, so construction waits for them. @param {any} state @param {Array<{x:number,y:number}>} cells */
export const cratePlacementError = (state, cells) => cells.some(cell => crateAt(state, cell.x, cell.y)) ? 'Collect the crate first.' : null;

/** A tile a crate may land on: firm, unbuilt and not the arrival tile. @param {any} state */
function freeTile(state, x, y) {
  if (!land(state.world, x, y) || hubCell(state, x, y) || padCell(state, x, y) || crateAt(state, x, y)) return false;
  if (state.beds.some(bed => bedCell(bed, x, y)) || state.sprinklers.some(s => s.x === x && s.y === y)) return false;
  if (decorationAt(state, x, y) || settlementAt(state, x, y) || industryAt(state, x, y)) return false;
  return !(Math.floor(state.world.spawn.x) === x && Math.floor(state.world.spawn.y) === y);
}
/** Landing tiles in a fixed order: nearest ring first, then clockwise from the pad's south side. @param {any} state */
function landingTiles(state) {
  const tiles = [];
  for (let r = CRATES.ringMin; r <= CRATES.ringMax; r++) {
    const ring = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = state.pad.x + dx, y = state.pad.y + dy;
      if (freeTile(state, x, y)) ring.push({ x, y, angle: (Math.atan2(-dx, dy) + Math.PI * 2) % (Math.PI * 2) });
    }
    ring.sort((a, b) => a.angle - b.angle);
    tiles.push(...ring);
  }
  return tiles;
}

/** Turns a shuttle reward into crates beside the pad; leftover materials are credited at once. @param {any} state */
export function unloadCrates(state, reward) {
  const amount = Math.max(0, Math.floor(Number(reward) || 0));
  if (!amount) return 0;
  state.crates ||= [];
  const tiles = landingTiles(state);
  let remaining = amount, placed = 0;
  while (remaining > 0 && placed < tiles.length && state.crates.length < CRATES.limit) {
    const materials = Math.min(CRATES.materials, remaining), tile = tiles[placed];
    state.crates.push({ id: `crate-${state.nextId++}`, x: tile.x, y: tile.y, materials, placedAt: state.time || 0 });
    remaining -= materials; placed++;
  }
  state.materials += remaining;
  return placed;
}

/** A worker collects a crate they are standing beside. @param {any} state @param {any} actor */
export function collectCrate(state, actor, crateId) {
  const crate = crateItems(state).find(item => item.id === crateId);
  if (!crate) reject('That crate has already been collected.', 404);
  if (![actor?.x, actor?.y].every(Number.isFinite)) reject('Walk up to the crate to collect it.');
  if ((actor.regionId || 'home') !== 'home') reject('Return to the home district to collect crates.');
  if (Math.max(Math.abs(actor.x - (crate.x + .5)), Math.abs(actor.y - (crate.y + .5))) > CRATES.reach) reject('Walk up to the crate to collect it.');
  if (carrier(state, crateId)) reject('A drone is already carrying that crate.');
  state.crates = state.crates.filter(item => item.id !== crateId);
  state.materials += crate.materials;
  releaseCrate(state, crateId);
  return { message: `Collected ${crate.materials} materials.`, materials: crate.materials };
}

/** The crate nearest a point within reach, for the worker's E prompt. @param {any} state @param {number} x @param {number} y @param {number} [reach] */
export function nearestCrate(state, x, y, reach = CRATES.reach) {
  let best = null, bestDistance = Infinity;
  for (const crate of crateItems(state)) {
    if (carrier(state, crate.id)) continue;
    const distance = Math.max(Math.abs(x - (crate.x + .5)), Math.abs(y - (crate.y + .5)));
    if (distance <= reach && distance < bestDistance) { best = crate; bestDistance = distance; }
  }
  return best;
}

/** The warehouse whose drone is flying a crate home, if any. @param {any} state */
export const carrier = (state, crateId) => industryItems(state).find(item => item.kind === 'warehouse' && item.task?.crateId === crateId && item.task.phase === 'back') || null;
/** A crate taken by hand ends a collector's task and turns a fetching drone around empty. @param {any} state */
function releaseCrate(state, crateId) {
  for (const machine of industryItems(state)) {
    if (machine.task?.crateId !== crateId) continue;
    if (machine.kind === 'warehouse') { const at = flightPoint(machine.task, 1); machine.task = flight(at, home(machine), 'back', null); }
    else machine.task = null;
  }
}
const home = machine => ({ x: machine.x + 1.5, y: machine.y + 1.5 });
function flight(from, to, phase, crateId) {
  const duration = Math.max(INDUSTRY.droneMinSeconds, Math.hypot(to.x - from.x, to.y - from.y) / INDUSTRY.droneSpeed);
  return { crateId, phase, elapsed: 0, duration, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } };
}
const flightPoint = (task, t) => ({ x: task.from.x + (task.to.x - task.from.x) * t, y: task.from.y + (task.to.y - task.from.y) * t });
/** Where a warehouse drone is right now, for drawing; null while it is parked. @param {any} state @param {any} machine */
export function dronePose(state, machine, time = state.time || 0, reduced = false) {
  const task = machine.task;
  if (!task) return null;
  const progress = Math.min(1, task.elapsed / task.duration), lead = reduced ? 0 : Math.min(.3, Math.max(0, time - (state.time || 0))) / task.duration;
  const t = Math.min(1, progress + lead), at = flightPoint(task, t);
  return { x: at.x, y: at.y, z: 1.25 + Math.sin(t * Math.PI) * .35, carrying: task.phase === 'back' && !!task.crateId, crateId: task.crateId, phase: task.phase, t };
}
function tickDrone(state, machine, dt) {
  let budget = dt;
  while (budget > 1e-9) {
    if (!machine.task) {
      const next = reachableCrates(state, machine)[0];
      if (!next) break;
      machine.task = flight(home(machine), { x: next.x + .5, y: next.y + .5 }, 'out', next.id);
    }
    const task = machine.task, crate = task.crateId ? crateItems(state).find(item => item.id === task.crateId) : null;
    if (task.crateId && !crate) { machine.task = flight(flightPoint(task, Math.min(1, task.elapsed / task.duration)), home(machine), 'back', null); continue; }
    const worked = Math.min(budget, task.duration - task.elapsed);
    task.elapsed += worked; budget -= worked;
    if (task.elapsed < task.duration - 1e-9) continue;
    if (task.phase === 'out') machine.task = flight(task.to, home(machine), 'back', task.crateId);
    else {
      if (crate) { state.crates = state.crates.filter(item => item.id !== crate.id); state.materials += crate.materials; }
      machine.task = null;
    }
  }
}

/** Collectors spend one unit of power per crate and take a fixed time per crate; a warehouse drone fetches for free. @param {any} state */
export function tickCollectors(state, dt) {
  if (!state.industry || !Number.isFinite(dt) || dt <= 0) return;
  const industry = state.industry;
  for (const machine of industry.machines) {
    if (!machine.enabled) continue;
    if (machine.kind === 'warehouse') { tickDrone(state, machine, dt); continue; }
    if (machine.kind !== 'collector') continue;
    let budget = dt;
    while (budget > 1e-9) {
      if (!machine.task) {
        const next = reachableCrates(state, machine)[0];
        if (!next || industry.energy < INDUSTRY.collectorEnergy) break;
        industry.energy -= INDUSTRY.collectorEnergy;
        machine.task = { crateId: next.id, elapsed: 0, duration: INDUSTRY.collectorSeconds };
      }
      const task = machine.task, crate = crateItems(state).find(item => item.id === task.crateId);
      if (!crate) { machine.task = null; continue; }
      const worked = Math.min(budget, task.duration - task.elapsed);
      task.elapsed += worked; budget -= worked;
      if (task.elapsed >= task.duration - 1e-9) {
        state.crates = state.crates.filter(item => item.id !== crate.id);
        state.materials += crate.materials;
        machine.task = null;
      }
    }
  }
}
