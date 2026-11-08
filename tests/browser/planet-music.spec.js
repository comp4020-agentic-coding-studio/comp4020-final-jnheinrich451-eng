import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

const assignments = [
  { mode: 'combat', template: 'caldera-v1', title: 'Apex of Conquest', file: 'Apex_Of_Conquest.mp3' },
  { mode: 'combat', template: 'sirocco-v1', title: 'Crimson Vanguard', file: 'Crimson_Vanguard.mp3' },
  { mode: 'combat', template: 'vesper-v1', title: 'Steel Wrought Ascent', file: 'Steel_Wrought_Ascent.mp3' },
  { mode: 'colonization', template: 'morrow-v1', title: 'Twilight Over the Still Lake', file: 'Twilight_Over_the_Still_Lake_Colonization.mp3' },
  { mode: 'colonization', template: 'nacre-v1', title: 'Harvest at Low Tide', file: 'Harvest_at_Low_Tide_Colonnization.mp3' },
  { mode: 'colonization', template: 'aurelia-v1', title: 'Sun Drenched Sanctuary', file: 'Sun_Drenched_Sanctuary_Colonization.mp3' },
];

// Sample the native media element's output without replacing its speaker path.
// The capture analyser has a silent sink, so it cannot add duplicate playback.
async function musicOutput(page) {
  await page.evaluate(async () => {
    const audio = document.getElementById('background-music');
    const stream = audio.captureStream(), context = new AudioContext();
    const analyser = context.createAnalyser(), sink = context.createGain();
    sink.gain.value = 0;
    context.createMediaStreamSource(stream).connect(analyser);
    analyser.connect(sink); sink.connect(context.destination);
    await context.resume();
    window.musicCapture = { context, stream, analyser, samples: new Float32Array(analyser.fftSize) };
  });
  let peak = 0;
  try {
    await expect.poll(async () => {
      peak = await page.evaluate(() => {
        const { analyser, samples } = window.musicCapture;
        analyser.getFloatTimeDomainData(samples);
        return samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
      });
      return peak;
    }, { timeout: 10000 }).toBeGreaterThan(.0001);
    return peak;
  } finally {
    await page.evaluate(async () => {
      const { context, stream } = window.musicCapture;
      stream.getTracks().forEach(track => track.stop());
      await context.close(); delete window.musicCapture;
    });
  }
}

for (const mobile of [false, true]) test(`each planet plays its assigned music / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(120000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-planet-music-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const value = await response.json(); expect(response.ok(), JSON.stringify(value)).toBe(true); return value;
    };
    const credentials = { name: 'Music keeper', email: 'music@frontier.test', password: 'isolated planet soundtrack password 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    await context.addInitScript(() => {
      window.musicLoads = 0;
      document.addEventListener('loadstart', event => { if (event.target.id === 'background-music') window.musicLoads++; }, true);
    });
    const page = await context.newPage(), errors = [], evidence = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const [index, assignment] of assignments.entries()) {
      const { mode, template, title, file } = assignment, colony = mode === 'colonization';
      const { id } = await post('/api/campaigns/create', { name: title, mode, template });
      await post('/api/campaigns/enter', { id });
      await page.goto(`${base}/${colony ? 'colony/' : ''}?campaign=${id}`);
      if (colony) {
        await expect(page.locator('#colony-loading')).toBeHidden();
        await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
        await page.locator('#room-open').click();
      } else {
        await expect(page.locator('#connection')).toContainText('live');
        await page.locator('#hud-menu-button').click();
        await page.locator('#help-button').click();
      }
      const audio = page.locator('#background-music');
      await expect(audio).toHaveCount(1);
      await expect(audio).toHaveAttribute('src', '/audio/' + file);
      await expect(page.locator('#music-track')).toContainText(title);
      await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed', String(index === 0));
      if (index > 0) {
        expect(await audio.evaluate(element => element.paused)).toBe(true);
        await expect(page.locator('#music-volume')).toHaveValue('40');
        await page.locator('#music-toggle').click();
      } else {
        await page.locator('#music-volume').fill('40');
        await page.locator('#sound-toggle').click();
        await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
      }
      await expect.poll(() => audio.evaluate(element => !element.paused && element.currentTime > .25 && Number.isFinite(element.duration))).toBe(true);
      await expect(page.locator('#music-status')).toContainText(title);
      const peak = await musicOutput(page);
      const before = await audio.evaluate(element => ({ time: element.currentTime, loads: window.musicLoads, duration: element.duration, volume: element.volume, loop: element.loop }));
      expect(before.duration).toBeGreaterThan(30); expect(before.volume).toBe(.4); expect(before.loop).toBe(true);
      // Room snapshots continue while the soundtrack advances; they must not reload it.
      await expect.poll(() => audio.evaluate(element => element.currentTime)).toBeGreaterThan(before.time + .35);
      expect(await page.evaluate(() => window.musicLoads)).toBe(before.loads);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-sound')).enabled)).toBe(false);
      const response = await context.request.get(base + '/audio/' + file);
      expect(response.headers()['content-type']).toBe('audio/mpeg');
      expect((await response.body()).length).toBeGreaterThan(4000000);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#music-toggle').scrollIntoViewIfNeeded();
      const controls = await page.locator('.music-settings').last().boundingBox();
      expect(controls.x).toBeGreaterThanOrEqual(0);
      expect(controls.x + controls.width).toBeLessThanOrEqual(mobile ? 390 : 1920);
      await page.screenshot({ path: info.outputPath(template + '.png') });
      if (colony) {
        if (template === 'morrow-v1') {
          const original = page.viewportSize(), resized = mobile ? { width: 844, height: 390 } : { width: 1024, height: 768 };
          await page.setViewportSize(resized);
          await page.locator('#music-volume').scrollIntoViewIfNeeded();
          const resizedSlider = await page.locator('#music-volume').boundingBox();
          expect(resizedSlider.x).toBeGreaterThanOrEqual(0);
          expect(resizedSlider.x + resizedSlider.width).toBeLessThanOrEqual(resized.width);
          expect(resizedSlider.y).toBeGreaterThanOrEqual(0);
          expect(resizedSlider.y + resizedSlider.height).toBeLessThanOrEqual(resized.height);
          await page.screenshot({ path: info.outputPath('morrow-resized.png') });
          await page.setViewportSize(original);
        }
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        expect(await audio.evaluate(element => element.paused)).toBe(true);
        await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
        await expect.poll(() => audio.evaluate(element => !element.paused)).toBe(true);
        // The controls keep their native keyboard semantics in the Crew menu.
        await page.locator('#music-volume').focus(); await page.keyboard.press('ArrowRight');
        await expect(page.locator('#music-volume')).toHaveValue('41');
        await page.keyboard.press('ArrowLeft'); await expect(page.locator('#music-volume')).toHaveValue('40');
      }
      await page.locator('#music-toggle').click();
      expect(await audio.evaluate(element => element.paused)).toBe(true);
      evidence.push({ template, file, duration: before.duration, peak, loads: before.loads });
      await page.goto('about:blank'); await post('/api/campaigns/leave', { id });
    }
    expect(errors).toEqual([]);
    console.log('PASS assigned planet music', mobile ? 'phone' : 'desktop', JSON.stringify(evidence));
  } finally {
    await context?.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-planet-music-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
