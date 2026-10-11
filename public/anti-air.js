import { airborne, hurtAircraft } from './aircraft.js';
import { turnTurret } from './turret.js';

export const ANTI_AIR = Object.freeze({ hp: 600, guards: 2, region: 11, range: 24,
  warning: 900, flight: 1400, interval: 300, count: 3, cooldown: 6000,
  radius: 1.8, damage: 40, maxShells: 12, speed: Math.PI / 2 });

// Predict once at acquisition. Turning or changing speed escapes the fixed burst.
// Air sensing ignores ground cover; parked aircraft and ground bodies are immune.
export function tickAntiAir(world, shells, now, dt, nextId, emit = event => {}) {
  const planes = (world.airbases || []).map(b => b.aircraft).filter(airborne);
  let changed = shells.length > 0;
  for (const shell of shells) if (!shell.impacted && now >= shell.landAt) {
    shell.impacted = true;
    for (const p of planes) if (Math.hypot(p.x - shell.x, p.y - shell.y) <= ANTI_AIR.radius && hurtAircraft(p, ANTI_AIR.damage)) {
      emit({ event: 'enemy.weapon.hit', kind: 'system', sourceId: shell.sourceId,
        projectileId: shell.id, targetId: p.id, weapon: 'FLAK', hp: p.health });
    }
  }
  for (let i = shells.length - 1; i >= 0; i--) if (now >= shells[i].landAt + 900) shells.splice(i, 1);
  for (const site of world.sites || []) {
    if (site.kind !== 'anti-air') continue;
    const m = site.aa ||= { angle: 0, phase: 'watching', nextShot: 0, targetId: null, queue: [] };
    if (site.state !== 'hostile') {
      changed ||= m.phase !== 'silent'; m.phase = 'silent'; m.queue = []; m.targetId = null; continue;
    }
    const center = { x: site.x + 1.5, y: site.y + 1.5 };
    if (m.queue.length) {
      changed = true;
      const aim = m.queue[0];
      m.angle = turnTurret(m.angle, Math.atan2(aim.x - center.x, center.y - aim.y), dt, ANTI_AIR.speed);
      while (m.queue.length && now >= m.queue[0].launchAt) {
        const point = m.queue.shift();
        // Capacity was reserved when the burst was accepted, including other queues.
        const shell = { ...point, id: nextId(), sourceId: site.id, fromX: center.x,
          fromY: center.y, at: point.launchAt, impacted: false };
        shells.push(shell); m.phase = 'firing';
        emit({ event: 'enemy.weapon.launched', kind: 'system', sourceId: site.id,
          projectileId: shell.id, weapon: 'FLAK', x: shell.x, y: shell.y });
      }
      if (!m.queue.length) { m.phase = 'cooling'; m.nextShot = now + ANTI_AIR.cooldown; m.targetId = null; }
      continue;
    }
    if (now < m.nextShot) continue;
    changed ||= m.phase !== 'watching'; m.phase = 'watching';
    const target = planes.filter(p => airborne(p) && Math.hypot(p.x - center.x, p.y - center.y) <= ANTI_AIR.range)
      .sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y) || a.id.localeCompare(b.id))[0];
    const reserved = shells.length + (world.sites || []).reduce((n, s) => n + (s.aa?.queue.length || 0), 0);
    if (!target || reserved + ANTI_AIR.count > ANTI_AIR.maxShells) continue;
    m.queue = Array.from({ length: ANTI_AIR.count }, (_, i) => {
      const launchAt = now + ANTI_AIR.warning + i * ANTI_AIR.interval, landAt = launchAt + ANTI_AIR.flight;
      const lead = (landAt - now) / 1000 * target.speed;
      return { x: Math.max(.5, Math.min(world.width - .5, target.x + Math.sin(target.angle) * lead)),
        y: Math.max(.5, Math.min(world.height - .5, target.y - Math.cos(target.angle) * lead)),
        launchAt, landAt, targetId: target.id };
    });
    m.targetId = target.id; m.phase = 'charging'; changed = true;
  }
  return changed;
}
