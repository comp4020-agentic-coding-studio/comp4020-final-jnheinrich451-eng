import { expect, it } from 'vitest';
import { createPlanet } from '../public/planet-templates.js';
import { islandAt, islandContacts, islandMultiplier } from '../public/island-pressure.js';

const worldOf = (rows: number[][], waterKinds?: number[]) => ({ width: rows[0].length, height: rows.length, terrain: rows.flat(), waterKinds });
const contact = (id: string, x: number, y: number, medium = 'ground') => ({ id, x, y, medium });

it('keeps inland rivers, lakes and mountains in one continent while ocean separates islands', () => {
  const world = worldOf([[2, 0, 2, 0, 2, 3, 0, 2]], [0, 2, 0, 3, 0, 0, 1, 0]);
  const before = structuredClone(world);
  for (let x = 0; x < 6; x++) expect(islandAt(world, x + .5, .5)).toBe('island:0');
  expect(islandAt(world, 6.5, .5)).toBeNull();
  expect(islandAt(world, 7.5, .5)).toBe('island:7');
  expect(world).toEqual(before);
  // An ocean mask is authoritative even if the terrain tile looks solid.
  expect(islandAt({ ...world, waterKinds: [0, 2, 0, 3, 0, 0, 1, 1] }, 7.5, .5)).toBeNull();
});

it('does not connect ocean bridges, floors or rail tracks, or diagonally touching islands', () => {
  const world: any = worldOf([[2, 0, 2], [0, 2, 0]]);
  const left = islandAt(world, .5, .5), right = islandAt(world, 2.5, .5);
  world.bridges = [{ x: 1, y: 0 }];
  world.logistics = { floors: [1], bridges: [{ x: 1, y: 0 }] };
  world.rails = [{ x: 1, y: 0 }];
  expect(islandAt(world, 1.5, .5)).toBeNull();
  expect(islandAt(world, .5, .5)).toBe(left);
  expect(islandAt(world, 2.5, .5)).toBe(right);
  expect(new Set([left, right, islandAt(world, 1.5, 1.5)]).size).toBe(3);
  for (const [x, y] of [[-1, 0], [3, 0], [0, 2], [NaN, 0], [0, Infinity]]) expect(islandAt(world, x, y)).toBeNull();
});

it('shares a cached index across shallow world views and rebuilds for changed base geometry', () => {
  let reads = 0;
  const terrain = new Proxy([2, 0, 2], { get: (target, prop, receiver) => { if (/^\d+$/.test(String(prop))) reads++; return Reflect.get(target, prop, receiver); } });
  const world = { width: 3, height: 1, terrain };
  expect(islandAt(world, 2, 0)).toBe('island:2');
  const indexedReads = reads;
  for (let n = 0; n < 20; n++) expect(islandAt({ ...world, sites: [], bridges: [{ x: 1, y: 0 }] }, 0, 0)).toBe('island:0');
  expect(reads).toBe(indexedReads);
  expect(islandAt({ ...world, waterKinds: [0, 2, 0] }, 2, 0)).toBe('island:0');
  expect(islandAt({ ...world, terrain: [2, 2, 2] }, 2, 0)).toBe('island:0');
  expect(islandAt(world, 2, 0)).toBe('island:2');
});

it('counts distinct occupied-player contacts on each island, excluding sea and ocean contacts', () => {
  const world = worldOf([[2, 2, 2, 0, 2, 2]]);
  const a = contact('a', .5, .5), b = contact('b', 2.5, .5, 'air'), c = contact('c', 4.5, .5);
  const contacts = [b, c, a, { ...a }, contact('sea', .5, .5, 'sea'), contact('bridge', 3.5, .5), contact('over-ocean', 3.5, .5, 'air')];
  const before = structuredClone(contacts);
  expect(islandContacts(world, contacts)).toEqual([
    { id: 'island:0', contacts: [a, b], multiplier: 1.7 },
    { id: 'island:4', contacts: [c], multiplier: 1 },
  ]);
  // Two compounds on the same island read one shared player budget.
  expect(islandAt(world, .5, .5)).toBe(islandAt(world, 2.5, .5));
  expect(islandContacts(world, [])).toEqual([]);
  expect(contacts).toEqual(before);
  expect([0, 1, 2, 3, 4, 5].map(islandMultiplier)).toEqual([0, 1, 1.7, 2.4, 3.1, 3.1]);
  expect(islandContacts(world, Array.from({ length: 6 }, (_, i) => contact('pilot-' + i, .5, .5)))[0].multiplier).toBe(3.1);
});

it.each(['caldera-v1', 'vesper-v1'])('indexes the real %s terrain without changing or persisting world geometry', template => {
  const world: any = createPlanet(template), before = JSON.stringify(world);
  const anchors = template === 'caldera-v1' ? [[24, 18], [225, 94], [91, 264], [370, 250]] : [[72, 80], [270, 100], [172, 278], [414, 270]];
  const ids = anchors.map(([x, y]) => islandAt(world, x, y));
  expect(ids.every(Boolean)).toBe(true); expect(new Set(ids).size).toBe(4);
  expect(islandAt(world, template === 'caldera-v1' ? 240 : 256, template === 'caldera-v1' ? 200 : 192)).toBeNull();
  if (template === 'vesper-v1') {
    for (const [x, y, anchor] of [[105, 108, 0], [316, 110, 1], [159, 292, 2], [393, 257, 3]]) {
      expect(world.waterKinds[y * world.width + x]).toBe(3);
      expect(islandAt(world, x, y)).toBe(ids[anchor]);
    }
  }
  expect(JSON.stringify(world)).toBe(before);
  expect(islandContacts(world, anchors.map(([x, y], i) => contact('pilot-' + i, x, y)))).toHaveLength(4);
});
