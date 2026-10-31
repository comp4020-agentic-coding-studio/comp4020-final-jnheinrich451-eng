// Disposable generated layouts only; no campaign files, accounts or live server.
// node scripts/centipede-layout-probe.mjs [--output .local/centipede-layout.json]
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createPlanet } from '../public/planet-templates.js';
import { prepareLandingZones, seedFrontierCities } from '../public/frontier-layout.js';
import { seedConquest } from '../public/conquest.js';
import { seedSettlement } from '../public/settlement.js';
import { seedAquaticHive } from '../public/aquatic-hive.js';
import { freshLogistics } from '../public/logistics.js';
import { canStand } from '../public/world.js';
import { islandAt } from '../public/island-pressure.js';
import { createDirector } from '../public/encounter-director.js';
import { pressureAllowance, updatePressure } from '../public/pressure-budget.js';
import { centipedeReservations, tickCentipedeSpawns } from '../public/centipede-spawn.js';
import { createCombat } from '../public/combat.js';
import { freshLife } from '../public/survival.js';

function generate(template, seed) {
  const world = { ...prepareLandingZones(createPlanet(template)), sites: [], cores: [], tanks: [], ships: [], airbases: [], artillery: [], rails: [], logistics: freshLogistics() };
  for (const kind of ['alert', 'mortar', 'modifier']) world.sites.push(...seedConquest(world, [], [], kind));
  world.sites.push(...seedSettlement(world, [], []));
  for (const kind of ['contaminator', 'laser', 'anti-air']) world.sites.push(...seedConquest(world, [], [], kind));
  world.sites.push(...seedFrontierCities(world, [], [], seed).sites, ...seedAquaticHive(world, [], []));
  return world;
}
function contact(world, root) {
  const island = islandAt(world, root.x + 1.5, root.y + 1.5);
  for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI / 16, p = { id: 'layout-probe', x: Math.floor(root.x + 1.5 + Math.cos(angle) * 16) + .5,
      y: Math.floor(root.y + 1.5 + Math.sin(angle) * 16) + .5, medium: 'ground' };
    if (islandAt(world, p.x, p.y) === island && canStand(world, [], p.x, p.y)) return p;
  }
  return null;
}
const rows = [];
for (const template of ['caldera-v1', 'vesper-v1']) for (const seed of ['centipede-layout-a', 'centipede-layout-b', 'centipede-layout-c']) {
  const world = generate(template, seed), roots = world.sites.filter(s => s.kind === 'modifier'), outcomes = [];
  for (const root of roots) {
    const p = contact(world, root), director = createDirector(seed), island = islandAt(world, root.x + 1.5, root.y + 1.5), enemies = [];
    if (!p) { outcomes.push({ rootId: root.id, island, eligibleContact: false, warning: false }); continue; }
    updatePressure(director, world, [p], [], 0, 0);
    director.centipedes = { version: 1, roots: { [root.id]: { activeMs: 60000, cooldown: 0, giantId: null, retryAt: 0, island } }, cooldowns: {}, pending: [], serial: 0, cursor: 0, nextPulse: 0 };
    const reservations = () => centipedeReservations(director), capacity = () => 24 - enemies.length - reservations().length;
    tickCentipedeSpawns({ world, buildings: [], contacts: [p], enemies, sleeping: [], director, now: 0, dt: 0, capacity,
      admit: (point, producer) => pressureAllowance(director, world, [p], enemies, reservations(), point, producer, capacity()), nextId: () => 1 });
    const warning = director.centipedes.pending.find(s => s.rootId === root.id);
    outcomes.push({ rootId: root.id, island, eligibleContact: true, warning: !!warning,
      ...(warning ? { head: { x: warning.x, y: warning.y }, samples: warning.trail.length } : {}) });
  }
  rows.push({ template, seed, hostileFacilities: world.sites.length, roots: roots.length,
    eligibleRoots: outcomes.filter(o => o.eligibleContact).length, clearCorridors: outcomes.filter(o => o.warning).length, outcomes });
}

// Follow the ordinary combat loop near one naturally usable Root on each world.
// Unchanged generated guards/director compete for capacity. The synthetic pilot
// is a presence contact only, so this tests emergence availability, not balance.
const natural = [];
for (const template of ['caldera-v1', 'vesper-v1']) {
  const seed = 'centipede-layout-a', world = generate(template, seed);
  const selected = rows.find(r => r.template === template && r.seed === seed).outcomes.find(o => o.warning);
  if (!selected) { natural.push({ template, firstBirthSeconds: null, reason: 'no clear corridor' }); continue; }
  const root = world.sites.find(s => s.id === selected.rootId), p = { ...contact(world, root), ...freshLife(), shield: 0, body: 'robot' };
  const combat = createCombat(world, null, null, seed), start = performance.now();
  let firstWarning = null, firstBirth = null, maxReserved = 0, maxLive = 0, maxCombined = 0;
  for (let i = 0; i < 1200; i++) {
    combat.tick(.1, [], [], [p]);
    const s = combat.snapshot(), pending = s.sites.reduce((n, site) => n + (site.pending?.points.length || 0), 0)
      + (s.frenzy?.phase === 'warning' ? s.frenzy.points.length : 0)
      + (s.encounters?.centipedes?.warnings || []).reduce((n, w) => n + w.points.length, 0);
    const live = s.enemies.filter(e => e.hp > 0).length - (s.encounters?.sleeping || 0);
    if (live + pending > 24) throw Error('Shared active-plus-reserved capacity exceeded.');
    maxReserved = Math.max(maxReserved, pending); maxLive = Math.max(maxLive, live); maxCombined = Math.max(maxCombined, live + pending);
    if (firstWarning === null && s.encounters?.centipedes?.warnings.some(w => w.kind === 'centipede')) firstWarning = s.time / 1000;
    if (s.enemies.some(e => e.kind === 'centipede' && e.hp > 0)) { firstBirth = s.time / 1000; break; }
  }
  natural.push({ template, rootId: root.id, firstWarningSeconds: firstWarning, firstBirthSeconds: firstBirth,
    simulatedSeconds: combat.snapshot().time / 1000, maxLive, maxReserved, maxCombined, wallMs: Math.round(performance.now() - start) });
}
const report = { measuredAt: new Date().toISOString(), scope: 'Six disposable generated Caldera/Vesper layouts, unchanged terrain and hostile facilities. Geometry probes isolate one Root eligibility clock at a time with empty population. Natural probes use ordinary director/guards and a non-targetable synthetic presence contact for up to120 simulation seconds; no player weapon clearing, Fly, rendering or human balance claims.', rows, natural };
const index = process.argv.indexOf('--output');
if (index >= 0) { const file = process.argv[index + 1]; await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(report, null, 2)); }
process.stdout.write(JSON.stringify({ geometry: rows.map(({ outcomes, ...r }) => r), natural }, null, 2) + '\n');
