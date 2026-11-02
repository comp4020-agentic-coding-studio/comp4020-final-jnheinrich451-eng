import { expect, it } from 'vitest';
import { compassBearing, missionGuide, nearestHostile, planetFronts } from '../public/mission-guide.js';

const site = (id: string, x: number, y: number, state = 'hostile', group?: any) => ({ id, name: id, kind: 'alert', x, y, state, settlement: group });
const compound = { id: 'c1', requiredIds: ['a', 'b'] };
const me = { id: 'p', x: 10, y: 10 };

it('counts a compound or a lone site as one front, and only a whole compound as cleared', () => {
  const sites = [site('a', 0, 0, 'conquered', compound), site('b', 5, 0, 'hostile', compound), site('c', 9, 9, 'conquered')];
  expect(planetFronts(sites)).toEqual({ total: 2, cleared: 1 });
  sites[1].state = 'conquered';
  expect(planetFronts(sites)).toEqual({ total: 2, cleared: 2 });
  expect(planetFronts([])).toEqual({ total: 0, cleared: 0 });
});

it('names the nearest hostile site with a distance and compass bearing, skipping conquered ones', () => {
  expect(compassBearing({ x: 0, y: 0 }, { x: 0, y: -5 })).toBe('N');
  expect(compassBearing({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe('SE');
  const found = nearestHostile([site('near', 18.5, 8.5, 'conquered'), site('far', 38.5, 8.5)], me);
  expect(found?.site.id).toBe('far'); expect(found?.distance).toBeCloseTo(30); expect(found?.bearing).toBe('E');
  expect(nearestHostile([site('x', 0, 0, 'conquered')], me)).toBeNull();
  expect(nearestHostile([site('x', 0, 0)], undefined)).toBeNull();
});

it('walks the player through optional guidance from landing to conquest', () => {
  const world: any = { cores: [], sites: [site('near', 18.5, 8.5)] };
  let guide = missionGuide({ world, buildings: [], me, located: false, conquest: undefined });
  expect(guide.current?.id).toBe('core'); expect(guide.text).toBe('Land your core');
  world.cores = [{ owner: 'p' }];
  guide = missionGuide({ world, buildings: [{ owner: 'p' }], me, located: true, conquest: undefined });
  expect(guide.current?.id).toBe('site'); expect(guide.text).toBe('Destroy near · 10 t E');
});

it('never leaves a skipped step behind, so guidance stays optional', () => {
  const world: any = { cores: [], sites: [site('done', 0, 0, 'conquered'), site('left', 30, 10)] };
  const guide = missionGuide({ world, buildings: [], me, located: false, conquest: undefined });
  expect(guide.steps.slice(0, 4).every(step => step.done)).toBe(true);
  expect(guide.current?.id).toBe('compound');
});

it('only finishes on the server conquest result, then reports survivors', () => {
  const world: any = { cores: [{ owner: 'p' }], sites: [site('a', 0, 0, 'conquered', compound), site('b', 5, 0, 'conquered', compound)] };
  // Every visible site being conquered is not victory until the server says so.
  expect(missionGuide({ world, buildings: [], me, located: true, conquest: { state: 'contested' } }).current?.id).toBe('planet');
  const left = missionGuide({ world, buildings: [], me, located: true, conquest: { state: 'conquered', survivors: 3 } });
  expect(left.current).toBeNull(); expect(left.text).toBe('Clear the last 3');
  expect(missionGuide({ world, buildings: [], me, located: true, conquest: { state: 'conquered', survivors: 0 } }).text).toBe('All threats cleared');
});
