import { CONTAMINATOR } from './contaminator.js';
// A bounded one-hop response to actual attacks, not a general noise network.
import { MODIFIER, isAlertSite } from './modifier.js';
export const DEFENSE = Object.freeze({ relay: 48, local: 12, memory: 8000, coalesce: 1000, overviewZoom: .4 });
export const sectorRadius = site => site.kind === 'contaminator' ? CONTAMINATOR.region : site.kind === 'mortar' ? 10 : site.kind === 'modifier' ? MODIFIER.region : 11;
export const territoryVisible = (zoom, orbital = false) => orbital || zoom <= DEFENSE.overviewZoom;
const center = s => ({ x: s.x + 1.5, y: s.y + 1.5 });

// Resolve a blocked impact to nearby ground without extra pathfinding searches.
export function investigationPoint(point, enemy, walkable) {
  const x = Math.floor(point.x) + .5, y = Math.floor(point.y) + .5;
  if (walkable(x, y)) return { x, y };
  for (let r = 1; r <= 3; r++) {
    const candidates = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(x + dx, y + dy)) candidates.push({ x: x + dx, y: y + dy });
    }
    if (candidates.length) return candidates.sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y))[0];
  }
  return null;
}

export function reportSectorAttack(sites, enemies, x, y, now, emit = event => {}) {
  const origins = sites.filter(s => (s.state === 'hostile' || s.conqueredAt === now) &&
    Math.hypot(center(s).x - x, center(s).y - y) <= sectorRadius(s) && now >= (s.nextDefenseReport || 0));
  if (!origins.length) return false;
  for (const s of origins) s.nextDefenseReport = now + DEFENSE.coalesce;
  const report = { x, y, at: now, until: now + DEFENSE.memory, originId: origins[0].id };
  for (const site of sites) {
    if (site.state !== 'hostile' || !origins.some(s => Math.hypot(s.x - site.x, s.y - site.y) <= DEFENSE.relay)) continue;
    site.defenseReport = { ...report }; site.awake = true;
    if (isAlertSite(site)) site.alarmUntil = Math.max(site.alarmUntil || 0, report.until);
  }
  for (const e of enemies) if (e.hp > 0 && e.kind !== 'swimmer' && Math.hypot(e.x - x, e.y - y) <= DEFENSE.local) {
    e.investigation = { ...report }; e.reroute = 0;
  }
  emit({ event: 'sector.alerted', kind: 'system', sourceId: report.originId, cause: 'hostile_attacked', x, y });
  return true;
}
