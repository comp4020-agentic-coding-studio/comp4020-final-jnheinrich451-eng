import {AQUATIC} from './aquatic-profile.js';
import { MORTAR } from './mortar.js';
const TAU = Math.PI * 2;
const oval = (c, x, y, rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };

// Local coordinates in tiles; same light direction/chitin palette as the crown.
export function drawMortarBody(c, site, time, reduced) {
  const dead = site.state === 'conquered', m = site.mortar;
  const swell = dead || reduced ? 1 : 1 + Math.sin(time / (m?.charge ? 100 : 600)) * (m?.charge ? .1 : .035);
  oval(c, 0, .05, 1.22, 1.08, dead ? '#33272b' : '#482b35');
  for (let side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = side * (.8 + Math.sin(i) * .2), y = (i - 1.5) * .43;
    oval(c, x, y, .35, .3, dead ? '#65423e' : '#ad6b56');
    oval(c, x - .06, y - .06, .22, .18, dead ? '#49383d' : '#713842');
  }
  c.save(); c.rotate(dead ? .65 : m?.angle || 0);
  oval(c, .18, .58, .8 * swell, .58 * swell, dead ? '#4c3c45' : '#844d70');
  oval(c, .04, .5, .52 * swell, .39 * swell, dead ? '#342c33' : '#bebf74');
  c.lineCap = 'round'; c.beginPath(); c.moveTo(0, .6); c.bezierCurveTo(-.45, .15, -.4, -.7, 0, -1.1);
  c.lineWidth = .83; c.strokeStyle = dead ? '#432d34' : '#3b2330'; c.stroke();
  c.lineWidth = .62; c.strokeStyle = dead ? '#755348' : '#a06351'; c.stroke();
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-.51, .15 - i * .28); c.lineTo(.12, .13 - i * .28); c.lineWidth = .075; c.strokeStyle = '#d494746b'; c.stroke(); }
  oval(c, 0, -1.08, .42, .29, dead ? '#4e373c' : '#bc7d68');
  oval(c, 0, -1.12, .28, .18, '#251f28');
  if (!dead) oval(c, 0, -1.12, m?.charge ? .2 : .11, .09, m?.charge ? '#e8ec9a' : '#839963');
  if (!dead && time - (m?.firedAt ?? -10000) < 300) oval(c, 0, -1.35, .33, .5, '#dbeea799');
  c.restore();
  if (!dead && time - site.hitAt < 350) { c.globalAlpha = .2; oval(c, 0, 0, 1.2, 1.1, '#ffe2cb'); c.globalAlpha = 1; }
}

export function drawAcid(c, combat, tile, zoom, time, reduced) {
  const warnings = (combat.sites || []).filter(s => s.state === 'hostile' && s.mortar?.charge).map(s => ({ ...s.mortar.charge, landAt: s.mortar.charge.fireAt + MORTAR.flight }));
  warnings.push(...(combat.acidShells || []).filter(s => !s.impacted));
  for (const w of warnings) {
    const radius=w.weapon==='BILE'?AQUATIC.blastRadius:MORTAR.radius;
    c.save(); c.translate(w.x * tile, w.y * tile);
    c.fillStyle = '#c5dd5522'; c.strokeStyle = '#eced94'; c.lineWidth = 2 / zoom;
    c.setLineDash([7 / zoom, 4 / zoom]); c.beginPath(); c.arc(0, 0, radius * tile, 0, TAU); c.fill(); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(-.35 * tile, 0); c.lineTo(.35 * tile, 0); c.moveTo(0, -.35 * tile); c.lineTo(0, .35 * tile); c.stroke();
    const label = `${w.weapon==='BILE'?'BILE':'ACID'} IMPACT / ${Math.max(0, (w.landAt - time) / 1000).toFixed(1)}s`;
    c.font = `600 ${11 / zoom}px monospace`; c.textAlign = 'center';
    const width = c.measureText(label).width;
    c.fillStyle = '#252a20ed'; c.fillRect(-width / 2 - 5 / zoom, -radius * tile - 19 / zoom, width + 10 / zoom, 17 / zoom);
    c.fillStyle = '#f5f6bc'; c.fillText(label, 0, -radius * tile - 6 / zoom); c.restore();
  }
  for (const s of combat.acidShells || []) {
    const radius=s.weapon==='BILE'?AQUATIC.blastRadius:MORTAR.radius;
    c.save();
    if (!s.impacted) {
      const t = Math.max(0, Math.min(1, (time - s.at) / (s.landAt - s.at)));
      const x = (s.fromX + (s.x - s.fromX) * t) * tile, y = (s.fromY + (s.y - s.fromY) * t) * tile;
      const lift = reduced ? 0 : Math.sin(t * Math.PI) * tile * 4;
      oval(c, x, y, tile * .14, tile * .09, '#15282466');
      c.strokeStyle = '#dcec98aa'; c.lineWidth = 3 / zoom;
      c.beginPath(); c.moveTo(x - (s.x - s.fromX) * tile * .025, y - lift + tile * .2); c.lineTo(x, y - lift); c.stroke();
      oval(c, x, y - lift, tile * .15, tile * .22, '#ecedaa');
    } else {
      const progress = Math.min(1, Math.max(0, (time - s.landAt) / 900));
      c.globalAlpha = 1 - progress;
      oval(c, s.x * tile, s.y * tile, radius * tile * (.55 + progress * .45), radius * tile * (.55 + progress * .45), '#a5bc6177');
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4, r = (reduced ? .7 : progress) * radius * tile * (.5 + (i % 3) * .2);
        oval(c, s.x * tile + Math.cos(a) * r, s.y * tile + Math.sin(a) * r, tile * .12, tile * .08, i % 2 ? '#dce796' : '#605875');
      }
    }
    c.restore();
  }
}
