import { CORE } from './core.js';
import { podCells } from './pod.js';

const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
// Bounded, deterministic client presentation. No dust or panel physics entities.
export class CoreEffects {
  constructor(tile, size = 3) {
    this.size = size;
    this.tile = tile;
    this.cloud = document.createElement('canvas'); this.cloud.width = this.cloud.height = 96;
    const dust = this.cloud.getContext('2d'), haze = dust.createRadialGradient(48, 48, 0, 48, 48, 48);
    haze.addColorStop(0, '#d5c4a5bb'); haze.addColorStop(.4, '#b7a88977'); haze.addColorStop(1, '#b7a88900');
    dust.fillStyle = haze; dust.fillRect(0, 0, 96, 96);
    this.panel = document.createElement('canvas'); this.panel.width = tile * 3; this.panel.height = tile * 4;
    const c = this.panel.getContext('2d');
    c.fillStyle = '#48595c'; c.fillRect(0, 0, tile * 3, tile * 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) {
      const px = x * tile, py = y * tile;
      c.fillStyle = (x + y) % 2 ? '#647071' : '#5a686a'; c.fillRect(px + 2, py + 2, tile - 4, tile - 4);
      c.strokeStyle = '#87918b'; c.lineWidth = 1; c.strokeRect(px + 5, py + 5, tile - 10, tile - 10);
      c.fillStyle = '#27393b';
      for (const dx of [8, tile - 9]) for (const dy of [8, tile - 9]) c.fillRect(px + dx, py + dy, 2, 2);
      c.fillStyle = '#3d5155'; for (let i = 0; i < 4; i++) c.fillRect(px + 15, py + 16 + i * 4, tile - 30, 2);
    }
    c.fillStyle = '#c5a965'; c.fillRect(0, 0, tile * 3, 5); c.fillRect(0, tile * 4 - 5, tile * 3, 5);
    c.fillStyle = '#2c3b3c'; for (let x = 0; x < tile * 3; x += 16) { c.fillRect(x, 0, 8, 5); c.fillRect(x, tile * 4 - 5, 8, 5); }
  }
  time(core, received, now, connected) {
    return core.elapsed >= CORE.duration ? core.elapsed : Math.min(CORE.duration, core.elapsed + (connected ? Math.min(.1, (now - received) / 1000) : 0));
  }
  preview(c, x, y, valid, zoom) {
    c.save(); c.fillStyle = valid ? '#dfc98730' : '#f1866740'; c.strokeStyle = valid ? '#f5d995' : '#ffa78b'; c.lineWidth = 1 / zoom;
    for (const cell of podCells(x, y, this.size)) { c.fillRect(cell.x * this.tile, cell.y * this.tile, this.tile, this.tile); c.strokeRect(cell.x * this.tile + 1, cell.y * this.tile + 1, this.tile - 2, this.tile - 2); }
    c.fillStyle = '#e9e7cc'; c.font = `bold ${11 / zoom}px monospace`; c.textAlign = 'center'; c.fillText(this.size === 1 ? 'TANK POD / 17 TILES' : 'CORE / 57 TILES', (x + this.size / 2) * this.tile, (y - 4.5) * this.tile); c.restore();
  }
  draw(c, core, time, reduced) {
    const T = this.tile, size = this.size, half = size / 2, cx = (core.x + half) * T, cy = (core.y + half) * T;
    c.save(); c.translate(cx, cy);
    if (time < CORE.impact) {
      const descent = clamp(time / CORE.impact);
      c.fillStyle = `rgba(12,27,28,${.1 + descent * .25})`; c.beginPath(); c.ellipse(0, 0, T * (2.4 - descent), T * (1.9 - descent * .6), 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#f1ca7c'; c.lineWidth = 2; c.setLineDash([8, 8]); c.strokeRect(-(half + .2) * T, -(half + .2) * T, (size + .4) * T, (size + .4) * T); c.setLineDash([]);
      const fall = 1 - descent * descent;
      const px = fall * 5 * T, py = -fall * 9 * T;
      if (!reduced) {
        c.lineCap = 'round';
        for (let i = 3; i >= 1; i--) { c.strokeStyle = ['','#fff1b4aa','#f49b4577','#dc592e33'][i]; c.lineWidth = i * 20; c.beginPath(); c.moveTo(px, py); c.lineTo(px + fall * 2 * T, py - fall * 4 * T); c.stroke(); }
      }
      c.translate(px, py); c.scale(1 + fall * 1.1, 1 + fall * 1.1);
      this.box(c, 0); c.restore(); return;
    }
    // Four independent hinges: each outer edge gets a separate ground strike.
    for (let side = 0; side < 4; side++) {
      const progress = clamp((time - CORE.unfold - side * CORE.stagger) / CORE.panelDuration);
      if (!progress) continue;
      const projected = Math.sin(smooth(progress) * Math.PI / 2);
      c.save(); c.rotate(side * Math.PI / 2); c.translate(0, -half * T);
      c.fillStyle = `rgba(15,29,29,${.25 * (1 - progress)})`; c.fillRect(-half * T + 12 * (1 - progress), -4 * T * projected - 14 * (1 - progress), size * T, 4 * T * projected);
      c.drawImage(this.panel, 0, 0, size * T, 4 * T, -half * T, -4 * T * projected, size * T, 4 * T * projected);
      c.fillStyle = '#b6bbae'; c.fillRect(-half * T, -3, size * T, 6);
      for (let i = 0; i < size * 2; i++) { c.fillStyle = '#27383c'; c.fillRect((-half + .15) * T + i * 23, -5, 10, 10); }
      const strike = time - (CORE.unfold + side * CORE.stagger + CORE.panelDuration);
      if (strike >= 0 && strike < .75) this.dust(c, 0, -4 * T, strike, .75, reduced ? 4 : 12, side + 10, .65);
      c.restore();
    }
    c.fillStyle = '#263a3c'; c.fillRect(-half * T, -half * T, size * T, size * T);
    const open = smooth((time - CORE.unfold) / 1.2);
    if (open < 1) { c.save(); c.globalAlpha = 1 - open; this.box(c, time - CORE.impact); c.restore(); }
    if (open > 0 && size === 3) {
      c.save(); c.globalAlpha = open;
      // Seven machinery cells; upper-right sentry and middle-right exit stay clear.
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (!(x === 2 && y < 2)) {
        const px = (x - 1.5) * T, py = (y - 1.5) * T;
        c.fillStyle = '#2c4146'; c.fillRect(px + 3, py + 5, T - 4, T - 5);
        c.fillStyle = '#7b8580'; c.fillRect(px + 1, py, T - 5, T - 8);
        c.strokeStyle = '#bac0ac'; c.lineWidth = 1; c.strokeRect(px + 5, py + 4, T - 13, T - 16);
        c.fillStyle = '#283d42'; for (let i = 0; i < 5; i++) c.fillRect(px + 10, py + 10 + i * 4, T - 24, 2);
        c.fillStyle = '#e8b96e'; c.fillRect(px + T - 13, py + 9, 3, 14);
      }
      c.fillStyle = '#131f25'; c.fillRect(.5 * T + 4, -.5 * T + 4, T - 8, T - 8);
      c.fillStyle = time >= CORE.exit ? '#add8bc' : '#db8d5b'; c.fillRect(.5 * T + 5, -.5 * T + 5, 4, T - 10);
      const hatch = 1 - smooth((time - CORE.exit + .3) / .3);
      c.fillStyle = '#8b958b'; c.fillRect(.5 * T + 8, -.5 * T + 4, (T - 12) * hatch, T - 8);
      c.fillStyle = '#d8d6b5'; c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.fillText('UPLINK', -T * .5, -T * .62);
      c.restore();
    }
    if (size === 1 && open >= 1) { c.drawImage(this.panel, 0, 0, T, T, -T / 2, -T / 2, T, T); c.strokeStyle = '#d9b675'; c.lineWidth = 2; c.strokeRect(-T*.3, -T*.3, T*.6, T*.6); }
    const impactAge = time - CORE.impact;
    if (impactAge < 1.25) this.dust(c, 0, 0, impactAge, 1.25, reduced ? 10 : 32, 3, 1.7);
    c.restore();
  }
  box(c, age) {
    const T = this.tile, bounce = Math.max(0, 1 - age / .25) * Math.sin(age * 45) * 3;
    c.save(); c.translate(0, bounce); c.scale(this.size / 3, this.size / 3);
    c.fillStyle = '#1b2d31'; c.fillRect(-1.5 * T - 3, -1.5 * T + 9, 3 * T + 6, 3 * T);
    c.fillStyle = '#84908c'; c.fillRect(-1.5 * T, -1.5 * T, 3 * T, 3 * T);
    c.fillStyle = '#354a50'; c.fillRect(-1.3 * T, -1.3 * T, 2.6 * T, 2.6 * T);
    c.strokeStyle = '#c9cbbb'; c.lineWidth = 3; c.strokeRect(-1.12 * T, -1.12 * T, 2.24 * T, 2.24 * T);
    for (let side = 0; side < 4; side++) { c.save(); c.rotate(side * Math.PI / 2); c.fillStyle = '#d1ac60'; c.fillRect(-T, -1.5 * T, 2 * T, 8); c.fillStyle = '#283a40'; for (let i = 0; i < 6; i++) c.fillRect(-T + i * 17, -1.5 * T, 8, 8); c.restore(); }
    c.strokeStyle = '#71827e'; c.lineWidth = 8; c.beginPath(); c.moveTo(-T, -T); c.lineTo(T, T); c.moveTo(T, -T); c.lineTo(-T, T); c.stroke();
    c.fillStyle = '#263b42'; c.fillRect(-24, -24, 48, 48); c.strokeStyle = '#c8c6a3'; c.lineWidth = 2; c.strokeRect(-24, -24, 48, 48);
    c.fillStyle = '#efba68'; c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillText('F', 0, 7); c.restore();
  }
  dust(c, x, y, age, duration, count, seed, size) {
    const p = clamp(age / duration), T = this.tile;
    c.save(); c.translate(x, y); c.globalAlpha = (1 - p) * .4;
    c.strokeStyle = '#e5d8b3'; c.lineWidth = 3 * (1 - p) + 1; c.beginPath(); c.ellipse(0, 0, T * size * (1 + p * 2), T * size * (.8 + p * 1.4), 0, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996 + seed, speed = .5 + (i * 17 % 11) / 10, distance = T * size * (1 + p * speed * 2);
      const px = Math.cos(a) * distance, py = Math.sin(a) * distance * .7;
      const radius = (15 + p * 35) * size;
      c.drawImage(this.cloud, px - radius, py - radius * .65, radius * 2, radius * 1.3);
      if (i % 3 === 0 && p < .5) { c.fillStyle = '#ebc172'; c.fillRect(px, py - Math.sin(p * Math.PI) * 25, 3, 5); }
    }
    c.restore();
  }
  shake(core, time, camera, reduced, enabled) {
    if (reduced || !enabled) return { x: 0, y: 0 };
    let strength = 0;
    for (const [at, power] of [[CORE.impact, 8], ...[0, 1, 2, 3].map(i => [CORE.unfold + i * CORE.stagger + CORE.panelDuration, 3])]) {
      const age = time - at; if (age >= 0 && age < .3) strength += power * (1 - age / .3);
    }
    const distance = Math.hypot((core.x + this.size / 2) * this.tile - camera.x, (core.y + this.size / 2) * this.tile - camera.y) * camera.zoom;
    strength *= Math.max(0, 1 - distance / 700);
    return { x: Math.sin(time * 119) * strength, y: Math.cos(time * 97) * strength * .65 };
  }
}
