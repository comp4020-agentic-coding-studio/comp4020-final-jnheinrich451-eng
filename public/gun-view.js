// Presentation only: what a cannon's operator is shown first. Firing, range and aim
// are still decided by the server from the actual weapon solution.
const MARGIN = 24, NEAR_ZOOM = .33, PHONE_ZOOM = .2, MAX_ZOOM = .7;

// Hostile sites and enemies a gun can reach, closest first. Sites come before moving
// enemies at equal distance because they are what a campaign is won by.
export function gunTargets(origin, { min, max }, sites = [], enemies = []) {
  const found = [];
  for (const site of sites) if (site.state === 'hostile') found.push({ x: site.x + 1.5, y: site.y + 1.5, label: site.name || site.kind, site: true });
  for (const enemy of enemies) if (enemy.hp > 0) found.push({ x: enemy.x, y: enemy.y, label: 'Contact', site: false });
  return found.map(target => ({ ...target, distance: Math.hypot(target.x - origin.x, target.y - origin.y) }))
    .filter(target => target.distance >= min && target.distance <= max)
    .sort((a, b) => a.distance - b.distance || Number(b.site) - Number(a.site));
}
// Frames the gun together with its closest target, leaving room for the bottom panel.
export function gunFrame(origin, target, { width, height, top = 90, bottom = 180 }, tile) {
  const free = { width: Math.max(120, width - 40), height: Math.max(120, height - top - bottom) };
  const lift = zoom => (bottom - top) / 2 / zoom;
  if (!target) { const zoom = width > 760 ? NEAR_ZOOM : PHONE_ZOOM; return { x: origin.x * tile, y: origin.y * tile + lift(zoom), zoom }; }
  const zoom = Math.min(MAX_ZOOM, free.width / ((Math.abs(target.x - origin.x) + MARGIN) * tile), free.height / ((Math.abs(target.y - origin.y) + MARGIN) * tile));
  return { x: (origin.x + target.x) / 2 * tile, y: (origin.y + target.y) / 2 * tile + lift(zoom), zoom };
}
// Pinch and wheel keep the world point under the pointer in place.
export function anchoredCamera(camera, nextZoom, offset) {
  return { ...camera, zoom: nextZoom, x: camera.x + offset.x / camera.zoom - offset.x / nextZoom, y: camera.y + offset.y / camera.zoom - offset.y / nextZoom };
}
