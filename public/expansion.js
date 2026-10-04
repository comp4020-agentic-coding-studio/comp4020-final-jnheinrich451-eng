// One-time deterministic extension. Every old terrain cell keeps its coordinate.
export function expandWorld(old) {
  if (old.version >= 2) return old;
  if (old.width !== 48 || old.height !== 36 || old.terrain.length !== 48 * 36) throw new Error('Unsupported world size for the Caldera expansion. Save left unchanged.');
  const width = 128, height = 96, terrain = Array(width * height).fill(0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x < old.width && y < old.height) { terrain[y * width + x] = old.terrain[y * old.width + x]; continue; }
    const dx = (x - 85) / 38, dy = (y - 43) / 39, angle = Math.atan2(dy, dx), edge = 1 + .06 * Math.sin(angle * 5);
    const distance = Math.hypot(dx, dy);
    if (distance < edge) terrain[y * width + x] = distance > edge - .1 ? 1 : 2;
    if (Math.hypot((x - 28) / 13, (y - 65) / 15) < 1) terrain[y * width + x] = 1;
    const clearPlain = x >= 57 && x <= 84 && y >= 12 && y <= 35;
    if (terrain[y * width + x] === 2 && !clearPlain && ((x * 73856093 ^ y * 19349663) >>> 0) % 103 === 0) terrain[y * width + x] = 3;
  }
  const bridges = [...(old.bridges || [])];
  // A three-wide deck crosses the existing water without rewriting those cells.
  let shore = old.width - 1;
  while (shore > 26 && !old.terrain[18 * old.width + shore]) shore--;
  for (let y = 17; y <= 19; y++) for (let x = shore; x <= 60; x++) {
    if (x < old.width && y < old.height) { if (terrain[y * width + x] === 0) bridges.push({ x, y }); }
    else terrain[y * width + x] = 4;
  }
  return { ...old, version: 2, width, height, terrain, bridges, fronts: [
    { id: 'landing', label: 'Caldera landing', ...old.spawn },
    { id: 'east', label: 'Eastern plain', x: 72.5, y: 24.5 },
    { id: 'south', label: 'Southern reach', x: 84.5, y: 66.5 },
  ] };
}
