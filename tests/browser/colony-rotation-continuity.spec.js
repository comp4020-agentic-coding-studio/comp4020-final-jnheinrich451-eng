import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

async function fixture(browser, mobile, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-rotation-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const value = await response.json(); expect(response.ok(), JSON.stringify(value)).toBe(true); return value;
    };
    const credentials = { name: 'Rotation Keeper', email: 'rotation@frontier.test', password: 'isolated continuity password 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    await context.addInitScript(() => {
      window.rotationFrames = [];
      const rasters = new WeakMap(), captures = new WeakMap(); let nextId = 1;
      const upload = CanvasRenderingContext2D.prototype.putImageData;
      CanvasRenderingContext2D.prototype.putImageData = function(pixels) {
        if ([320, 448].includes(this.canvas.width) && this.canvas.height === this.canvas.width) {
          // Real rendered RGB samples, including the terminator and lit limb.
          // Copies stay immutable when the sphere cache updates its ImageData.
          const size = this.canvas.width, samples = [];
          for (let y = 1; y < 32; y++) for (let x = 1; x < 32; x++) {
            if (Math.hypot(x / 16 - 1, y / 16 - 1) > .96) continue;
            const offset = (Math.floor(y * size / 32) * size + Math.floor(x * size / 32)) * 4;
            samples.push(pixels.data[offset], pixels.data[offset + 1], pixels.data[offset + 2]);
          }
          const old = rasters.get(this.canvas);
          const hash = samples.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
          rasters.set(this.canvas, { id: old?.id || nextId++, version: (old?.version || 0) + 1, at: performance.now(), hash, samples });
        }
        return upload.apply(this, arguments);
      };
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function() { captures.delete(this.canvas); return clear.apply(this, arguments); };
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(source, x, y, width, height) {
        if (arguments.length === 5 && source instanceof HTMLCanvasElement) {
          const raster = rasters.get(source), capture = captures.get(source), screen = this.canvas.classList.contains('entry-scene');
          if (raster) {
            const value = { raster, x, y, width, height };
            if (!screen) captures.set(this.canvas, value);
            else window.rotationFrames.push({ kind: 'live', phase: document.body.dataset.entryWormhole || null, at: performance.now(), ...value });
          } else if (screen && capture) {
            window.rotationFrames.push({ kind: 'snapshot', phase: document.body.dataset.entryWormhole || null, at: performance.now(),
              sourceWidth: source.width, sourceHeight: source.height, screenWidth: this.canvas.width, screenHeight: this.canvas.height, ...capture });
          }
        }
        return draw.apply(this, arguments);
      };
    });
    const page = await context.newPage(), errors = [];
    // Optional saved source allows proving the regression against its original
    // renderer without modifying the shared checkout or any developer saves.
    if (process.env.FRONTIER_ROTATION_BASELINE) await page.route('**/entry-scene.js', route => route.fulfill({ path: process.env.FRONTIER_ROTATION_BASELINE, contentType: 'text/javascript' }));
    page.on('pageerror', error => errors.push(error.message));
    await run({ base, page });
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-rotation-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
}

for (const mobile of [false, true]) for (const direction of ['gold', 'blue']) {
  test(`destination rotation and light continue through ${direction} lens handoff / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
    await fixture(browser, mobile, async ({ base, page }) => {
      const body = page.locator('body');
      await page.goto(base + '/campaigns/' + (direction === 'blue' ? '#view=colony&mode=colonization&planet=morrow-v1' : ''));
      await expect(body).toHaveAttribute('data-scene-ready', 'canvas');
      await expect.poll(() => page.evaluate(() => window.rotationFrames.filter(frame => frame.kind === 'live').length)).toBeGreaterThan(8);
      await page.evaluate(id => { window.rotationFrames = []; document.getElementById(id).click(); }, direction === 'gold' ? 'colonization-game' : 'war-zone');
      await expect(body).toHaveAttribute('data-entry-wormhole-direction', direction);
      await expect(body).toHaveAttribute('data-entry-wormhole', 'expand');
      await expect.poll(() => body.getAttribute('data-entry-wormhole'), { timeout: 6000 }).toBeNull();
      await expect.poll(() => page.evaluate(() => window.rotationFrames.filter(frame => frame.kind === 'live' && !frame.phase).length)).toBeGreaterThan(35);
      const metrics = await page.evaluate(() => {
        const expansion = window.rotationFrames.filter(frame => frame.kind === 'snapshot' && frame.phase === 'expand');
        const last = expansion.at(-1);
        const live = window.rotationFrames.filter(frame => frame.kind === 'live' && !frame.phase && frame.at > last.at);
        const first = live[0];
        const difference = (a, b) => a.samples.reduce((sum, value, index) => sum + Math.abs(value - b.samples[index]), 0) / a.samples.length;
        const unique = frames => frames.filter((frame, index) => !index || frame.raster.hash !== frames[index - 1].raster.hash);
        const ordinary = unique(live), steps = ordinary.slice(1).map((frame, index) => difference(ordinary[index].raster, frame.raster));
        return {
          expansionFrames: expansion.length,
          expansionRasterVersions: new Set(expansion.map(frame => frame.raster.version)).size,
          expansionPixelSamples: new Set(expansion.map(frame => frame.raster.hash)).size,
          lastVisibleSampleAgeMs: last.at - last.raster.at,
          sphereIdentityPreserved: last.raster.id === first.raster.id,
          snapshotResolutionMatches: expansion.every(frame => frame.sourceWidth === frame.screenWidth && frame.sourceHeight === frame.screenHeight),
          geometryDelta: Math.max(...['x', 'y', 'width', 'height'].map(key => Math.abs(last[key] - first[key]))),
          handoffPixelDelta: difference(last.raster, first.raster),
          ordinaryPixelStepMax: Math.max(0, ...steps),
          ordinarySampleCount: ordinary.length,
          handoffFrameGapMs: first.at - last.at,
        };
      });
      await writeFile(info.outputPath(`rotation-${direction}-${mobile ? 'phone' : 'desktop'}.json`), JSON.stringify(metrics, null, 2));
      // A frozen incoming picture can expand smoothly but jumps its texture and
      // lighting on return to live rendering; inspect the raster, not markers.
      expect(metrics.expansionFrames).toBeGreaterThan(8);
      expect(metrics.expansionRasterVersions).toBeGreaterThanOrEqual(3);
      expect(metrics.expansionPixelSamples).toBeGreaterThanOrEqual(3);
      expect(metrics.lastVisibleSampleAgeMs).toBeLessThan(260);
      expect(metrics.sphereIdentityPreserved).toBe(true);
      expect(metrics.snapshotResolutionMatches).toBe(true);
      expect(metrics.geometryDelta).toBeLessThan(2);
      expect(metrics.ordinarySampleCount).toBeGreaterThanOrEqual(3);
      expect(metrics.handoffPixelDelta).toBeLessThanOrEqual(Math.max(.08, metrics.ordinaryPixelStepMax * 2));
    });
  });
}
