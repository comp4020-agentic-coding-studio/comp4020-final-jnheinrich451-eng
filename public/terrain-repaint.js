import { tileAt } from './world.js';

export const CHUNK_TILES = 16;
// Tile art reads its neighbours and tree canopies cross one tile.
const ART_REACH = 2;

// Compares what is painted with the live tiles and records the difference in `painted`.
export function terrainChanges(world, painted) {
  const changed = [];
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) {
    const index = y * world.width + x, kind = tileAt(world, x, y);
    if (painted[index] !== kind) { painted[index] = kind; changed.push(index); }
  }
  return changed;
}

// Detailed chunks that show a changed tile, including those just off the map.
export function chunksAround(world, changed) {
  const chunks = new Set();
  for (const index of changed) {
    const x = index % world.width, y = Math.floor(index / world.width);
    for (const tx of [x - ART_REACH, x + ART_REACH]) for (const ty of [y - ART_REACH, y + ART_REACH]) {
      chunks.add(Math.floor(tx / CHUNK_TILES) + ',' + Math.floor(ty / CHUNK_TILES));
    }
  }
  return chunks;
}

// Overview cells to redraw, in the map's own painting order so dabs overlap as before.
export function cellsAround(world, changed) {
  const cells = new Set();
  for (const index of changed) {
    const x = index % world.width, y = Math.floor(index / world.width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < world.width && ny < world.height) cells.add(ny * world.width + nx);
    }
  }
  return [...cells].sort((a, b) => a - b);
}
