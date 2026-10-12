import { expect, it } from 'vitest';
import { hudState, coreSiteAnalysis, orbitStep, landingLog } from '../public/hud.js';
import { sectorRadius } from '../public/sector-defense.js';

const flat = (fill = 2): any => ({ width: 40, height: 30, terrain: Array(40 * 30).fill(fill), sites: [], cores: [] });

it('names one operator state, most specific first', () => {
  expect(hudState({ me: { body: 'orbital' }, mode: 'build' }).key).toBe('orbit');
  expect(hudState({ me: { body: 'robot', deploying: true } }).key).toBe('descent');
  expect(hudState({ me: { body: 'robot', life: 'disabled' }, gun: 'RAIL CANNON' }).key).toBe('disabled');
  expect(hudState({ me: { body: 'robot', life: 'active' }, gun: 'RAIL CANNON', mode: 'build' })).toEqual({ key: 'facility', label: 'OPERATING · RAIL CANNON' });
  expect(hudState({ me: { body: 'rover', life: 'active' } }).key).toBe('vehicle');
  expect(hudState({ me: { body: 'robot', life: 'active' }, mode: 'build', placingLabel: 'Tank drop pod' }).label).toBe('PLACING · TANK DROP POD');
  expect(hudState({ me: { body: 'robot', life: 'active' }, mode: 'explore' }).key).toBe('ground');
  expect(hudState({ me: null }).key).toBe('connecting');
});

it('measures a core footprint, covered rocks and hostile territory', () => {
  const world = flat();
  world.terrain[14 * 40 + 11] = 3; // one rock under the north arm of a core at 10, 15
  const clear = coreSiteAnalysis(world, 10, 15);
  expect(clear).toMatchObject({ cells: 57, inside: true, grass: 56, rock: 1, water: 0, nearest: null, territory: null });
  const site = { kind: 'alert', state: 'hostile', x: 20, y: 15 };
  world.sites = [site];
  const near = coreSiteAnalysis(world, 10, 15);
  expect(near.nearest?.distance).toBeCloseTo(10);
  expect(10 <= sectorRadius(site)).toBe(true);
  expect(near.territory).not.toBeNull();
  site.state = 'conquered';
  expect(coreSiteAnalysis(world, 10, 15).nearest).toBeNull(); // conquered sites are not hostile
  expect(coreSiteAnalysis(world, 1, 1).inside).toBe(false); // arms leave the map
});

it('advances landing steps only for a valid site', () => {
  expect(orbitStep({ error: 'Water', pending: false })).toBe(2);
  expect(orbitStep({ error: '', pending: false })).toBe(3);
  expect(orbitStep({ error: 'Saving', pending: true })).toBe(3);
});

it('ticks the first-landing log from state, ignoring a core\'s built-in sentry', () => {
  const me = { id: 'p1' }, world = { cores: [{ owner: 'p1' }] };
  const log = landingLog({ world, buildings: [{ owner: 'p1', coreId: 'c1' }], me, located: false });
  expect(log.map(i => i.done)).toEqual([true, false, false]);
  const later = landingLog({ world, buildings: [{ owner: 'p1', coreId: 'c1' }, { owner: 'p1' }], me, located: true });
  expect(later.every(i => i.done)).toBe(true);
});
