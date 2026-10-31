import { expect, it } from 'vitest';
import { createSirocco } from '../public/sirocco-world.js';
import { createPlanet } from '../public/planet-templates.js';
import { expandWorld } from '../public/expansion.js';
import { expandPlanet } from '../public/planet-world.js';
import { prepareLandingZones, seedFrontierCities } from '../public/frontier-layout.js';
import { corePlacementError } from '../public/core.js';
import { airbaseError } from '../public/aircraft.js';
import { canStand, tileAt } from '../public/world.js';
import { flightLineClear, inlandWaterAt } from '../public/terrain-rules.js';
import { freshLogistics } from '../public/logistics.js';
import { shipyardSite, yardFromShip } from '../public/shipyard.js';
import { canSail } from '../public/ship.js';
import { shipRoute } from '../public/naval-orders.js';
import { seedConquest } from '../public/conquest.js';
import { seedSettlement } from '../public/settlement.js';
import { islandAt } from '../public/island-pressure.js';
import { createDirector } from '../public/encounter-director.js';
import { updatePressure, pressureAllowance } from '../public/pressure-budget.js';
import { centipedeReservations, tickCentipedeSpawns } from '../public/centipede-spawn.js';
import { bridgeError } from '../public/bridge.js';
import { bridgeDuration } from '../public/bridge-geometry.js';

const ports = [[112, 172], [400, 172], [112, 212], [400, 212]];
const oases = [[112, 65], [400, 65], [112, 319], [400, 319]];
const hullKinds = ['gunship', 'carrier', 'transport', 'submarine'];
function world(): any {
  return { ...prepareLandingZones(createPlanet('sirocco-v1')), cores: [], tanks: [], ships: [], airbases: [],
    artillery: [], rails: [], sites: [], logistics: { ...freshLogistics(), shipyards: [] } };
}
function campaign(seed: string): any {
  const w = world();
  for (const kind of ['alert', 'mortar', 'modifier']) w.sites.push(...seedConquest(w, [], [], kind));
  w.sites.push(...seedSettlement(w, [], []));
  for (const kind of ['contaminator', 'laser', 'anti-air']) w.sites.push(...seedConquest(w, [], [], kind));
  const skeleton = structuredClone(w.sites), cities = seedFrontierCities(w, [], [], seed);
  w.sites.push(...cities.sites);
  return { w, skeleton, cities };
}

it('generates deterministic independent Sirocco saves without changing either previous planet', () => {
  const caldera = createPlanet(), vesper = createPlanet('vesper-v1'), originals = JSON.stringify([caldera, vesper]);
  const w = createSirocco();
  expect(w).toEqual(createPlanet('sirocco-v1')); expect(w).toEqual(createSirocco());
  expect(w.width).toBe(512); expect(w.height).toBe(384);
  for (const field of [w.terrain, w.waterKinds, w.mountains]) expect(field).toHaveLength(512 * 384);
  expect(new Set(w.waterKinds)).toEqual(new Set([0, 1, 3]));
  expect(w.terrain).not.toEqual(caldera.terrain); expect(w.terrain).not.toEqual(vesper.terrain);
  expect(JSON.stringify([caldera, vesper])).toBe(originals);
  const restored = JSON.parse(JSON.stringify(w));
  expect(restored).toEqual(w); expect(expandPlanet(expandWorld(restored))).toBe(restored);
  restored.terrain[0] = 2; expect(createSirocco().terrain[0]).toBe(0);
});

it('offers four legal core/runway reserves on separate geographic plateaus, preserving lakes and mesas', () => {
  const original = createSirocco(), w = world();
  expect(w.landingZones).toHaveLength(4); expect(w.waterKinds).toEqual(original.waterKinds); expect(w.mountains).toEqual(original.mountains);
  const islands = new Set();
  for (const z of w.landingZones) {
    expect(corePlacementError(w, [], [], z.x, z.y, 'pilot')).toBeNull();
    const island = islandAt(w, z.x, z.y); expect(island).not.toBeNull(); islands.add(island);
  }
  expect(islands.size).toBe(4);
  for (const [x, y] of [[100, 118], [388, 118], [100, 246], [388, 246]]) expect(airbaseError(w, [], [], x, y, 'pilot')).toBeNull();
  for (const [x, y] of oases) {
    expect(inlandWaterAt(w, x, y)).toBe(true);
    expect(islandAt(w, x, y)).toBe(islandAt(w, x + 19, y));
  }
  const index = w.mountains.findIndex(Boolean), x = index % w.width, y = Math.floor(index / w.width);
  w.logistics.floors = [index];
  expect(tileAt(w, x, y)).toBe(3); expect(canStand(w, [], x + .5, y + .5)).toBe(false);
  expect(flightLineClear(w, { x: x - 2, y: y + .5 }, { x: x + 2, y: y + .5 })).toBe(false);
  expect(corePlacementError(w, [], [], x, y, 'pilot')).toContain('mountains');
});

it('keeps loose sand naval-only and firm plateaus ground-only, with one connected sand sea', () => {
  const w = world(), labels = new Uint8Array(w.terrain.length), queue = new Uint32Array(w.terrain.length);
  let head = 0, tail = 1; queue[0] = 0; labels[0] = 1;
  const visit = (i: number) => { if (!labels[i] && w.waterKinds[i] === 1) { labels[i] = 1; queue[tail++] = i; } };
  while (head < tail) {
    const i = queue[head++], x = i % w.width;
    if (x) visit(i - 1); if (x + 1 < w.width) visit(i + 1);
    if (i >= w.width) visit(i - w.width); if (i + w.width < labels.length) visit(i + w.width);
  }
  expect(tail).toBe(w.waterKinds.filter((kind: number) => kind === 1).length);
  expect(canStand(w, [], 256.5, 192.5)).toBe(false); expect(islandAt(w, 256, 192)).toBeNull();
  expect(canStand(w, [], 112.5, 128.5)).toBe(true);
  for (const kind of hullKinds) {
    const s = { id: 'probe', kind, navalScale: 2, x: 256.5, y: 192.5, angle: 0 };
    expect(canSail(w, s)).toBe(true); expect(canSail(w, s, 112.5, 128.5)).toBe(false);
    for (const [x, y] of oases) expect(canSail(w, s, x, y)).toBe(false);
  }
});

it('fits four completed large docks and routes full-size carriers into the connected central sea', () => {
  const w = world();
  const hulls = ports.map(([x, y], i) => {
    const site = shipyardSite(w, [], [], x, y, 'pilot', 2);
    expect(site.error).toBeNull();
    const s = { ...site.ship!, id: 'dock-' + i, elapsed: 100, dockReady: true, kind: 'carrier' };
    w.logistics.shipyards.push(yardFromShip(s));
    return s;
  });
  for (const s of hulls) {
    for (const kind of hullKinds) expect(canSail(w, { ...s, kind })).toBe(true);
    expect(shipRoute(w, s, { x: s.x, y: 192.5 })).not.toBeNull();
  }
  const s = { ...hulls[0], x: 256.5, y: 192.5, angle: Math.PI / 2 };
  for (const p of [{ x: 48.5, y: 192.5 }, { x: 464.5, y: 192.5 }, { x: 256.5, y: 24.5 }, { x: 256.5, y: 360.5 }])
    expect(shipRoute(w, s, p)).not.toBeNull();
  for (let i = 0; i < 16; i++) expect(canSail(w, s, s.x, s.y, i * Math.PI / 8)).toBe(true);
}, 15000);

it('supports a heavy bridge between plateaus while retaining a full carrier underpass and separate pressure budgets', () => {
  const w = world(), from = { x: 200, y: 180 }, to = { x: 200, y: 221 }, builder = { x: 203.5, y: 179.5 };
  expect(bridgeError(w, [], [], builder, from, to, 'heavy')).toBeNull();
  expect(bridgeError(w, [], [], builder, from, to)).toContain('24');
  const carrier = { id: 'carrier', kind: 'carrier', navalScale: 2, berthX: 0, berthY: 0,
    x: 170.5, y: 200.5, angle: Math.PI / 2 }, goal = { x: 230.5, y: 200.5 };
  expect(shipRoute(w, carrier, goal)).not.toBeNull();
  const bridge = { id: 'bridge', from, to, profile: 'heavy', elapsed: 0 };
  w.logistics.bridges = [bridge];
  expect(canSail(w, carrier, 200.5, 200.5)).toBe(false);
  bridge.elapsed = bridgeDuration(bridge);
  expect(canStand(w, [], 200.5, 200.5)).toBe(true);
  expect(canSail(w, carrier, 200.5, 200.5)).toBe(true);
  expect(shipRoute(w, carrier, goal)).not.toBeNull();
  expect(islandAt(w, from.x, from.y)).not.toBe(islandAt(w, to.x, to.y));
  expect(islandAt(w, 200.5, 200.5)).toBeNull();
});

it.each(['0', '1', '2', '3'])('fits normal campaign fixtures and dense protected city layouts for seed %s', seed => {
  const { w, skeleton, cities } = campaign(seed);
  expect(skeleton).toHaveLength(9);
  expect(new Set(skeleton.map((s: any) => s.kind))).toEqual(new Set(['alert', 'mortar', 'modifier', 'contaminator', 'laser', 'anti-air']));
  expect(cities.manifest.groups.length).toBeGreaterThanOrEqual(40); expect(cities.sites.length).toBeGreaterThanOrEqual(150);
  expect(new Set(cities.manifest.groups.map((g: any) => g.region))).toEqual(new Set(['landing', 'aurora', 'haven', 'meridian']));
  expect(new Set(w.sites.map((s: any) => s.id)).size).toBe(w.sites.length);
  for (const site of w.sites) {
    expect(islandAt(w, site.x + 1.5, site.y + 1.5)).not.toBeNull();
    for (const z of w.landingZones) expect(Math.hypot(site.x - z.x, site.y - z.y)).toBeGreaterThanOrEqual(z.radius + 30);
    for (let y = site.y; y < site.y + 3; y++) for (let x = site.x; x < site.x + 3; x++) {
      expect([1, 2]).toContain(w.terrain[y * w.width + x]); expect(w.mountains[y * w.width + x]).toBe(0);
    }
  }
  // Geography alone is not enough: the actual bounded giant producer must find
  // an unobstructed emergence corridor beside a living Root on every plateau.
  const corridors = new Set();
  for (const root of w.sites.filter((s: any) => s.kind === 'modifier')) {
    const island = islandAt(w, root.x + 1.5, root.y + 1.5);
    if (corridors.has(island)) continue;
    let contact: any;
    for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16, p = { id: 'probe', medium: 'ground',
        x: Math.floor(root.x + 1.5 + Math.cos(angle) * 16) + .5, y: Math.floor(root.y + 1.5 + Math.sin(angle) * 16) + .5 };
      if (islandAt(w, p.x, p.y) === island && canStand(w, [], p.x, p.y)) { contact = p; break; }
    }
    if (!contact) continue;
    const director: any = createDirector(seed); updatePressure(director, w, [contact], [], 0, 0);
    director.centipedes = { version: 1, roots: { [root.id]: { activeMs: 60000, cooldown: 0, giantId: null, retryAt: 0, island } },
      cooldowns: {}, pending: [], serial: 0, cursor: 0, nextPulse: 0 };
    const reserved = () => centipedeReservations(director), capacity = () => 24 - reserved().length;
    tickCentipedeSpawns({ world: w, buildings: [], contacts: [contact], enemies: [], sleeping: [], director, now: 0, dt: 0, capacity,
      admit: (point: any, producer: any) => pressureAllowance(director, w, [contact], [], reserved(), point, producer, capacity()), nextId: () => 1 });
    const warning = director.centipedes.pending.find((p: any) => p.rootId === root.id);
    if (warning) {
      expect(warning.trail.every((p: any) => canStand(w, [], p.x, p.y))).toBe(true);
      corridors.add(island);
    }
  }
  expect(corridors.size).toBe(4);
});
