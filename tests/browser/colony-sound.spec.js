import { test, expect } from '@playwright/test';
import { colonyFixture } from './colony-motion-helper.js';
import { installWorldAudioProbe } from '../helpers/world-audio-probe.js';

function seed(colony) {
  colony.materials = 40;
  colony.nextId = 50;
  colony.settlement = { version: 1, revision: 0, stored: {}, deliveries: [], completed: [], undo: null, items: [
    { id: 'audio-pond', kind: 'pond', x: 37, y: 32, dir: 0, variant: 'ivory', status: 'ready', revision: 0, owner: 'seed' },
  ] };
  colony.pet = { id: 'audio-pet', name: 'Bramble', x: 36.5, y: 32.5, angle: 0, mode: 'wander', moving: false,
    reaction: null, friend: null, fed: 0, pets: 0, since: 0, stillFor: 0, last: null, notice: null };
  colony.fishing = { casts: 0, catches: [], treats: 1, record: {} };
  colony.crates = [
    { id: 'audio-hand-crate', x: 36, y: 31, materials: 4, placedAt: -5 },
    { id: 'audio-drone-crate', x: 45, y: 29, materials: 4, placedAt: -5 },
  ];
  colony.industry = { version: 1, starter: true, belts: [], storage: {}, energy: 20, machines: [
    { id: 'audio-warehouse', kind: 'warehouse', x: 39, y: 33, dir: 1, revision: 0, enabled: false,
      cost: 14, input: {}, output: {}, job: null, fuelEnergy: 0, task: null },
  ] };
}

const report = page => page.evaluate(() => window.worldAudioReport());
const matching = (value, name) => value.records.filter(sound => sound.file?.includes('sfx_colony_' + name));

for (const phone of [false, true]) test(`colony activities reach audio output and retain personal controls / ${phone ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(120000);
  const f = await colonyFixture(browser, { viewport: phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, seedColony: seed });
  try {
    const { page } = f;
    // The fixture has loaded the real app but has made no gesture, so its audio
    // context and decoder do not exist yet. Also install for the reload below.
    await page.evaluate(installWorldAudioProbe);
    await page.addInitScript(installWorldAudioProbe);
    const me = () => page.evaluate(() => window.colonyPackets.at(-1)?.me || null);
    const press = () => phone ? page.locator('#rest-prompt').click() : page.keyboard.press('e');
    await page.locator('#room-open').click();
    await expect(page.locator('#sound-status')).toContainText('ready', { timeout: 20000 });
    await page.locator('#room-close').click();

    // The manually collected crate uses the actual acknowledged UI action.
    await expect(page.locator('#collect-crate')).toBeVisible();
    await page.locator('#collect-crate').click();
    await expect.poll(async () => matching(await report(page), 'item_collect_').length).toBe(1);

    await expect(page.locator('#rest-prompt')).toContainText('Fish');
    await press();
    await expect.poll(async () => matching(await report(page), 'fish_cast_').length).toBe(1);
    await expect(page.locator('#rest-prompt')).toContainText('Reel in', { timeout: 15000 });
    await expect.poll(async () => matching(await report(page), 'fish_bite_').length).toBe(1);
    await press();
    await expect(page.locator('#fish-fight')).toBeVisible();
    if (phone) {
      const box = await page.locator('#fish-reel').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    } else await page.keyboard.down('e');
    await expect.poll(async () => (await report(page)).active.filter(sound => sound.file?.includes('fish_reel_loop')).length).toBe(1);
    if (phone) await page.mouse.up(); else await page.keyboard.up('e');
    await expect.poll(async () => (await report(page)).active.filter(sound => sound.file?.includes('fish_reel_loop')).length).toBe(0);
    // Release the reel and let the real server verify the completed recording.
    await expect(page.locator('#fish-fight')).toBeHidden({ timeout: 35000 });
    await expect.poll(async () => {
      const audio = await report(page);
      return matching(audio, 'fish_escape_').length + matching(audio, 'fish_catch_').length;
    }).toBe(1);
    if (await page.locator('#catch-card').isVisible()) await page.locator('#catch-close').click();

    // Walking away stops fishing. The companion follows using actual server
    // movement; all audible strides must alternate, including earlier steps.
    await page.keyboard.down('a');
    try {
      await expect.poll(async () => matching(await report(page), 'spider_step_').length, { timeout: 7000 }).toBeGreaterThanOrEqual(4);
      await expect.poll(async () => (await me()).x).toBeLessThan(33);
    } finally { await page.keyboard.up('a'); }
    await expect(page.locator('#rest-prompt')).toContainText('Pet', { timeout: 10000 });
    await press();
    await expect.poll(async () => matching(await report(page), 'spider_eat_').length).toBe(1);
    await expect.poll(async () => (await f.world()).colony.pet.fed).toBe(1);
    await expect(page.locator('#colony-toast')).toContainText('gobbles');
    // If this fish happened to land, it supplied a second treat. Consume it
    // before checking the separate no-treat petting reaction.
    if ((await f.world()).colony.fishing.treats > 0) {
      await press();
      await expect.poll(async () => (await f.world()).colony.fishing.treats).toBe(0);
    }
    await page.evaluate(() => { window.worldAudioPeak = 0; });
    await press();
    await expect.poll(async () => matching(await report(page), 'spider_purr_').length).toBe(1);
    await expect.poll(async () => (await report(page)).signal).toBeGreaterThan(.0001);
    const reactions = await report(page);
    const steps = matching(reactions, 'spider_step_').map(sound => sound.file.match(/step_(\d+)\./)[1]);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    steps.forEach((step, index) => expect(step).toBe(index % 2 ? '02' : '01'));
    expect(matching(reactions, 'spider_happy_')).toHaveLength(0); // feeding has its own cue
    expect(reactions.records.every(sound => sound.file?.includes('/audio/effects/colony/'))).toBe(true);

    // Enable real warehouse work and observe a native loop before muting it.
    await page.locator('#tool-industry').click();
    await page.locator('.industry-machines summary').click();
    await page.locator('[data-industry-select="audio-warehouse"]').click();
    await page.locator('#industry-toggle').click();
    await expect.poll(async () => (await report(page)).active.filter(sound => sound.loop && sound.file?.includes('drone_hover')).length).toBe(1);
    await page.locator('#room-open').click();
    const musicBefore = await page.locator('#music-toggle').getAttribute('aria-pressed');
    await page.locator('#sound-volume').evaluate(slider => { slider.value = '42'; slider.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#sound-toggle').click();
    await expect.poll(async () => (await report(page)).active.length).toBe(0);
    await expect(page.locator('#sound-quick')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed', musicBefore);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-sound')))).toEqual({ enabled: false, volume: .42 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`colony-audio-${phone ? 'phone' : 'desktop'}.png`), fullPage: true });

    await page.reload();
    await expect(page.locator('#colony-loading')).toBeHidden();
    await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
    await page.locator('#room-open').click();
    await expect(page.locator('#sound-toggle')).toHaveText('Effects off');
    await expect(page.locator('#sound-volume')).toHaveValue('42');
    expect((await report(page)).records).toHaveLength(0);
    await page.locator('#sound-toggle').click();
    await expect(page.locator('#sound-status')).toContainText('ready', { timeout: 20000 });
    const resumed = await report(page);
    expect(matching(resumed, 'spider_eat_')).toHaveLength(0);
    expect(matching(resumed, 'spider_purr_')).toHaveLength(0);
    expect(f.errors).toEqual([]);
    console.log('PASS colony app audio', phone ? 'phone' : 'desktop', { speakerPeak: reactions.signal, footsteps: steps, records: reactions.records.length });
  } finally { await f.close(); }
});
