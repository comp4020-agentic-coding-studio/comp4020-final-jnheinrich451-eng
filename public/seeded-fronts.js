import { makeSite } from './conquest.js';
import { bridgeCells } from './bridge-geometry.js';

export const ENCOUNTER_VERSION = 1;
const REGIONS = [
  { id: 'aurora', name: 'Aurora', count: 2, radius: 46 },
  { id: 'haven', name: 'Haven', count: 2, radius: 44 },
  { id: 'meridian', name: 'Meridian', count: 3, radius: 59 },
];
export const DENSE_REGIONS = Object.freeze([
  { id: 'aurora', name: 'Aurora', count: 6, rx: 67, ry: 52 },
  { id: 'haven', name: 'Haven', count: 6, rx: 56, ry: 61 },
  { id: 'meridian', name: 'Meridian', count: 12, rx: 84, ry: 84 },
]);
const TEMPLATES = [
  { name: 'Listening nest', kinds: ['alert', 'modifier'] },
  { name: 'Bile bastion', kinds: ['mortar', 'modifier'] },
  { name: 'Spore battery', kinds: ['anti-air', 'modifier'] },
  { name: 'War colony', kinds: ['alert', 'mortar', 'modifier'] },
];
function random(seed) {
  let n = 2166136261;
  for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, n | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Plan once, without mutating terrain, entities or existing objective records.
// Persist the returned records, not a promise to regenerate them on each load.
export function seedFronts(world, buildings, occupants, seed) {
  return planFronts(world, buildings, occupants, seed, false);
}

// Add to existing compounds (including conquered ones); never replace them.
export function seedDenseFronts(world, buildings, occupants, seed) {
  return planFronts(world, buildings, occupants, seed, true);
}
function planFronts(world, buildings, occupants, seed, dense) {
  const rand = random(seed), sites = [], groups = [], skipped = [];
  const version = dense ? 2 : ENCOUNTER_VERSION;
  const existing = [...new Map((world.sites || []).filter(s => s.encounter).map(s => [s.encounter.id, s.encounter])).values()];
  const protectedObjects = [...occupants, ...buildings, ...(world.cores || []),
    ...(world.tanks || []).flatMap(t => [t, ...(Number.isFinite(t.podX) && Number.isFinite(t.podY) ? [{ x: t.podX, y: t.podY }] : [])]),
    ...(world.artillery || []), ...(world.airbases || []),
    ...(world.logistics?.facilities || []), ...(world.logistics?.recyclers || []),
    ...(world.logistics?.crates || []), ...(world.logistics?.shipyards || []).map(y => y.dock || y),
    ...(world.ships || []).flatMap(s => [s, s.dock, s.ramp].filter(Boolean))];
  const tracks = [...(world.rails || []), ...(world.bridges || []), ...(world.logistics?.bridges || []).flatMap(bridgeCells)];
  const floors = new Set(world.logistics?.floors || []);
  for (const region of dense ? DENSE_REGIONS : REGIONS) {
    const center = world.regions?.find(r => r.id === region.id);
    const occupied = dense ? existing.filter(g => g.region === region.id).length : 0;
    for (let slot = occupied; slot < region.count; slot++) {
      const id = `front-v${version}-${seed}-${region.id}-${slot}`;
      const template = TEMPLATES[Math.floor(rand() * TEMPLATES.length)];
      let placed = false;
      for (let attempt = 0; center && attempt < (dense ? 768 : 96); attempt++) {
        const angle = rand() * Math.PI * 2, radius = dense ? Math.sqrt(.25 + rand() * .75) : region.radius + rand() * 8;
        const x = Math.round(center.x + Math.cos(angle) * radius * (dense ? region.rx : 1));
        const y = Math.round(center.y + Math.sin(angle) * radius * (dense ? region.ry : 1));
        if ([...groups, ...(dense ? existing : [])].some(g => Math.hypot(g.x - x - (dense ? .5 : 0), g.y - y - (dense ? 1.5 : 0)) < (dense ? 32 : 43))) continue;
        const members = template.kinds.map((kind, i) => makeSite(kind, `${id}-${i}`, x + [-5, 5, 0][i] - 1, y + [-3, -3, 6][i] - 1));
        const unsafe = members.some(s => {
          const sx = s.x + 1.5, sy = s.y + 1.5;
          // Keep a clear central staging area beyond mortar/flak reach.
          if (Math.hypot(sx - center.x, sy - center.y) < 39) return true;
          if (protectedObjects.some(p => Math.hypot(p.x - sx, p.y - sy) < 40)) return true;
          if (tracks.some(p => Math.hypot(p.x - sx, p.y - sy) < 15)) return true;
          if ((world.sites || []).some(p => Math.hypot(p.x - s.x, p.y - s.y) < (dense && p.encounter ? 14 : 32))) return true;
          for (let ty = s.y - 5; ty < s.y + 8; ty++) for (let tx = s.x - 5; tx < s.x + 8; tx++) {
            if (tx < 128 && ty < 96 || tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return true;
            if (floors.has(ty * world.width + tx) || ![1, 2].includes(world.terrain[ty * world.width + tx])) return true;
          }
          return false;
        });
        if (unsafe) continue;
        const group = { id, name: `${region.name} / ${template.name} ${slot + 1}`, region: region.id,
          requiredIds: members.map(s => s.id), x: x + .5, y: y + 1.5, radius: 13 };
        const records = members.map((s, i) => {
          // One finite guard allocation per compound. Only crowns can call more hunters.
          const guardRoster = i === 0 ? ['hunter', 'breaker', 'hunter'] : [];
          return { ...s, encounter: { ...group }, guardRoster, guardsRemaining: guardRoster.length };
        });
        sites.push(...records); groups.push(group); placed = true; break;
      }
      if (!placed) skipped.push({ id, region: region.id, reason: 'no_safe_space' });
    }
  }
  return { sites, manifest: { version, seed, groups, skipped } };
}
