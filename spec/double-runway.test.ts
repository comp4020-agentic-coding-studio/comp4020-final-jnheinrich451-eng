import { it, expect } from 'vitest';
import { createWorld } from '../public/world.js';
import { freshLogistics, facilityTargets } from '../public/logistics.js';
import { airbaseError, airbaseGate, newAirbase, parkingPoint } from '../public/aircraft.js';
import { airfields, deliveryBaseAt, deliveryError, fleetCapacity, fleetCount, flightBase, freeAirbase, newAircraftError, operationalAirbase, parkedRecord, reserveLanding, runwayAvailable } from '../public/air-traffic.js';
import { airbaseAt, hangarBlocks } from '../public/footprints.js';
import { airSize } from '../public/helicopter.js';
import { hangarBox, runwayLayout } from '../public/runway.js';
import { cargoCells, cargoContains, cargoPanels, cargoSite } from '../public/cargo-pods.js';
import { constructionError } from '../public/construction.js';

const flat = (): any => ({ ...createWorld(), version: 2, width: 128, height: 96, terrain: Array(128 * 96).fill(2), cores: [], tanks: [], ships: [], artillery: [], airbases: [], rails: [], sites: [], logistics: freshLogistics() });
const vacant = (b: any) => { b.aircraft.state = 'vacant'; b.aircraft.health = 0; return b; };
const double = (id: string, x: number, y: number, turned = false): any => vacant(newAirbase(id, 'a', x, y, 'bomber', 'airbase', runwayLayout({ runways: 2, turned })));
const flying = (b: any, x: number, y: number) => { Object.assign(b.aircraft, { state: 'flying', health: 180, x, y, leftBase: true, speed: 6 }); return b.aircraft; };

it('leaves a base built before the second strip exactly as it was', () => {
  const w = flat(), old: any = newAirbase('old', 'a', 48, 48); w.airbases.push(old);
  expect(airSize(old)).toEqual({ width: 6, height: 10 });
  expect(airfields(w).map((b: any) => b.id)).toEqual(['old']);
  expect(parkingPoint(old)).toEqual({ x: 50, y: 55.5 }); expect(airbaseGate(old)).toEqual({ x: 53.5, y: 56.5 });
  expect(hangarBox(old)).toEqual({ x: 53, y: 50.5, w: 2, h: 3 });
  expect(hangarBlocks(w, 52, 49)).toBe(true); expect(hangarBlocks(w, 52, 59)).toBe(false);
  expect(airbaseAt(w, 53, 58)).toBe(false);
});

it('gives a new base a second strip but still only one aircraft', () => {
  const w = flat(), base = double('new', 48, 30); w.airbases.push(base);
  expect(airSize(base)).toEqual({ width: 6, height: 20 });
  const [first, second] = airfields(w);
  expect([first.id, second.id]).toEqual(['new', 'new:2']); expect(second).toMatchObject({ spare: true, parent: 'new', x: 48, y: 40 });
  expect(parkingPoint(second)).toEqual({ x: 50, y: 47.5 }); expect(airbaseGate(second)).toEqual({ x: 53.5, y: 48.5 });
  expect(fleetCapacity(w)).toBe(1);
  expect(deliveryError(w, second, 'bomber')).toContain('only takes visitors');
  expect(newAircraftError(w, second, 'a', 'bomber')).toContain('only takes visitors');
  // Clicking anywhere on the base orders onto the first strip.
  expect(deliveryBaseAt(w, { x: 50, y: 45 }, 'bomber').id).toBe('new');
  expect(newAircraftError(w, first, 'a', 'bomber')).toBeNull();
});

it('lets a visitor land beside the base\'s own aircraft, then fills up', () => {
  const w = flat(), base = double('front', 48, 30), home = double('rear', 80, 30), other = double('third', 20, 30);
  w.airbases.push(base, home, other);
  Object.assign(base.aircraft, { state: 'parked', health: 180 }, parkingPoint(base));
  const visitor = flying(home, 50, 46), second = flying(other, 50, 46);
  expect(runwayAvailable(w, airfields(w)[0], visitor)).toBe(false);
  const free = freeAirbase(w, visitor);
  expect(free.id).toBe('front:2');
  expect(reserveLanding(w, visitor, 'front:2')).toBeNull();
  Object.assign(visitor, { state: 'parked' }, parkingPoint(airfields(w)[1]));
  expect(parkedRecord(w, airfields(w)[1]).aircraft).toBe(visitor);
  expect(flightBase(w, home)).toMatchObject({ id: 'front:2', x: 48, y: 40 });
  // Two strips, two aircraft: the next one is refused, not stacked.
  expect(runwayAvailable(w, airfields(w)[1], second)).toBe(false);
  expect(reserveLanding(w, second, 'front:2')).toContain('free friendly runway');
  expect(fleetCount(w)).toBe(3); expect(fleetCapacity(w)).toBe(3);
});

it('turns the whole base a quarter turn, with both strips, hangars and parking', () => {
  const w = flat(), base = double('turned', 30, 40, true); w.airbases.push(base);
  expect(airSize(base)).toEqual({ width: 20, height: 6 });
  expect(base).toMatchObject({ runways: 2, turned: true, angle: -Math.PI / 2 });
  expect(base.aircraft.angle).toBeCloseTo(-Math.PI / 2);
  const [first, second] = airfields(w);
  expect(second).toMatchObject({ x: 40, y: 40, turned: true });
  expect(parkingPoint(first)).toEqual({ x: 37.5, y: 44 }); expect(parkingPoint(second)).toEqual({ x: 47.5, y: 44 });
  expect(airbaseGate(first)).toEqual({ x: 38.5, y: 40.5 });
  // Hangars sit on the north side now, one per strip.
  for (const x of [31, 33, 41, 43]) for (const y of [40, 41]) expect(hangarBlocks(w, x, y), `${x},${y}`).toBe(true);
  for (const [x, y] of [[30, 40], [34, 40], [31, 42], [38, 41], [44, 40]]) expect(hangarBlocks(w, x, y), `${x},${y}`).toBe(false);
  expect(airbaseAt(w, 49, 45)).toBe(true); expect(airbaseAt(w, 50, 45)).toBe(false); expect(airbaseAt(w, 49, 46)).toBe(false);
});

it('blocks both hangars of an upright base and hits the base once from either', () => {
  const w = flat(), base = double('new', 48, 30); w.airbases.push(base);
  for (const y of [31, 33, 41, 43]) expect(hangarBlocks(w, 52, y), String(y)).toBe(true);
  expect(hangarBlocks(w, 52, 34)).toBe(false); expect(hangarBlocks(w, 52, 44)).toBe(false);
  const targets = facilityTargets(w).filter((t: any) => t.kind === 'airbase');
  expect(targets).toHaveLength(1);
  expect(targets[0]).toMatchObject({ x: 53, y: 37.5, w: 2, h: 13, hp: { max: 500 } });
  w.airbases[0].turned = true; expect(hangarBox(w.airbases[0])).toMatchObject({ w: 13, h: 2 });
});

it('closes the second strip until the base is built, and with the base', () => {
  const w = flat(), base = double('new', 48, 30), other = double('other', 80, 30); w.airbases.push(base, other);
  const plane = flying(other, 50, 46), second = () => airfields(w)[1];
  w.logistics.jobs.new = { remaining: 10, duration: 10 };
  expect(operationalAirbase(w, second())).toBe(false); expect(fleetCapacity(w)).toBe(1);
  delete w.logistics.jobs.new;
  expect(runwayAvailable(w, second(), plane)).toBe(true);
  base.destroyed = true;
  expect(runwayAvailable(w, second(), plane)).toBe(false);
});

it('checks the whole double footprint, turned or not, before placing it', () => {
  const w = flat();
  expect(airbaseError(w, [], [], 40, 20, 'a')).toBeNull();
  // A rock in the second strip's far end, past the old 6 x 10 base.
  w.terrain[48 * 128 + 41] = 3;
  expect(airbaseError(w, [], [], 40, 30, 'a')).toBeTruthy();
  expect(airbaseError(w, [], [], 40, 30, 'a', 'airbase', true)).toBeNull();
  expect(airbaseError(w, [], [], 100, 30, 'a', 'airbase', true)).toContain('16 tiles');
  expect(airbaseError(w, [], [], 100, 30, 'a')).toBeNull();
  expect(airbaseError(w, [], [], 40, 70, 'a')).toContain('16 tiles');
});

it('opens a double crate along its long sides only', () => {
  const upright = cargoSite('airbase', 40, 30)!, turned = cargoSite('airbase', 40, 30, true)!;
  expect(upright).toMatchObject({ w: 6, h: 20, walls: 2 }); expect(turned).toMatchObject({ w: 20, h: 6, walls: 2 });
  expect(cargoPanels(upright).map((r: any) => r.side)).toEqual([1, 3]);
  expect(cargoPanels(turned).map((r: any) => r.side)).toEqual([0, 2]);
  for (const p of [upright, turned]) expect(cargoCells(p)).toHaveLength(360);
  expect(cargoContains(upright, 35, 35)).toBe(true); expect(cargoContains(upright, 42, 25)).toBe(false);
  expect(cargoContains(turned, 45, 25)).toBe(true); expect(cargoContains(turned, 35, 32)).toBe(false);
  // Four-wall crates are untouched.
  expect(cargoPanels(cargoSite('helipad', 30, 30)!)).toHaveLength(4);
});

it('needs the whole turned footprint inside support for a local build', () => {
  const w = flat(); w.cores = [{ id: 'c', owner: 'a', x: 45, y: 45, elapsed: 1e6, x0: 0 }];
  // 20 tiles running south leaves the 24-tile circle; lying east-west it stays inside.
  expect(constructionError(w, 'airbase', 37, 54)).toContain('24 tiles');
  expect(constructionError(w, 'airbase', 37, 54, { turned: true })).toBeNull();
  expect(constructionError(w, 'airbase', 44, 37)).toBeNull();
});
