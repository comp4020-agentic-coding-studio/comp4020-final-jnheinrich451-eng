import { test, expect } from '@playwright/test';
import { colonyFixture } from './colony-motion-helper.js';
import { regionDiscoveries, regionsFor } from '../../public/colony-regions.js';

// Nacre and Aurelia gained Morrow's Furnish and Explore with their own regions.
async function walkAxis(f, key, reached) {
  await f.page.keyboard.down(key);
  try { await expect.poll(async () => reached((await f.world()).me), { timeout: 10000, intervals: [100] }).toBe(true); }
  finally { await f.page.keyboard.up(key); }
}

async function toolbarOverflow(page) {
  await page.evaluate(() => document.fonts.ready);
  return page.locator('.garden-toolbar').evaluate(toolbar => [...toolbar.querySelectorAll('button')].filter(button => button.getClientRects().length).flatMap(button => {
    const bounds = button.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(button);
    return [...range.getClientRects()].some(rect => rect.width && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) ? [button.id] : [];
  }));
}

for (const { template, planet, regionId, label, viewport } of [
  { template: 'nacre-v1', planet: 'Nacre', regionId: 'glowcap-fen', label: 'desktop', viewport: { width: 1920, height: 1080 } },
  { template: 'aurelia-v1', planet: 'Aurelia', regionId: 'fanleaf-uplands', label: 'phone', viewport: { width: 390, height: 844 } },
]) test(`${planet} furnishes and explores its own regions on ${label}`, async ({ browser }, info) => {
  test.setTimeout(75000);
  const f = await colonyFixture(browser, { viewport, template });
  try {
    const { page } = f, region = regionsFor(template).find(r => r.id === regionId), point = regionDiscoveries(regionId)[0];
    const initial = await f.world();
    await expect(page.locator('#tool-settlement')).toBeVisible();
    await expect(page.locator('#tool-explore')).toBeVisible();
    expect(await toolbarOverflow(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#tool-settlement').click();
    await expect(page.locator('#inspector-eyebrow')).toHaveText(`${planet.toUpperCase()} · MAKING A HOME`);
    await page.locator('#tool-explore').click();
    await expect(page.locator('#inspector-eyebrow')).toHaveText(`${planet.toUpperCase()} · FIELD NOTES`);
    await expect(page.locator('#field-journal summary')).toContainText('0 / 6');
    await page.locator(`#travel-${regionId}`).click();
    await expect.poll(async () => (await f.world()).me.regionId).toBe(regionId);
    await expect(page.locator('#colony-planet')).toContainText(region.name);
    const remote = await f.world();
    expect(remote.world.template).toBe(template); expect(remote.colony.beds).toEqual([]);
    await page.keyboard.press('Escape');
    await walkAxis(f, 'd', me => me.x >= point.x - .6);
    await walkAxis(f, 'w', me => me.y <= point.y + .7);
    await page.locator('#tool-explore').click();
    await expect(page.locator(`#discover-${point.id}`)).toBeEnabled();
    await page.locator(`#discover-${point.id}`).click();
    await expect.poll(async () => (await f.world()).colony.exploration.discoveries).toContain(point.id);
    await expect(page.locator('#field-journal summary')).toContainText('1 / 6');
    await page.screenshot({ path: info.outputPath(`colony-${planet.toLowerCase()}-discovery-${label}.png`) });
    await page.locator('#inspector-close').click();
    await page.locator('#exploration-return').click();
    await expect.poll(async () => (await f.world()).me.regionId).toBe('home');
    const home = await f.world();
    expect(home.world.terrain).toEqual(initial.world.terrain);
    expect(home.colony.settlement.stored[point.furnishing]).toBe(1);
    expect(home.colony.materials).toBe(initial.colony.materials + point.reward);
    await page.locator('#tool-settlement').click();
    await page.screenshot({ path: info.outputPath(`colony-${planet.toLowerCase()}-furnish-${label}.png`) });
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
