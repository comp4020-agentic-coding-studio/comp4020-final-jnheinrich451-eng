import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { colonyFixture } from './colony-motion-helper.js';

const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-08');

// A warehouse south-east of the pad with two crates waiting: its drone fetches both while the
// worker watches. Seeding keeps the run short; the flight rules are covered by vitest.
function seed(colony) {
  colony.crates = [
    { id: 'crate-near', x: 34, y: 33, materials: 4, placedAt: -5 },
    { id: 'crate-far', x: 45, y: 29, materials: 4, placedAt: -5 },
  ];
  colony.industry = {
    version: 1, starter: true, belts: [], storage: { provisions: 5, biomass: 2 }, energy: 20,
    machines: [{ id: 'warehouse-seed', kind: 'warehouse', x: 39, y: 33, dir: 1, revision: 0, enabled: false, cost: 14, input: {}, output: {}, job: null, fuelEnergy: 0, task: null }],
  };
  colony.nextId = 50;
}

for (const phone of [false, true]) test(`the warehouse drone carries the shuttle's crates home and the shelf offers no belts / ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(90000);
  const f = await colonyFixture(browser, { viewport: phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, seedColony: seed });
  try {
    const { page } = f;
    await mkdir(evidence, { recursive: true });
    const materials = (await f.world()).colony.materials;
    // The shelf: warehouse in, conveyor and collector out.
    await page.locator('#tool-industry').click();
    await expect(page.locator('#place-industry-warehouse')).toBeVisible();
    await expect(page.locator('#place-industry-belt')).toHaveCount(0);
    await expect(page.locator('#place-industry-collector')).toHaveCount(0);
    await page.locator('.industry-machines summary').click();
    await page.locator('[data-industry-select="warehouse-seed"]').click();
    await expect(page.locator('#industry-status')).toHaveText('Paused');
    await expect(page.locator('#industry-holding')).toContainText('materials in the yard');
    await expect(page.locator('#industry-load')).toHaveCount(0);
    // Resume: the drone flies out, and a frame mid-flight shows it.
    await page.locator('#industry-toggle').click();
    await expect(page.locator('#industry-status')).toHaveText(/Drone fetching|Drone returning/);
    await page.screenshot({ path: path.join(evidence, `colony-warehouse-${phone ? 'phone' : 'desktop'}.png`), fullPage: true });
    await expect.poll(async () => (await f.world()).colony.crates.length, { timeout: 20000 }).toBe(0);
    const final = await f.world();
    expect(final.colony.materials).toBe(materials + 8);
    expect(final.colony.industry.energy).toBe(20);
    await expect(page.locator('#industry-status')).toHaveText('Open');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
