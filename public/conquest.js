import { ANTI_AIR } from './anti-air.js';
import { LASER } from './laser-tower.js';
import { CONTAMINATOR } from './contaminator.js';
import { canStand, placementError } from './world.js';
import { tankPodCell } from './tank.js';
import { sensorContacts, tickSensor } from './sensors.js';
import { MORTAR } from './mortar.js';
import { MODIFIER, isAlertSite } from './modifier.js';

export const ALERT = Object.freeze({ hp: 420, size: 3, region: 11, wake: 18, detection: 12,
  pursuit: 20, grace: 4000, interval: 12000, warning: 2200, guards: 3, wave: 2, max: 8, globalMax: 24 });
export const siteCenter = site => ({ x: site.x + 1.5, y: site.y + 1.5 });
export const siteDistance = (site, point) => Math.hypot(Math.max(site.x - point.x, 0, point.x - site.x - 3), Math.max(site.y - point.y, 0, point.y - site.y - 3));

export function makeSite(kind, id, x, y) {
  const profile = kind === 'anti-air' ? ANTI_AIR : kind === 'laser' ? LASER : kind === 'contaminator' ? CONTAMINATOR : kind === 'mortar' ? MORTAR : kind === 'modifier' ? MODIFIER : ALERT;
  return { id, kind, name: kind === 'anti-air' ? 'Spore flak' : kind === 'laser' ? 'Lance tower' : kind === 'contaminator' ? 'Air contaminator' : kind === 'mortar' ? 'Bile mortar' : kind === 'modifier' ? 'Blight root' : 'Sensory crown', x, y,
    hp: profile.hp, maxHp: profile.hp, state: 'hostile', awake: false, guardsRemaining: profile.guards,
    alarmUntil: 0, nextCall: 0, pending: null, hitAt: -10000, blockedAt: -10000 };
}

// One additive encounter, selected once. Existing buildings/players keep their sites.
export function seedConquest(world, buildings, occupants, kind = 'alert') {
  if (!['alert', 'mortar', 'modifier', 'contaminator', 'laser', 'anti-air'].includes(kind)) return [];
  const antiAir = kind === 'anti-air';
  const contaminator = kind === 'contaminator', laser = kind === 'laser';
  const mortar = kind === 'mortar', modifier = kind === 'modifier';
  const candidates = [];
  for (let y = 12; y < world.height - 12; y += 4) for (let x = 60; x < world.width - 12; x += 4) candidates.push({ x, y });
  const preferred = antiAir ? { x: 108, y: 24 } : laser ? { x: 60, y: 28 } : contaminator ? { x: 80, y: 48 } : mortar ? { x: 96, y: 60 } : modifier ? { x: 64, y: 64 } : { x: 80, y: 28 };
  candidates.sort((a, b) => Math.hypot(a.x - preferred.x, a.y - preferred.y) - Math.hypot(b.x - preferred.x, b.y - preferred.y));
  for (const p of candidates) {
    if (antiAir && (world.sites || []).some(s => Math.hypot(s.x - p.x, s.y - p.y) < (s.kind === 'contaminator' ? CONTAMINATOR.radius + 6 : 12))) continue;
    if (antiAir && (world.airbases || []).some(b => Math.hypot(b.x + 3 - p.x - 1.5, b.y + 5 - p.y - 1.5) < ANTI_AIR.range + 12)) continue;
    if (laser && (world.sites || []).some(s => Math.hypot(s.x - p.x, s.y - p.y) < (s.kind === 'contaminator' ? CONTAMINATOR.radius + LASER.acquire + 3 : 12))) continue;
    if (contaminator && (world.sites || []).some(s => Math.hypot(s.x - p.x, s.y - p.y) < 18)) continue;
    if ((mortar || modifier) && (world.sites || []).some(s => Math.hypot(s.x - p.x, s.y - p.y) < 30)) continue;
    if ((mortar || modifier || contaminator || laser || antiAir) && [...occupants, ...buildings, ...(world.cores || []), ...(world.tanks || []), ...(world.artillery || []), ...(world.airbases || []),
      ...(contaminator ? (world.ships || []).flatMap(s => [s, s.dock].filter(Boolean)) : [])]
      .some(o => Math.hypot(o.x - p.x - 1.5, o.y - p.y - 1.5) < (contaminator ? 32 : MORTAR.range + 4))) continue;
    if (occupants.some(o => Math.hypot(o.x - p.x - 1.5, o.y - p.y - 1.5) < ALERT.wake + 4)) continue;
    if ((world.fronts || []).some(o => Math.hypot(o.x - p.x - 1.5, o.y - p.y - 1.5) < 8)) continue;
    let clear = true;
    for (let y = p.y - 3; y < p.y + 6 && clear; y++) for (let x = p.x - 3; x < p.x + 6; x++) {
      if (placementError(world, buildings, [], x, y) || world.tanks?.some(t => tankPodCell(t, x, y))) { clear = false; break; }
    }
    if (clear) return [makeSite(kind, `caldera-${kind}-01`, p.x, p.y)];
  }
  return []; // No safe space: preserve the save; never overwrite a player's base.
}

export function damageSites(sites, x, y, profile, now, blastDamage) {
  const hits = [];
  for (const site of sites) {
    if (site.state !== 'hostile') continue;
    const amount = blastDamage(siteDistance(site, { x, y }), profile);
    if (amount <= 0) continue;
    site.hp = Math.max(0, site.hp - amount); site.hitAt = now;
    site.alarmUntil = Math.max(site.alarmUntil || 0, now + ALERT.grace); site.awake = true;
    site.disturbance = { x, y, until: now + ALERT.grace };
    if (!site.hp) { site.state = 'conquered'; site.conqueredAt = now; site.pending = null; site.alarmUntil = 0; if (site.mortar) site.mortar.charge = null; if (site.laser) { site.laser.phase = 'silent'; site.laser.beam = null; site.laser.targetId = null; } }
    hits.push({ id: site.id, ...siteCenter(site), kind: 'station', angle: 0, killed: site.hp === 0 });
    if (!site.hp && site.aa) { site.aa.queue = []; site.aa.phase = 'silent'; site.aa.targetId = null; }
  }
  return hits;
}

function arrivalPoints(site, world, buildings, people, enemies, blocked, origin = siteCenter(site)) {
  const center = origin, points = [];
  const vehicles = [...(world.tanks || []), ...(world.ships || []), ...(world.airbases || []).map(b => b.aircraft).filter(Boolean)];
  const occupied = people.concat(vehicles);
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8, x = Math.floor(center.x + Math.cos(angle) * 5) + .5, y = Math.floor(center.y + Math.sin(angle) * 5) + .5;
    if (!canStand(world, buildings, x, y) || blocked(Math.floor(x), Math.floor(y))) continue;
    if (occupied.some(p => Math.hypot(p.x - x, p.y - y) < 4) || enemies.some(e => e.hp > 0 && Math.hypot(e.x - x, e.y - y) < 1.5)) continue;
    points.push({ x, y });
  }
  return points;
}

export function tickSites(sites, world, buildings, people, enemies, now, nextId, blocked = () => false) {
  let changed = false;
  const occupants = people.filter(p => p.body !== 'orbital');
  const contacts = sensorContacts(world, people);
  for (const site of sites) {
    const previousMarks = site.sensor?.marks.length || 0;
    const scanner = isAlertSite(site);
    if (scanner) tickSensor(site, world, buildings, contacts, now);
    if (previousMarks || site.sensor?.marks.length) changed = true;
    if (site.state !== 'hostile') { site.pending = null; site.alarm = false; continue; }
    changed = true; // Shared pulse/beam/mark time, independent of each client's camera.
    const center = siteCenter(site);
    if (!site.awake && contacts.some(p => p.ground && Math.hypot(p.x - center.x, p.y - center.y) < ALERT.wake)) { site.awake = true; changed = true; }
    const report = (site.sensor?.marks || []).filter(m => m.ground).sort((a, b) => b.seenAt - a.seenAt)[0];
    const alarm = site.alarmUntil > now || !!report;
    if (site.alarm !== alarm) { site.alarm = alarm; changed = true; }
    if (!site.awake) continue;
    const capacity = () => Math.max(0, Math.min(ALERT.max - enemies.filter(e => e.hp > 0 && e.siteId === site.id).length,
      ALERT.globalMax - enemies.filter(e => e.hp > 0).length - sites.filter(s => s.id !== site.id && s.state === 'hostile').reduce((n, s) => n + (s.pending?.points.length || 0), 0)));
    if (site.pending) {
      changed = true;
      if (!alarm && site.pending.kind === 'reinforcement') site.pending = null;
      else if (now >= site.pending.at) {
        const valid = arrivalPoints(site, world, buildings, occupants, enemies, blocked, site.pending.origin || siteCenter(site));
        let spawned = 0;
        for (const point of site.pending.points) {
          if (!capacity() || !valid.some(p => p.x === point.x && p.y === point.y)) continue;
          enemies.push({ id: nextId(), ...point, hp: 60, angle: 0, path: [], reroute: 0,
            siteId: site.id, homeX: point.x, homeY: point.y, emergedAt: now, behavior: 'guarding' }); spawned++;
        }
        if (site.pending.kind === 'guards') site.guardsRemaining -= spawned;
        site.pending = null; site.nextCall = now + (spawned ? ALERT.interval : 2000);
      }
    }
    if (!site.pending && now >= site.nextCall && capacity() > 0 && (site.guardsRemaining > 0 || scanner && alarm)) {
      const count = Math.min(capacity(), site.guardsRemaining || ALERT.wave);
      const origin = site.defenseReport?.until > now ? { x: site.defenseReport.x, y: site.defenseReport.y } : siteCenter(site);
      const points = arrivalPoints(site, world, buildings, occupants, enemies, blocked, origin).slice(0, count);
      if (points.length) { site.pending = { kind: site.guardsRemaining ? 'guards' : 'reinforcement', points, origin, at: now + ALERT.warning }; changed = true; }
      else site.nextCall = now + 2000;
    }
  }
  return changed;
}
