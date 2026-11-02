import { describe, expect, it } from 'vitest';
import { createWorld, tileAt } from '../public/world.js';
import { freshLogistics } from '../public/logistics.js';
import { cellsAround, chunksAround, terrainChanges } from '../public/terrain-repaint.js';

function field() {
  const world: any = { ...createWorld(), width: 64, height: 48, terrain: Array(64 * 48).fill(2), bridges: [], cores: [], tanks: [], ships: [], sites: [] };
  for (let y = 0; y < 48; y++) for (let x = 20; x <= 25; x++) world.terrain[y * 64 + x] = 0;
  world.logistics = { ...freshLogistics(), bridges: [] };
  return world;
}
const painted = (world: any) => { const tiles = new Uint8Array(world.width * world.height).fill(255); terrainChanges(world, tiles); return tiles; };
const bridge = { id: 'b', from: { x: 19, y: 15 }, to: { x: 26, y: 15 }, profile: 'standard', width: 3, cableTime: 2, rowTime: .65, elapsed: 99 };

describe('terrain repaint', () => {
  it('the first comparison covers every tile', () => {
    const world = field(), tiles = new Uint8Array(world.width * world.height).fill(255);
    expect(terrainChanges(world, tiles)).toHaveLength(64 * 48);
  });

  it('nothing changes while the map stays the same', () => {
    const world = field();
    expect(terrainChanges(world, painted(world))).toEqual([]);
  });

  it('a finished bridge reports only its own deck', () => {
    const world = field(), tiles = painted(world);
    world.logistics.bridges = [bridge];
    const changed = terrainChanges(world, tiles);
    // Three rows wide across the eight tiles from 19 to 26.
    expect(changed).toHaveLength(24);
    for (const index of changed) expect(tiles[index]).toBe(tileAt(world, index % 64, Math.floor(index / 64)));
    expect(terrainChanges(world, tiles)).toEqual([]);
  });

  it('a change reaches the next chunk when its art crosses the border', () => {
    const world = field();
    expect(chunksAround(world, [10 * 64 + 8])).toEqual(new Set(['0,0']));
    expect(chunksAround(world, [10 * 64 + 15])).toEqual(new Set(['0,0', '1,0']));
    expect(chunksAround(world, [16 * 64 + 16])).toEqual(new Set(['0,0', '0,1', '1,0', '1,1']));
  });

  it('a change at the map edge reaches the chunks past it', () => {
    expect(chunksAround(field(), [0])).toEqual(new Set(['-1,-1', '-1,0', '0,-1', '0,0']));
  });

  it('overview cells stay on the map, in painting order', () => {
    const world = field(), cells = cellsAround(world, [0, 64 * 48 - 1]);
    expect(cells).toEqual([0, 1, 64, 65, 64 * 47 - 2, 64 * 47 - 1, 64 * 48 - 2, 64 * 48 - 1]);
    expect(cellsAround(world, [5 * 64 + 5])).toHaveLength(9);
  });
});
