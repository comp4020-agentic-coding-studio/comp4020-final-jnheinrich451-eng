import { angleDelta, turnTurret } from './turret.js';
import { operational, hullDistance, hurtVehicle } from './vehicle.js';
import { hurtRobot } from './survival.js';

export const MORTAR = Object.freeze({ hp: 600, guards: 2, region: 10, minRange: 4,
  range: 22, speed: Math.PI / 3, tolerance: Math.PI / 90, windup: 800,
  flight: 2200, reload: 6000, radius: 2.4, damage: 40, edgeDamage: 12, maxShells: 8 });
export const acidDamage = distance => distance > MORTAR.radius ? 0 : Math.round(MORTAR.damage -
  (MORTAR.damage - MORTAR.edgeDamage) * Math.max(0, distance - .6) / (MORTAR.radius - .6));

// Server simulation only. One fixed point, one radial damage application per hull.
export function tickMortars(world, robots, shells, now, dt, nextId, emit = event => {}) {
  const tanks = (world.tanks || []).filter(operational);
  const foot = robots.filter(p => p.life === 'active' && p.health > 0 && !p.deploying && !(p.shield > 0) &&
    !['orbital', 'rover', 'ship', 'aircraft'].includes(p.body) && !tanks.some(v => v.occupant === p.id));
  const targets = foot.map(p => ({ id: p.id, x: p.x, y: p.y })).concat(tanks.map(v => ({ id: 'vehicle:' + v.id, x: v.x, y: v.y })));
  let changed = shells.length > 0;
  for (const shell of shells) if (!shell.impacted && now >= shell.landAt) {
    shell.impacted = true;
    for (const p of foot) {
      const damage = acidDamage(Math.hypot(p.x - shell.x, p.y - shell.y));
      if (damage && hurtRobot(p, damage)) emit({ event: 'enemy.weapon.hit', kind: 'system', sourceId: shell.sourceId, projectileId: shell.id, targetId: p.id, weapon: 'ACID', hp: p.health });
    }
    for (const v of tanks) {
      const damage = acidDamage(hullDistance(v, shell));
      if (damage && hurtVehicle(v, damage)) emit({ event: 'enemy.weapon.hit', kind: 'system', sourceId: shell.sourceId, projectileId: shell.id, targetId: v.id, weapon: 'ACID', hp: v.health });
    }
  }
  for (let i = shells.length - 1; i >= 0; i--) if (now >= shells[i].landAt + 900) shells.splice(i, 1);
  for (const site of world.sites || []) {
    if (site.kind !== 'mortar') continue;
    const m = site.mortar ||= { angle: 0, nextShot: 0, targetId: null, charge: null };
    if (site.state !== 'hostile') { if (m.charge || m.targetId) changed = true; m.charge = null; m.targetId = null; continue; }
    const center = { x: site.x + 1.5, y: site.y + 1.5 };
    if (m.charge) {
      changed = true;
      if (now >= m.charge.fireAt) {
        if (shells.filter(s => !s.impacted).length < MORTAR.maxShells) {
          const shell = { id: nextId(), sourceId: site.id, fromX: center.x, fromY: center.y,
            x: m.charge.x, y: m.charge.y, at: now, landAt: now + MORTAR.flight, impacted: false };
          shells.push(shell); m.firedAt = now;
          emit({ event: 'enemy.weapon.launched', kind: 'system', sourceId: site.id, projectileId: shell.id, weapon: 'ACID', x: shell.x, y: shell.y });
        }
        m.charge = null; m.nextShot = now + MORTAR.reload;
      }
      continue;
    }
    const distance = p => Math.hypot(p.x - center.x, p.y - center.y);
    const candidates = targets.filter(p => distance(p) >= MORTAR.minRange && distance(p) <= MORTAR.range);
    const target = candidates.find(p => p.id === m.targetId) || candidates.sort((a, b) => distance(a) - distance(b) || String(a.id).localeCompare(String(b.id)))[0];
    if (m.targetId !== (target?.id || null)) changed = true;
    m.targetId = target?.id || null;
    if (!target) {
      const report = site.defenseReport;
      if (report?.until > now && distance(report) <= MORTAR.range) {
        const before = m.angle;
        m.angle = turnTurret(m.angle, Math.atan2(report.x - center.x, center.y - report.y), dt, MORTAR.speed);
        changed ||= before !== m.angle;
      }
      continue;
    }
    const aim = Math.atan2(target.x - center.x, center.y - target.y);
    const before = m.angle; m.angle = turnTurret(m.angle, aim, dt, MORTAR.speed);
    changed ||= before !== m.angle;
    if (now >= m.nextShot && Math.abs(angleDelta(m.angle, aim)) <= MORTAR.tolerance && shells.filter(s => !s.impacted).length < MORTAR.maxShells) {
      m.charge = { x: target.x, y: target.y, at: now, fireAt: now + MORTAR.windup }; changed = true;
    }
  }
  return changed;
}
