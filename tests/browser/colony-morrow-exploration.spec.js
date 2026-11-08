import { test, expect } from '@playwright/test';
import { colonyFixture } from './colony-motion-helper.js';
import { colonyAction } from '../../public/colonization.js';
import { regionDiscoveries } from '../../public/colony-regions.js';
import { tickSettlement } from '../../public/colony-settlement.js';

function growingGarden(state) {
  const actor = { id: 'fixture' };
  const result = colonyAction(state, actor, 'build-bed', { x: 31, y: 32 });
  colonyAction(state, actor, 'plant', { bedId: result.targetId, crop: 'sundrop' });
  colonyAction(state, actor, 'water', { bedId: result.targetId });
  colonyAction(state, actor, 'build-furnishing', { kind: 'bench', x: 30, y: 28, dir: 0 });
  tickSettlement(state, 8);
  state.shipments = 3;
}

async function expectToolbarTextContained(page) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.locator('.garden-toolbar').evaluate(toolbar => {
    const failures = [];
    for (const button of toolbar.querySelectorAll('button')) {
      if (!button.getClientRects().length) continue;
      const bounds = button.getBoundingClientRect();
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        for (const rect of range.getClientRects()) {
          if (rect.width && rect.height && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) {
            failures.push(`${button.id}: ${walker.currentNode.textContent.trim()}`);
          }
        }
      }
    }
    return failures;
  });
  expect(overflow).toEqual([]);
}

async function walkAxis(f, key, reached) {
  await f.page.keyboard.down(key);
  try { await expect.poll(async () => reached((await f.world()).me), { timeout: 10000, intervals: [100] }).toBe(true); }
  finally { await f.page.keyboard.up(key); }
}

test('Morrow survey travel keeps the shared garden, records a reachable discovery and restores the journal', async ({ browser }, info) => {
  test.setTimeout(75000);
  const f = await colonyFixture(browser, { viewport: { width: 1440, height: 1000 }, seedColony: growingGarden });
  try {
    const { page } = f;
    const initial = await f.world();
    for (const [width, height] of [[1440, 1000], [800, 900], [844, 390], [390, 844], [320, 700]]) {
      await page.setViewportSize({ width, height });
      await expectToolbarTextContained(page);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.garden-toolbar').screenshot({ path: info.outputPath('colony-toolbar-contained-desktop.png') });
    const invitation = await f.post(f.owner, '/api/campaigns/invite', { id: f.campaign.id });
    const friend = await f.account('Basil');
    await f.post(friend, '/api/campaigns/join', { code: invitation.code });
    const peer = await f.open(friend);
    await page.locator('#tool-explore').click();
    await expect(page.locator('#travel-home')).toBeDisabled();
    await page.locator('#travel-blossom-grove').click();
    await expect.poll(async () => (await f.world()).me.regionId).toBe('blossom-grove');
    await expect(page.locator('#colony-planet')).toContainText('Blossom Grove');
    await expect(page.locator('#tool-bed')).toBeDisabled();
    await expect(page.locator('#garden-tool-label')).toHaveText('Home');
    await expect(page.locator('#bed-count')).toHaveText('Return to garden');
    await expectToolbarTextContained(page);
    const remote = await f.world();
    expect(remote.colony.beds).toEqual([]); expect(remote.colony.settlement).toBeUndefined();
    expect(remote.players).toHaveLength(1); expect(remote.crew).toHaveLength(2);
    expect((await f.world(friend)).me.regionId).toBe('home');
    expect((await f.world(friend)).world.terrain).toEqual(initial.world.terrain);
    await expect.poll(async () => (await f.world(friend)).colony.beds[0].growth).toBeGreaterThan(initial.colony.beds[0].growth + .5);
    const point = regionDiscoveries('blossom-grove')[0];
    await expect(page.locator(`#discover-${point.id}`)).toBeDisabled();
    // Walk the real robot from the survey landing, across clear ground then
    // north to the specimen. No production debug endpoint or saved teleport.
    await page.keyboard.press('Escape');
    await walkAxis(f, 'd', me => me.x >= point.x - .6);
    await walkAxis(f, 'w', me => me.y <= point.y + .7);
    await page.locator('#tool-explore').click();
    await expect(page.locator(`#discover-${point.id}`)).toBeEnabled();
    const materials = (await f.world()).colony.materials;
    await page.locator(`#discover-${point.id}`).click();
    await expect.poll(async () => (await f.world()).colony.exploration.discoveries).toContain(point.id);
    await expect(page.locator(`#discover-${point.id}`)).toHaveText('Recorded');
    expect((await f.world()).colony.materials).toBe(materials + 3);
    await page.locator('#field-journal summary').click();
    await expect(page.locator('#field-journal')).toContainText(point.description);
    await page.screenshot({ path: info.outputPath('colony-morrow-grove-discovery-desktop.png') });
    await peer.locator('#tool-explore').click();
    await expect(peer.locator('#field-journal summary')).toContainText('1 / 6');
    await page.reload();
    await expect(page.locator('#colony-loading')).toBeHidden();
    await expect(page.locator('#colony-planet')).toContainText('Blossom Grove');
    await expect(page.locator('#tool-inspect')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#tool-explore')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#field-journal summary')).toContainText('1 / 6');
    await page.locator('#inspector-close').click();
    await expect(page.locator('#exploration-return')).toBeVisible();
    await expect(page.locator('#inspector')).toBeHidden();
    await page.screenshot({ path: info.outputPath('colony-exploration-return-desktop.png') });
    await page.locator('#exploration-return').click();
    await expect.poll(async () => (await f.world()).me.regionId).toBe('home');
    await expect(page.locator('#inspector-title')).toHaveText('Garden');
    await expect(page.locator('#tool-inspect')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#exploration-hint')).toBeHidden();
    const home = await f.world();
    expect(home.world.terrain).toEqual(initial.world.terrain);
    expect(home.colony.beds[0].id).toBe(initial.colony.beds[0].id);
    expect(home.colony.beds[0].growth).toBeGreaterThan(initial.colony.beds[0].growth);
    expect(home.colony.settlement.items).toEqual(initial.colony.settlement.items);
    expect(home.colony.exploration.discoveries).toEqual([point.id]);
    expect(home.colony.settlement.stored[point.furnishing]).toBe(1);
    expect(home.players).toHaveLength(2); expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('phone survey map travels to Stillwater, supports held movement and offers a safe return', async ({ browser }, info) => {
  test.setTimeout(45000);
  const f = await colonyFixture(browser, { viewport: { width: 390, height: 844 }, reduced: true, seedColony: growingGarden });
  try {
    const { page } = f;
    const initial = await f.world();
    await page.locator('#tool-explore').click();
    for (const id of ['travel-home', 'travel-blossom-grove', 'travel-lake-basin']) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
    await page.locator('#travel-lake-basin').click();
    await expect.poll(async () => (await f.world()).me.regionId).toBe('lake-basin');
    await expect(page.locator('#colony-planet')).toContainText('Stillwater Basin');
    const start = (await f.world()).me;
    await page.keyboard.press('Escape');
    const east = page.getByRole('button', { name: 'Move east', exact: true });
    const button = await east.boundingBox();
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
    await page.mouse.down();
    try { await expect.poll(async () => (await f.world()).me.x, { timeout: 5000 }).toBeGreaterThan(start.x + 1); }
    finally { await page.mouse.up(); }
    await page.locator('#tool-explore').click();
    await expect(page.locator('#field-journal summary')).toContainText('0 / 6');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('colony-morrow-exploration-phone.png') });
    await page.locator('#inspector-close').click();
    await expect(page.locator('#exploration-return')).toBeVisible();
    await expectToolbarTextContained(page);
    await f.post(f.owner, '/api/campaigns/pause', { id: f.campaign.id, paused: true });
    await expect(page.locator('#exploration-return')).toBeDisabled();
    await expect(page.locator('#tool-inspect')).toBeDisabled();
    await f.post(f.owner, '/api/campaigns/pause', { id: f.campaign.id, paused: false });
    await expect(page.locator('#tool-inspect')).toBeEnabled();
    await page.screenshot({ path: info.outputPath('colony-exploration-return-phone.png') });
    // Home in the toolbar is a direct return even with field notes closed.
    await page.locator('#tool-inspect').click();
    await expect.poll(async () => (await f.world()).me.regionId).toBe('home');
    await expect(page.locator('#tool-bed')).toBeEnabled();
    await expect(page.locator('#inspector-title')).toHaveText('Garden');
    await expect(page.locator('#garden-tool-label')).toHaveText('Garden');
    expect((await f.world()).colony.settlement.items).toEqual(initial.colony.settlement.items);
    expect((await f.world()).colony.beds[0].id).toBe(initial.colony.beds[0].id);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
