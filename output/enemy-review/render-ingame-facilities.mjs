// Renders the in-game hostile facilities in each state with the game's own
// drawConquest and lance beams. Run from the repo root:
//   node output/enemy-review/render-ingame-facilities.mjs
// Read-only preview server: no game server, accounts, or campaign access.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve('public'), out = resolve('output/enemy-review');
const html = `<!doctype html><meta charset="utf-8"><title>Frontier facilities in game</title>
<style>body{margin:0;background:#121b22;color:#efe8d7;font-family:Arial,sans-serif}section{padding:30px;width:1580px;box-sizing:border-box}
h1{font-size:28px;margin:0 0 6px}p{color:#b8c5c8;margin:0 0 16px;font-size:15px}h3{margin:14px 0 6px;font-size:15px;color:#ddc296;font-weight:normal}canvas{display:block;border-radius:8px}</style>
<section id="states"><h1>FRONTIER / Hostile facilities in game, by state</h1><p>Drawn by the game's drawConquest (public/facility-art.js) at zoom 1, with its labels, health bars and warnings</p><div id="rows"></div></section>
<script type="module">
import { drawConquest } from '/conquest-effects.js';
import { drawLaserBeams } from '/laser-tower-effects.js';
import { makeSite } from '/conquest.js';
const T = 48, now = 200000, CW = 252, H = 250;
const rows = [
  ['Sensory crown', 'alert', [['search', { sensor: { mode: 'search', angle: .5, pulseAt: now - 900 } }], ['alarm', { alarm: true, sensor: { mode: 'lost', angle: -.8 } }], ['damaged', { hp: 100 }], ['conquered', { state: 'conquered' }]]],
  ['Bile mortar', 'mortar', [['idle', { mortar: { angle: 0 } }], ['charging, aim 40°', { mortar: { angle: .7, charge: { x: 0, y: 0, fireAt: now + 200 } } }], ['just fired', { mortar: { angle: .7, firedAt: now - 90 } }], ['conquered', { state: 'conquered' }]]],
  ['Blight root', 'modifier', [['idle', {}], ['giant warned 50%', {}, .5], ['giant warned 95%', {}, .95], ['conquered', { state: 'conquered' }]]],
  ['Lance tower', 'laser', [['watching', { laser: { phase: 'watching', angle: 0 } }], ['charging', { laser: { phase: 'charging', angle: .52, remaining: .4 } }], ['firing (beam)', { laser: { phase: 'firing', angle: .52 } }], ['cooling', { laser: { phase: 'cooling', angle: .52, remaining: 3 } }], ['conquered', { state: 'conquered' }]]],
  ['Spore flak', 'anti-air', [['watching', { aa: { phase: 'watching', angle: 0 } }], ['charging', { aa: { phase: 'charging', angle: .78 } }], ['firing', { aa: { phase: 'firing', angle: .78 } }], ['conquered', { state: 'conquered' }]]],
  ['Air contaminator', 'contaminator', [['emitting', {}], ['conquered', { state: 'conquered', conqueredAt: now }]]],
  ['Aquatic hive', 'aquatic-hive', [['full health', { hp: 1500, maxHp: 1500 }], ['regenerating', { hp: 900, maxHp: 1500 }], ['healing suppressed', { hp: 900, maxHp: 1500, hitAt: now - 2000 }], ['conquered', { state: 'conquered' }]]],
];
let id = 1;
for (const [name, kind, states] of rows) {
  const h3 = document.createElement('h3'); h3.textContent = name; document.querySelector('#rows').append(h3);
  const canvas = document.createElement('canvas'), W = CW * 6; canvas.width = W * 2; canvas.height = H * 2; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  document.querySelector('#rows').append(canvas);
  const c = canvas.getContext('2d'); c.scale(2, 2); c.fillStyle = kind === 'aquatic-hive' ? '#33697a' : '#2b4f82'; c.fillRect(0, 0, W, H);
  const sites = [], warnings = [];
  states.forEach(([label, patch, emerging], i) => {
    const site = Object.assign(makeSite(kind, 'site-' + id++, (i * CW + CW / 2) / T - 1.5, (H / 2 + 22) / T - 1.5), { hitAt: -1e9 }, patch);
    if (site.laser?.phase === 'firing') site.laser.beam = { x: site.x + 1.5 + Math.sin(.52) * 3.5, y: site.y + 1.5 - Math.cos(.52) * 3.5 };
    if (emerging) warnings.push({ kind: 'centipede', rootId: site.id, at: now + (1 - emerging) * 10000, windup: 10000 });
    sites.push(site);
  });
  c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
  drawConquest(c, sites, T, 1, now, false, null, [], { centipedes: { warnings } });
  drawLaserBeams(c, sites, T, 1, null, [], () => null);
  c.restore();
  states.forEach(([label], i) => { c.fillStyle = '#f1e6c9'; c.font = '11px monospace'; c.fillText(label, i * CW + 8, 15); });
}
window.ready = true;
</script>`;
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    const file = resolve(root, '.' + url);
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
  await page.locator('#states').screenshot({ path: resolve(out, 'ingame-facilities-v1.png') });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ output: resolve(out, 'ingame-facilities-v1.png') }));
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
