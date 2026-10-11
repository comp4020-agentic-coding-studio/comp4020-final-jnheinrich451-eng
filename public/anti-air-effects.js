import { ANTI_AIR } from './anti-air.js';
const TAU = Math.PI * 2;
export function drawAntiAirBody(c, site) {
  const dead = site.state === 'conquered';
  c.fillStyle = dead ? '#41323c' : '#552f4b';
  c.beginPath(); c.ellipse(0, 0, 1.3, 1.1, 0, 0, TAU); c.fill();
  for (let i = 0; i < 8; i++) {
    c.save(); c.rotate(i * TAU / 8); c.fillStyle = dead ? '#665052' : '#a16d79';
    c.beginPath(); c.moveTo(.3, -.25); c.lineTo(1.45, -.12); c.lineTo(1.05, .34); c.closePath(); c.fill(); c.restore();
  }
  c.save(); c.rotate(site.aa?.angle || 0);
  for (const x of [-.65, 0, .65]) {
    c.strokeStyle = '#322637'; c.lineWidth = .36; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, .55); c.quadraticCurveTo(x * .6, -.4, x, -1.25); c.stroke();
    c.strokeStyle = dead ? '#735a5d' : '#b68a8a'; c.lineWidth = .19; c.stroke();
    c.fillStyle = dead ? '#271f30' : site.aa?.phase === 'charging' ? '#ffdda0' : '#d179c4';
    c.beginPath(); c.ellipse(x, -1.22, .2, .15, 0, 0, TAU); c.fill();
  }
  c.restore();
}
export function drawFlak(c, sites, shells, time, T, zoom, reduced) {
  const pending = sites.filter(s => s.state === 'hostile').flatMap(s => s.aa?.queue || []);
  for (const p of [...pending, ...shells]) {
    c.save(); c.translate(p.x * T, p.y * T);
    const hit = p.impacted, age = Math.max(0, (time - p.landAt) / 900);
    c.strokeStyle = hit ? '#ed9ecb' : '#f7b894'; c.fillStyle = hit ? '#a86eaa55' : '#f39ba51c';
    c.lineWidth = (hit ? 2 : 1.5) / zoom; c.setLineDash(hit ? [] : [5 / zoom, 4 / zoom]);
    c.globalAlpha = hit ? Math.max(0, 1 - age) : 1;
    c.beginPath(); c.arc(0, 0, ANTI_AIR.radius * T * (hit ? .6 + Math.min(1, age) * .6 : 1), 0, TAU); c.fill(); c.stroke();
    c.setLineDash([]);
    if (hit) {
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8, r = (reduced ? .8 : .4 + age * 1.8) * T;
        c.fillStyle = i % 2 ? '#ecb36d' : '#d591d1'; c.fillRect(Math.cos(a) * r, Math.sin(a) * r, 3 / zoom, 3 / zoom);
      }
    } else {
      c.fillStyle = '#ffe0bc'; c.font = `bold ${10 / zoom}px monospace`; c.textAlign = 'center';
      c.fillText('FLAK / ' + Math.max(0, (p.landAt - time) / 1000).toFixed(1), 0, -ANTI_AIR.radius * T - 5 / zoom);
    }
    c.restore();
    if (!hit && p.at !== undefined) {
      const t = Math.max(0, Math.min(1, (time - p.at) / (p.landAt - p.at)));
      const x = p.fromX + (p.x - p.fromX) * t, y = p.fromY + (p.y - p.fromY) * t;
      c.save(); c.strokeStyle = '#efb0dc'; c.lineWidth = 2 / zoom;
      c.beginPath(); c.moveTo((x - (p.x - p.fromX) * .045) * T, (y - (p.y - p.fromY) * .045) * T); c.lineTo(x * T, y * T); c.stroke(); c.restore();
    }
  }
}
