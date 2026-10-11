// Fixed, cosmetic conversion. Original terrain remains the collision authority.
export const MODIFIER = Object.freeze({ hp: 480, guards: 3, region: 12, radius: 9, recovery: 6000 });
export const isAlertSite = site => !site.kind || site.kind === 'alert';
export const conversionStrength = (site, time, reduced = false) => site.state === 'hostile' ? 1
  : reduced ? 0 : Math.max(0, 1 - Math.max(0, time - (site.conqueredAt || 0)) / MODIFIER.recovery);
export function convertedCells(world, site) {
  const cells = [], cx = site.x + 1.5, cy = site.y + 1.5, r = MODIFIER.radius;
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(world.height, cy + r); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(world.width, cx + r); x++) {
      const terrain = world.terrain[y * world.width + x];
      if (terrain !== 1 && terrain !== 2) continue;
      const angle = Math.atan2(y + .5 - cy, x + .5 - cx), distance = Math.hypot(x + .5 - cx, y + .5 - cy);
      const edge = r * (.88 + .07 * Math.sin(angle * 5 + site.x) + .05 * Math.cos(angle * 9 + site.y));
      if (distance < edge) cells.push({ x, y, strength: Math.min(1, (edge - distance) / 1.6) });
    }
  }
  return cells;
}
