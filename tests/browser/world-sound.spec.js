import { test, expect } from '@playwright/test';
import { isolatedField } from './rover-helper.js';
import { installWorldAudioProbe } from '../helpers/world-audio-probe.js';

for (const mobile of [false, true]) test(`deployment timing and continuous vehicle audio / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(120000);
  const field = await isolatedField('world-audio-' + (mobile ? 'phone' : 'desktop'));
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
  const errors = [];
  try {
    await context.addInitScript(installWorldAudioProbe);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(field.base + '/?legacy=1'); await expect(page.locator('#connection')).toContainText('live');
    await page.locator('#hud-menu-button').click(); await page.locator('#help-button').click();
    await expect(page.locator('#sound-status')).toContainText('ready', { timeout: 20000 });
    await page.keyboard.press('Escape');
    const accepted = await page.evaluate(async () => {
      const response = await fetch('/api/cores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 60, y: 30 }) });
      return { status: response.status, value: await response.json() };
    });
    expect(accepted.status, JSON.stringify(accepted.value)).toBe(201);
    const report = target => target.evaluate(() => window.worldAudioReport());
    const count = (r, file) => r.records.filter(sound => sound.file?.includes(file)).length;
    await expect.poll(async () => count(await report(page), 'sfx_pod_ground_impact_01'), { timeout: 6000 }).toBe(1);
    await expect.poll(async () => count(await report(page), 'sfx_pod_panel_ground_slam_01'), { timeout: 6000 }).toBe(4);
    const deployment = await report(page);
    expect(count(deployment, 'sfx_pod_panel_open_01')).toBe(4);
    expect(deployment.signal).toBeGreaterThan(.0001);
    expect(deployment.records.filter(s => s.file?.includes('sfx_pod_panel_open_01')).every(s => !s.loop && s.end - s.start <= .56)).toBe(true);
    expect(deployment.records.filter(s => s.file?.includes('sfx_pod_panel_ground_slam_01')).every(s => !s.loop)).toBe(true);
    await page.screenshot({ path: info.outputPath('core-panels.png') });
    // A reconnect observes the already landed pod without replaying its impacts.
    await page.reload(); await expect(page.locator('#connection')).toContainText('live');
    await page.locator('#hud-menu-button').click(); await page.locator('#help-button').click();
    await expect(page.locator('#sound-status')).toContainText('ready', { timeout: 20000 });
    expect((await report(page)).records.filter(s => !s.loop)).toHaveLength(0);
    await page.close();

    // Deterministic authoritative-shaped snapshots exercise loop lifetimes with
    // native decoded buffers, without changing a game save or faking output.
    const mixer = await context.newPage(); mixer.on('pageerror', error => errors.push(error.message));
    await mixer.goto(field.base + '/readme/');
    await mixer.setContent('<button id="sound-toggle"></button><input id="sound-volume" type="range" min="0" max="100"><p id="sound-status"></p>');
    await mixer.evaluate(async () => {
      localStorage.removeItem('frontier-sound'); window.soundActive = true; window.listener = { x: 10, y: 10 }; window.clock = 0;
      window.emptyAudioWorld = () => ({ cores: [], tanks: [], ships: [], airbases: [], logistics: { cargoPods: [], recyclers: [] } });
      window.audioWorld = window.emptyAudioWorld();
      window.mixer = (await import('/sound.js')).setupSound({ listener: () => window.listener, active: () => window.soundActive });
      window.feedWorld = (step = 100, shots = []) => { window.clock += step; window.mixer.ingest({ epoch: 'vehicle-browser', time: window.clock, world: window.audioWorld, players: [], shots }); };
      window.resetWorld = () => { clearInterval(window.worldFeed); window.worldFeed = null; window.mixer.reset(); window.audioWorld = window.emptyAudioWorld(); window.clock = 0; window.feedWorld(); };
      window.runWorld = () => { clearInterval(window.worldFeed); window.feedWorld(); window.worldFeed = setInterval(() => window.feedWorld(), 100); };
      window.resetWorld();
    });
    await mixer.locator('#sound-volume').click(); await expect(mixer.locator('#sound-status')).toContainText('ready', { timeout: 20000 });
    await mixer.evaluate(() => {
      window.audioWorld.tanks = [{ id: 'tank', x: 10, y: 10, podX: 9, podY: 9, elapsed: 4.5, occupant: 'pilot', health: 200, vx: 1, vy: 0, driveSpeed: 1, angle: 0, turret: 0 }];
      window.runWorld();
    });
    await expect.poll(async () => (await report(mixer)).active.filter(s => s.loop).length).toBe(3);
    const running = await report(mixer), tankStarts = running.records.length;
    expect(running.active.every(s => s.loop)).toBe(true);
    await expect.poll(async () => (await report(mixer)).active.find(s => s.file?.includes('sfx_vehicle_tracks_loop'))?.age, { timeout: 7000 }).toBeGreaterThan(running.active[0].duration + .2);
    await mixer.evaluate(() => { window.worldAudioPeak = 0; });
    await expect.poll(async () => (await report(mixer)).signal, { message: 'Continuous engines must still reach the output after a complete loop period' }).toBeGreaterThan(.0001);
    const steady = await report(mixer);
    expect(steady.records).toHaveLength(tankStarts);
    expect(steady.signal).toBeGreaterThan(.0001);
    // The same source is spatialized continuously rather than restarted.
    await mixer.evaluate(() => { window.audioWorld.tanks[0].x = 16; });
    await expect.poll(async () => (await report(mixer)).active.find(s => s.file?.includes('sfx_vehicle_tracks_loop'))?.pan).toBeGreaterThan(.3);
    const moved = await report(mixer);
    expect(moved.active.find(s => s.file?.includes('sfx_vehicle_tracks_loop')).gain).toBeLessThan(steady.active.find(s => s.file?.includes('sfx_vehicle_tracks_loop')).gain);
    expect(moved.records).toHaveLength(tankStarts);
    await mixer.evaluate(() => { Object.assign(window.audioWorld.tanks[0], { vx: 0, vy: 0, driveSpeed: 0 }); });
    await expect.poll(async () => (await report(mixer)).active.length).toBe(1);
    expect((await report(mixer)).active[0].file).toContain('sfx_vehicle_engine_idle_loop');
    await mixer.evaluate(() => { window.audioWorld.tanks[0].occupant = null; });
    await expect.poll(async () => (await report(mixer)).active.length).toBe(0);

    // Transported tank saves may retain zero velocity fields even while the
    // server advances the hull position. Actual movement must still be audible.
    await mixer.evaluate(() => {
      window.resetWorld();
      window.audioWorld.tanks = [{ id: 'transferred', x: 10, y: 10, podX: 9, podY: 9, elapsed: 4.5, occupant: 'pilot', health: 200, vx: 0, vy: 0, speed: 0, driveSpeed: 0, angle: 0, turret: 0 }];
      window.feedWorld(); window.worldFeed = setInterval(() => { window.audioWorld.tanks[0].x += .1; window.feedWorld(); }, 100);
    });
    await expect.poll(async () => (await report(mixer)).active.filter(s => s.file?.includes('sfx_vehicle_')).length).toBe(3);
    expect((await report(mixer)).active.some(s => s.file?.includes('sfx_vehicle_tracks_loop'))).toBe(true);

    const beginJet = () => mixer.evaluate(() => {
      window.resetWorld(); window.audioWorld.airbases = [{ id: 'base', aircraft: { id: 'jet', kind: 'attack-jet', state: 'flying', x: 10, y: 10, speed: 8, health: 180 } }]; window.runWorld();
    });
    await beginJet(); await expect.poll(async () => (await report(mixer)).active.length).toBe(1);
    expect((await report(mixer)).active[0].file).toContain('sfx_jet_engine_loop');
    await mixer.evaluate(() => { window.audioWorld.airbases[0].aircraft.state = 'landing'; window.feedWorld(); window.audioWorld.airbases[0].aircraft.state = 'parked'; window.feedWorld(); });
    await expect.poll(async () => (await report(mixer)).active.filter(s => s.loop).length).toBe(0);
    await expect.poll(async () => count(await report(mixer), 'sfx_mechanical_servo_loop')).toBe(1);
    expect((await report(mixer)).records.at(-1).loop).toBe(false); // supplied touchdown/servo filenames are swapped
    await beginJet(); await expect.poll(async () => (await report(mixer)).active.length).toBe(1);
    await mixer.evaluate(() => { Object.assign(window.audioWorld.airbases[0].aircraft, { health: 0, state: 'destroyed' }); });
    await expect.poll(async () => (await report(mixer)).active.length).toBe(0);

    await mixer.evaluate(() => {
      window.resetWorld(); window.audioWorld.template = 'sirocco-v1';
      window.audioWorld.ships = [{ id: 'ship', x: 10, y: 10, elapsed: 4.5, occupant: 'pilot', health: 300, speed: 2, driveSpeed: 2, throttle: 1, angle: 0, turnRate: 0 }]; window.runWorld();
    });
    await expect.poll(async () => (await report(mixer)).active.some(s => s.file?.includes('sfx_ship_sand_slide_loop'))).toBe(true);
    expect((await report(mixer)).active.some(s => s.file?.includes('sfx_ship_wake_loop'))).toBe(false);
    await mixer.evaluate(() => { window.audioWorld.template = 'caldera-v1'; });
    await expect.poll(async () => (await report(mixer)).active.some(s => s.file?.includes('sfx_ship_wake_loop'))).toBe(true);
    await expect.poll(async () => (await report(mixer)).active.some(s => s.file?.includes('sfx_ship_sand_slide_loop'))).toBe(false);

    // A continuing nearby emitter stops under every lifecycle boundary.
    for (const boundary of ['mute', 'hidden', 'inactive', 'reset', 'missing-snapshots', 'frozen-snapshots']) {
      await beginJet(); await expect.poll(async () => (await report(mixer)).active.length).toBe(1);
      if (boundary === 'mute') await mixer.locator('#sound-toggle').click();
      else await mixer.evaluate(boundary => {
        if (boundary === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); }
        if (boundary === 'inactive') window.soundActive = false;
        if (boundary === 'reset') { clearInterval(window.worldFeed); window.mixer.reset(); }
        if (boundary === 'missing-snapshots') clearInterval(window.worldFeed);
        if (boundary === 'frozen-snapshots') { clearInterval(window.worldFeed); window.worldFeed = setInterval(() => window.feedWorld(0), 100); }
      }, boundary);
      await expect.poll(async () => (await report(mixer)).active.length, { timeout: 2000, message: boundary }).toBe(0);
      await mixer.evaluate(() => { clearInterval(window.worldFeed); window.audioWorld = window.emptyAudioWorld(); window.soundActive = true; if (document.hidden) { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); } });
      if (boundary === 'mute') await mixer.locator('#sound-toggle').click();
    }
    await mixer.evaluate(() => {
      window.resetWorld(); window.audioWorld.airbases = Array.from({ length: 20 }, (_, i) => ({ id: 'b' + i, aircraft: { id: 'a' + i, kind: 'attack-jet', state: 'flying', x: 8 + (i % 5), y: 8 + Math.floor(i / 5), speed: 8, health: 180 } })); window.runWorld();
    });
    await expect.poll(async () => (await report(mixer)).active.length).toBeGreaterThan(0);
    expect((await report(mixer)).active.filter(s => s.loop).length).toBeLessThanOrEqual(6);
    await mixer.evaluate(() => {
      clearInterval(window.worldFeed);
      for (let round = 0; round < 5; round++) {
        const time = window.clock + 100;
        window.feedWorld(100, Array.from({ length: 6 }, (_, i) => ({ id: round * 10 + i, at: time, x: 4 + i * 4, y: 10, weapon: 'HE', sound: ['tank-shot', 'naval-main-shot', 'railway-shot', 'gunship-105-shot', 'mac-shot'][round] })));
      }
    });
    const bounded = await report(mixer);
    expect(bounded.peakVoices).toBeLessThanOrEqual(16);
    expect(bounded.records.filter(s => s.file?.includes('sfx_wpn_')).every(s => !s.loop)).toBe(true);
    await mixer.evaluate(() => window.mixer.reset()); await mixer.close();
    expect(errors).toEqual([]);
    console.log('PASS world audio', mobile ? 'phone' : 'desktop', { panelSlams: count(deployment, 'sfx_pod_panel_ground_slam_01'), deploymentPeak: deployment.signal, enginePeak: steady.signal, voicePeak: bounded.peakVoices });
  } finally { await context.close(); await field.close(); }
});
