// UI selection only. Distances use the growing bed's ground footprint, so a
// worker on a corner is just as near as one standing beside its centre.
export const BED_INSPECTION = Object.freeze({ enter: 1, leave: 1.5, switchGap: .35 });

export function bedEdgeDistance(bed, worker) {
  if (!worker) return Infinity;
  return Math.hypot(Math.max(0, Math.abs(worker.x - bed.x - .5) - 1.5),
    Math.max(0, Math.abs(worker.y - bed.y - .5) - 1.5));
}

/**
 * @param {Array<{id:string,x:number,y:number}>} beds
 * @param {{x:number,y:number}|null|undefined} worker
 * @param {string|null} currentId
 * @param {Set<string>} dismissed
 */
export function nearbyColonyBed(beds, worker, currentId = null, dismissed = new Set()) {
  if (!worker) return null;
  let closest = null, distance = Infinity;
  for (const bed of beds) {
    if (dismissed.has(bed.id)) continue;
    const next = bedEdgeDistance(bed, worker);
    if (next <= BED_INSPECTION.enter && next < distance) { closest = bed; distance = next; }
  }
  const current = beds.find(bed => bed.id === currentId && !dismissed.has(bed.id));
  const currentDistance = current ? bedEdgeDistance(current, worker) : Infinity;
  if (currentDistance <= BED_INSPECTION.leave &&
      (!closest || distance + BED_INSPECTION.switchGap >= currentDistance)) return current;
  return closest;
}
