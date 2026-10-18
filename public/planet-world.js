// Additive saved terrain: the old rectangle remains byte-for-byte at its coordinates.
export function expandPlanet(old) {
  // Also complete metadata for local v3 previews saved before the strike reference
  // was added. This is additive and goes through the same backed-up transaction.
  if (old.version === 3 && !old.orbitalOrigin) return { ...old, orbitalOrigin: { x: 64, y: 48 } };
  if (old.version >= 3) return old;
  if (old.version !== 2 || old.width !== 128 || old.height !== 96 || old.terrain.length !== 128 * 96)
    throw new Error('Unsupported world size for planet expansion. Save left unchanged.');
  const width = 512, height = 384, terrain = Array(width * height).fill(0);
  const continents = [[225, 94, 83, 67], [370, 250, 102, 100], [91, 264, 72, 77], [410, 65, 45, 32], [233, 286, 27, 43]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x < old.width && y < old.height) { terrain[y * width + x] = old.terrain[y * old.width + x]; continue; }
    let coast = Infinity;
    for (const [cx, cy, rx, ry] of continents) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, a = Math.atan2(dy, dx);
      coast = Math.min(coast, Math.hypot(dx, dy) - 1 - .045 * Math.sin(a * 5) - .025 * Math.cos(a * 9));
    }
    let tile = coast < -.075 ? 2 : coast < 0 ? 1 : 0;
    // Sparse rock belts leave the broad interiors clear for airfields and bases.
    if (tile === 2 && coast > -.3 && ((x * 73856093 ^ y * 19349663) >>> 0) % 137 === 0) tile = 3;
    terrain[y * width + x] = tile;
  }
  return { ...old, version: 3, width, height, terrain, orbitalOrigin: old.orbitalOrigin || { x: old.width / 2, y: old.height / 2 }, regions: [
    { id: 'landing', label: 'Caldera / original foothold', ...old.spawn },
    { id: 'east', label: 'Eastern plain / existing front', x: 72.5, y: 24.5 },
    { id: 'aurora', label: 'Aurora / northern continent', x: 225.5, y: 94.5 },
    { id: 'haven', label: 'Haven / western continent', x: 91.5, y: 264.5 },
    { id: 'meridian', label: 'Meridian / southern continent', x: 370.5, y: 250.5 },
    { id: 'isles', label: 'Cinder / eastern islands', x: 410.5, y: 65.5 },
    { id: 'ocean', label: 'Pelagic passage / open ocean', x: 240.5, y: 200.5 },
  ] };
}

export function remapFloors(floors, oldWidth, newWidth) {
  return floors.map(index => Math.floor(index / oldWidth) * newWidth + index % oldWidth);
}
