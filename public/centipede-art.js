// Draw the server-owned body chain. Legs, shadows and vents are cosmetic; the
// plated body stays inside the same eight circles used by weapon collision.
import { CENTIPEDE } from './centipede.js';

const bodyOf = enemy => enemy.body?.length ? enemy.body.slice(0, CENTIPEDE.segments) : [{ x: enemy.x, y: enemy.y, angle: enemy.angle || 0 }];
const walking = enemy => ['hunting', 'investigating', 'returning', 'patrolling'].includes(enemy.behavior) && enemy.hp > 0;

export function drawCentipede(c, enemy, time, tile, reduced = false, hit = 0, dead = false) {
  const body = bodyOf(enemy), radius = CENTIPEDE.radius * tile;
  const step = reduced || dead || !walking(enemy) ? 0 : time * 4;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // A shallow contact shadow gives the plated chain weight without suggesting
  // that the creature is airborne or displacing its aiming surface.
  c.fillStyle = '#25152538';
  for (const part of body) { c.beginPath(); c.ellipse(part.x * tile + radius * .2, part.y * tile + radius * .24, radius * 1.17, radius * 1.12, part.angle || 0, 0, Math.PI * 2); c.fill(); }
  for (let i = body.length - 1; i >= 0; i--) {
    const part = body[i], head = i === 0, tail = i === body.length - 1;
    const flex = step ? Math.sin(step - i * .85) : 0;
    c.save(); c.translate(part.x * tile, part.y * tile); c.rotate(head && Number.isFinite(enemy.angle) ? enemy.angle : part.angle || 0);
    // Paired legs alternate along the body. Their narrow tips are decorative,
    // like crawler legs, rather than extra hit boxes or independent entities.
    for (const side of [-1, 1]) for (const row of [-1, 1]) {
      const stride = dead ? -.18 : flex * side * .12;
      c.strokeStyle = dead ? '#452b37' : hit ? '#ebb6a6' : '#49243d'; c.lineWidth = radius * .2;
      c.beginPath(); c.moveTo(side * radius * .62, row * radius * .35);
      c.lineTo(side * radius * 1.25, radius * (row * .52 + stride));
      c.lineTo(side * radius * (dead ? .95 : 1.45), radius * (row * .8 + stride)); c.stroke();
      c.strokeStyle = dead ? '#80634f' : '#bf956b'; c.lineWidth = radius * .07;
      c.beginPath(); c.moveTo(side * radius * .83, row * radius * .42);
      c.lineTo(side * radius * 1.25, radius * (row * .52 + stride)); c.stroke();
    }
    c.fillStyle = dead ? '#543543' : hit ? '#e7a7a4' : '#713448';
    c.strokeStyle = dead ? '#33242f' : '#352237'; c.lineWidth = radius * .12;
    c.beginPath(); c.ellipse(0, 0, radius * .92, radius * .98, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    // Overlapping pale armor ridges reveal the rounded segment silhouette.
    c.fillStyle = dead ? '#79634b' : hit ? '#ffe6b0' : i % 2 ? '#bea16a' : '#cfb17a';
    c.beginPath(); c.moveTo(-radius * .8, radius * .08); c.quadraticCurveTo(-radius * .72, -radius * .74, 0, -radius * .9);
    c.quadraticCurveTo(radius * .72, -radius * .74, radius * .8, radius * .08);
    c.lineTo(radius * .54, radius * .42); c.quadraticCurveTo(0, radius * .1, -radius * .54, radius * .42); c.closePath(); c.fill();
    c.fillStyle = dead ? '#4d3741' : '#67334c';
    c.beginPath(); c.moveTo(-radius * .56, -radius * .05); c.quadraticCurveTo(0, -radius * .6, radius * .56, -radius * .05);
    c.lineTo(radius * .4, radius * .22); c.quadraticCurveTo(0, radius * .02, -radius * .4, radius * .22); c.closePath(); c.fill();
    c.strokeStyle = dead ? '#9a7c58' : '#f0d390'; c.lineWidth = radius * .055;
    c.beginPath(); c.moveTo(-radius * .75, -radius * .07); c.quadraticCurveTo(0, -radius * 1.06, radius * .75, -radius * .07); c.stroke();
    if (head) {
      // Forward mandibles and two eye clusters make the siege direction clear.
      for (const side of [-1, 1]) {
        c.fillStyle = dead ? '#92735b' : '#ddc18b'; c.strokeStyle = '#492938'; c.lineWidth = radius * .07;
        c.beginPath(); c.moveTo(side * radius * .48, -radius * .45); c.lineTo(side * radius * .7, -radius * 1.22);
        c.lineTo(side * radius * .2, -radius * 1.42); c.lineTo(side * radius * .38, -radius * 1.02); c.lineTo(side * radius * .18, -radius * .6); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = dead ? '#38232c' : '#ffca73'; c.beginPath(); c.ellipse(side * radius * .48, -radius * .35, radius * .16, radius * .11, side * -.3, 0, Math.PI * 2); c.fill();
        if (!dead) { c.fillStyle = '#5c2239'; c.beginPath(); c.arc(side * radius * .49, -radius * .38, radius * .055, 0, Math.PI * 2); c.fill(); }
      }
      c.fillStyle = dead ? '#38232c' : '#391e32'; c.beginPath(); c.moveTo(-radius * .2, -radius * .57); c.lineTo(0, -radius * .94); c.lineTo(radius * .2, -radius * .57); c.closePath(); c.fill();
    } else if (!tail) {
      // Brood vents remain part of the back; the warning renderer below marks
      // the actual saved offspring positions before anything can emerge.
      c.fillStyle = dead ? '#33262e' : '#391f36'; c.beginPath(); c.ellipse(0, radius * .5, radius * .27, radius * .19, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = dead ? '#70533b' : '#dc9167'; c.lineWidth = radius * .065; c.stroke();
      c.fillStyle = dead ? '#644636' : '#b96863'; c.beginPath(); c.ellipse(0, radius * .51, radius * .15, radius * .06, 0, 0, Math.PI * 2); c.fill();
    }
    if (dead) { c.strokeStyle = '#2e232bcc'; c.lineWidth = radius * .07; c.beginPath(); c.moveTo(-radius * .3, -radius * .76); c.lineTo(radius * .1, -radius * .25); c.lineTo(-radius * .07, radius * .1); c.lineTo(radius * .4, radius * .5); c.stroke(); }
    c.restore();
  }
  c.restore();
}

export function drawCentipedeStatus(c, enemy, now, tile, zoom) {
  const x = enemy.x * tile, y = enemy.y * tile - tile * .86, width = 74 / zoom;
  c.save(); c.fillStyle = '#291d2bea'; c.fillRect(x - width / 2, y, width, 5 / zoom);
  c.fillStyle = '#e6bd73'; c.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, enemy.hp / (enemy.maxHp || 2400))), 5 / zoom);
  if (zoom >= .35) {
    const blocked = enemy.armorHitAt !== undefined && now - enemy.armorHitAt < 600;
    c.textAlign = 'center'; c.font = `${10 / zoom}px monospace`; c.fillStyle = blocked ? '#ffce89' : '#f3d89c';
    c.fillText(blocked ? 'ARMORED / HE · MAG · MAC' : 'SIEGE CENTIPEDE', x, y - 5 / zoom);
  }
  c.restore();
}

export function drawCentipedeWarnings(c, view, now, tile, zoom, reduced = false) {
  for (const warning of view?.warnings || []) {
    const giant = warning.kind === 'centipede', seconds = Math.max(0, Math.ceil((warning.at - now) / 1000));
    const progress = Math.max(0, Math.min(1, 1 - (warning.at - now) / Math.max(1, warning.windup)));
    c.save(); c.strokeStyle = '#f58c94'; c.fillStyle = '#a7354c24'; c.lineWidth = 1.5 / zoom;
    if (giant && warning.trail?.length) {
      c.strokeStyle = '#ed8f7944'; c.lineWidth = CENTIPEDE.radius * tile * 2; c.lineCap = 'round';
      c.beginPath(); warning.trail.forEach((p, i) => i ? c.lineTo(p.x * tile, p.y * tile) : c.moveTo(p.x * tile, p.y * tile)); c.stroke();
      c.strokeStyle = '#e79a7a'; c.lineWidth = 1.5 / zoom;
    }
    for (const point of warning.points || []) {
      const x = point.x * tile, y = point.y * tile, radius = tile * (giant ? .76 : .5);
      c.setLineDash([6 / zoom, 4 / zoom]); c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill(); c.stroke(); c.setLineDash([]);
      c.lineWidth = 3 / zoom; c.beginPath(); c.arc(x, y, radius + 4 / zoom, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); c.stroke(); c.lineWidth = 1.5 / zoom;
      c.beginPath(); c.moveTo(x - 5 / zoom, y); c.lineTo(x + 5 / zoom, y); c.moveTo(x, y - 5 / zoom); c.lineTo(x, y + 5 / zoom); c.stroke();
    }
    if (zoom >= .3) {
      c.font = `${11 / zoom}px monospace`; c.textAlign = 'center'; c.fillStyle = '#ffb7a4';
      c.fillText((giant ? 'BLIGHT ROOT / GIANT EMERGING ' : 'BROOD HATCHING ') + seconds + 's', warning.x * tile, warning.y * tile - tile * 1.1);
    }
    c.restore();
  }
}
