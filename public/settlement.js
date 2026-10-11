import { makeSite } from './conquest.js';
import { placementError } from './world.js';
import { tankPodCell } from './tank.js';

const KINDS = ['alert', 'mortar', 'modifier'];
const ID = 'caldera-settlement-01';
const requiredIds = KINDS.map(kind => `${ID}-${kind}`);

// Membership travels with the saved sites. Completion has one source of truth:
// every explicitly required structure must exist and be permanently conquered.
export function settlements(sites = []) {
  const groups = new Map();
  for (const site of sites) if (site.settlement) groups.set(site.settlement.id, site.settlement);
  return [...groups.values()].map(group => {
    const members = group.requiredIds.map(id => sites.find(s => s.id === id));
    const cleared = members.filter(s => s?.state === 'conquered').length;
    return { ...group, members, cleared, state: cleared === group.requiredIds.length ? 'conquered' : 'hostile' };
  });
}

export function seedSettlement(world, buildings, occupants) {
  if (world.sites?.some(s => s.settlement?.id === ID)) return [];
  const candidates = [];
  for (let y = 12; y < world.height - 22; y += 2) for (let x = 58; x < world.width - 22; x += 2) candidates.push({ x, y });
  candidates.sort((a, b) => Math.hypot(a.x - 94, a.y - 26) - Math.hypot(b.x - 94, b.y - 26));
  const protectedObjects = [...occupants, ...buildings, ...(world.cores || []), ...(world.tanks || []), ...(world.artillery || []), ...(world.airbases || [])];
  for (const p of candidates) {
    const sites = KINDS.map((kind, i) => makeSite(kind, requiredIds[i], p.x + [0, 10, 5][i], p.y + [0, 0, 9][i]));
    if (sites.some(s => protectedObjects.some(o => Math.hypot(o.x - s.x - 1.5, o.y - s.y - 1.5) < 26)
      || (world.sites || []).some(o => Math.hypot(o.x - s.x, o.y - s.y) < 13)
      || (world.fronts || []).some(o => Math.hypot(o.x - s.x - 1.5, o.y - s.y - 1.5) < 7))) continue;
    let clear = true;
    for (const s of sites) for (let y = s.y - 1; y <= s.y + 3 && clear; y++) for (let x = s.x - 1; x <= s.x + 3; x++) {
      if (placementError(world, buildings, occupants, x, y) || world.tanks?.some(t => tankPodCell(t, x, y))) { clear = false; break; }
    }
    if (!clear) continue;
    const group = { id: ID, name: 'Ashfold colony', requiredIds, x: p.x + 6.5, y: p.y + 5, radius: 13 };
    return sites.map(s => ({ ...s, settlement: { ...group } }));
  }
  return []; // All three or none; never flatten terrain or displace a player.
}
