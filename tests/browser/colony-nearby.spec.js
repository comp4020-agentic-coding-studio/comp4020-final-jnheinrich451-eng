import { test, expect } from '@playwright/test';
import { colonyFixture } from './colony-motion-helper.js';

async function plantFixture(fixture) {
  const route = `/api/campaign-world/${fixture.campaign.id}/colony`;
  for (const [x, crop] of [[32, 'sundrop'], [28, 'moonberry']]) {
    const built = await fixture.post(fixture.owner, route, { action: 'build-bed', x, y: 31, requestId: crypto.randomUUID() });
    await fixture.post(fixture.owner, route, { action: 'plant', bedId: built.targetId, revision: 0, crop, requestId: crypto.randomUUID() });
  }
  return (await fixture.world()).colony.beds;
}

async function walkToX(fixture, target, page = fixture.page, context = fixture.owner) {
  await page.bringToFront(); await page.locator('#colony-canvas').focus();
  const start = (await fixture.world(context)).me.x, key = target < start ? 'a' : 'd';
  await page.keyboard.down(key);
  try {
    await expect.poll(async () => {
      const x = (await fixture.world(context)).me.x;
      return key === 'a' ? x <= target : x >= target;
    }, { intervals: [50], timeout: 5000 }).toBe(true);
  } finally { await page.keyboard.up(key); }
}

test('a newly placed nearby empty bed and a saved arrival show seed choices automatically', async ({ browser }) => {
  const f = await colonyFixture(browser);
  try {
    const route = `/api/campaign-world/${f.campaign.id}/colony`;
    // Another room action may create a bed while the welcome panel is still up.
    await f.post(f.owner, route, { action: 'build-bed', x: 36, y: 33, requestId: crypto.randomUUID() });
    await expect(f.page.locator('#inspector-title')).toHaveText('Choose a seed');
    await expect(f.page.locator('#inspector-eyebrow')).toContainText('NEARBY');
    await expect(f.page.locator('[data-plant]')).toHaveCount(3);
    const before = (await f.world()).colony.beds[0];
    await f.page.reload();
    await expect(f.page.locator('#colony-loading')).toBeHidden();
    await expect(f.page.locator('#inspector-title')).toHaveText('Choose a seed');
    await expect(f.page.locator('#inspector-eyebrow')).toContainText('NEARBY');
    expect((await f.world()).colony.beds[0]).toEqual(before);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('walking discovers bed status, preserves deliberate actions, and dismisses until re-entry', async ({ browser }, info) => {
  const f = await colonyFixture(browser, { viewport: { width: 1440, height: 960 } });
  try {
    const beds = await plantFixture(f), { page } = f;
    await page.locator('#inspector-close').click();
    const since = await page.evaluate(() => performance.now());
    await walkToX(f, 34.2);
    await expect(page.locator('#inspector-title')).toHaveText('Sundrop');
    await expect(page.locator('#inspector-eyebrow')).toContainText('BED 1');
    await expect(page.locator('#colony-canvas')).toBeFocused();
    const unhandled = (await f.world()).colony;
    expect(unhandled.materials).toBe(34);
    expect(unhandled.beds.map(b => ({ crop: b.crop, water: b.water, growth: b.growth, revision: b.revision })))
      .toEqual(beds.map(b => ({ crop: b.crop, water: b.water, growth: b.growth, revision: b.revision })));
    const cameraJump = await page.evaluate(since => {
      const frames = window.colonyFrames.filter(f => f.at >= since); let maximum = 0;
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1], b = frames[i];
        if (b.at - a.at <= 70) maximum = Math.max(maximum, Math.hypot(b.camera.x - a.camera.x, b.camera.y - a.camera.y));
      }
      return maximum;
    }, since);
    expect(cameraJump, 'automatic inspection must not call the manual camera jump').toBeLessThan(.85);
    await page.locator('#water-bed').click();
    await expect.poll(async () => (await f.world()).colony.beds[0].water).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath('colony-nearby-bed-desktop.png') });

    await page.locator('#inspector-close').click();
    await page.waitForTimeout(650); // Several stream updates must respect explicit dismissal.
    await expect(page.locator('#inspector')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#room-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#room-panel')).toBeHidden();
    await expect(page.locator('#inspector')).toBeHidden();
    await walkToX(f, 36.2);
    await walkToX(f, 33.9);
    await expect(page.locator('#inspector-title')).toHaveText('Sundrop');
    await walkToX(f, 29.4);
    await expect(page.locator('#inspector-title')).toHaveText('Moonberry');
    await expect(page.locator('#inspector-eyebrow')).toContainText('BED 2');
    await walkToX(f, 36.5);
    await expect(page.locator('#inspector')).toBeHidden();
    expect((await f.world()).colony.beds[1]).toMatchObject({ water: 0, growth: 0, revision: beds[1].revision });
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('manual remote inspection and other tools take priority over nearby beds', async ({ browser }) => {
  const f = await colonyFixture(browser, { viewport: { width: 1440, height: 960 } });
  try {
    const beds = await plantFixture(f), { page } = f;
    await page.locator('#inspector-close').click();
    await walkToX(f, 33.5);
    await expect(page.locator('#inspector-title')).toHaveText('Sundrop');
    await page.locator('#tool-inspect').click();
    await page.locator(`[data-select-bed="${beds[1].id}"]`).click();
    await page.waitForTimeout(650);
    await expect(page.locator('#inspector-title')).toHaveText('Moonberry');
    await walkToX(f, 32.5);
    await expect(page.locator('#inspector-title')).toHaveText('Sundrop');

    await page.locator('#tool-inspect').click();
    await page.locator(`[data-select-bed="${beds[0].id}"]`).click();
    await expect(page.locator('#inspector-eyebrow')).not.toContainText('NEARBY');
    await walkToX(f, 31.7);
    await expect(page.locator('#inspector-eyebrow')).toContainText('NEARBY');
    await expect(page.locator('body')).toHaveClass(/colony-game-nearby/);

    await page.locator('#tool-camp').click();
    await walkToX(f, 33.5);
    await expect(page.locator('#inspector-title')).toHaveText('Camp');
    await page.locator('#tool-shipment').click();
    await walkToX(f, 32.5);
    await expect(page.locator('#inspector-title')).toHaveText('Orbital post');
    await page.locator('#tool-bed').click();
    await walkToX(f, 33.5);
    await expect(page.locator('#placement-note')).toBeVisible();
    await expect(page.locator('#inspector')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#placement-note')).toBeHidden();
    await page.waitForTimeout(400);
    await expect(page.locator('#inspector')).toBeHidden();
    await page.keyboard.press('F1');
    await expect(page.locator('#colony-help-dialog')).toBeVisible();
    await expect(page.locator('#inspector')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#colony-help-dialog')).toBeHidden();
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('phone direction controls reveal nearby crops independently for each crew member', async ({ browser }, info) => {
  const f = await colonyFixture(browser, { viewport: { width: 390, height: 844 }, reduced: true });
  try {
    await plantFixture(f);
    const invitation = await f.post(f.owner, '/api/campaigns/invite', { id: f.campaign.id });
    const friend = await f.account('Clover');
    await f.post(friend, '/api/campaigns/join', { code: invitation.code });
    const peer = await f.open(friend), { page } = f;
    await peer.locator('#inspector-close').click();
    await page.bringToFront(); await page.locator('#inspector-close').click();
    const west = await page.getByRole('button', { name: 'Move west', exact: true }).boundingBox();
    expect(west).not.toBeNull();
    await page.mouse.move(west.x + west.width / 2, west.y + west.height / 2); await page.mouse.down();
    try { await expect.poll(async () => (await f.world()).me.x, { intervals: [50] }).toBeLessThan(33.6); }
    finally { await page.mouse.up(); }
    await expect(page.locator('#inspector-title')).toHaveText('Sundrop');
    await expect(peer.locator('#inspector')).toBeHidden();
    await walkToX(f, 29.4, peer, friend);
    await expect(peer.locator('#inspector-title')).toHaveText('Moonberry');
    await expect(page.locator('#inspector-title')).toHaveText('Sundrop');
    const bounds = await page.locator('#inspector').boundingBox(), toolbar = await page.locator('.garden-toolbar').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(toolbar.y + 1);
    const east = page.getByRole('button', { name: 'Move east', exact: true });
    await expect(east).toBeVisible();
    const pad = await page.locator('.colony-touch-pad').boundingBox();
    expect(pad.y + pad.height).toBeLessThan(bounds.y);
    await page.screenshot({ path: info.outputPath('colony-nearby-bed-phone.png') });
    // A phone player can walk out of the automatic panel with the same pad.
    await page.bringToFront();
    const eastBox = await east.boundingBox();
    await page.mouse.move(eastBox.x + eastBox.width / 2, eastBox.y + eastBox.height / 2); await page.mouse.down();
    try { await expect.poll(async () => (await f.world()).me.x, { intervals: [50] }).toBeGreaterThan(36); }
    finally { await page.mouse.up(); }
    await expect(page.locator('#inspector')).toBeHidden();
    await expect(peer.locator('#inspector-title')).toHaveText('Moonberry');
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
