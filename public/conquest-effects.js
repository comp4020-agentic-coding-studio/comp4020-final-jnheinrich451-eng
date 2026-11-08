import { ANTI_AIR } from './anti-air.js';
import { LABEL_ZOOM } from './map-labels.js';
import {AQUATIC} from './aquatic-profile.js';
import { LASER } from './laser-tower.js';
// Pure client drawing: a small living silhouette, not server-simulated anatomy.
import { ALERT, siteCenter } from './conquest.js';
import { SCANNER, beamRay } from './sensors.js';
import { MORTAR } from './mortar.js';
import { sectorRadius, territoryVisible } from './sector-defense.js';
import { MODIFIER, isAlertSite } from './modifier.js';
import { settlements } from './settlement.js';
import { drawFacility } from './facility-art.js';
const TAU = Math.PI * 2;
// True unless the current origin is more than radius device pixels off the canvas.
function onScreen(c, radius) {
  if (typeof c.getTransform !== 'function' || !c.canvas) return true;
  const m = c.getTransform(), r = radius * Math.hypot(m.a, m.b);
  return m.e > -r && m.f > -r && m.e < c.canvas.width + r && m.f < c.canvas.height + r;
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
      c.fillText(`${group.name.toUpperCase()} / ${group.cleared}/${group.requiredIds.length}${dead ? ' SECURED' : ''}`, group.x * tile, (group.y - group.radius) * tile - 10 / zoom);
    }
    c.restore();
  }
  for (const site of sites) {
    const center = siteCenter(site), dead = site.state === 'conquered';
    if(dead&&world?.logistics?.salvage[site.id]===0)continue;
    const antiAir = site.kind === 'anti-air';
    const laser = site.kind === 'laser', mortar = site.kind === 'mortar', modifier = site.kind === 'modifier', region = sectorRadius(site);
    c.save(); c.translate(center.x * tile, center.y * tile);
    if (!dead) {
      if (overview && !site.settlement) {
        c.fillStyle = '#a52b3620'; c.strokeStyle = '#ce6e6888'; c.lineWidth = 1 / zoom;
        c.setLineDash([6 / zoom, 6 / zoom]); c.beginPath(); c.arc(0, 0, region * tile, 0, TAU); c.fill(); c.stroke(); c.setLineDash([]);
      } else if (!overview && view.inspectedId === site.id) {
        c.strokeStyle = '#efcc9688'; c.lineWidth = 1 / zoom; c.setLineDash([3 / zoom, 5 / zoom]);
        for (const range of site.kind==='aquatic-hive'?[AQUATIC.ventRadius]:antiAir ? [ANTI_AIR.range] : laser ? [LASER.acquire] : mortar ? [MORTAR.minRange, MORTAR.range] : modifier ? [MODIFIER.radius] : [SCANNER.range]) {
          c.beginPath(); c.arc(0, 0, range * tile, 0, TAU); c.stroke();
        }
        c.setLineDash([]); c.font = `${10 / zoom}px monospace`; c.textAlign = 'center';
        c.fillStyle = '#efcc96'; c.fillText(site.kind==='aquatic-hive'?'POISON VENT RANGE':antiAir ? 'AIRSPACE / FLAK RANGE' : laser ? 'ACQUISITION / TRACKS TO 40' : mortar ? 'MORTAR RANGE' : modifier ? 'ALTERED TERRAIN' : 'SEARCH RANGE', 0, -(site.kind==='aquatic-hive'?AQUATIC.ventRadius:antiAir ? ANTI_AIR.range : laser ? LASER.acquire : mortar ? MORTAR.range : modifier ? MODIFIER.radius : SCANNER.range) * tile - 5 / zoom);
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
    // Rooted bed and body (facility-art.js), skipped when well off screen; poses
    // follow saved site state, and a Blight root opens while its giant is warned.
    if (onScreen(c, 2.4 * tile)) {
      const warning = site.kind === 'modifier' && (view.centipedes?.warnings || []).find(w => w.kind === 'centipede' && w.rootId === site.id);
      const emerging = warning ? Math.max(0, Math.min(1, 1 - (warning.at - time) / (warning.windup || 1))) : 0;
      c.save(); c.scale(tile / 48, tile / 48); drawFacility(c, site, time, reduced, { zoom, emerging }); c.restore();
    }
    const font = 10 / zoom, labelY = -1.9 * tile - font;
    c.font = `600 ${font}px monospace`; c.textAlign = 'center';
    const blocked = !dead && time - site.blockedAt < 1800;
    const label = site.kind==='aquatic-hive'?(dead?'CONQUERED / HIVE SILENCED':time-site.hitAt<AQUATIC.healDelay?'AQUATIC HIVE / HEALING SUPPRESSED':site.hp<site.maxHp?'AQUATIC HIVE / REGENERATING':'AQUATIC HIVE / USE HE'):antiAir ? (dead ? 'CONQUERED / AIRSPACE CLEAR' : 'SPORE FLAK / ' + (site.aa?.phase || 'watching').toUpperCase()) : laser ? (dead ? 'CONQUERED / LANCE SILENCED' : 'LANCE TOWER / ' + (site.laser?.phase || 'watching').toUpperCase()) : site.kind === 'contaminator' ? (dead ? 'CONQUERED / EMITTER SILENCED' : 'AIR CONTAMINATOR / USE HE') : dead ? (mortar ? 'CONQUERED / MORTAR SILENCED' : modifier ? 'CONQUERED / BLIGHT CLEARED' : 'CONQUERED / CROWN SILENCED') : blocked ? 'ARMORED ORGAN / USE HE' : modifier ? 'BLIGHT ROOT / USE HE' : mortar ? (site.mortar?.charge ? 'BILE MORTAR / INCOMING ACID' : 'BILE MORTAR / USE HE') : site.sensor?.mode === 'tracking' ? 'TRACKING / DEFENDERS ALERTED' : site.sensor?.mode === 'lost' ? 'CONTACT LOST / INVESTIGATING' : 'ALERT STATION / SCANNING';
    const w = c.measureText(label).width;
    // Far out, the compound's own label speaks for its sites.
    if (zoom >= LABEL_ZOOM || !(dead || site.settlement || site.encounter)) {
      c.fillStyle = '#132523e8'; c.fillRect(-w / 2 - font * .5, labelY - font, w + font, font * 1.5);
      c.fillStyle = dead ? '#99d5cc' : '#efb1a0'; c.fillText(label, 0, labelY);
    }
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
