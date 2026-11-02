import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { colonyFixture, captureMovement, motionSummary } from './colony-motion-helper.js';

const displacement = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function expectStopped(fixture) {
  const settling = await fixture.world();
  await expect.poll(async () => (await fixture.world()).colony.time - settling.colony.time).toBeGreaterThan(.4);
  const stopped = await fixture.world();
  await expect.poll(async () => (await fixture.world()).colony.time - stopped.colony.time).toBeGreaterThan(.5);
  expect(displacement((await fixture.world()).me, stopped.me)).toBeLessThan(.015);
}

test('Escape opens Crew and closes the foremost layer without retaining movement', async ({ browser }, info) => {
  const fixture = await colonyFixture(browser);
  try {
    const { page, world } = fixture;
    // Initial inspector closes first; clear play then opens the same Crew menu.
    await expect(page.locator('#inspector')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#inspector')).toBeHidden();
    await expect(page.locator('#room-panel')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#room-panel')).toBeVisible();
    await expect(page.locator('#room-open')).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: info.outputPath('escape-crew-menu-desktop.png'), fullPage: true });
    await page.locator('#colony-invite').click();
    await expect(page.locator('#invite-code')).not.toHaveValue('');
    await page.locator('#invite-code').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#room-panel')).toBeHidden();
    await expect(page.locator('#colony-canvas')).toBeFocused();

    // A dialog closes alone, leaving the underlying menu for the next Escape.
    await page.keyboard.press('Escape');
    await page.keyboard.press('F1');
    await expect(page.locator('#colony-help-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#colony-help-dialog')).toBeHidden();
    await expect(page.locator('#room-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#room-panel')).toBeHidden();

    await page.keyboard.press('b');
    await expect(page.locator('#placement-note')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#placement-note')).toBeHidden();
    await expect(page.locator('#room-panel')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#room-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('#tool-shipment').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#inspector')).toBeHidden();
    await expect(page.locator('#room-panel')).toBeHidden();

    const origin = (await world()).me;
    await page.locator('#colony-canvas').focus(); await page.keyboard.down('d');
    await expect.poll(async () => (await world()).me.x - origin.x).toBeGreaterThan(.4);
    await page.keyboard.press('Escape');
    await expect(page.locator('#room-panel')).toBeVisible();
    await expectStopped(fixture);
    // Even a movement repeat received in the menu must be cleared on close.
    await page.keyboard.down('d'); await page.keyboard.press('Escape');
    await expect(page.locator('#room-panel')).toBeHidden();
    await expectStopped(fixture); await page.keyboard.up('d');
    expect(fixture.errors).toEqual([]);
  } finally { await fixture.close(); }
});

for (const reduced of [false, true]) test(`worker and follow camera keep moving between packets / ${reduced ? 'reduced animation' : 'normal animation'}`, async ({ browser }, info) => {
  const fixture = await colonyFixture(browser, { reduced });
  try {
    const { page, world } = fixture;
    await page.locator('#inspector-close').click(); await page.locator('#colony-canvas').focus();
    const origin = (await world()).me;
    await page.keyboard.down('d');
    await expect.poll(async () => (await world()).me.x - origin.x).toBeGreaterThan(2.5);
    const captured = await captureMovement(page, origin.id), summary = motionSummary(captured);
    await page.keyboard.up('d');
    await writeFile(info.outputPath('presentation-motion.json'), JSON.stringify({ reduced, summary, captured }, null, 2));
    await info.attach('presentation-motion', { body: JSON.stringify({ reduced, ...summary }, null, 2), contentType: 'application/json' });
    expect(summary.packetIntervalsMs.length).toBeGreaterThanOrEqual(4);
    expect(summary.samples).toBeGreaterThan(summary.packetIntervalsMs.length * 2);
    expect(summary.movingFrameFraction).toBeGreaterThan(.9);
    expect(summary.speedRatio, 'speed must not decay into a stop and jump every packet').toBeLessThan(3);
    expect(summary.cameraMovingFrameFraction).toBeGreaterThan(.9);
    expect(summary.cameraSpeedRatio).toBeLessThan(3);
    expect(summary.maximumPacketDistance, 'presentation stays within one bounded packet of server authority').toBeLessThan(1.1);
    await expectStopped(fixture);

    // Pause freezes cosmetic time too; the render loop can still service UI.
    await page.keyboard.press('Escape'); await page.locator('#colony-pause').click();
    await expect(page.locator('#colony-connection')).toHaveText('Taking a little break');
    const frozen = await world(); expect(frozen.room.paused).toBe(true);
    const paused = await captureMovement(page, origin.id, 500);
    expect((await world()).colony.time).toBe(frozen.colony.time);
    expect(new Set(paused.frames.map(frame => frame.time)).size).toBe(1);
    const positions = paused.frames.map(frame => frame.players.find(p => p.id === origin.id));
    expect(displacement(positions[0], positions.at(-1))).toBeLessThan(.005);
    await page.locator('#colony-pause').click();
    await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
    await page.keyboard.press('Escape');

    // Headless contexts can retain OS focus together; dispatch the real browser
    // blur handler and leave the held key down until authoritative stop is proven.
    const beforeBlur = (await world()).me;
    await page.keyboard.down('a');
    await expect.poll(async () => beforeBlur.x - (await world()).me.x).toBeGreaterThan(.4);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expectStopped(fixture); await page.keyboard.up('a');
    expect(fixture.errors).toEqual([]);
  } finally { await fixture.close(); }
});

test('a teammate is presented smoothly while positions remain server authoritative', async ({ browser }, info) => {
  const fixture = await colonyFixture(browser);
  try {
    const { page, owner, post, open, world } = fixture;
    await page.locator('#room-open').click(); await page.locator('#colony-invite').click();
    await expect(page.locator('#invite-code')).not.toHaveValue('');
    const friend = await fixture.account('Clover');
    await post(friend, '/api/campaigns/join', { code: await page.locator('#invite-code').inputValue() });
    const friendPage = await open(friend);
    await expect(page.locator('#crew-count')).toHaveText('2');
    await page.locator('#room-close').click();
    await friendPage.locator('#inspector-close').click(); await friendPage.locator('#colony-canvas').focus();
    const origin = (await world(friend)).me, ownerBefore = (await world(owner)).me;
    await friendPage.keyboard.down('a');
    await expect.poll(async () => origin.x - (await world(friend)).me.x).toBeGreaterThan(2.5);
    const captured = await captureMovement(page, origin.id), summary = motionSummary(captured);
    await friendPage.keyboard.up('a');
    await writeFile(info.outputPath('teammate-presentation-motion.json'), JSON.stringify({ summary, captured }, null, 2));
    expect(summary.movingFrameFraction).toBeGreaterThan(.9);
    expect(summary.speedRatio).toBeLessThan(3);
    expect(summary.maximumPacketDistance).toBeLessThan(1.1);
    const ownerWorld = await world(owner), friendWorld = await world(friend);
    expect(displacement(ownerWorld.me, ownerBefore)).toBeLessThan(.001);
    expect(displacement(ownerWorld.players.find(p => p.id === origin.id), friendWorld.me)).toBeLessThan(.2);
    expect(ownerWorld).not.toHaveProperty('combat');
    expect(fixture.errors).toEqual([]);
  } finally { await fixture.close(); }
});
