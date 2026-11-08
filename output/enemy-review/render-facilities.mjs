// Renders the hostile facility sketch review sheets. Run from the repo root:
//   node output/enemy-review/render-facilities.mjs
// Read-only preview server: no game server, accounts, or campaign access.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';

const roots = { '/public/': resolve('public'), '/review/': resolve('output/enemy-review') };
const out = resolve('output/enemy-review');
const html = `<!doctype html><meta charset="utf-8"><title>Frontier facility sketches</title>
<style>body{margin:0;background:#121b22;color:#efe8d7;font-family:Arial,sans-serif}section{padding:32px;width:1580px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 8px}p.lead{color:#b8c5c8;margin:0 0 18px;font-size:15px;line-height:1.5}
.row{background:#202c35;border:1px solid #40505a;border-radius:12px;margin:0 0 14px;overflow:hidden}
.head{display:flex;gap:16px;align-items:baseline;padding:12px 16px 8px}.head h2{font-size:19px;margin:0}.head span{font-size:13px;color:#ddc296}
.keeps{font-size:13px;color:#cfd8d6;padding:8px 16px 12px;line-height:1.45}.keeps b{color:#ecd9ae;font-weight:normal}
canvas{display:block}.strip{margin:0 0 14px}.strip h3{font-size:15px;margin:0 0 6px;color:#ddc296;font-weight:normal}.strip canvas{border-radius:8px}
.note{font-size:14px;color:#b8c5c8;line-height:1.5;padding:6px 2px 0}</style>
<section id="sheet"><h1>FRONTIER / Hostile facility sketches v1</h1>
<p class="lead">Today's art (left, game renderer) and a proposed redesign in the new creatures' language, at zoom 1 (48 px per tile) · 9 November 2026<br>
No concept references: Claude's design. Each pose follows saved site state the game already sends. Labels and health bars hidden for inspection.</p>
<div id="rows"></div></section>
<section id="field"><h1>FRONTIER / Facilities at battlefield scale</h1>
<p class="lead">One compound of seven facilities with the robot for scale · today's art against the sketches · zoom 1 and 0.6</p><div id="strips"></div>
<p class="note">The air contaminator normally sits inside its own opaque fog; its body shows on the fog's edge, on the map and as a ruin.</p></section>
<script type="module">
import * as F from '/review/facility-sketches.js';
import { drawConquest } from '/public/conquest-effects.js';
import { makeSite } from '/public/conquest.js';
import { drawRobot } from '/public/robot.js';
const T = 48, now = 200000, CW = 252, CH = 236;
// Today's renderer with HUD text and bars suppressed, as in render-review.mjs.
const quiet = c => new Proxy(c, { get(t, k) { if (k === 'fillText') return () => {}; if (k === 'fillRect') return (...a) => { if (Math.abs(t.getTransform().a) > 3) t.fillRect(...a); }; const v = Reflect.get(t, k, t); return typeof v === 'function' ? v.bind(t) : v; }, set(t, k, v) { return Reflect.set(t, k, v, t); } });
function current(c, kind, id) { const site = makeSite(kind, 'cur-' + id, -1.5, -1.5); drawConquest(quiet(c), [site], T, 1, now, true, null, [], {}); }
function ground(c, w, h, color) { c.fillStyle = color; c.fillRect(0, 0, w, h); c.globalAlpha = .25; for (let i = 0; i < 30; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#000000'; c.globalAlpha = .04; c.beginPath(); c.ellipse((Math.sin(i * 12.9) * .5 + .5) * w, (Math.cos(i * 7.3) * .5 + .5) * h, 40 + i % 5 * 20, 30 + i % 3 * 15, 0, 0, 7); c.fill(); } c.globalAlpha = 1; }
const base = { hp: 600, maxHp: 600, state: 'hostile', hitAt: -1e9, x: -1.5, y: -1.5 };
const ROWS = [
  ['Sensory crown', 'Detection and defender alerts', 'alert', F.drawCrownSketch, [
    ['search', { sensor: { mode: 'search', angle: .5, pulseAt: now - 900 } }], ['tracking, bearing 60°', { sensor: { mode: 'tracking', angle: 1.05 } }],
    ['alarm', { alarm: true, sensor: { mode: 'lost', angle: -.8 } }], ['damaged', { hp: 200, sensor: { mode: 'search', angle: 0, pulseAt: now - 300 } }]],
   '<b>Shows</b> a crown of bone sensory fronds round a teal receptor that looks along the saved sensor bearing · search pulses with the scan ring · tracking turns it amber and leans the fronds · alarm reddens the frond tips'],
  ['Bile mortar', 'Lobbed acid artillery', 'mortar', F.drawMortarSketch, [
    ['idle', { mortar: { angle: 0 } }], ['charging 80%, aim 40°', { mortar: { angle: .7, charge: { fireAt: now + 300 } } }],
    ['just fired', { mortar: { angle: .7, firedAt: now - 90 } }], ['damaged', { hp: 150, mortar: { angle: -.5 } }]],
   '<b>Shows</b> gold armour (Breaker family) round a green acid sac · the siphon turns to the saved aim · the sac swells and glows through the charge · the siphon kicks back and spurts when it fires'],
  ['Blight root', 'Terrain alteration / centipede source', 'modifier', F.drawRootSketch, [
    ['idle', {}], ['giant emerging 50%', {}, { emerging: .5 }], ['giant emerging 100%', {}, { emerging: 1 }], ['damaged', { hp: 120 }]],
   '<b>Shows</b> five gnarled roots spiralling out of a closed bud carrying the centipede\\'s flower maw · brood nodules pulse along the roots · during a giant\\'s saved emergence warning the bud opens and the maw glows'],
  ['Lance tower', 'Fixed beam weapon', 'laser', F.drawLanceSketch, [
    ['watching', { laser: { phase: 'watching', angle: 0 } }], ['charging 60%, aim 30°', { laser: { phase: 'charging', angle: .52, remaining: 1 } }],
    ['firing', { laser: { phase: 'firing', angle: .52 } }], ['cooling', { laser: { phase: 'cooling', angle: .52, remaining: 4 } }]],
   '<b>Shows</b> one long stepped lance with a teal aperture over a star of six radiator fins (laser family) · it turns to the saved angle · fins heat through the charge, run hot while firing and cool after · the charging ring stays as the danger warning'],
  ['Spore flak', 'Fixed anti-air weapon', 'anti-air', F.drawFlakSketch, [
    ['watching', { aa: { phase: 'watching', angle: 0 } }], ['charging, aim 45°', { aa: { phase: 'charging', angle: .78 } }],
    ['firing', { aa: { phase: 'firing', angle: .78 } }], ['damaged', { hp: 200, aa: { phase: 'cooling', angle: -.3 } }]],
   '<b>Shows</b> a gilled puffball cap carrying three stubby spore cannons that lean toward the saved aim · mouths glow through the charge and puff spore rings while firing'],
  ['Air contaminator', 'Air contamination emitter', 'contaminator', F.drawContaminatorSketch, [
    ['emitting', {}], ['emitting (later)', {}, { later: true }], ['damaged', { hp: 200 }]],
   '<b>Shows</b> a ribbed gas bladder in the fog\\'s own colours that breathes slowly, with five chimneys exhaling · collapses and wrinkles when conquered'],
  ['Aquatic hive', 'Regeneration / aquatic production (Vesper)', 'aquatic-hive', F.drawHiveSketch, [
    ['full health', { hp: 1500, maxHp: 1500 }], ['regenerating', { hp: 900, maxHp: 1500 }], ['healing suppressed (hit)', { hp: 900, maxHp: 1500, hitAt: now - 2000 }]],
   '<b>Shows</b> a reef mound, kept in the bile spitters\\' green, with a ring of egg pods round a spawning pool and three poison vents · pods glow while it regenerates and dim while a recent hit suppresses healing · conquest bursts them'],
];
let id = 1;
for (const [name, role, kind, draw, states, keeps] of ROWS) {
  const el = document.createElement('article'); el.className = 'row';
  el.innerHTML = '<div class="head"><h2>' + name + '</h2><span>' + role + '</span></div><canvas></canvas><div class="keeps">' + keeps + '</div>';
  document.querySelector('#rows').append(el);
  const cells = [['TODAY', null], ...states, ['conquered', { state: 'conquered' }]];
  const canvas = el.querySelector('canvas'), W = CW * 6, H = CH; canvas.width = W * 2; canvas.height = H * 2; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const c = canvas.getContext('2d'); c.scale(2, 2);
  ground(c, W, H, kind === 'aquatic-hive' ? '#33697a' : '#2b4f82');
  cells.forEach(([label, patch, opts], i) => {
    c.save(); c.beginPath(); c.rect(i * CW, 0, CW, H); c.clip();
    if (i === 1) { c.fillStyle = '#00000022'; c.fillRect(i * CW - 1, 0, 2, H); }
    c.translate(i * CW + CW / 2, H / 2 + 10);
    if (!patch) current(c, kind, id++);
    else {
      const site = { ...base, id: 'sk-' + id++, kind, ...patch };
      F.drawSiteBase(c, site, now, false);
      draw(c, site, opts?.later ? now + 1300 : now, false, opts || {});
    }
    c.restore();
    c.fillStyle = i ? '#f1e6c9' : '#ffd88f'; c.font = '11px monospace'; c.fillText(i ? label : 'TODAY (current art)', i * CW + 8, 15);
  });
}
// Battlefield strips: a compound at real scale, today's art against the sketches.
const LINE = [['alert', 3.1, 0], ['mortar', 7.4, -.4], ['laser', 11.7, .3], ['anti-air', 16, -.3], ['modifier', 20.3, .2], ['contaminator', 24.6, -.2], ['aquatic-hive', 29, .1]];
const SK = { alert: [F.drawCrownSketch, { sensor: { mode: 'tracking', angle: 2.2 } }], mortar: [F.drawMortarSketch, { mortar: { angle: -.6, charge: { fireAt: now + 500 } } }], laser: [F.drawLanceSketch, { laser: { phase: 'charging', angle: -.9, remaining: 1.2 } }], 'anti-air': [F.drawFlakSketch, { aa: { phase: 'watching', angle: .3 } }], modifier: [F.drawRootSketch, {}], contaminator: [F.drawContaminatorSketch, {}], 'aquatic-hive': [F.drawHiveSketch, { hp: 1000, maxHp: 1500 }] };
function strip(title, zoom, sketch) {
  const wrap = document.createElement('div'); wrap.className = 'strip'; wrap.innerHTML = '<h3>' + title + '</h3><canvas></canvas>'; document.querySelector('#strips').append(wrap);
  const W = 1516, H = Math.round(250 * Math.max(zoom, .75)), canvas = wrap.querySelector('canvas');
  canvas.width = W * 2; canvas.height = H * 2; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const c = canvas.getContext('2d'); c.scale(2, 2); ground(c, W, H, '#2b4f82');
  c.fillStyle = '#33697a'; c.beginPath(); c.moveTo(27.2 * T * zoom, 0); c.bezierCurveTo(26.5 * T * zoom, H * .4, 27.6 * T * zoom, H * .7, 26.9 * T * zoom, H); c.lineTo(W, H); c.lineTo(W, 0); c.fill();
  c.save(); c.scale(zoom, zoom); const cy = H / zoom / 2 + 8;
  c.save(); c.translate(1.1 * T, cy); drawRobot(c, -Math.PI / 2, 0, 0, 0, true, 1); c.restore();
  // Compound root connections, as drawConquest draws them.
  c.strokeStyle = '#75485288'; c.lineWidth = .18 * T; c.beginPath(); c.moveTo(3 * T, cy); for (const [, x, dy] of LINE.slice(0, 6)) c.lineTo(x * T, cy + dy * T); c.stroke();
  for (const [kind, x, dy] of LINE) {
    c.save(); c.translate(x * T, cy + dy * T);
    if (!sketch) current(c, kind, id++);
    else { const [draw, patch] = SK[kind], site = { ...base, id: 'f-' + id++, kind, ...patch }; F.drawSiteBase(c, site, now, false); draw(c, site, now, false, kind === 'modifier' ? { emerging: 0 } : {}); }
    c.restore();
  }
  c.restore();
  c.fillStyle = '#ffffffaa'; c.fillRect(14, H - 16, T * zoom, 3); c.font = '11px monospace'; c.fillText('1 tile', 18 + T * zoom, H - 11);
  c.textAlign = 'right'; c.fillStyle = '#ffffffcc'; c.font = '12px monospace'; c.fillText('zoom ' + zoom, W - 12, 18);
}
strip('Today\\'s art, zoom 1', 1, false);
strip('Sketch v1, zoom 1 (crown tracking, mortar charging, lance charging)', 1, true);
strip('Sketch v1, zoom 0.6', .6, true);
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
    res.setHeader('Content-Type', extname(file) === '.js' ? 'text/javascript' : 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => r.status() >= 400 && !r.url().endsWith('favicon.ico') && errors.push(r.status() + ' ' + r.url()));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.ready, { timeout: 30000 });
  await page.locator('#sheet').screenshot({ path: resolve(out, 'facility-sheet-v1.png') });
  await page.locator('#field').screenshot({ path: resolve(out, 'facility-battlefield-v1.png') });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ files: ['facility-sheet-v1.png', 'facility-battlefield-v1.png'] }));
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
