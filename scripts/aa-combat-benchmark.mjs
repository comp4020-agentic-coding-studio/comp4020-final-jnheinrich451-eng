// Reproducible synthetic AA load, using disposable generated worlds only.
// node --expose-gc scripts/aa-combat-benchmark.mjs --output .local/aa-combat-load.json
// --validate checks fixture geometry without running or collecting timings.
import { cpus } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPlanet } from '../public/planet-templates.js';
import { prepareLandingZones, seedFrontierCities } from '../public/frontier-layout.js';
import { seedConquest } from '../public/conquest.js';
import { seedSettlement } from '../public/settlement.js';
import { seedAquaticHive } from '../public/aquatic-hive.js';
import { createCombat } from '../public/combat.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { newAerialEnemy, aerialPointClear } from '../public/aerial-enemy.js';
import { freshLife } from '../public/survival.js';
import { freshLogistics } from '../public/logistics.js';
import { canStand } from '../public/world.js';
import { islandAt } from '../public/island-pressure.js';
import { flightLineClear } from '../public/terrain-rules.js';
import { turnTurret } from '../public/turret.js';
import { AA } from '../public/aa-vehicle.js';
import { isAirEnemy } from '../public/target-domain.js';

const DT = .1, WARMUP_TICKS = 100, TICKS = 1800, BOOSTED_HP = 1e9;
const round = value => +value.toFixed(3), mib = bytes => round(bytes / 1024 / 1024);
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: values.length, meanMs: round(values.reduce((sum, x) => sum + x, 0) / values.length),
    p95Ms: round(sorted[Math.ceil(sorted.length * .95) - 1]), maxMs: round(sorted.at(-1)) };
}
function generate(template) {
  const world = { ...prepareLandingZones(createPlanet(template)), sites: [], cores: [], tanks: [], ships: [], airbases: [], artillery: [], rails: [], logistics: freshLogistics() };
  for (const kind of ['alert', 'mortar', 'modifier']) world.sites.push(...seedConquest(world, [], [], kind));
  world.sites.push(...seedSettlement(world, [], []));
  for (const kind of ['contaminator', 'laser', 'anti-air']) world.sites.push(...seedConquest(world, [], [], kind));
  const dense = seedFrontierCities(world, [], [], 'aa-combat-load');
  world.sites.push(...dense.sites, ...seedAquaticHive(world, [], []));
  return { world, groups: dense.manifest.groups };
}
function clear(world, point, occupied = [], island = islandAt(world, point.x, point.y), radius = 12) {
  for (let r = 0; r <= radius; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (r && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const candidate = { x: Math.floor(point.x + dx) + .5, y: Math.floor(point.y + dy) + .5 };
    if (islandAt(world, candidate.x, candidate.y) === island && aerialPointClear(world, candidate) &&
      canStand(world, [], candidate.x, candidate.y, null, .45) && occupied.every(p => length(p, candidate) >= 1.6)) return candidate;
  }
  throw Error('No non-overlapping natural land position near fixture point.');
}
function front(world, group, sentries, players, flyers, ground) {
  const island = islandAt(world, group.x, group.y);
  for (const [dx, dy] of [[16, 16], [-16, 16], [16, -16], [-16, -16]]) {
    try {
      const anchor = clear(world, { x: group.x + dx, y: group.y + dy }, [], island), occupied = [], friendlies = [], pilots = [], air = [], land = [];
      for (let i = 0; i < sentries; i++) {
        const angle = i * Math.PI * 2 / sentries;
        const p = clear(world, { x: anchor.x + Math.cos(angle) * 7, y: anchor.y + Math.sin(angle) * 7 }, occupied, island, 5);
        friendlies.push(p); occupied.push(p);
      }
      for (let i = 0; i < players; i++) {
        const p = clear(world, { x: anchor.x + i * 2, y: anchor.y }, occupied, island, 5); pilots.push(p); occupied.push(p);
      }
      for (let i = 0; i < flyers; i++) {
        const p = clear(world, { x: anchor.x + 9 + i * 2, y: anchor.y - 7 }, [], island, 6);
        if ([...friendlies, ...pilots].some(q => length(q, p) > 25 || !flightLineClear(world, q, p, .15))) throw Error('Obscured AA fixture.');
        air.push(p);
      }
      for (let i = 0; i < ground; i++) {
        const angle = i * Math.PI * 2 / ground;
        const p = clear(world, { x: anchor.x + Math.cos(angle) * 15, y: anchor.y + Math.sin(angle) * 15 }, occupied, island);
        land.push(p); occupied.push(p);
      }
      return { group, island, anchor, friendlies, pilots, air, land };
    } catch { /* Try the next deterministic side of this compound. */ }
  }
  return null;
}
function fixture(template, players, split) {
  const { world, groups } = generate(template), fronts = [];
  const frontCount = split ? 2 : 1;
  for (const group of groups) {
    if (fronts.some(f => f.island === islandAt(world, group.x, group.y) || length(f.group, group) < 70)) continue;
    const selected = front(world, group, 8 / frontCount, players / frontCount, 4 / frontCount, 20 / frontCount);
    if (selected) fronts.push(selected);
    if (fronts.length === frontCount) break;
  }
  if (fronts.length !== frontCount) throw Error('Cannot build the requested deterministic load fixture.');
  const buildings = [], people = [], enemies = [];
  for (const [frontIndex, f] of fronts.entries()) {
    for (const p of f.friendlies) buildings.push({ id: 'bench-sentry-' + buildings.length, owner: 'bench-pilot-0',
      kind: 'aa-sentry', weapon: 'AA35', x: p.x - .5, y: p.y - .5 });
    for (const p of f.pilots) {
      const id = 'bench-pilot-' + people.length, tank = { id: 'bench-aa-' + people.length, kind: 'aa', owner: id, occupant: id,
        x: p.x, y: p.y, angle: 0, turret: 0, elapsed: 99, health: 200, weapon: 'AA35', secondary: 'APCR' };
      world.tanks.push(tank);
      people.push({ id, ...p, ...freshLife(), body: 'rover', vehicleId: tank.id, tankWeapon: 'AA35', health: 10000,
        shield: 0, aaFire: true, aimPoint: { ...f.air[0] }, frontIndex });
    }
    for (const p of f.air) enemies.push({ ...newAerialEnemy(enemies.length + 1, p, { siteId: f.group.requiredIds[0], pressureIsland: f.island }),
      hp: BOOSTED_HP, maxHp: BOOSTED_HP, benchmarkFront: frontIndex });
    for (const [i, p] of f.land.entries()) enemies.push({ ...newGroundEnemy(i % 6 === 4 ? 'breaker' : i % 6 === 5 ? 'bulwark' : 'hunter', enemies.length + 1, p),
      hp: BOOSTED_HP, maxHp: BOOSTED_HP, siteId: f.group.requiredIds[0], pressureIsland: f.island, homeX: p.x, homeY: p.y });
  }
  const saved = createCombat(world, null, null, 'aa-combat-load').checkpoint();
  saved.serial = enemies.length; saved.enemies = enemies;
  const combat = createCombat(world, saved, () => ({ roomId: 'local-synthetic-aa-load' }));
  const maintain = () => {
    for (const [i, person] of people.entries()) {
      const tank = world.tanks[i]; tank.health = 200; tank.destroyed = false;
      person.health = 10000; person.life = 'active'; person.shield = 0;
      const air = enemies.filter(e => isAirEnemy(e) && e.benchmarkFront === person.frontIndex);
      const target = air.reduce((best, e) => length(tank, e) < length(tank, best) ? e : best, air[0]);
      person.aimPoint = { x: target.x, y: target.y };
      tank.turret = turnTurret(tank.turret, Math.atan2(target.x - tank.x, tank.y - target.y), DT, AA.turnSpeed);
      person.turret = tank.turret;
    }
    // Deliberately sustain defense availability. This measures load rather than
    // predicting whether 140-HP sentries can survive three minutes unaided.
    for (const b of buildings) {
      const state = world.logistics.durability['sentry:' + b.id];
      if (state) state.health = state.max;
    }
  };
  return { world, buildings, people, enemies, combat, maintain, fronts };
}
function measure(template, players, split) {
  const generationAt = performance.now(), f = fixture(template, players, split), generationMs = performance.now() - generationAt;
  const { world, buildings, people, combat, maintain } = f;
  for (let i = 0; i < WARMUP_TICKS; i++) { maintain(); combat.tick(DT, buildings, people); combat.drainEvents(); }
  global.gc?.();
  const memoryBefore = process.memoryUsage(), tickSamples = [], snapshotBuild = [], snapshotEncode = [], checkpointBuild = [], checkpointEncode = [];
  const maxima = { enemies: 0, flyers: 0, projectiles: 0, groundAttacks: 0, bileShots: 0, pendingArrivals: 0, snapshotBytes: 0, checkpointBytes: 0 };
  const minima = { enemies: Infinity, flyers: Infinity };
  const observedRounds = {}, summaryRounds = {}, memory = [];
  let lastMuzzleId = -1, receivedBile = 0, lastBile = -1;
  const cpuAt = process.cpuUsage(), wallAt = performance.now();
  for (let i = 0; i < TICKS; i++) {
    maintain();
    let at = performance.now(); combat.tick(DT, buildings, people); tickSamples.push(performance.now() - at);
    at = performance.now(); const snapshot = combat.snapshot(); snapshotBuild.push(performance.now() - at);
    at = performance.now(); const encoded = JSON.stringify(snapshot); snapshotEncode.push(performance.now() - at);
    maxima.snapshotBytes = Math.max(maxima.snapshotBytes, Buffer.byteLength(encoded));
    const pending = snapshot.sites.reduce((n, s) => n + (s.pending?.points.length || 0), 0) + (snapshot.frenzy?.phase === 'warning' ? snapshot.frenzy.points.length : 0);
    const living = snapshot.enemies.filter(e => e.hp > 0), air = living.filter(isAirEnemy);
    const airPending = snapshot.sites.reduce((n, s) => n + (s.pending?.points || []).filter(isAirEnemy).length, 0);
    maxima.enemies = Math.max(maxima.enemies, living.length); maxima.flyers = Math.max(maxima.flyers, air.length);
    minima.enemies = Math.min(minima.enemies, living.length); minima.flyers = Math.min(minima.flyers, air.length);
    maxima.projectiles = Math.max(maxima.projectiles, snapshot.shells.length + snapshot.charges.length);
    maxima.groundAttacks = Math.max(maxima.groundAttacks, living.filter(e => !isAirEnemy(e) && e.attack).length);
    maxima.bileShots = Math.max(maxima.bileShots, snapshot.aerialShots.filter(s => !s.impacted).length);
    maxima.pendingArrivals = Math.max(maxima.pendingArrivals, pending);
    if (living.length + pending > 24 || air.length + airPending > 4 || snapshot.shells.length + snapshot.charges.length > 64) throw Error('A shared capacity limit was exceeded.');
    let latest = lastMuzzleId;
    for (const s of snapshot.shots) if (s.mount === 'aa-35mm' && s.id > lastMuzzleId) {
      observedRounds[s.owner] = (observedRounds[s.owner] || 0) + 1; latest = Math.max(latest, s.id);
    }
    lastMuzzleId = latest;
    for (const s of snapshot.aerialShots) if (s.id > lastBile) { receivedBile++; lastBile = s.id; }
    for (const event of combat.drainEvents()) if (event.weapon === 'AA35' && ['defense.activity', 'weapon.activity'].includes(event.event))
      summaryRounds[event.sourceId] = (summaryRounds[event.sourceId] || 0) + event.count;
    if (i % 5 === 0) {
      at = performance.now(); const checkpoint = combat.checkpoint(); checkpointBuild.push(performance.now() - at);
      at = performance.now(); const saved = JSON.stringify(checkpoint); checkpointEncode.push(performance.now() - at);
      maxima.checkpointBytes = Math.max(maxima.checkpointBytes, Buffer.byteLength(saved));
    }
    if (i % 50 === 0) {
      const m = process.memoryUsage(); memory.push({ simulationSeconds: round((i + 1) * DT), rssMiB: mib(m.rss), heapUsedMiB: mib(m.heapUsed) });
    }
  }
  const wallMs = performance.now() - wallAt, cpu = process.cpuUsage(cpuAt), memoryBeforeGC = process.memoryUsage();
  global.gc?.(); const memoryAfterGC = process.memoryUsage();
  const row = { template, players, arrangement: split ? 'two separate islands' : 'one shared front and island',
    playerIslands: [...new Set(people.map(p => islandAt(world, p.x, p.y)))], generatedHostileFacilities: world.sites.length,
    aaSentries: buildings.length, mobileAA: world.tanks.length, simulatedSeconds: TICKS * DT, warmupSeconds: WARMUP_TICKS * DT,
    generationMs: round(generationMs), wallMs: round(wallMs), processCpuMs: { user: round(cpu.user / 1000), system: round(cpu.system / 1000) },
    combatTick: stats(tickSamples), snapshotBuild: stats(snapshotBuild), snapshotJSON: stats(snapshotEncode),
    checkpointBuild: stats(checkpointBuild), checkpointJSON: stats(checkpointEncode), minima, maxima,
    observedAAMuzzleEvents: observedRounds, automaticActivitySummaryRounds: summaryRounds, observedBileShots: receivedBile,
    memory: { beforeMiB: { rss: mib(memoryBefore.rss), heapUsed: mib(memoryBefore.heapUsed) },
      endBeforeGCMiB: { rss: mib(memoryBeforeGC.rss), heapUsed: mib(memoryBeforeGC.heapUsed) },
      endAfterGCMiB: { rss: mib(memoryAfterGC.rss), heapUsed: mib(memoryAfterGC.heapUsed) },
      sampledPeakRSSMiB: Math.max(...memory.map(m => m.rssMiB)),
      retainedHeapDeltaMiB: mib(memoryAfterGC.heapUsed - memoryBefore.heapUsed), samples: memory } };
  if (Object.keys(observedRounds).filter(id => id.startsWith('bench-sentry-')).length !== 8) throw Error('Not all eight sentries participated.');
  if (minima.flyers !== 4 || minima.enemies !== 24) throw Error('Synthetic sustained roster did not remain full.');
  return row;
}

const scenarios = ['caldera-v1', 'vesper-v1'].flatMap(template => [1, 2, 4].map(players => ({ template, players, split: false }))
  .concat({ template, players: 2, split: true }));
if (process.argv.includes('--validate')) {
  const rows = scenarios.map(({ template, players, split }) => {
    const f = fixture(template, players, split);
    return { template, players, split, sites: f.world.sites.length, sentries: f.buildings.length, enemies: f.enemies.length,
      fronts: f.fronts.map(g => ({ anchor: g.anchor, island: g.island })) };
  });
  console.log(JSON.stringify({ geometryValidated: true, rows }, null, 2));
} else {
  const started = performance.now(), rows = [];
  for (const scenario of scenarios) {
    const row = measure(scenario.template, scenario.players, scenario.split); rows.push(row);
    if (process.argv.includes('--output')) console.log(`${scenario.template} ${scenario.players}p ${scenario.split ? 'split' : 'shared'}: tick p95 ${row.combatTick.p95Ms} ms, observed ${Object.values(row.observedAAMuzzleEvents).reduce((a, b) => a + b, 0)} AA muzzles`);
  }
  const result = { measuredAt: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model, gcEnabled: !!global.gc,
    elapsedMs: round(performance.now() - started), dtSeconds: DT,
    scope: 'Local synthetic sustained combat, not Fly capacity or human balance testing. Each generated Caldera/Vesper fixture has 20 ground enemies, four normally moving/attacking mantas, eight ready AA sentries and one occupied firing AA vehicle per player. Enemies have boosted HP; players, vehicles and sentry HP are replenished before ticks to preserve load. Player aim/traverse maintenance is synthetic and excluded from combatTick timings. No server, HTTP, SSE, browser rendering, database or disk persistence is included. Snapshot creation/JSON run every tick; checkpoint creation/JSON run every five ticks and are measured separately. Checkpoint creation itself includes its existing internal JSON copy.',
    counting: 'Muzzle observations include trailing warmup events, use the existing bounded 64-event snapshot history and may undercount heavy simultaneous effects; activity summaries count accepted rounds but have an at-most-one-tick sentry boundary offset. Bile observations include the trailing warmup flight. CPU totals cover the measured loop including maintenance, assertions and serialization; memory samples are every five simulation seconds. Post-GC deltas include retained timing arrays and do not establish leak freedom. Existing enemy/projectile caps are asserted every tick; stationary AA numbers are an authored stress fixture, not a newly imposed gameplay cap.',
    rows };
  const outputArg = process.argv.indexOf('--output');
  if (outputArg >= 0) {
    const output = path.resolve(process.argv[outputArg + 1]);
    await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(result, null, 2) + '\n');
    console.log(`Wrote ${output}`);
  } else console.log(JSON.stringify(result, null, 2));
}
