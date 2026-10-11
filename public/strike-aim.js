// Pull a rectangular strike inward on the cursor bearing. Every corner must fit
// inside both the range circle and map; minimum range is validated by the caller.
export function clampStrike(origin, world, target, width, height, range) {
  if (!target || ![target.x, target.y].every(Number.isFinite)) return target;
  const dx = target.x - origin.x, dy = target.y - origin.y, length = Math.hypot(dx, dy);
  if (!length || !Number.isFinite(length)) return target;
  const ux = dx / length, uy = dy / length, hx = width / 2, hy = height / 2;
  let limit = length;
  for (const x of [-hx, hx]) for (const y of [-hy, hy]) {
    const dot = ux * x + uy * y;
    limit = Math.min(limit, -dot + Math.sqrt(Math.max(0, dot * dot + range * range - x * x - y * y)));
  }
  for (const [o, u, half, extent] of [[origin.x, ux, hx, world.width], [origin.y, uy, hy, world.height]]) {
    if (u > 1e-12) limit = Math.min(limit, (extent - half - o) / u);
    else if (u < -1e-12) limit = Math.min(limit, (half - o) / u);
  }
  if (limit < 0) return target; // No feasible rectangle on this bearing.
  if (length <= limit + 1e-8) return target;
  return { x: origin.x + ux * limit, y: origin.y + uy * limit };
}
