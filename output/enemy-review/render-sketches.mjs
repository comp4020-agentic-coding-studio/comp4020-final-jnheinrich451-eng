// Renders the enemy sketch review sheets. Run from the repo root:
//   node output/enemy-review/render-sketches.mjs
// Read-only preview server: no game server, accounts, or campaign access.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';

const roots = { '/public/': resolve('public'), '/review/': resolve('output/enemy-review') };
const out = resolve('output/enemy-review');
const types = { '.js': 'text/javascript', '.png': 'image/png', '.html': 'text/html' };

const html = `<!doctype html><meta charset="utf-8"><title>Frontier enemy sketches</title>
<style>
body{margin:0;background:#121b22;color:#efe8d7;font-family:Arial,sans-serif}
section{padding:36px;width:1400px;box-sizing:border-box}
h1{font-size:32px;margin:0 0 8px}p.lead{color:#b8c5c8;margin:0 0 22px;font-size:16px;line-height:1.5}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.card{background:#202c35;border:1px solid #40505a;border-radius:12px;overflow:hidden}
.card.wide{grid-column:1/3}
h2{font-size:21px;margin:15px 18px 4px}.role{font-size:14px;margin:0 18px 10px;color:#ddc296}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#40505a}
.wide .pair{grid-template-columns:1fr 1.25fr}
.pane{position:relative;background:#c9c4b8;height:300px;display:flex;align-items:center;justify-content:center}
.wide .pane{height:250px}
.pane.sketch{background:#b2b0a0}.pane img{max-width:94%;max-height:94%}
.pane canvas{width:100%;height:100%}
.tag{position:absolute;left:10px;top:8px;font:11px monospace;color:#3a3a34;letter-spacing:.06em}
.keeps{font-size:13.5px;color:#cfd8d6;padding:11px 18px 14px;line-height:1.45}.keeps b{color:#ecd9ae;font-weight:normal}
.note{padding:20px 4px 0;font-size:14px;color:#b8c5c8;line-height:1.5}
.strip{margin:0 0 16px}.strip h3{font-size:15px;margin:0 0 6px;color:#ddc296;font-weight:normal}
.strip canvas{display:block;border-radius:8px}
</style>
<section id="sheet"><h1>FRONTIER / Enemy sketches v1</h1>
<p class="lead">Concept render (left) simplified to the game's flat Canvas style (right) · 9 November 2026<br>
Sketches are drawn in the game's own convention (48 px per tile, front up) and enlarged here. Not wired into the game.</p>
<div class="grid"></div>
<p class="note">Berserker is drawn where the Bulwark drawing sits today. Twin and Heavy laser replace the twin-lens and heavy-lens drawings; their barrels sit in a group that turns about the neck, so they can still aim independently of the body.</p></section>
<section id="field"><h1>FRONTIER / Sketches at battlefield scale</h1>
<p class="lead">Zoom 1 (48 px per tile) unless noted · robot for scale at left · Heavy laser drawn at 2.5 times the Twin laser's width, as requested<br>
Dashed circles: today's 0.38-tile enemy hit circle (the centipede keeps its eight 0.42-tile circles).</p>
<div id="strips"></div></section>
<script type="module">
import * as S from '/review/enemy-sketches.js';
import { drawCrawler } from '/public/effects.js';
import { drawCentipede } from '/public/centipede-art.js';
import { drawSwimmer } from '/public/vehicle-effects.js';
import { drawRobot } from '/public/robot.js';
const T = 48;
// Centipede chain in pixels, head first; angle turns local -y to the heading.
function chain(x, y, heading, curve, spacing = 36, n = 8) {
  const parts = []; let px = x, py = y;
  for (let i = 0; i < n; i++) {
    const h = heading + curve * Math.sin(i * .62);
    if (i) { px -= Math.cos(h) * spacing; py -= Math.sin(h) * spacing; }
    parts.push({ x: px, y: py, angle: h + Math.PI / 2 });
  }
  return parts;
}
const heavySize = 2.5 * S.SKETCH_WIDTH.twin / S.SKETCH_WIDTH.heavy;
const cards = [
  ['Hunter', 'Fast melee hunter', 'hunter-concept-v1.png', 2.7, [0, 8], c => S.drawHunterSketch(c),
   '<b>Keeps</b> heart carapace with seam · two open mouths, no eyes · two open serrated clamps · four walking legs · four back vents'],
  ['Breaker', 'Heavy melee attacker', 'breaker-concept-v2.png', 2.35, [0, 12], c => S.drawBreakerSketch(c),
   '<b>Keeps</b> long gold body (about 1.65 : 1) · forward chevron plates on a pale spine · two necked mouths · oversized open clamps · four long exposed legs'],
  ['Berserker', 'Armored melee attacker (Bulwark role)', 'berserker-concept-v2.png', 2.35, [0, 9], c => S.drawBerserkerSketch(c),
   '<b>Keeps</b> broad slate wedge · three forward points: prow spike and two pikes · plate tips serrate the outline · legs hidden, four claw tips · plum vents'],
  ['Twin laser', 'Mobile anti-air / two lenses', 'twin-laser-concept-v1.png', 2.9, [0, 6], c => S.drawTwinLaserSketch(c),
   '<b>Keeps</b> two banded lens barrels with teal apertures and a notch between · two separate four-fin radiators either side of a clear strip · six slim legs'],
  ['Heavy laser', 'Heavy mobile anti-air / one lens', 'heavy-laser-concept-v1.png', 2.05, [0, 5], c => S.drawHeavyLaserSketch(c),
   '<b>Keeps</b> one stepped barrel across the whole front · radiator ribs arch across the midline with red gills between · six thick legs, armored knees, blunt feet'],
  ['Swimmer', 'Aquatic melee attacker', 'swimmer-concept-v1.png', 4, [0, 0], c => S.drawSwimmerSketch(c),
   '<b>Keeps</b> swept fins and forked tail in rust-coral · long toothed mouth from the nose · amber core feeding two vessels to two bladed tail propellers'],
  ['Siege centipede', 'Eight-segment armored nursery', 'siege-centipede-concept-v1.png', 1.75, [0, 0], c => S.drawCentipedeSketch(c, chain(150, 0, 0, .18)),
   '<b>Keeps</b> flower maw of five toothed petals · eight saved parts with gold chevron plates · a brood port on each flank with a leg either side · soft tail tentacles and two long antennae', true],
];
const grid = document.querySelector('#sheet .grid');
for (const [name, role, concept, scale, [ox, oy], draw, keeps, wide] of cards) {
  const el = document.createElement('article'); el.className = 'card' + (wide ? ' wide' : '');
  el.innerHTML = '<h2>' + name + '</h2><div class="role">' + role + '</div><div class="pair"><div class="pane"><span class="tag">CONCEPT</span><img src="/review/' + concept + '"></div><div class="pane sketch"><span class="tag">SKETCH V1</span><canvas></canvas></div></div><div class="keeps">' + keeps + '</div>';
  grid.append(el);
  const canvas = el.querySelector('canvas'), box = canvas.parentElement.getBoundingClientRect();
  canvas.width = box.width * 2; canvas.height = box.height * 2;
  const c = canvas.getContext('2d'); c.scale(2, 2); c.translate(box.width / 2 + ox * scale, box.height / 2 + oy * scale); c.scale(scale, scale);
  draw(c);
}
await Promise.all([...document.images].map(i => i.decode().catch(() => {})));

// Ground strips: soft per-tile drifts in each planet's own colours.
const GROUND = {
  caldera: { land: ['#1f3a66', '#2b4f82', '#3b679e'], water: '#1f5468', label: 'Caldera meadow' },
  vesper: { land: ['#66816a', '#80997a', '#5f7b80', '#8f975f'], water: '#33697a', label: 'Vesper moss' },
  sirocco: { land: ['#cdae83', '#d9bf94', '#c99a72'], water: '#b9763e', label: 'Sirocco firm ground / sand sea', sand: true },
};
const hash = (x, y) => { let n = Math.imul(x * 374761393 + y * 668265263, 1274126177); n ^= n >>> 13; return ((Math.imul(n, 1103515245) >>> 0) % 1000) / 1000; };
function ground(c, w, h, g, zoom, waterFrom) {
  const tile = T * zoom;
  c.fillStyle = g.land[1]; c.fillRect(0, 0, w, h);
  c.globalAlpha = .45;
  for (let i = 0; i < 90; i++) { c.fillStyle = g.land[i % g.land.length]; c.beginPath(); c.ellipse(hash(i, 7) * w, hash(i, 9) * h, 30 + hash(i, 3) * 70, 20 + hash(i, 5) * 40, 0, 0, 7); c.fill(); }
  c.globalAlpha = 1;
  c.fillStyle = g.water; c.beginPath(); c.moveTo(waterFrom, 0); c.bezierCurveTo(waterFrom - 30, h * .35, waterFrom + 20, h * .7, waterFrom - 10, h); c.lineTo(w, h); c.lineTo(w, 0); c.fill();
  c.fillStyle = '#ffffffaa'; c.fillRect(14, h - 16, tile, 3); c.font = '11px monospace'; c.fillText('1 tile', 14 + tile + 6, h - 11);
}
function hitCircle(c, x, y, r) { c.save(); c.setLineDash([4, 4]); c.strokeStyle = '#ffffff99'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); c.restore(); }
function strip(title, planet, zoom, current = false) {
  const wrap = document.createElement('div'); wrap.className = 'strip';
  wrap.innerHTML = '<h3>' + title + '</h3><canvas></canvas>'; document.querySelector('#strips').append(wrap);
  const W = 1328, H = Math.round(250 * Math.max(zoom, .7)), canvas = wrap.querySelector('canvas');
  canvas.width = W * 2; canvas.height = H * 2; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const c = canvas.getContext('2d'); c.scale(2, 2);
  const g = GROUND[planet], waterX = 1130 * zoom + (1 - zoom) * 900;
  ground(c, W, H, g, zoom, waterX);
  c.save(); c.scale(zoom, zoom);
  const cy = H / zoom / 2 + 6, put = (x, fn, hit = true) => { c.save(); c.translate(x, cy); fn(c); c.restore(); if (hit) hitCircle(c, x, cy, .38 * T); };
  put(50, c => { c.rotate(0); drawRobot(c, -Math.PI / 2, 0, 0, 0, true, 1); }, false);
  if (current) {
    const crawl = kind => c => drawCrawler(c, { id: 2, kind, x: 0, y: 0, angle: 0, hp: 100, maxHp: 100, behavior: 'patrolling', airLaser: { phase: 'watching', angle: 0 } }, 0);
    put(140, crawl('hunter')); put(250, crawl('breaker')); put(370, crawl('bulwark')); put(480, crawl('twin-lens')); put(610, crawl('heavy-lens'));
    const body = chain(1030, cy, 0, .18).map(p => ({ x: p.x / T, y: p.y / T, angle: p.angle }));
    c.save(); drawCentipede(c, { kind: 'centipede', hp: 100, angle: body[0].angle, body, behavior: 'resting' }, 0, T, true); c.restore();
    c.save(); c.translate(0, 0); drawSwimmer(c, { id: 1, x: (waterX / zoom + 90) / T, y: cy / T, angle: 0 }, 0, T, true, 0, null); c.restore();
  } else {
    put(140, c => S.drawHunterSketch(c)); put(250, c => S.drawBreakerSketch(c)); put(370, c => S.drawBerserkerSketch(c));
    put(480, c => S.drawTwinLaserSketch(c, { phase: planet === 'vesper' ? 'charging' : 'watching' }));
    put(625, c => S.drawHeavyLaserSketch(c, { size: heavySize }));
    const body = chain(1068, cy, 0, .18);
    S.drawCentipedeSketch(c, body);
    body.forEach(p => hitCircle(c, p.x, p.y, .42 * T));
    put(waterX / zoom + 90, c => S.drawSwimmerSketch(c, { sand: g.sand }));
  }
  c.restore();
  c.fillStyle = '#ffffffcc'; c.font = '12px monospace'; c.textAlign = 'right'; c.fillText(g.label + ' · zoom ' + zoom, W - 12, 18);
}
strip('Current art, for comparison', 'caldera', 1, true);
strip('Sketch v1 on Caldera', 'caldera', 1);
strip('Sketch v1 on Vesper (Twin laser charging)', 'vesper', 1);
strip('Sketch v1 on Sirocco (Swimmer on the sand sea)', 'sirocco', 1);
strip('Sketch v1 on Caldera, zoomed out', 'caldera', .6);
window.ready = true;
</script>`;

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    const prefix = Object.keys(roots).find(p => url.startsWith(p));
    if (!prefix) { res.writeHead(404).end(); return; }
    const root = roots[prefix], file = resolve(root, '.' + url.slice(prefix.length - 1));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('response', r => r.status() >= 400 && !r.url().endsWith('favicon.ico') && errors.push(r.status() + ' ' + r.url()));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.ready, { timeout: 30000 });
  await page.locator('#sheet').screenshot({ path: resolve(out, 'sketch-sheet-v1.png') });
  await page.locator('#field').screenshot({ path: resolve(out, 'sketch-battlefield-v1.png') });
  await writeFile(resolve(out, 'sketch-review.html'), html);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ output: out, files: ['sketch-sheet-v1.png', 'sketch-battlefield-v1.png'] }));
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
