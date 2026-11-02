// Local renderer-only measurement. It creates no accounts, game runtime or save data.
// Before edits, copy public/colony-{art,robot}.js into .local/colony-render-baseline/.
// node scripts/colony-render-probe.mjs baseline|current [output-name]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from '@playwright/test';

const variant = process.argv[2] || 'current';
const label = process.argv[3] || variant;
if (!['baseline', 'current'].includes(variant) || !/^[a-z0-9-]+$/.test(label)) throw Error('Invalid probe arguments');
const root = process.cwd(), output = path.join(root, 'docs/testing/evidence/2026-11-02');
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html><style>html,body{margin:0;overflow:hidden}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas></html>');
      return;
    }
    const name = path.basename(url.pathname);
    if (!/^colony-[a-z-]+\.js$|^colonization\.js$/.test(name)) { res.writeHead(404).end(); return; }
    const captured = variant === 'baseline' && ['colony-art.js', 'colony-robot.js'].includes(name);
    const source = await readFile(path.join(root, captured ? '.local/colony-render-baseline' : 'public', name));
    res.setHeader('Content-Type', 'text/javascript'); res.end(source);
  } catch (error) { res.writeHead(500).end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined, headless: true });
  const results = [];
  for (const settings of [
    { name: 'desktop-starter', width: 1920, height: 1080, dpr: 1, tile: 45, beds: 1, players: 1 },
    { name: 'desktop-full', width: 1920, height: 1080, dpr: 1, tile: 45, beds: 16, players: 4 },
    { name: 'desktop-pan', width: 1920, height: 1080, dpr: 1, tile: 45, beds: 16, players: 4, pan: true },
    { name: 'desktop-district', width: 1920, height: 1080, dpr: 1, tile: 14, beds: 16, players: 4 },
    { name: 'desktop-far-pan', width: 1920, height: 1080, dpr: 1, tile: 78, beds: 16, players: 4, x: 8, y: 8 },
    { name: 'phone-full', width: 390, height: 844, dpr: 2, tile: 29, beds: 16, players: 4 },
  ]) {
    const context = await browser.newContext({ viewport: { width: settings.width, height: settings.height }, deviceScaleFactor: settings.dpr });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async settings => {
      const { createColonyRenderer } = await import('/colony-art.js');
      const { createColony } = await import('/colonization.js');
      const colony = createColony('morrow-v1');
      colony.beds = Array.from({ length: settings.beds }, (_, i) => ({ id: `bed-${i}`, x: [26, 30, 34, 38][i % 4], y: [20, 24, 33, 37][Math.floor(i / 4)], crop: ['sundrop', 'moonberry', 'cloudmelon'][i % 3], growth: 160, water: 80, harvests: 1, revision: 1 }));
      colony.sprinklers = settings.beds > 1 ? Array.from({ length: 8 }, (_, i) => ({ id: `sprinkler-${i}`, x: 26 + i % 4 * 4, y: 29 + Math.floor(i / 4) * 7 })) : [];
      const players = Array.from({ length: settings.players }, (_, i) => ({ id: `player-${i}`, name: 'Gardener', x: 32 + i * 2, y: 30, angle: i * Math.PI / 2, vx: 1, vy: 0 }));
      window.fixture = { pan: !!settings.pan, renderer: createColonyRenderer(document.querySelector('canvas')), args: { world: colony.world, colony, players, me: players[0], camera: { x: settings.x ?? 36, y: settings.y ?? 29, tile: settings.tile }, time: 0, reduced: false } };
      window.fixture.renderer.draw(window.fixture.args);
    }, settings);
    const measurements = await page.evaluate(async () => {
      const { renderer, args } = window.fixture, times = [], frames = [];
      let previous;
      for (let i = 0; i < 210; i++) {
        const now = await new Promise(requestAnimationFrame);
        args.time = i / 60;
        if (window.fixture.pan) args.camera.x = 36 + Math.sin(i / 60) * 3;
        // Repeated new snapshot objects must not invalidate unchanged artwork.
        if (i % 7 === 0) args.colony = structuredClone(args.colony);
        const start = performance.now(); renderer.draw(args); const duration = performance.now() - start;
        if (i >= 30) { times.push(duration); frames.push(now - previous); }
        previous = now;
      }
      const summary = samples => {
        const sorted = [...samples].sort((a, b) => a - b);
        return { mean: samples.reduce((a, b) => a + b, 0) / samples.length, p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1) };
      };
      args.time = 2; renderer.draw(args);
      const context = document.querySelector('canvas').getContext('2d'), canvasCalls = {};
      for (const name of ['beginPath', 'fill', 'stroke', 'drawImage']) {
        const original = context[name]; canvasCalls[name] = 0;
        context[name] = function (...values) { canvasCalls[name]++; return original.apply(this, values); };
      }
      renderer.draw(args);
      return { drawMs: summary(times), frameMs: summary(frames), framesOver25ms: frames.filter(v => v > 25).length, samples: times.length, canvasCalls };
    });
    await page.screenshot({ path: path.join(output, `colony-render-${label}-${settings.name}.png`) });
    results.push({ ...settings, ...measurements });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
  const sources = {};
  for (const name of ['colony-art.js', 'colony-robot.js']) sources[name] = createHash('sha256').update(await readFile(path.join(root, variant === 'baseline' ? '.local/colony-render-baseline' : 'public', name))).digest('hex');
  await writeFile(path.join(output, `colony-render-${label}.json`), JSON.stringify({ variant, label, capturedAt: new Date().toISOString(), browser: await browser.version(), scope: 'Local headless Chrome renderer-only synthetic fixture; no app, networking, server tick, real saves or hardware capacity claim. Full garden exercises rendering limits; scene placement is synthetic.', sources, results }, null, 2) + '\n');
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
