// Local, disposable combat timing probe. No server, database or saved campaign
// is opened. Run: node --expose-gc scripts/pressure-benchmark.mjs
import { cpus } from 'node:os';
import { createPlanet } from '../public/planet-templates.js';
import { prepareLandingZones, seedFrontierCities } from '../public/frontier-layout.js';
import { seedConquest } from '../public/conquest.js';
import { seedSettlement } from '../public/settlement.js';
import { seedAquaticHive } from '../public/aquatic-hive.js';
import { createCombat } from '../public/combat.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { freshLife } from '../public/survival.js';
import { freshLogistics } from '../public/logistics.js';
import { canStand } from '../public/world.js';
import { islandAt } from '../public/island-pressure.js';

const DT = .1, WARMUP = 40, TICKS = 120;
const round = value => +value.toFixed(3);
const mib = value => round(value / 1024 / 1024);

function generate(template) {
  const world = { ...prepareLandingZones(createPlanet(template)), sites: [], cores: [], tanks: [], ships: [], airbases: [], artillery: [], rails: [], logistics: freshLogistics() };
  for (const kind of ['alert', 'mortar', 'modifier']) world.sites.push(...seedConquest(world, [], [], kind));
  world.sites.push(...seedSettlement(world, [], []));
  for (const kind of ['contaminator', 'laser', 'anti-air']) world.sites.push(...seedConquest(world, [], [], kind));
  const dense = seedFrontierCities(world, [], [], 'pressure-benchmark');
  world.sites.push(...dense.sites, ...seedAquaticHive(world, [], []));
  return { world, groups: dense.manifest.groups };
}

function clear(world, x, y) {
  for (let radius = 0; radius <= 18; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (radius && Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
    const point = { x: Math.floor(x + dx) + .5, y: Math.floor(y + dy) + .5 };
    if (canStand(world, [], point.x, point.y)) return point;
  }
  throw new Error('No clear benchmark position near the generated compound.');
}

function measure(template, count) {
  const generationStart = performance.now(), { world, groups } = generate(template), selected = [];
  for (const group of groups) {
    if (selected.every(other => Math.hypot(other.x - group.x, other.y - group.y) > 70)) selected.push(group);
    if (selected.length === count) break;
  }
  if (selected.length !== count) throw new Error('Insufficient separated generated compounds for benchmark.');
  const generationMs = performance.now() - generationStart;
  const people = selected.map((group, index) => ({ id: `bench-${index}`, ...clear(world, group.x + 10, group.y + 10), ...freshLife(), body: 'robot', health: 10000, shield: 0 }));
  const saved = createCombat(world, null, null, 'pressure-benchmark').checkpoint();
  saved.serial = 24;
  saved.enemies = Array.from({ length: 24 }, (_, index) => {
    const group = selected[index % count], angle = index * Math.PI / 12;
    const point = clear(world, group.x + Math.cos(angle) * 15, group.y + Math.sin(angle) * 15);
    return { ...newGroundEnemy(index % 6 === 4 ? 'breaker' : index % 6 === 5 ? 'bulwark' : 'hunter', index + 1, point), siteId: group.requiredIds[0], homeX: point.x, homeY: point.y };
  });
  const combat = createCombat(world, saved), samples = [];
  const maintainPlayers = step => people.forEach((person, index) => {
    const group = selected[index], angle = step * DT * .12 + index;
    Object.assign(person, clear(world, group.x + Math.cos(angle) * 11, group.y + Math.sin(angle) * 11), { health: 10000, life: 'active', shield: 0 });
  });
  for (let step = 0; step < WARMUP; step++) { maintainPlayers(step); combat.tick(DT, [], people); }
  global.gc?.();
  const before = process.memoryUsage().heapUsed;
  for (let step = 0; step < TICKS; step++) {
    maintainPlayers(step + WARMUP);
    const started = performance.now(); combat.tick(DT, [], people); samples.push(performance.now() - started);
  }
  const beforeGC = process.memoryUsage().heapUsed; global.gc?.(); const afterGC = process.memoryUsage().heapUsed;
  samples.sort((a, b) => a - b);
  const checkpoint = combat.checkpoint(), snapshot = combat.snapshot();
  const pending = checkpoint.sites.reduce((sum, site) => sum + (site.pending?.points.length || 0), 0) + (checkpoint.frenzy?.phase === 'warning' ? checkpoint.frenzy.points.length : 0);
  if (checkpoint.enemies.filter(enemy => enemy.hp > 0).length + pending > 24) throw new Error('Shared active-plus-reserved population exceeded 24.');
  return { template, players: count, playerIslands: [...new Set(people.map(person => islandAt(world, person.x, person.y)))],
    facilities: world.sites.length, generationMs: round(generationMs), activeEnemies: checkpoint.enemies.filter(enemy => enemy.hp > 0).length,
    sleepingEnemies: checkpoint.director.sleeping.length, reservedArrivals: pending, measuredTicks: TICKS, warmupTicks: WARMUP,
    meanMs: round(samples.reduce((sum, value) => sum + value, 0) / samples.length), p95Ms: round(samples[Math.ceil(samples.length * .95) - 1]), maxMs: round(samples.at(-1)),
    heapBeforeGCDeltaMiB: mib(beforeGC - before), heapAfterGCDeltaMiB: mib(afterGC - before), snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)) };
}

const started = performance.now(), rows = [];
for (const template of ['caldera-v1', 'vesper-v1']) for (const count of [1, 4]) rows.push(measure(template, count));
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model, gcEnabled: !!global.gc,
  elapsedMs: round(performance.now() - started), dtSeconds: DT,
  scope: 'Local isolated combat.tick on generated Caldera/Vesper with authored and dense facilities, 24 initial enemies, and solo/four players near hostile compounds. Player maintenance, generation, snapshots and GC excluded from tick timings. No server, network, rendering, weapon load or persistent IO; not Fly capacity or proof of leak freedom.', rows }, null, 2));
