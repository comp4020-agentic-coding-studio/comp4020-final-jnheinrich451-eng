import { expect, it } from 'vitest';
import { anchoredCamera, gunFrame, gunTargets } from '../public/gun-view.js';

const T = 48, gun = { x: 100, y: 100 }, reach = { min: 15, max: 180 };
const view = { width: 1920, height: 1080, top: 90, bottom: 180 };

it('lists only hostile targets the gun can reach, closest first', () => {
  const sites = [{ x: 150, y: 100, state: 'hostile', name: 'Far', kind: 'alert' }, { x: 120, y: 100, state: 'hostile', name: 'Near', kind: 'mortar' },
    { x: 110, y: 100, state: 'conquered', kind: 'alert' }, { x: 102, y: 100, state: 'hostile', kind: 'alert' }, { x: 400, y: 100, state: 'hostile', kind: 'alert' }];
  const enemies = [{ x: 130, y: 100, hp: 10 }, { x: 125, y: 100, hp: 0 }];
  expect(gunTargets(gun, reach, sites, enemies).map(t => t.label)).toEqual(['Near', 'Contact', 'Far']);
  expect(gunTargets(gun, reach, [], [])).toEqual([]);
});

it('opens near the gun instead of on the whole planet, framing its closest target', () => {
  const alone = gunFrame(gun, undefined, view, T);
  expect(alone.zoom).toBeCloseTo(.33); expect(alone.x).toBe(100 * T);
  const near = gunFrame(gun, { x: 130, y: 100 }, view, T), far = gunFrame(gun, { x: 280, y: 100 }, view, T);
  expect(near.zoom).toBeGreaterThan(far.zoom);
  expect(far.zoom).toBeGreaterThan(.04);
  for (const frame of [near, far]) {
    // The gun and its target both land inside the free part of the screen.
    for (const point of [gun, frame === near ? { x: 130, y: 100 } : { x: 280, y: 100 }]) {
      const sx = view.width / 2 + (point.x * T - frame.x) * frame.zoom, sy = view.height / 2 + (point.y * T - frame.y) * frame.zoom;
      expect(sx).toBeGreaterThan(0); expect(sx).toBeLessThan(view.width);
      expect(sy).toBeGreaterThan(view.top - 1); expect(sy).toBeLessThan(view.height - view.bottom + 1);
    }
  }
  expect(gunFrame(gun, undefined, { ...view, width: 390, height: 844 }, T).zoom).toBeCloseTo(.2);
});

it('zooms around the pointer, keeping the world point under it still', () => {
  const camera = { x: 1000, y: 2000, zoom: .2 }, offset = { x: 300, y: -120 }, next = anchoredCamera(camera, .5, offset);
  expect(next.zoom).toBe(.5);
  const under = (c: typeof camera) => ({ x: c.x + offset.x / c.zoom, y: c.y + offset.y / c.zoom });
  expect(under(next).x).toBeCloseTo(under(camera).x); expect(under(next).y).toBeCloseTo(under(camera).y);
});
