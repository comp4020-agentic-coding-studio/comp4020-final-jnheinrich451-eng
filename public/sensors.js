import { raycast } from './raycast.js';
import { angleDelta, turnTurret } from './turret.js';

export const SCANNER = Object.freeze({ range: 12, trackRange: 24, halfAngle: Math.PI / 15,
  period: 3000, memory: 8000, speed: Math.PI / 2, pursuit: 28 });
const centerOf = site => ({ x: site.x + 1.5, y: site.y + 1.5 });
const bearing = (a, b) => Math.atan2(b.x - a.x, a.y - b.y);

// Only physical, active participants are sensor contacts. Never persist player rows.
export function sensorContacts(world, people) {
  return people.filter(p => p.id != null && p.body !== 'orbital' && p.life === 'active' && !p.deploying && !(p.shield > 0)).flatMap(p => {
    const tank = (world.tanks || []).find(v => !v.destroyed && v.occupant === p.id);
    const ship = (world.ships || []).find(v => !v.destroyed && v.occupant === p.id);
    if (ship?.kind === 'submarine' && ship.depth === 'submerged') return [];
    const plane = (world.airbases || []).map(b => b.aircraft).find(v => v && v.occupant === p.id);
    const physical = tank || ship || plane || p;
    return [{ id: p.id, targetId: tank ? 'vehicle:' + tank.id : ship ? 'ship:' + ship.id : plane ? 'aircraft:' + plane.id : p.id,
      x: physical.x, y: physical.y, ground: !ship && !plane && p.body !== 'aircraft' && p.body !== 'ship' }];
  }).filter((p, i, all) => all.findIndex(q => q.id === p.id) === i);
}

export function beamRay(world, buildings, site, angle, range = SCANNER.trackRange) {
  // The emitting organ is solid to weapons, but must not block its own sensor.
  return raycast({ ...world, sites: (world.sites || []).filter(s => s.id !== site.id) }, buildings,
    centerOf(site), Math.sin(angle), -Math.cos(angle), range);
}

// Exact moving-point / expanding-ring intersection within one pulse interval.
// This catches a fast vehicle crossing both sides between simulation samples.
export function sweptPulse(a, b, origin, r0, r1) {
  const x = a.x - origin.x, y = a.y - origin.y, dx = b.x - a.x, dy = b.y - a.y, dr = r1 - r0;
  const A = dx * dx + dy * dy - dr * dr, B = 2 * (x * dx + y * dy - r0 * dr), C = x * x + y * y - r0 * r0;
  if (Math.abs(A) < 1e-9) return Math.abs(B) < 1e-9 ? Math.abs(C) < 1e-7 : -C / B >= 0 && -C / B <= 1;
  const d = B * B - 4 * A * C;
  if (d < 0) return false;
  return [(-B - Math.sqrt(d)) / (2 * A), (-B + Math.sqrt(d)) / (2 * A)].some(t => t >= 0 && t <= 1);
}

function crossedPulse(previous, contact, center, from, to, pulseAt) {
  const span = to - from;
  if (span <= 0) return false;
  // Simulation ticks are short; bound catch-up for old saves/direct test callers.
  from = Math.max(from, to - SCANNER.period);
  const at = t => { const f = (t - (to - span)) / span; return { x: previous.x + (contact.x - previous.x) * f, y: previous.y + (contact.y - previous.y) * f }; };
  for (let start = from; start < to;) {
    const cycle = Math.floor((start - pulseAt) / SCANNER.period);
    const end = Math.min(to, pulseAt + (cycle + 1) * SCANNER.period);
    const radius = t => (t - pulseAt - cycle * SCANNER.period) / SCANNER.period * SCANNER.range;
    if (sweptPulse(at(start), at(end), center, radius(start), radius(end))) return true;
    start = end;
  }
  return false;
}

export function tickSensor(site, world, buildings, contacts, now) {
  const s = site.sensor ||= { mode: 'search', angle: 0, pulseAt: now, at: now, previous: [], marks: [] };
  s.marks = s.marks.filter(m => m.until > now);
  if (site.state !== 'hostile') { s.mode = 'silent'; s.targetId = null; s.previous = []; s.at = now; return; }
  const center = centerOf(site), dt = Math.min(.2, Math.max(0, now - s.at) / 1000);
  if (s.mode !== 'search') {
    const mark = s.marks.find(m => m.id === s.targetId);
    if (!mark) { s.mode = 'search'; s.targetId = null; s.pulseAt = now; }
    else {
      s.angle = turnTurret(s.angle, bearing(center, mark), dt, SCANNER.speed);
      const target = contacts.find(p => p.id === s.targetId);
      const d = target ? Math.hypot(target.x - center.x, target.y - center.y) : Infinity;
      const visible = target && d <= SCANNER.trackRange && Math.abs(angleDelta(s.angle, bearing(center, target))) <= SCANNER.halfAngle &&
        !beamRay(world, buildings, site, bearing(center, target), d).blocked;
      s.mode = visible ? 'tracking' : 'lost';
      if (visible) Object.assign(mark, target, { until: now + SCANNER.memory, seenAt: now });
    }
  }
  if (s.mode === 'search') {
    const hits = contacts.filter(p => {
      const previous = s.previous.find(q => q.id === p.id && q.targetId === p.targetId) || p;
      return crossedPulse(previous, p, center, Math.max(s.at, s.pulseAt), now, s.pulseAt);
    }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (hits.length) {
      const target = hits[0];
      s.targetId = target.id; s.mode = 'lost';
      s.marks = s.marks.filter(m => m.id !== target.id);
      s.marks.push({ ...target, until: now + SCANNER.memory, seenAt: now });
    }
  }
  s.previous = contacts.map(p => ({ ...p })); s.at = now;
}

export function detectionFor(sites, id, now) {
  return sites.flatMap(site => site.sensor?.marks || []).filter(m => m.id === id && m.until > now)
    .sort((a, b) => b.until - a.until)[0] || null;
}
