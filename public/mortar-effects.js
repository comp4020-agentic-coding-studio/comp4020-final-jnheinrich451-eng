import {AQUATIC} from './aquatic-profile.js';
import { MORTAR } from './mortar.js';
const TAU = Math.PI * 2;
const oval = (c, x, y, rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };

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
