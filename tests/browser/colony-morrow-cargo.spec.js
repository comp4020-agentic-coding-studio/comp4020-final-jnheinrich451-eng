import { test, expect } from '@playwright/test';
import { colonyFixture } from './colony-motion-helper.js';
import { settlementAction } from '../../public/colony-settlement.js';

test('Morrow material return and construction delivery follow the saved active clock', async ({ browser }, info) => {
  test.setTimeout(45000);
  const f = await colonyFixture(browser, { viewport: { width: 1440, height: 1000 }, seedColony: colony => {
    colony.storage.sundrop = 4;
    settlementAction(colony, { id: 'fixture', players: [] }, 'build-furnishing', { kind: 'cabin', x: 31, y: 28, dir: 0 });
  } });
  try {
    const { page } = f;
    await page.locator('#inspector-close').click();
    await expect.poll(async () => (await f.world()).colony.settlement.deliveries[0]?.elapsed || 0).toBeGreaterThan(2);
    await f.post(f.owner, '/api/campaigns/pause', { id: f.campaign.id, paused: true });
    await expect(page.locator('#colony-connection')).toHaveText('Taking a little break');
    const paused = (await f.world()).colony;
    // Two real paused server updates must retain the exact suspended cargo phase.
    const pausedPackets = await page.evaluate(async () => {
      const start = window.colonyPackets.length;
      while (window.colonyPackets.length < start + 2) await new Promise(resolve => setTimeout(resolve, 100));
      return window.colonyPackets.slice(start);
    });
    expect(pausedPackets.every(packet => packet.time === paused.time)).toBe(true);
    expect((await f.world()).colony.settlement.deliveries).toEqual(paused.settlement.deliveries);
    await page.screenshot({ path: info.outputPath('morrow-construction-paused.png') });
    await f.post(f.owner, '/api/campaigns/pause', { id: f.campaign.id, paused: false });
    await expect.poll(async () => (await f.world()).colony.settlement.deliveries.length, { timeout: 12000 }).toBe(0);
    await page.locator('#tool-shipment').click();
    const before = (await f.world()).colony.materials;
    await expect(page.locator('#parcel-sundrop')).toHaveValue('4');
    await page.locator('#parcel-sundrop').fill('2');
    await page.locator('#ship-cargo').click();
    await expect(page.locator('.shipment-summary').first()).toContainText(/Loading harvest|Departing/);
    await expect.poll(async () => (await f.world()).colony.shipment?.remaining || 0, { timeout: 16000 }).toBeLessThan(2.5);
    await expect(page.locator('.shipment-summary').first()).toContainText('Returning with materials');
    await page.screenshot({ path: info.outputPath('morrow-orbital-material-return.png') });
    await expect.poll(async () => (await f.world()).colony.shipments, { timeout: 16000 }).toBe(1);
    // The reward waits as four crates beside the pad until collected.
    expect((await f.world()).colony.materials).toBe(before);
    expect((await f.world()).colony.crates.reduce((total, crate) => total + crate.materials, 0)).toBe(16);
    expect((await f.world()).colony.storage.sundrop).toBe(2);
    await page.reload(); await expect(page.locator('#colony-loading')).toBeHidden();
    const restored = (await f.world()).colony;
    expect(restored.settlement.items[0]).toMatchObject({ kind: 'cabin', status: 'ready' });
    expect(restored.materials + restored.crates.reduce((total, crate) => total + crate.materials, 0)).toBe(before + 16);
    expect(restored.shipments).toBe(1);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
