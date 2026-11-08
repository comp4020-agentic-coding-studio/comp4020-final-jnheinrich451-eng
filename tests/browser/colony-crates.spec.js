import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { colonyFixture } from './colony-motion-helper.js';

const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-04');

// A fresh Morrow garden with two crates and a powered collector: one crate beside the
// worker's arrival tile (36.5, 31.5) and one inside the collector's reach but outside the
// worker's. Seeding keeps the test short; the shuttle flow itself is covered by vitest.
function seed(colony) {
  colony.crates = [
    { id: 'crate-hand', x: 35, y: 32, materials: 4, placedAt: 0 },
    { id: 'crate-machine', x: 46, y: 33, materials: 4, placedAt: 0 },
  ];
  colony.industry = {
    version: 1, starter: true, belts: [], storage: { provisions: 0, biomass: 0 }, energy: 5,
    machines: [{ id: 'collector-seed', kind: 'collector', x: 42, y: 31, dir: 1, revision: 0, enabled: true, cost: 10, input: {}, output: {}, job: null, fuelEnergy: 0, recipe: 'sundrop', task: null }],
  };
  colony.nextId = 50;
}

for (const phone of [false, true]) test(`a worker collects a crate with E and a powered collector gathers the other / ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(60000);
  const f = await colonyFixture(browser, { viewport: phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, seedColony: seed });
  try {
    const { page } = f;
    await mkdir(evidence, { recursive: true });
    const initial = await f.world();
    expect(initial.colony.crates.map(c => c.id).sort()).toEqual(['crate-hand', 'crate-machine']);
    const materials = initial.colony.materials;
    // The nearby prompt appears for the crate within reach and is tappable on phones.
    await expect(page.locator('#collect-crate')).toBeVisible();
    await page.screenshot({ path: path.join(evidence, `colony-crates-${phone ? 'phone' : 'desktop'}.png`), fullPage: true });
    if (phone) await page.locator('#collect-crate').click(); else await page.keyboard.press('e');
    await expect(page.locator('#colony-toast')).toHaveText('Collected 4 materials.');
    await expect.poll(async () => (await f.world()).colony.crates.some(c => c.id === 'crate-hand')).toBe(false);
    await expect(page.locator('#collect-crate')).toBeHidden();
    // The collector spends one unit of power and takes 2.5 s for the far crate.
    await expect.poll(async () => (await f.world()).colony.crates.length, { timeout: 15000 }).toBe(0);
    const final = await f.world();
    expect(final.colony.materials).toBe(materials + 8);
    expect(final.colony.industry.energy).toBe(4);
    expect(final.colony.industry.machines[0].task).toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
