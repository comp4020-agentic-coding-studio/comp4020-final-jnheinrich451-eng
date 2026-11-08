import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { colonyFixture } from './colony-motion-helper.js';
import { groundAt, groundSummary } from '../../public/colony-ground.js';

const GROUND_MESSAGE = 'Grow a crop nearby to condition this ground first.';
const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-04');

async function clickTile(page, x, y) {
  const point = await page.evaluate(async ({ x, y }) => {
    const { colonyWorldToScreen } = await import('/colony-view.js');
    const canvas = document.getElementById('colony-canvas');
    return colonyWorldToScreen({ x: x + .5, y: y + .5 }, window.colonyFrames.at(-1).camera, canvas.clientWidth, canvas.clientHeight);
  }, { x, y });
  const viewport = page.viewportSize();
  expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(viewport.width);
  expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(viewport.height);
  await page.mouse.click(point.x, point.y);
}

// The world JSON stays in Node: never hand a whole world to or from page.evaluate.
const groundLevel = (saved, x, y) => groundAt({ world: saved.world, ground: saved.colony.ground }, x, y);

for (const phone of [false, true]) test(`conditioned ground bounds bed placement and the garden readout follows live crops / ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(90000);
  const f = await colonyFixture(browser, { viewport: phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 } });
  try {
    const { page } = f;
    await mkdir(evidence, { recursive: true });
    const initial = await f.world();
    expect(initial.colony.ground).toMatchObject({ version: 1, revision: 0 });
    const summary = groundSummary({ world: initial.world, ground: initial.colony.ground });
    expect(summary.conditioned).toBeGreaterThan(0);

    // Garden readout: the same numbers the server's ground summary reports.
    await page.locator('#tool-inspect').click();
    await expect(page.locator('#inspector-title')).toHaveText('Garden');
    await expect(page.locator('#ground-readout')).toContainText(/Conditioned ground/);
    await expect(page.locator('#ground-readout')).toContainText(`${summary.conditioned} tiles · ${summary.frontier} growing`);
    expect(Number(/(\d+) tiles/.exec(await page.locator('#ground-readout').textContent())[1])).toBeGreaterThan(0);

    // A wild tile about thirteen tiles east of the hub refuses a bed with the shared message.
    expect(groundLevel(initial, 49, 28)).toBe(0);
    await page.keyboard.press('b');
    await expect(page.locator('#placement-note')).toBeVisible();
    await expect(page.locator('#placement-reason')).toHaveText('Select conditioned ground; crops widen it.');
    if (phone) for (let i = 0; i < 5; i++) await page.locator('#colony-zoom-out').click();
    await clickTile(page, 49, 28);
    await expect(page.locator('#placement-reason')).toHaveText(GROUND_MESSAGE);
    await expect(page.locator('#colony-toast')).toHaveText(GROUND_MESSAGE);
    await expect(page.locator('#colony-toast')).toHaveClass(/error/);
    // Placement mode shades every tile that cannot take construction.
    await page.screenshot({ path: path.join(evidence, `colony-ground-placing-${phone ? 'phone' : 'desktop'}.png`), fullPage: true });
    expect((await f.world()).colony.beds).toHaveLength(0);

    // The gift site is conditioned: place, plant and water through the same pointer path.
    expect(groundLevel(initial, 32, 31)).toBe(8);
    await clickTile(page, 32, 31);
    await expect.poll(async () => (await f.world()).colony.beds.length).toBe(1);
    expect((await f.world()).colony.beds[0]).toMatchObject({ x: 32, y: 31 });
    await page.locator('[data-plant=sundrop]').click();
    await page.locator('#water-bed').click();
    await expect(page.locator('.water-status')).toContainText('Watered');
    // Live crop conditioning is observable server state: a saved revision and frontier tiles.
    await expect.poll(async () => {
      const saved = await f.world();
      const live = groundSummary({ world: saved.world, ground: saved.colony.ground });
      return saved.colony.ground.revision > initial.colony.ground.revision && live.frontier > 0;
    }, { timeout: 15000 }).toBe(true);
    if (!phone) {
      // A second bed on the clearing's west edge (the north edge sits under the header once the camera has
      // centred on the selected first bed): its near ring crosses the frontier, so thirty seconds of
      // conditioning shows the warm gradient (near tiles gain every step, far tiles every second step).
      expect(groundLevel(initial, 27, 29)).toBe(8); expect(groundLevel(initial, 25, 29)).toBe(0);
      await page.keyboard.press('b');
      await clickTile(page, 27, 29);
      await expect.poll(async () => (await f.world()).colony.beds.length).toBe(2);
      await page.locator('[data-plant=sundrop]').click();
      await page.locator('#water-bed').click();
      await expect(page.locator('.water-status')).toContainText('Watered');
      await expect.poll(async () => groundLevel(await f.world(), 25, 29), { timeout: 45000 }).toBeGreaterThanOrEqual(6);
    }
    await page.locator('#tool-inspect').click();
    await expect(page.locator('#ground-readout')).toContainText(/· [1-9][0-9]* growing/);
    await page.screenshot({ path: path.join(evidence, `colony-ground-${phone ? 'phone' : 'desktop'}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
