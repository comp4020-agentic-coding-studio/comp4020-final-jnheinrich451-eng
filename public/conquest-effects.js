import { ANTI_AIR } from './anti-air.js';
import { drawAntiAirBody } from './anti-air-effects.js';
import { LASER } from './laser-tower.js';
import { drawLaserBody } from './laser-tower-effects.js';
import { drawContaminatorBody } from './contaminator-effects.js';
// Pure client drawing: a small living silhouette, not server-simulated anatomy.
import { ALERT, siteCenter } from './conquest.js';
import { SCANNER, beamRay } from './sensors.js';
import { MORTAR } from './mortar.js';
import { drawMortarBody } from './mortar-effects.js';
import { sectorRadius, territoryVisible } from './sector-defense.js';
import { MODIFIER, isAlertSite } from './modifier.js';
import { drawModifierBody } from './modifier-effects.js';
import { settlements } from './settlement.js';
const TAU = Math.PI * 2;
function oval(c, x, y, rx, ry, color, angle = 0) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, TAU); c.fill();
}
export function drawConquest(c, sites, tile, zoom, time, reduced, world, buildings = [], view = {}) {
  const overview = territoryVisible(zoom, view.orbital);
  for (const group of settlements(sites)) {
    const dead = group.state === 'conquered';
    c.save();
    // Cosmetic root connections make the compound readable without new entities.
    c.strokeStyle = dead ? '#59454b55' : '#75485288'; c.lineWidth = .18 * tile;
    for (const member of group.members.filter(Boolean)) {
      c.beginPath(); c.moveTo(group.x * tile, group.y * tile);
      c.quadraticCurveTo((member.x + 3) * tile, group.y * tile, (member.x + 1.5) * tile, (member.y + 1.5) * tile); c.stroke();
    }
    if (overview) {
      c.fillStyle = dead ? '#57b8b512' : '#a52b3620'; c.strokeStyle = dead ? '#8bcec3aa' : '#e39188aa';
      c.lineWidth = 1.5 / zoom; c.setLineDash([8 / zoom, 6 / zoom]);
      c.beginPath(); c.arc(group.x * tile, group.y * tile, group.radius * tile, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = dead ? '#b0e6df' : '#f9c0ae'; c.textAlign = 'center'; c.font = `${12 / zoom}px monospace`;
      c.fillText(`${group.name.toUpperCase()} / ${group.cleared}/3${dead ? ' SECURED' : ''}`, group.x * tile, (group.y - group.radius) * tile - 10 / zoom);
    }
    c.restore();
  }
  for (const site of sites) {
    const center = siteCenter(site), dead = site.state === 'conquered';
    const antiAir = site.kind === 'anti-air';
    const laser = site.kind === 'laser', mortar = site.kind === 'mortar', modifier = site.kind === 'modifier', region = sectorRadius(site);
    const phase = reduced || dead ? 0 : time / 1000;
    c.save(); c.translate(center.x * tile, center.y * tile);
    if (!dead) {
      if (overview && !site.settlement) {
        c.fillStyle = '#a52b3620'; c.strokeStyle = '#ce6e6888'; c.lineWidth = 1 / zoom;
        c.setLineDash([6 / zoom, 6 / zoom]); c.beginPath(); c.arc(0, 0, region * tile, 0, TAU); c.fill(); c.stroke(); c.setLineDash([]);
      } else if (!overview && view.inspectedId === site.id) {
        c.strokeStyle = '#efcc9688'; c.lineWidth = 1 / zoom; c.setLineDash([3 / zoom, 5 / zoom]);
        for (const range of antiAir ? [ANTI_AIR.range] : laser ? [LASER.acquire] : mortar ? [MORTAR.minRange, MORTAR.range] : modifier ? [MODIFIER.radius] : [SCANNER.range]) {
          c.beginPath(); c.arc(0, 0, range * tile, 0, TAU); c.stroke();
        }
        c.setLineDash([]); c.font = `${10 / zoom}px monospace`; c.textAlign = 'center';
        c.fillStyle = '#efcc96'; c.fillText(antiAir ? 'AIRSPACE / FLAK RANGE' : laser ? 'ACQUISITION / TRACKS TO 40' : mortar ? 'MORTAR RANGE' : modifier ? 'ALTERED TERRAIN' : 'SEARCH RANGE', 0, -(antiAir ? ANTI_AIR.range : laser ? LASER.acquire : mortar ? MORTAR.range : modifier ? MODIFIER.radius : SCANNER.range) * tile - 5 / zoom);
      }
      const s = isAlertSite(site) && site.sensor;
      if (s?.mode === 'search') {
        const radius = reduced ? SCANNER.range : ((time - s.pulseAt) % SCANNER.period) / SCANNER.period * SCANNER.range;
        c.strokeStyle = '#f2bc77aa'; c.lineWidth = 2 / zoom;
        c.beginPath(); c.arc(0, 0, radius * tile, 0, TAU); c.stroke();
      } else if (s && world) {
        c.beginPath(); c.moveTo(0, 0);
        for (let i = 0; i <= 16; i++) {
          const angle = s.angle - SCANNER.halfAngle + i / 16 * SCANNER.halfAngle * 2;
          const p = beamRay(world, buildings, site, angle);
          c.lineTo((p.x - center.x) * tile, (p.y - center.y) * tile);
        }
        c.closePath(); c.fillStyle = s.mode === 'tracking' ? '#ef647c36' : '#efba7330';
        c.strokeStyle = s.mode === 'tracking' ? '#ff8fa7bb' : '#efba7380'; c.fill(); c.stroke();
      }
    }
    c.save(); c.scale(tile, tile);
    oval(c, .15, .2, 2.15, 1.8, '#30202752');
    oval(c, 0, .05, 1.65, 1.4, dead ? '#49364288' : '#62405766');
    // Thick rooted tendrils with occasional joint swellings and a small twitch.
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12, reach = 1.85 + .3 * Math.sin(i * 4), twitch = Math.sin(phase * 1.7 + i * 3) * .08;
      c.save(); c.rotate(a); c.lineCap = 'round';
      c.beginPath(); c.moveTo(.6, 0); c.bezierCurveTo(1.1, -.3, reach - .2, .4 + twitch, reach, twitch);
      c.strokeStyle = dead ? '#3d3038' : '#482d35'; c.lineWidth = .2; c.stroke();
      c.strokeStyle = dead ? '#63504c' : '#96634e'; c.lineWidth = .065; c.stroke();
      oval(c, 1.1, .01, .16, .1, dead ? '#554147' : '#9d5c68'); c.restore();
    }
    if (antiAir) drawAntiAirBody(c, site);
    else if (laser) drawLaserBody(c, site, time, reduced);
    else if (site.kind === 'contaminator') drawContaminatorBody(c, site);
    else if (modifier) drawModifierBody(c, site, time, reduced);
    else if (mortar) drawMortarBody(c, site, time, reduced);
    else if (dead) {
      oval(c, 0, .03, .95, .72, '#292630');
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8; oval(c, Math.cos(a) * .85, Math.sin(a) * .72, .4, .17, i % 2 ? '#60443d' : '#47343a', a);
      }
      oval(c, -.2, .2, .42, .16, '#70445c77');
    } else {
      const pulse = 1 + Math.sin(phase * (site.alarm ? 5 : 1.9)) * .035;
      oval(c, 0, 0, 1.25, 1.2, '#34202b');
      // Overlapping radial armor petals; light faces the same upper-left as terrain.
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        c.save(); c.rotate(a);
        const g = c.createLinearGradient(.4, -.3, 1.35, .3); g.addColorStop(0, '#663540'); g.addColorStop(.55, '#a25b4b'); g.addColorStop(1, '#482c31');
        c.beginPath(); c.moveTo(.3, -.2); c.quadraticCurveTo(.8, -.6, 1.32, -.19); c.lineTo(1.16, .3); c.quadraticCurveTo(.7, .5, .3, .2); c.closePath(); c.fillStyle = g; c.fill();
        c.strokeStyle = '#301e29'; c.lineWidth = .055; c.stroke();
        c.beginPath(); c.moveTo(.67, -.27); c.lineTo(1.14, -.2); c.strokeStyle = '#bf89705c'; c.lineWidth = .035; c.stroke(); c.restore();
      }
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4, r = .48 + (i % 2) * .16;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        oval(c, x, y, .22 * pulse, .3 * pulse, '#874861', a);
        oval(c, x - .05, y - .07, .065, .11, '#d098a46e', a);
      }
      const inner = c.createRadialGradient(-.12, -.18, .02, 0, 0, .58);
      inner.addColorStop(0, site.alarm ? '#d197ac' : '#af7c8d'); inner.addColorStop(.4, '#8c4665'); inner.addColorStop(1, '#3c233b');
      oval(c, 0, 0, .47 * pulse, .57 * pulse, inner);
      // Asymmetric slit, fine veins and pinhole pores suggest invasive biology.
      oval(c, .05, -.01, .065, .38 * pulse, '#241c2b', .22);
      for (let i = 0; i < 7; i++) oval(c, Math.sin(i * 3) * .8, Math.cos(i * 2) * .9, .035, .045, '#211e28');
      if (site.hp < site.maxHp * .65) {
        c.beginPath(); c.moveTo(-1.05, -.1); c.lineTo(-.55, .1); c.lineTo(-.82, .33); c.lineTo(-.38, .48);
        c.strokeStyle = '#c084ae'; c.lineWidth = .06; c.stroke();
      }
      if (site.alarm) { c.strokeStyle = '#d987a2'; c.lineWidth = .035; c.beginPath(); c.arc(0, 0, 1.5 + (reduced ? .1 : (phase % 1) * .45), 0, TAU); c.stroke(); }
      if (time - site.hitAt < 350) { c.globalAlpha = .18; oval(c, 0, 0, 1.25, 1.2, '#ffe8d2'); c.globalAlpha = 1; }
    }
    c.restore();
    const font = 10 / zoom, labelY = -1.9 * tile - font;
    c.font = `600 ${font}px monospace`; c.textAlign = 'center';
    const blocked = !dead && time - site.blockedAt < 1800;
    const label = antiAir ? (dead ? 'CONQUERED / AIRSPACE CLEAR' : 'SPORE FLAK / ' + (site.aa?.phase || 'watching').toUpperCase()) : laser ? (dead ? 'CONQUERED / LANCE SILENCED' : 'LANCE TOWER / ' + (site.laser?.phase || 'watching').toUpperCase()) : site.kind === 'contaminator' ? (dead ? 'CONQUERED / EMITTER SILENCED' : 'AIR CONTAMINATOR / USE HE') : dead ? (mortar ? 'CONQUERED / MORTAR SILENCED' : modifier ? 'CONQUERED / BLIGHT CLEARED' : 'CONQUERED / CROWN SILENCED') : blocked ? 'ARMORED ORGAN / USE HE' : modifier ? 'BLIGHT ROOT / USE HE' : mortar ? (site.mortar?.charge ? 'BILE MORTAR / INCOMING ACID' : 'BILE MORTAR / USE HE') : site.sensor?.mode === 'tracking' ? 'TRACKING / DEFENDERS ALERTED' : site.sensor?.mode === 'lost' ? 'CONTACT LOST / INVESTIGATING' : 'ALERT STATION / SCANNING';
    const w = c.measureText(label).width;
    c.fillStyle = '#132523e8'; c.fillRect(-w / 2 - font * .5, labelY - font, w + font, font * 1.5);
    c.fillStyle = dead ? '#99d5cc' : '#efb1a0'; c.fillText(label, 0, labelY);
    if (!dead) {
      c.fillStyle = '#241e2c'; c.fillRect(-tile, -1.65 * tile, tile * 2, 4 / zoom);
      c.fillStyle = '#c27889'; c.fillRect(-tile, -1.65 * tile, tile * 2 * site.hp / site.maxHp, 4 / zoom);
    }
    c.restore();
    if (site.pending) for (const p of site.pending.points) {
      c.save(); c.strokeStyle = '#e6a088'; c.fillStyle = '#3b263570'; c.lineWidth = 2 / zoom;
      c.beginPath(); c.arc(p.x * tile, p.y * tile, tile * .65, 0, TAU); c.fill(); c.stroke();
      const progress = Math.max(0, Math.min(1, 1 - (site.pending.at - time) / ALERT.warning));
      c.strokeStyle = '#231924'; c.lineWidth = 3 / zoom;
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5;
        c.beginPath(); c.moveTo(p.x * tile, p.y * tile);
        c.lineTo((p.x + Math.cos(a + .3) * progress * .35) * tile, (p.y + Math.sin(a + .3) * progress * .35) * tile);
        c.lineTo((p.x + Math.cos(a) * progress * .7) * tile, (p.y + Math.sin(a) * progress * .7) * tile); c.stroke();
      }
      c.font = `${10 / zoom}px monospace`; c.textAlign = 'center'; c.fillStyle = '#f5c8a5'; c.fillText('INCOMING', p.x * tile, (p.y - .9) * tile); c.restore();
    }
  }
}
export function drawConquestMap(c, sites, sx, sy) {
  for (const group of settlements(sites)) {
    c.fillStyle = group.state === 'conquered' ? '#8bcec333' : '#e3787638';
    c.beginPath(); c.ellipse(group.x * sx, group.y * sy, group.radius * sx, group.radius * sy, 0, 0, TAU); c.fill();
  }
  for (const site of sites) {
    const p = siteCenter(site), dead = site.state === 'conquered';
    const region = sectorRadius(site);
    c.fillStyle = dead ? '#8bcec3' : '#e37876';
    if (!dead && !site.settlement) { c.globalAlpha = .22; c.beginPath(); c.ellipse(p.x * sx, p.y * sy, region * sx, region * sy, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
    c.strokeStyle = dead ? '#8bcec3' : '#f2aca0'; c.lineWidth = 1.5;
    c.strokeRect(p.x * sx - 3, p.y * sy - 3, 6, 6);
    if (site.kind === 'mortar') { c.beginPath(); c.moveTo(p.x * sx - 2, p.y * sy + 2); c.lineTo(p.x * sx + 3, p.y * sy - 4); c.stroke(); }
    if (site.kind === 'modifier') { c.beginPath(); c.arc(p.x * sx, p.y * sy, 2, 0, TAU); c.stroke(); }
    if (dead) { c.beginPath(); c.moveTo(p.x * sx - 2, p.y * sy); c.lineTo(p.x * sx, p.y * sy + 2); c.lineTo(p.x * sx + 4, p.y * sy - 4); c.stroke(); }
  }
}
