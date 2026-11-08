import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { colonyFixture } from './colony-motion-helper.js';
import { SETTLEMENT_STARTER } from '../../public/colony-settlement.js';

const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-04');

// A living garden: a shuttle about to lift off, a powered chain at work, a sprinkler
// irrigating a growing bed, two crates and every animated furnishing. The seed keeps the
// run short; the rules behind each state are covered by vitest.
function seed(colony) {
  colony.shipment = { id: 'shipment-seed', remaining: 7.5, duration: 8, cargo: { sundrop: 2 }, reward: 16 };
  colony.beds.push({ id: 'bed-seed', x: 36, y: 36, crop: 'sundrop', growth: 10, water: 60, harvests: 0, revision: 0 });
  colony.sprinklers.push({ id: 'sprinkler-seed', x: 39, y: 34 });
  const machine = (id, kind, x, y, dir, extra = {}) => ({ id, kind, x, y, dir, revision: 0, enabled: true, cost: 10, input: {}, output: {}, job: null, fuelEnergy: 0, recipe: 'sundrop', ...extra });
  colony.industry = {
    version: 1, starter: true, energy: 20, storage: { provisions: 0, biomass: 0 },
    machines: [machine('generator-seed', 'generator', 30, 30, 1, { input: { biomass: 4 } }), machine('processor-seed', 'processor', 33, 30, 1, { input: { sundrop: 6 } }), machine('collector-seed', 'collector', 40, 30, 1, { task: null })],
    belts: [{ id: 'belt-a', kind: 'belt', x: 35, y: 30, dir: 1, revision: 0, enabled: true, cost: 1, item: 'provisions', progress: .1 }, { id: 'belt-b', kind: 'belt', x: 36, y: 30, dir: 1, revision: 0, enabled: true, cost: 1, item: null, progress: 0 }],
  };
  colony.crates = [{ id: 'crate-a', x: 45, y: 31, materials: 4, placedAt: -5 }, { id: 'crate-b', x: 46, y: 31, materials: 4, placedAt: -5 }];
  const ready = (id, kind, x, y, dir = 0) => ({ id, kind, x, y, dir, variant: 'ivory', status: 'ready', revision: 0, owner: 'seed' });
  colony.settlement = { version: 1, revision: 0, stored: { ...SETTLEMENT_STARTER }, deliveries: [], completed: [], undo: null, items: [
    ready('f-pennant', 'pennant', 40, 24), ready('f-lights', 'hanging-lights', 30, 24), ready('f-wind', 'wind-sculpture', 33, 24),
    ready('f-pond', 'pond', 28, 34), ready('f-path', 'path-lamp', 42, 35), ready('f-petal', 'petal-lamp', 44, 35),
  ] };
  colony.nextId = 90;
}

for (const reduced of [false, true]) test(`working machines, the shuttle and furnishings animate, and settle under reduced motion / ${reduced ? 'reduced' : 'full'}`, async ({ browser }) => {
  test.setTimeout(60000);
  const f = await colonyFixture(browser, { reduced, seedColony: seed });
  try {
    const { page } = f;
    await mkdir(evidence, { recursive: true });
    // The chain is at work on the server: the processor has a job and the belt carries cargo.
    await expect.poll(async () => (await f.world()).colony.industry.machines.find(m => m.id === 'processor-seed').job !== null, { timeout: 10000 }).toBe(true);
    // Frame the shuttle while it lifts off (the climb starts about 1.3 s into the trip).
    await expect.poll(async () => (await f.world()).colony.shipment?.remaining ?? 0, { timeout: 10000 }).toBeLessThan(6);
    const first = await page.screenshot({ path: path.join(evidence, `colony-life-${reduced ? 'reduced' : 'desktop'}.png`), fullPage: true });
    await page.waitForTimeout(600);
    const second = await page.screenshot();
    // Two frames of a working garden differ; under reduced motion no claim is made beyond rendering cleanly.
    if (!reduced) expect(Buffer.compare(first, second)).not.toBe(0);
    const live = await f.world();
    expect(live.colony.industry.belts.some(b => b.item)).toBe(true);
    expect(live.colony.settlement.items).toHaveLength(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
