import { turnTurret, angleDelta } from './turret.js';
import { raycast } from './raycast.js';
import { operational, hullHealth, hurtVehicle } from './vehicle.js';
import { hurtRobot } from './survival.js';

export const LASER = Object.freeze({ hp: 600, guards: 2, region: 11, acquire: 8,
  range: 40, speed: Math.PI / 6, charge: 1, burst: 2, cooldown: 5, memory: 2,
  trackingSpeed: Math.PI / 45,
  robotDps: 100 / 3, tankDps: 200 / 9 });
const bearing = (a, b) => Math.atan2(b.x - a.x, a.y - b.y);

// All timers are simulation seconds, checkpointed with the site. No wall timers,
// particles or extra enemies are needed on the server.
export function tickLasers(world, buildings, robots, dt, emit = event => {}) {
  const tanks = (world.tanks || []).filter(operational);
  const targets = tanks.map(v => ({ id: 'vehicle:' + v.id, x: v.x, y: v.y, hp: hullHealth(v), vehicle: v }));
  for (const p of robots) if (p.life === 'active' && p.health > 0 && !p.deploying && !(p.shield > 0) &&
      !['orbital', 'rover', 'ship', 'aircraft'].includes(p.body) && !tanks.some(v => v.occupant === p.id)) {
    targets.push({ id: p.id, x: p.x, y: p.y, hp: p.health, robot: p });
  }
  let changed = false;
  for (const site of world.sites || []) {
    if (site.kind !== 'laser') continue;
    changed ||= !site.laser;
    const m = site.laser ||= { angle: 0, phase: 'watching', remaining: 0, targetId: null, lost: 0, beam: null, hitIds: [] };
    // Older saves tracked a variable-length endpoint. Keep their barrel and
    // timers, but discard that superseded state without resetting the encounter.
    if ('chase' in m) { delete m.chase; changed = true; }
    if (site.state !== 'hostile') {
      changed ||= m.phase !== 'silent'; m.phase = 'silent'; m.targetId = null; m.beam = null; continue;
    }
    const center = { x: site.x + 1.5, y: site.y + 1.5 };
    const scene = { ...world, sites: world.sites.filter(s => s.id !== site.id) };
    const trace = (angle, range, bodies = []) => raycast(scene, buildings, center, Math.sin(angle), -Math.cos(angle), range, bodies, .42);
    const distance = p => Math.hypot(p.x - center.x, p.y - center.y);
    const visible = p => !trace(bearing(center, p), distance(p)).blocked;
    let target = targets.find(p => p.id === m.targetId && p.hp > 0 && distance(p) <= LASER.range);
    if (target && visible(target)) { m.last = { x: target.x, y: target.y }; m.lost = 0; }
    else if (target) { m.lost += dt; if (m.lost >= LASER.memory) target = null; }
    if (!target) {
      if (m.phase === 'firing' || m.phase === 'charging') { m.phase = 'cooling'; m.remaining = LASER.cooldown; }
      target = targets.filter(p => p.hp > 0 && distance(p) <= LASER.acquire && visible(p))
        .sort((a, b) => distance(a) - distance(b) || String(a.id).localeCompare(String(b.id)))[0];
      if (target) { m.last = { x: target.x, y: target.y }; m.lost = 0; }
    }
    changed ||= m.targetId !== (target?.id || null);
    m.targetId = target?.id || null; m.beam = null;
    if (target && !['charging', 'firing'].includes(m.phase)) {
      const before = m.angle;
      m.angle = turnTurret(m.angle, bearing(center, m.last), dt, LASER.speed);
      changed ||= m.angle !== before;
    }
    if (m.phase === 'cooling') {
      m.remaining = (m.remaining - dt < 1e-8 ? 0 : m.remaining - dt); changed = true;
      if (!m.remaining) m.phase = 'watching';
      continue;
    }
    if (!target) continue;
    changed = true;
    if (m.phase === 'watching') {
      if (!m.lost && Math.abs(angleDelta(m.angle, bearing(center, m.last))) < .04) {
        m.phase = 'charging'; m.remaining = LASER.charge;
        // Hold this bearing throughout charge. A sideways runner gets a head start.
      }
    } else if (m.phase === 'charging') {
      m.remaining = (m.remaining - dt < 1e-8 ? 0 : m.remaining - dt);
      if (!m.remaining) {
        m.phase = 'firing'; m.remaining = LASER.burst; m.hitIds = [];
        emit({ event: 'enemy.weapon.launched', kind: 'system', sourceId: site.id, weapon: 'LASER', x: center.x, y: center.y });
      }
    } else if (m.phase === 'firing') {
      const exposure = Math.min(dt, m.remaining);
      // Only the angle pursues the contact. Four degrees/second sweeps at
      // about 2.8 tiles/second even at the far end of the 40-tile beam.
      m.angle = turnTurret(m.angle, bearing(center, m.last), exposure, LASER.trackingSpeed);
      const ray = trace(m.angle, LASER.range, targets.filter(p => p.hp > 0));
      m.beam = { x: ray.x, y: ray.y };
      if (ray.enemy) {
        const p = ray.enemy, body = p.vehicle || p.robot;
        const hurt = p.vehicle ? hurtVehicle : hurtRobot;
        if (hurt(body, exposure * (p.vehicle ? LASER.tankDps : LASER.robotDps))) {
          p.hp = body.health;
          if (!m.hitIds.includes(p.id)) {
            m.hitIds.push(p.id);
            emit({ event: 'enemy.weapon.hit', kind: 'system', sourceId: site.id, targetId: p.id, weapon: 'LASER', hp: body.health });
          }
        }
      }
      m.remaining = (m.remaining - dt < 1e-8 ? 0 : m.remaining - dt);
      if (!m.remaining) { m.phase = 'cooling'; m.remaining = LASER.cooldown; m.beam = null; }
    }
  }
  return changed;
}
