import {test, expect} from '@playwright/test';
import {isolatedField} from './rover-helper.js';
import {installWorldAudioProbe} from '../helpers/world-audio-probe.js';

for (const fallback of [false, true]) test(`colony recordings, variations and mixer lifecycle / ${fallback ? 'phone PCM fallback' : 'desktop Ogg'}`, async ({browser}) => {
  test.setTimeout(120000);
  const field = await isolatedField('colony-audio-mixer-' + Number(fallback));
  const context = await browser.newContext({viewport: fallback ? {width: 390, height: 844} : {width: 1920, height: 1080}, isMobile: fallback, hasTouch: fallback});
  const errors = [], requested = new Set();
  try {
    await context.addInitScript(installWorldAudioProbe);
    // A real invalid compressed payload exercises decode failure and the PCM
    // recovery path, without replacing AudioContext or successful decoding.
    if (fallback) await context.route('**/audio/effects/colony/*.ogg', route => route.fulfill({status: 200, contentType: 'audio/ogg', body: 'not an Ogg audio file'}));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/audio/effects/')) requested.add(new URL(request.url()).pathname); });
    await page.goto(field.base + '/readme/');
    await page.setContent('<button id="sound-toggle"></button><button id="sound-quick">Effects</button><input id="sound-volume" type="range" min="0" max="100"><p id="sound-status"></p>');
    await page.evaluate(async () => {
      localStorage.removeItem('frontier-sound');
      window.soundActive = true; window.clock = 0; window.listener = {x: 10, y: 10};
      window.scene = {events: [], loops: []};
      // Detector transitions are covered by pure state tests. Supply synthetic
      // detector results here to isolate playback with real native audio nodes.
      const {ColonySoundEvents} = await import('/colony-sound-events.js');
      ColonySoundEvents.prototype.ingest = () => window.scene;
      window.mixer = (await import('/colony-sound.js')).setupColonySound({listener: () => window.listener, active: () => window.soundActive});
      window.feed = (step = .1) => { window.clock += step; window.mixer.ingest({epoch: 'mixer-test', time: window.clock, colony: {regionId: 'home'}}); window.scene.events = []; };
      window.resetMixer = () => { clearInterval(window.audioFeed); clearInterval(window.reelFeed); window.audioFeed = null; window.reelFeed = null; window.mixer.reset(); window.scene = {events: [], loops: []}; window.clock = 0; window.feed(); };
      window.runMachine = () => { window.resetMixer(); window.scene.loops = [{kind: 'machine-work', id: 'processor', x: 10, y: 10}]; window.feed(); window.audioFeed = setInterval(() => window.feed(), 100); };
      window.resetMixer();
    });
    await page.locator('#sound-volume').click();
    await expect(page.locator('#sound-status')).toContainText('ready', {timeout: 30000});
    expect([...requested].filter(url => url.endsWith('.ogg'))).toHaveLength(52);
    expect([...requested].filter(url => url.endsWith('.wav'))).toHaveLength(fallback ? 52 : 0);
    expect([...requested].every(url => url.includes('/effects/colony/'))).toBe(true);
    const report = () => page.evaluate(() => window.worldAudioReport());
    const files = (value, fragment) => value.records.filter(record => record.file?.includes(fragment)).map(record => record.file.split('/').pop());
    for (let n = 0; n < 4; n++) {
      expect(await page.evaluate(() => window.mixer.cue('spider-step', {x: 10, y: 10}))).toBe(true);
      // Enforce audible stride spacing, not a simultaneous burst of footsteps.
      await page.waitForTimeout(100);
    }
    const extension = fallback ? 'wav' : 'ogg';
    expect(files(await report(), 'spider_step')).toEqual(['01', '02', '01', '02'].map(number => `sfx_colony_spider_step_${number}.${extension}`));
    await page.locator('#sound-quick').click();
    expect(await page.evaluate(() => window.mixer.cue('spider-step', {x: 10, y: 10}))).toBe(false);
    await page.locator('#sound-quick').click();
    await expect(page.locator('#sound-status')).toContainText('ready');
    expect(await page.evaluate(() => window.mixer.cue('spider-step', {x: 10, y: 10}))).toBe(true);
    expect(files(await report(), 'spider_step').at(-1)).toBe(`sfx_colony_spider_step_01.${extension}`);
    for (let n = 0; n < 10; n++) {
      expect(await page.evaluate(() => window.mixer.cue('spider-curious', {local: true}))).toBe(true);
      await page.waitForTimeout(90);
    }
    const curious = files(await report(), 'spider_curious');
    expect(curious).toHaveLength(10);
    expect(curious.every((file, index) => !index || file !== curious[index - 1])).toBe(true);
    expect(new Set(curious).size).toBeGreaterThan(1);
    await expect.poll(async () => (await report()).signal).toBeGreaterThan(.0001);

    await page.evaluate(() => window.runMachine());
    await expect.poll(async () => (await report()).active.filter(sound => sound.loop).length).toBe(1);
    const running = await report(), starts = running.records.length;
    await expect.poll(async () => (await report()).active[0]?.age, {timeout: 7000}).toBeGreaterThan(running.active[0].duration + .2);
    await page.evaluate(() => { window.worldAudioPeak = 0; });
    await expect.poll(async () => (await report()).signal).toBeGreaterThan(.0001);
    expect((await report()).records).toHaveLength(starts);
    const settled = await report();
    await page.evaluate(() => { window.scene.loops[0].x = 15; });
    await expect.poll(async () => (await report()).active[0]?.pan).toBeGreaterThan(.4);
    expect((await report()).active[0].gain).toBeLessThan(settled.active[0].gain);
    expect((await report()).records).toHaveLength(starts);
    await page.evaluate(() => { window.mixer.setReeling(true); window.reelFeed = setInterval(() => window.mixer.setReeling(true), 50); });
    await expect.poll(async () => (await report()).active.some(sound => sound.file?.includes('fish_reel'))).toBe(true);
    await page.evaluate(() => { clearInterval(window.reelFeed); window.mixer.setReeling(false); });
    await expect.poll(async () => (await report()).active.some(sound => sound.file?.includes('fish_reel'))).toBe(false);
    expect((await report()).active.some(sound => sound.file?.includes('machine_work'))).toBe(true);

    for (const boundary of ['mute', 'zero-volume', 'hidden', 'inactive', 'reset', 'missing-snapshots', 'frozen-snapshots', 'frozen-with-held-reel']) {
      await page.evaluate(() => window.runMachine());
      await expect.poll(async () => (await report()).active.length).toBe(1);
      if (boundary === 'frozen-with-held-reel') {
        await page.evaluate(() => { window.mixer.setReeling(true); window.reelFeed = setInterval(() => window.mixer.setReeling(true), 30); });
        await expect.poll(async () => (await report()).active.some(sound => sound.file?.includes('fish_reel'))).toBe(true);
      }
      if (boundary === 'mute') await page.locator('#sound-toggle').click();
      else await page.evaluate(boundary => {
        if (boundary === 'zero-volume') { const slider = document.getElementById('sound-volume'); slider.value = '0'; slider.dispatchEvent(new Event('input')); }
        if (boundary === 'hidden') { Object.defineProperty(document, 'hidden', {configurable: true, value: true}); document.dispatchEvent(new Event('visibilitychange')); }
        if (boundary === 'inactive') window.soundActive = false;
        if (boundary === 'reset') { clearInterval(window.audioFeed); window.mixer.reset(); }
        if (boundary === 'missing-snapshots') clearInterval(window.audioFeed);
        if (boundary === 'frozen-snapshots' || boundary === 'frozen-with-held-reel') { clearInterval(window.audioFeed); window.audioFeed = setInterval(() => window.feed(0), 100); }
      }, boundary);
      await expect.poll(async () => (await report()).active.length, {timeout: 2000, message: boundary}).toBe(0);
      await page.evaluate(() => {
        window.resetMixer(); window.soundActive = true;
        if (document.hidden) { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); }
        const slider = document.getElementById('sound-volume'); slider.value = '55'; slider.dispatchEvent(new Event('input'));
      });
      if (boundary === 'mute') await page.locator('#sound-toggle').click();
      await expect(page.locator('#sound-status')).toContainText('ready');
    }
    await page.evaluate(() => {
      window.resetMixer(); window.scene.loops = Array.from({length: 12}, (_, index) => ({kind: 'machine-work', id: 'machine-' + index, x: 10 + index / 10, y: 10}));
      window.feed(); window.audioFeed = setInterval(() => window.feed(), 100);
      for (let index = 0; index < 40; index++) window.mixer.cue('spider-happy', {id: 'pet-' + index, local: true});
    });
    await expect.poll(async () => (await report()).active.length).toBeGreaterThan(0);
    const bounded = await report();
    expect(bounded.active.filter(sound => sound.loop).length).toBeLessThanOrEqual(4);
    expect(bounded.peakVoices).toBeLessThanOrEqual(16);
    expect(bounded.records.filter(sound => !sound.loop).every(sound => !sound.file.includes('_loop.'))).toBe(true);
    await page.evaluate(() => window.resetMixer());
    expect(errors).toEqual([]);
    console.log('PASS colony native mixer', {fallback, sources: 52, peak: bounded.signal, peakVoices: bounded.peakVoices, footsteps: '01,02,01,02'});
  } finally { await context.close(); await field.close(); }
});
