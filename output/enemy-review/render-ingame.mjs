// Renders the in-game enemy art in each animation state, using the real
// renderers in public/. Run from the repo root:
//   node output/enemy-review/render-ingame.mjs
// Read-only preview server: no game server, accounts, or campaign access.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve('public'), out = resolve('output/enemy-review');
const html = `<!doctype html><meta charset="utf-8"><title>Frontier enemy states</title>
<style>body{margin:0;background:#121b22;color:#efe8d7;font-family:Arial,sans-serif}section{padding:30px;width:1580px;box-sizing:border-box}
h1{font-size:28px;margin:0 0 6px}p{color:#b8c5c8;margin:0 0 16px;font-size:15px}h3{margin:14px 0 6px;font-size:15px;color:#ddc296;font-weight:normal}canvas{display:block;border-radius:8px}</style>
<section id="states"><h1>FRONTIER / Enemy art in game, by state</h1><p>Rendered by the game's own renderers (public/enemy-art.js) at 1.4x zoom · labels name the saved state each pose follows</p><div id="rows"></div></section>
<script type="module">
import { drawCrawler } from '/effects.js';
import { drawCentipede } from '/centipede-art.js';
import { drawSwimmer } from '/vehicle-effects.js';
import { drawMobileLaserBeams } from '/mobile-laser-effects.js';
import { mobileBeam, MOBILE_LASERS } from '/mobile-laser.js';
import { enemyPose } from '/enemy-art.js';
const T = 48, S = 1.4, CW = 168, CH = 190, now = 100000;
let id = 1;
function row(title, cells, draw, height = CH, ground = '#2b4f82') {
  const h3 = document.createElement('h3'); h3.textContent = title; document.querySelector('#rows').append(h3);
  const canvas = document.createElement('canvas'), W = CW * cells.length;
  canvas.width = W * 2; canvas.height = height * 2; canvas.style.width = W + 'px'; canvas.style.height = height + 'px';
  document.querySelector('#rows').append(canvas);
  const c = canvas.getContext('2d'); c.scale(2, 2); c.fillStyle = ground; c.fillRect(0, 0, W, height);
  cells.forEach((cell, i) => {
    c.save(); c.beginPath(); c.rect(i * CW, 0, CW, height); c.clip();
    c.fillStyle = i % 2 ? '#ffffff08' : '#00000010'; c.fillRect(i * CW, 0, CW, height);
    c.translate(i * CW + CW / 2, height / 2 + 12); c.scale(S, S); draw(c, cell, id++); c.restore();
    c.fillStyle = '#f1e6c9'; c.font = '11px monospace'; c.fillText(cell.label, i * CW + 8, 15);
  });
}
// Melee crawlers: attack windup/strike and armour hits are saved timestamps.
const melee = kind => [
  { label: 'idle' }, { label: 'walking', stride: .21 }, { label: 'windup 50%', attack: .5 }, { label: 'windup 95%', attack: .95 },
  { label: 'strike', strike: true }, ...(kind === 'bulwark' ? [{ label: 'armour blocked hit', armor: true }] : [{ label: 'hit flash', hit: .8 }]),
  { label: 'burning (fleeing)', behavior: 'fleeing' }, { label: 'remains', dead: true }];
function crawlerState(kind, cell, eid) {
  const e = { id: eid, kind, x: 0, y: 0, angle: 0, hp: 100, behavior: cell.behavior || 'patrolling' };
  if (cell.attack) e.attack = { at: now + (1 - cell.attack) * 1400, windup: 1400 };
  if (cell.strike) e.strike = { at: now - 40 };
  if (cell.armor) e.armorHitAt = now - 80;
  return { e, pose: enemyPose(e, now, cell.stride || 0) };
}
for (const [kind, name] of [['hunter', 'Hunter'], ['breaker', 'Breaker'], ['bulwark', 'Berserker (bulwark kind)']])
  row(name, melee(kind), (c, cell, eid) => { const { e, pose } = crawlerState(kind, cell, eid); drawCrawler(c, { ...e, pose }, 1.3, cell.hit || 0, !!cell.dead, false); });
// Lasers: phase and remaining time come from the saved airLaser state.
const lens = kind => { const p = MOBILE_LASERS[kind]; return [
  { label: 'watching' }, { label: 'walking', stride: .27 }, { label: 'bracing, aim 50°', phase: 'bracing', remaining: p.brace / 2, aim: .87 },
  { label: 'charging 40%', phase: 'charging', remaining: p.charge * .6, aim: .87 }, { label: 'charging 90%', phase: 'charging', remaining: p.charge * .1, aim: .87 },
  { label: 'firing' + (kind === 'twin-lens' ? ' left' : ''), phase: 'firing', remaining: p.burst / 2, aim: .87, lens: 0 },
  ...(kind === 'twin-lens' ? [{ label: 'firing right', phase: 'firing', remaining: p.burst / 3, aim: .87, lens: 1 }] : []),
  { label: 'cooling 70%', phase: 'cooling', remaining: p.cooldown * .7, aim: .87 }, { label: 'remains', dead: true }]; };
for (const [kind, name] of [['twin-lens', 'Twin laser'], ['heavy-lens', 'Heavy laser']])
  row(name, lens(kind), (c, cell, eid) => {
    const e = { id: eid, kind, x: 0, y: 0, angle: -.2, hp: 100, behavior: 'patrolling', airLaser: { phase: cell.phase || 'watching', remaining: cell.remaining || 0, angle: -.2 + (cell.aim || 0), lens: cell.lens } };
    if (cell.phase === 'firing') e.airLaser.beam = mobileBeam(e, e.airLaser.angle, MOBILE_LASERS[kind].range, cell.lens || 0);
    // Draw twice so the eased barrel aim settles on the saved bearing, as it does over frames.
    for (const t of [1, 1.05, 1.1, 1.15, 1.2, 1.25]) { c.save(); c.globalAlpha = t < 1.25 ? 0 : 1; drawCrawler(c, { ...e, pose: enemyPose(e, now, cell.stride || 0) }, t, 0, !!cell.dead, false); c.restore(); }
    if (!cell.dead) drawMobileLaserBeams(c, [e], T, 1);
  }, CH + 20);
// Swimmer: windup from its saved attack; propellers turn with travel.
row('Swimmer', [{ label: 'idle' }, { label: 'moving', stride: .3 }, { label: 'windup 50%', attack: .5 }, { label: 'windup 95%', attack: .95 },
  { label: 'strike', strike: true }, { label: 'hit flash', hit: .8 }, { label: 'burning', burn: true }, { label: 'sand sea', sand: true }], (c, cell, eid) => {
  const e = { id: eid, kind: 'swimmer', x: 0, y: 0, angle: 0, hp: 100 };
  if (cell.attack) e.attack = { at: now + (1 - cell.attack) * 1000, windup: 1000 };
  if (cell.strike) e.strike = { at: now - 40 };
  if (cell.burn) e.burnUntil = now + 1000;
  const world = cell.sand ? { template: 'sirocco-v1', width: 1, height: 1, terrain: [0], waterKinds: [1] } : null;
  drawSwimmer(c, { ...e, pose: enemyPose(e, now, cell.stride || 0) }, 1.3, T, false, cell.hit || 0, world);
}, CH, '#1f5468');
// Centipede: eight saved parts; the flower follows its saved attack.
const chain = curve => Array.from({ length: 8 }, (_, i) => ({ x: -i * .75 + 2.6, y: Math.sin(i * .62) * curve, angle: Math.PI / 2 }));
row('Siege centipede', [{ label: 'walking' }, { label: 'windup 80%', attack: .8 }, { label: 'strike', strike: true }, { label: 'remains (one saved part)', dead: true }].map(x => x), () => {}, 10);
const wrap = document.createElement('canvas'), W = 1360, H = 300; wrap.width = W * 2; wrap.height = H * 2; wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
document.querySelector('#rows').lastElementChild.replaceWith(wrap);
{ const c = wrap.getContext('2d'); c.scale(2, 2); c.fillStyle = '#2b4f82'; c.fillRect(0, 0, W, H);
  const states = [{ label: 'walking', behavior: 'hunting' }, { label: 'windup 80%', attack: .8 }, { label: 'strike', strike: true }];
  states.forEach((cell, i) => {
    const e = { id: 50 + i, kind: 'centipede', hp: 2400, behavior: cell.behavior || 'attacking', body: chain(.3).map(p => ({ ...p, angle: p.angle })) };
    e.angle = Math.PI / 2; e.x = e.body[0].x; e.y = e.body[0].y;
    if (cell.attack) e.attack = { at: now + (1 - cell.attack) * 2200, windup: 2200 };
    if (cell.strike) e.strike = { at: now - 40 };
    c.save(); c.translate(205 + i * 390, 150); c.scale(1.1, 1.1); drawCentipede(c, { ...e, pose: enemyPose(e, now, 0) }, 1.3, T, false, 0, false); c.restore();
    c.fillStyle = '#f1e6c9'; c.font = '11px monospace'; c.fillText(cell.label, 20 + i * 390, 18);
  });
  c.save(); c.translate(1270, 160); c.scale(1.4, 1.4); drawCentipede(c, { kind: 'centipede', x: 0, y: 0, angle: Math.PI / 2, hp: 0 }, 0, T, true, 0, true); c.restore();
  c.fillStyle = '#f1e6c9'; c.font = '11px monospace'; c.fillText('remains (one saved part)', 1185, 18);
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
  await page.locator('#states').screenshot({ path: resolve(out, 'ingame-states-v1.png') });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ output: resolve(out, 'ingame-states-v1.png') }));
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
