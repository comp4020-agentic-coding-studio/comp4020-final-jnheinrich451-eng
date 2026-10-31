// Cosmetic samples of an already-clipped authoritative flight segment. There
// are no particles, collision queries, or frame-dependent state to accumulate.
export const AA_TRACE = Object.freeze({ life: .14, maxDashes: 3, length: .22, playbackDelay: 100 });

export function aaEffectBorn(at, simulationTime, clock) {
  // One snapshot of buffering preserves staggered fire timestamps when two
  // alternating muzzle events reach the browser in the same 10 Hz update.
  return clock + AA_TRACE.playbackDelay - Math.max(0, simulationTime - at);
}

export function aaTracerDashes(shot, age, reduced = false) {
  if (![shot.x, shot.y, shot.endX, shot.endY, age].every(Number.isFinite) || age < 0 || age >= AA_TRACE.life) return [];
  const dx = shot.endX - shot.x, dy = shot.endY - shot.y, distance = Math.hypot(dx, dy);
  if (distance < .001) return [];
  const count = reduced ? 1 : Math.min(AA_TRACE.maxDashes, Math.max(1, Math.ceil(distance / .7)));
  const length = Math.min(AA_TRACE.length, distance / (count * 2));
  const seed = Math.abs(Math.sin((Number(shot.id) || 0) * 12.9898 + (shot.barrel || 0) * 3.7));
  const dashes = [];
  for (let i = 0; i < count; i++) {
    // Successive samples briefly light from the back of this fixed segment
    // toward its endpoint. A seeded offset prevents a rigid dashed-beam look.
    const delay = reduced ? 0 : i / count * .045, localAge = age - delay;
    if (localAge < 0 || localAge >= .11) continue;
    const center = distance * (i + .4 + seed * .2) / count;
    const start = Math.max(0, center - length / 2), end = Math.min(distance, center + length / 2);
    dashes.push({
      x: shot.x + dx * start / distance, y: shot.y + dy * start / distance,
      endX: shot.x + dx * end / distance, endY: shot.y + dy * end / distance,
      alpha: (reduced ? .45 : .9) * (1 - localAge / .11),
    });
  }
  return dashes;
}
