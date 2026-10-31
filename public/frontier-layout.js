import { makeSite } from './conquest.js';
import { bridgeCells } from './bridge-geometry.js';

// Used only while creating a new campaign. Persist its result; never regenerate
// these records or clear terrain in an existing save.
export const FRONTIER_LAYOUT = Object.freeze({ version: 1, zoneRadius: 12, zoneBuffer: 30,
  groups: 48, groupSpacing: 26, siteSpacing: 8 });
const TEMPLATES = [
  { name: 'War colony', kinds: ['alert', 'mortar', 'modifier'] },
  { name: 'Lance fortress', kinds: ['alert', 'laser', 'modifier', 'mortar'] },
  { name: 'Spore citadel', kinds: ['alert', 'anti-air', 'modifier', 'mortar'] },
  { name: 'Shrouded bastion', kinds: ['alert', 'mortar', 'modifier', 'contaminator', 'anti-air'] },
];
const OFFSETS = [[-6, -4], [6, -4], [0, 6], [-9, 7], [9, 7]];
function random(seed) {
  let n = 2166136261;
  for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, n | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const naturalLand = (world, x, y, rocks = false) => x >= 0 && y >= 0 && x < world.width && y < world.height
  && !world.mountains?.[y * world.width + x] && (world.waterKinds?.[y * world.width + x] || 0) === 0
  && (rocks ? [1, 2, 3] : [1, 2]).includes(world.terrain[y * world.width + x]);
const zoneDistance = (zone, point) => Math.hypot(zone.x + 1.5 - point.x, zone.y + 1.5 - point.y);

export function prepareLandingZones(world) {
  if (world.landingZones?.length) return world;
  const terrain = [...world.terrain], landingZones = [];
  const anchors = [
    { id: 'landing', label: `${world.name} foothold`, ...world.spawn },
    ...['aurora', 'haven', 'meridian'].map(id => ({ ...world.regions?.find(r => r.id === id),
      ...(world.template === 'vesper-v1' && id === 'aurora' ? { x: 270, y: 100 } : {}), id })),
  ];
  for (const anchor of anchors) {
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) throw Error('Missing landing region: ' + anchor.id);
    const candidates = [];
    for (let y = Math.max(13, Math.floor(anchor.y) - 44); y < Math.min(world.height - 14, anchor.y + 44); y++)
      for (let x = Math.max(13, Math.floor(anchor.x) - 44); x < Math.min(world.width - 14, anchor.x + 44); x++)
        candidates.push({ x, y, distance: Math.hypot(x + 1.5 - anchor.x, y + 1.5 - anchor.y) });
    candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    const radius = FRONTIER_LAYOUT.zoneRadius;
    const clear = candidates.find(p => {
      if (landingZones.some(z => zoneDistance(z, { x: p.x + 1.5, y: p.y + 1.5 }) < radius * 4)) return false;
      for (let y = p.y - radius; y <= p.y + radius + 2; y++) for (let x = p.x - radius; x <= p.x + radius + 2; x++) {
        if (Math.hypot(x - p.x - 1, y - p.y - 1) <= radius && !naturalLand(world, x, y, true)) return false;
      }
      return true;
    });
    if (!clear) throw Error('No clear landing reserve in ' + anchor.id);
    const zone = { id: 'landing-' + anchor.id, label: anchor.label || anchor.id, x: clear.x, y: clear.y, radius };
    for (let y = zone.y - radius; y <= zone.y + radius + 2; y++) for (let x = zone.x - radius; x <= zone.x + radius + 2; x++)
      if (Math.hypot(x - zone.x - 1, y - zone.y - 1) <= radius && terrain[y * world.width + x] === 3) terrain[y * world.width + x] = 2;
    landingZones.push(zone);
  }
  return { ...world, terrain, landingZones, frontierLayout: { version: FRONTIER_LAYOUT.version } };
}

export function seedFrontierCities(world, buildings = [], occupants = [], seed = 'frontier') {
  const rand = random(seed), sites = [], groups = [], existing = world.sites || [];
  const protectedObjects = [...occupants, ...buildings, ...(world.cores || []),
    ...(world.tanks || []).flatMap(t => [t, ...(Number.isFinite(t.podX) && Number.isFinite(t.podY) ? [{ x: t.podX, y: t.podY }] : [])]),
    ...(world.airbases || []), ...(world.artillery || []), ...(world.logistics?.facilities || []),
    ...(world.logistics?.recyclers || []), ...(world.logistics?.crates || []),
    ...(world.logistics?.shipyards || []).map(y => y.dock || y), ...(world.ships || []).flatMap(s => [s, s.dock, s.ramp].filter(Boolean))];
  const tracks = [...(world.rails || []), ...(world.bridges || []), ...(world.logistics?.bridges || []).flatMap(bridgeCells)];
  const floors = new Set(world.logistics?.floors || []), usedIds = new Set(existing.map(s => s.id));
  let serial = 0;
  const candidates = [];
  for (let y = 12; y < world.height - 14; y += 6) for (let x = 12; x < world.width - 14; x += 6) {
    const p = { x: x + Math.floor(rand() * 5) - 2, y: y + Math.floor(rand() * 5) - 2, rank: rand() };
    if (naturalLand(world, p.x, p.y)) candidates.push(p);
  }
  candidates.sort((a, b) => a.rank - b.rank);
  for (const p of candidates) {
    if (groups.length >= FRONTIER_LAYOUT.groups) break;
    if (groups.some(g => Math.hypot(g.x - p.x - 1.5, g.y - p.y - 1.5) < FRONTIER_LAYOUT.groupSpacing)) continue;
    // Establish each defensive role before randomising later compounds; narrow
    // terrain must not silently remove an entire facility type from a planet.
    const template = TEMPLATES[groups.length < TEMPLATES.length ? groups.length : Math.floor(rand() * TEMPLATES.length)];
    while (usedIds.has(`city-v${FRONTIER_LAYOUT.version}-${seed}-${serial}-0`)) serial++;
    const id = `city-v${FRONTIER_LAYOUT.version}-${seed}-${serial}`;
    const members = template.kinds.map((kind, i) => makeSite(kind, `${id}-${i}`, p.x + OFFSETS[i][0], p.y + OFFSETS[i][1]));
    if (members.some(s => {
      const point = { x: s.x + 1.5, y: s.y + 1.5 };
      if ((world.landingZones || []).some(z => zoneDistance(z, point) < z.radius + FRONTIER_LAYOUT.zoneBuffer)) return true;
      if (protectedObjects.some(o => Math.hypot(o.x - point.x, o.y - point.y) < 32)) return true;
      if (tracks.some(o => Math.hypot(o.x - point.x, o.y - point.y) < 12)) return true;
      if (existing.concat(sites).some(o => Math.hypot(o.x - s.x, o.y - s.y) < FRONTIER_LAYOUT.siteSpacing)) return true;
      // A two-tile collar leaves space to walk around each facility and emerge.
      for (let y = s.y - 2; y < s.y + 5; y++) for (let x = s.x - 2; x < s.x + 5; x++)
        if (!naturalLand(world, x, y) || floors.has(y * world.width + x)) return true;
      return false;
    })) continue;
    const region = (world.regions || []).filter(r => !['ocean', 'lake'].includes(r.id))
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const group = { id, name: `${region?.label?.split(' / ')[0] || world.name} / ${template.name} ${groups.length + 1}`,
      region: region?.id || 'frontier', requiredIds: members.map(s => s.id), x: p.x + 1.5, y: p.y + 1.5, radius: 15 };
    sites.push(...members.map((s, i) => {
      const guardRoster = i === 0 ? ['hunter', 'breaker', 'hunter', 'bulwark'] : [];
      return { ...s, encounter: { ...group }, guardRoster, guardsRemaining: guardRoster.length };
    }));
    groups.push(group); serial++;
  }
  return { sites, manifest: { version: FRONTIER_LAYOUT.version, seed, groups, limit: FRONTIER_LAYOUT.groups } };
}
