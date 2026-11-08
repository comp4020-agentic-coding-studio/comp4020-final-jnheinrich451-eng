// Work-driven irrigation for the Morrow pilot. All time is active room time.
// This module does not draw, read a clock or create resources outside bed water.
import { cropById, bedReady } from './colony-crops.js';

export const IRRIGATION = Object.freeze({
  radius: 5, moisture: 90, threshold: 20, serviceSeconds: 1.8, flowPerSecond: 60,
  turnRate: .7, maxVisualLead: .3,
});
const TAU = Math.PI * 2;
const growing = bed => !!cropById(bed.crop) && !bedReady(bed);
const within = (sprinkler, bed) => Math.hypot(sprinkler.x - bed.x, sprinkler.y - bed.y) <= IRRIGATION.radius;
const validStep = dt => Number.isFinite(dt) && dt > 0;

/**
 * Updates moisture and returns the watered duration available to each bed's
 * growth rule. Call before growing crops for the same simulation interval.
 * Existing non-Morrow expeditions retain their continuous irrigation rule.
 * @param {any} state
 * @returns {Map<string, number>}
 */
export function tickIrrigation(state, dt) {
  const wet = new Map(state.beds.map(bed => [bed.id, 0]));
  if (!validStep(dt)) return wet;
  if (state.template !== 'morrow-v1') {
    for (const bed of state.beds) {
      const irrigated = state.sprinklers.some(s => within(s, bed));
      wet.set(bed.id, irrigated ? dt : Math.min(dt, bed.water));
      bed.water = irrigated ? IRRIGATION.moisture : Math.max(0, bed.water - dt);
    }
    return wet;
  }
  // Small deterministic steps keep a long test/update equivalent to ordinary
  // runtime ticks. A sprinkler may cover several beds, but each bed has only
  // one assigned sprinkler during a service burst.
  const steps = Math.ceil(dt / .1), interval = dt / steps;
  const ordered = [...state.sprinklers].sort((a, b) => a.id.localeCompare(b.id));
  for (let step = 0; step < steps; step++) {
    const assigned = new Set();
    for (const sprinkler of ordered) {
      const task = sprinkler.irrigation;
      if (!task || task.remaining <= 1e-8) continue;
      task.bedIds = task.bedIds.filter(id => {
        const bed = state.beds.find(value => value.id === id);
        if (!bed || !growing(bed) || !within(sprinkler, bed) || assigned.has(id)) return false;
        assigned.add(id); return true;
      });
      if (!task.bedIds.length) task.remaining = 0;
    }
    for (const sprinkler of ordered) {
      let task = sprinkler.irrigation;
      if (!task || task.remaining <= 1e-8) {
        const beds = state.beds.filter(bed => growing(bed) && bed.water <= IRRIGATION.threshold
          && within(sprinkler, bed) && !assigned.has(bed.id));
        if (!beds.length) continue;
        task = sprinkler.irrigation = { phase: task?.phase || 0,
          remaining: IRRIGATION.serviceSeconds, bedIds: beds.map(bed => bed.id) };
        for (const bed of beds) assigned.add(bed.id);
      }
      const worked = Math.min(interval, task.remaining);
      for (const id of task.bedIds) {
        const bed = state.beds.find(value => value.id === id);
        bed.water = Math.min(IRRIGATION.moisture, bed.water + worked * IRRIGATION.flowPerSecond);
      }
      task.phase = (task.phase + worked * IRRIGATION.turnRate) % TAU;
      task.remaining = Math.max(0, task.remaining - worked);
    }
    for (const bed of state.beds) {
      wet.set(bed.id, wet.get(bed.id) + Math.min(interval, bed.water));
      bed.water = Math.max(0, bed.water - interval);
    }
  }
  return wet;
}

/** Read-only visual state. The angle holds its last position whenever idle.
 * @param {any} state @param {any} sprinkler
 */
export function sprinklerMotion(state, sprinkler, time = state.time || 0, reduced = false) {
  if (state.template !== 'morrow-v1') return {
    active: true, phase: reduced ? .35 : time * IRRIGATION.turnRate, targetIds: [],
  };
  const task = sprinkler.irrigation;
  const targetIds = (task?.bedIds || []).filter(id => {
    const bed = state.beds.find(value => value.id === id);
    return bed && growing(bed) && within(sprinkler, bed);
  });
  const active = !!task && task.remaining > 1e-8 && targetIds.length > 0;
  const lead = active && !reduced ? Math.min(IRRIGATION.maxVisualLead,
    task.remaining, Math.max(0, time - (state.time || 0))) : 0;
  return { active, phase: reduced ? .35 : ((task?.phase || 0) + lead * IRRIGATION.turnRate) % TAU, targetIds };
}
