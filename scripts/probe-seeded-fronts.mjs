// Simulation-only budget probe; excludes HTTP/SSE, SQLite, rendering and other rooms.
import { performance } from 'node:perf_hooks';
import { createWorld } from '../public/world.js';
import { expandWorld } from '../public/expansion.js';
import { expandPlanet } from '../public/planet-world.js';
import { seedFronts } from '../public/seeded-fronts.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { createCombat } from '../public/combat.js';
import { freshLife } from '../public/survival.js';

const world = expandPlanet(expandWorld(createWorld()));
const started = performance.now(), plan = seedFronts(world, [], [], 'budget-sample');
const generationMs = performance.now() - started;
world.sites = plan.sites;
const saved = createCombat(world).checkpoint(), groups = plan.manifest.groups.slice(0, 4);
saved.enemies = groups.flatMap((g, index) => Array.from({ length: 6 }, (_, i) => ({
  ...newGroundEnemy(i < 2 ? 'breaker' : 'hunter', index * 6 + i + 1, { x: g.x - 10, y: g.y - 4 + i * 2 }),
  siteId: g.requiredIds[0], homeX: g.x - 10, homeY: g.y,
})));
saved.serial = 24;
const combat = createCombat(world, saved), players = groups.map((g, i) => ({ id: 'p' + i, ...freshLife(), x: g.x - 15, y: g.y, health: 100000 }));
const times = []; let peakRss = 0;
for (let tick = 0; tick < 600; tick++) {
  players.forEach((p, i) => { p.y = groups[i].y + Math.sin(tick / 50) * 5; });
  const before = performance.now(); combat.tick(.05, [], players); times.push(performance.now() - before);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}
times.sort((a, b) => a - b);
console.log(JSON.stringify({ scope: 'local simulation only; 24 mixed enemies, 4 ground targets at separate seeded compounds',
  sites: world.sites.length, simulatedSeconds: 30, generationMs: +generationMs.toFixed(2),
  p95Ms: +times[Math.floor(times.length * .95)].toFixed(2), maxMs: +times.at(-1).toFixed(2), peakRssMiB: +(peakRss / 1048576).toFixed(1) }, null, 2));
