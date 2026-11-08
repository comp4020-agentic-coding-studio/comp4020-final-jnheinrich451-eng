import {test, expect} from '@playwright/test';
import {isolatedField} from './rover-helper.js';
import {installWorldAudioProbe} from '../helpers/world-audio-probe.js';

// Transparently meter both output channels. A mono analyser can hide a high
// lateral peak by averaging it with the other channel. These are sampled
// native output values, not an offline true-peak certification of the mix.
function installStereoOutputMeter() {
  const connect = AudioNode.prototype.connect, meters = [];
  window.levelOutput = {left: 0, right: 0, nonFinite: 0};
  AudioNode.prototype.connect = function(destination, ...ports) {
    if (!(destination instanceof AudioDestinationNode)) return connect.call(this, destination, ...ports);
    const splitter = this.context.createChannelSplitter(2), merger = this.context.createChannelMerger(2);
    connect.call(this, splitter, ...ports);
    for (let channel = 0; channel < 2; channel++) {
      const meter = this.context.createAnalyser(); meter.fftSize = 2048;
      connect.call(splitter, meter, channel, 0); connect.call(meter, merger, 0, channel);
      meters.push({meter, channel});
    }
    connect.call(merger, destination);
    return destination;
  };
  setInterval(() => {
    for (const {meter, channel} of meters) {
      const samples = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(samples);
      const key = channel ? 'right' : 'left';
      for (const sample of samples) {
        if (!Number.isFinite(sample)) window.levelOutput.nonFinite++;
        else window.levelOutput[key] = Math.max(window.levelOutput[key], Math.abs(sample));
      }
    }
  }, 8);
}

test('calibrated effects retain native output headroom at full volume', async ({browser}) => {
  test.setTimeout(60000);
  const field = await isolatedField('sound-level-headroom');
  const context = await browser.newContext({viewport: {width: 1920, height: 1080}}), errors = [], measured = [];
  try {
    await context.addInitScript(installWorldAudioProbe);
    await context.addInitScript(installStereoOutputMeter);
    for (const mode of ['colony', 'combat']) {
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(field.base + '/readme/');
      await page.setContent('<button id="unlock">Start output check</button><button id="sound-toggle"></button><input id="sound-volume" type="range" min="0" max="100"><p id="sound-status"></p>');
      await page.evaluate(async mode => {
        localStorage.setItem('frontier-sound', JSON.stringify({enabled: true, volume: 1}));
        const options = {listener: () => ({x: 10, y: 10}), active: () => true};
        if (mode === 'colony') {
          // Deterministic take choice exercises the unusually sharp bite03.
          // The production selector, buffers, mixer and audio nodes still run.
          window.takeChoices = [.7];
          const random = Math.random;
          Math.random = () => window.takeChoices.shift() ?? 0;
          try { window.mixer = (await import('/colony-sound.js')).setupColonySound(options); }
          finally { Math.random = random; }
          window.mixer.ingest({epoch: 'headroom', time: 0, colony: {regionId: 'home', time: 0}});
        } else {
          window.mixer = (await import('/sound.js')).setupSound(options);
          window.mixer.ingest({epoch: 'headroom', time: 0});
        }
      }, mode);
      await page.locator('#unlock').click();
      await expect(page.locator('#sound-status')).toContainText('ready', {timeout: 20000});
      await expect(page.locator('#sound-volume')).toHaveValue('100');
      const report = () => page.evaluate(() => window.worldAudioReport());
      const output = () => page.evaluate(() => ({...window.levelOutput}));
      if (mode === 'colony') {
        expect(await page.evaluate(() => window.mixer.cue('fish-bite', {id: 'sharp-center', x: 10, y: 10}))).toBe(true);
        await expect.poll(async () => (await report()).records[0]?.age).toBeGreaterThan(.025);
        const gain = await page.evaluate(async () => {
          const record = window.worldAudioRecords[0];
          const {SOUND_LEVELS} = await import('/audio/effects/colony/loudness.js');
          const {COLONY_SOUND_PROFILES} = await import('/colony-sound-catalog.js');
          const file = record.file.split('/audio/effects/')[1], level = SOUND_LEVELS[file];
          let peak = 0;
          for (let channel = 0; channel < record.source.buffer.numberOfChannels; channel++) {
            for (const sample of record.source.buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
          }
          const role = COLONY_SOUND_PROFILES['fish-bite'].gain;
          return {file, actual: record.gain.gain.value, expected: level.scale * role, oldPeakOnly: .8 / peak * role};
        });
        expect(gain.file).toBe('colony/sfx_colony_fish_bite_03.ogg');
        expect(Math.abs(gain.actual / gain.expected - 1)).toBeLessThan(.01);
        expect(Math.abs(gain.actual / gain.oldPeakOnly - 1)).toBeGreaterThan(.25);
        await expect.poll(async () => (await report()).active.length, {timeout: 5000}).toBe(0);
        const centered = await output();
        expect(centered.nonFinite).toBe(0);
        expect(Math.max(centered.left, centered.right)).toBeGreaterThan(.0001);
        expect(Math.max(centered.left, centered.right)).toBeLessThan(1);

        // All four actual bite takes overlap at center and either side. The
        // sharp03 returns at the colony's largest pan/attenuation combination.
        const accepted = await page.evaluate(() => {
          window.takeChoices = [0, 0, .9, .9];
          return [10, 11.696, 8.304, 11.696].map((x, index) => window.mixer.cue('fish-bite', {id: 'bite-' + index, x, y: 10}));
        });
        expect(accepted).toEqual([true, true, true, true]);
        await expect.poll(async () => (await report()).active.length, {timeout: 5000}).toBe(0);
        const files = (await report()).records.map(record => record.file.match(/bite_(\d+)\./)?.[1]);
        expect(files).toEqual(['03', '01', '02', '04', '03']);
      } else {
        // A representative busy snapshot, through the real combat event
        // extractor, includes heavy impacts and guns at center and lateral.
        await page.evaluate(() => window.mixer.ingest({epoch: 'headroom', time: 100,
          shots: ['naval-main-shot', 'railway-shot', 'mac-shot'].map((sound, index) =>
            ({id: 'shot-' + index, at: 100, x: 10, y: 10, weapon: 'HE', sound})),
          impacts: ['orbital-impact', 'heavy-bomb-impact', 'mac-impact'].map((sound, index) =>
            ({id: 'impact-' + index, at: 100, x: index ? 16.672 : 10, y: 10, weapon: 'HE', sound})),
        }));
        await expect.poll(async () => (await report()).records.length).toBe(6);
        await expect.poll(async () => (await report()).active.length, {timeout: 7000}).toBe(0);
      }
      const values = await output(), played = await report();
      expect(values.nonFinite).toBe(0);
      expect(Math.max(values.left, values.right)).toBeGreaterThan(.0001);
      expect(Math.max(values.left, values.right)).toBeLessThan(1);
      expect(played.records.every(record => !record.loop && record.file?.endsWith('.ogg'))).toBe(true);
      expect(played.peakVoices).toBeLessThanOrEqual(16);
      measured.push({mode, ...values, voices: played.peakVoices});
      await page.evaluate(() => window.mixer.reset());
      await page.close();
    }
    expect(errors).toEqual([]);
    console.log('PASS calibrated full-volume native output', measured);
  } finally { await context.close(); await field.close(); }
});
