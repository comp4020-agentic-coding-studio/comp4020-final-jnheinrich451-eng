import { test, expect } from '@playwright/test';
import { colonyFixture } from './colony-motion-helper.js';
import { SETTLEMENT_CATALOGUE, settlementAction, tickSettlement } from '../../public/colony-settlement.js';

const categories = ['paths', 'garden', 'lights', 'living', 'furniture', 'shelters'];
const toolbar = ['inspect', 'bed', 'sprinkler', 'industry', 'shipment', 'camp', 'settlement', 'explore'];
const items = colony => colony.settlement?.items || [];
const flights = colony => colony.settlement?.deliveries || [];

async function clickTile(page, x, y) {
  const point = await page.evaluate(async ({ x, y }) => {
    const { colonyWorldToScreen } = await import('/colony-view.js');
    const canvas = document.getElementById('colony-canvas');
    return colonyWorldToScreen({ x: x + .5, y: y + .5 }, window.colonyFrames.at(-1).camera, canvas.clientWidth, canvas.clientHeight);
  }, { x, y });
  expect(point.x).toBeGreaterThan(0); expect(point.y).toBeGreaterThan(0);
  await page.mouse.click(point.x, point.y);
}

async function openCollection(page, tab = 'catalogue') {
  await page.locator('#tool-settlement').click();
  await expect(page.locator('#inspector-title')).toHaveText('Your settlement');
  await page.locator(`#settlement-tab-${tab}`).click();
}

async function chooseFurnishing(page, kind, tab = 'catalogue') {
  await openCollection(page, tab);
  if (tab === 'catalogue') {
    const definition = SETTLEMENT_CATALOGUE.find(item => item.id === kind);
    await page.locator(`#furnishing-category-${definition.category.toLowerCase()}`).click();
  }
  await page.locator(`#place-furnishing-${kind}`).click();
  await expect(page.locator('#placement-note')).toBeVisible();
}

async function inspectFurnishing(page, id) {
  await openCollection(page);
  const list = page.locator('.settlement-items');
  if (!await list.evaluate(element => element.open)) await list.locator('summary').click();
  await page.locator(`[data-furnishing-id="${id}"]`).click();
  await expect(page.locator('#furnishing-store')).toBeVisible();
}

function seededHome(colony) {
  colony.materials = 100;
  const actor = { id: 'fixture', players: [] };
  for (const [kind, x, y] of [['bench', 30, 30], ['flower-planter', 30, 32], ['petal-lamp', 33, 32]]) {
    settlementAction(colony, actor, 'build-furnishing', { kind, x, y, dir: 0 });
    tickSettlement(colony, 8);
  }
}

test('Morrow catalogue, shuttle placement and a completed project stay shared and saved', async ({ browser }, info) => {
  test.setTimeout(120000);
  const f = await colonyFixture(browser, { viewport: { width: 1440, height: 1000 } });
  try {
    const { page } = f;
    await openCollection(page);
    const catalogue = [];
    for (const category of categories) {
      await page.locator(`#furnishing-category-${category}`).click();
      await expect(page.locator(`#furnishing-category-${category}`)).toHaveAttribute('aria-pressed', 'true');
      catalogue.push(...await page.locator('.furnishing-card').evaluateAll(elements => elements.map(element => element.id.replace('place-furnishing-', ''))));
    }
    expect(catalogue.sort()).toEqual(SETTLEMENT_CATALOGUE.map(item => item.id).sort());
    expect(catalogue).toHaveLength(24);
    await page.screenshot({ path: info.outputPath('morrow-furnishing-catalogue-desktop.png') });

    const invitation = await f.post(f.owner, '/api/campaigns/invite', { id: f.campaign.id });
    const friend = await f.account('Willow');
    await f.post(friend, '/api/campaigns/join', { code: invitation.code });
    const peer = await f.open(friend);
    await openCollection(peer);
    await page.bringToFront();
    const before = (await f.world()).colony;
    await chooseFurnishing(page, 'stepping-stones');
    await clickTile(page, 32, 31);
    await expect.poll(async () => items((await f.world()).colony).length).toBe(1);
    await expect(page.locator('#tool-settlement')).toBeEnabled();
    const reserved = (await f.world()).colony, first = items(reserved)[0];
    expect(first).toMatchObject({ kind: 'stepping-stones', x: 32, y: 31, status: 'delivery' });
    expect(reserved.materials).toBe(before.materials);
    expect(reserved.settlement.stored['stepping-stones']).toBe(5);
    await expect(peer.locator('[data-furnishing-id]')).toHaveCount(1);
    await expect(peer.locator('#settlement-delivery')).toBeVisible();
    await expect.poll(async () => flights((await f.world()).colony)[0]?.elapsed || 0).toBeGreaterThan(2);
    await page.screenshot({ path: info.outputPath('morrow-shuttle-lowering-desktop.png') });

    // Reload during the delivery: the saved reserved object and stock deduction
    // survive, and the active-time flight continues without another placement.
    await page.reload();
    await expect(page.locator('#colony-loading')).toBeHidden();
    await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
    const rejoined = (await f.world()).colony;
    expect(items(rejoined).map(item => item.id)).toEqual([first.id]);
    expect(rejoined.materials).toBe(before.materials);
    expect(rejoined.settlement.stored['stepping-stones']).toBe(5);
    await expect.poll(async () => items((await f.world()).colony)[0]?.status, { timeout: 10000 }).toBe('ready');
    await expect.poll(async () => flights((await f.world()).colony).length, { timeout: 10000 }).toBe(0);

    // Finish the first place-making project with real catalogue and map input.
    await chooseFurnishing(page, 'stepping-stones');
    for (const x of [33, 34]) {
      await clickTile(page, x, 31);
      await expect.poll(async () => items((await f.world()).colony).filter(item => item.kind === 'stepping-stones').length).toBe(x - 31);
      await expect(page.locator('#tool-settlement')).toBeEnabled();
    }
    await chooseFurnishing(page, 'path-lamp');
    await clickTile(page, 34, 30);
    await expect.poll(async () => items((await f.world()).colony).length).toBe(4);
    await expect.poll(async () => flights((await f.world()).colony).length, { timeout: 30000 }).toBe(0);
    const delivered = (await f.world()).colony;
    expect(items(delivered).every(item => item.status === 'ready')).toBe(true);
    expect(delivered.materials).toBe(before.materials);
    expect(delivered.settlement.stored['stepping-stones']).toBe(3);
    expect(delivered.settlement.stored['path-lamp']).toBe(1);
    await openCollection(page, 'projects');
    await expect(page.locator('#claim-lit-route')).toBeEnabled();
    await page.locator('#claim-lit-route').click();
    await expect.poll(async () => (await f.world()).colony.materials).toBe(before.materials + 8);
    await expect(page.locator('#claim-lit-route')).toHaveText('Completed');
    await expect(page.locator('#claim-lit-route')).toBeDisabled();
    await page.screenshot({ path: info.outputPath('morrow-first-project-desktop.png') });
    await openCollection(peer, 'projects');
    await expect(peer.locator('#claim-lit-route')).toHaveText('Completed');
    expect((await f.world(friend)).colony.settlement.completed).toContain('lit-route');
    await page.reload(); await expect(page.locator('#colony-loading')).toBeHidden();
    expect(items((await f.world()).colony)).toHaveLength(4);
    expect((await f.world()).colony.materials).toBe(before.materials + 8);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('Morrow furnishings can be moved, undone, rotated, stored and retrieved without repayment', async ({ browser }, info) => {
  test.setTimeout(60000);
  const f = await colonyFixture(browser, { viewport: { width: 1440, height: 1000 }, seedColony: seededHome });
  try {
    const { page } = f, initial = (await f.world()).colony;
    const bench = items(initial).find(item => item.kind === 'bench');
    await inspectFurnishing(page, bench.id);
    await page.locator('#furnishing-move').click();
    await clickTile(page, 32, 30);
    await expect.poll(async () => items((await f.world()).colony).find(item => item.id === bench.id)?.x).toBe(32);
    expect((await f.world()).colony.materials).toBe(initial.materials);
    await openCollection(page);
    await expect(page.locator('#settlement-undo')).toBeEnabled();
    await page.locator('#settlement-undo').click();
    await expect.poll(async () => items((await f.world()).colony).find(item => item.id === bench.id)?.x).toBe(30);
    await inspectFurnishing(page, bench.id);
    await page.locator('#furnishing-rotate').click();
    await expect.poll(async () => items((await f.world()).colony).find(item => item.id === bench.id)?.dir).toBe(1);
    await expect(page.locator('#furnishing-store')).toBeEnabled();
    await page.locator('#furnishing-store').click();
    await expect.poll(async () => (await f.world()).colony.settlement.stored.bench).toBe(1);
    expect(items((await f.world()).colony).some(item => item.id === bench.id)).toBe(false);
    await chooseFurnishing(page, 'bench', 'stored');
    await clickTile(page, 32, 30);
    await expect.poll(async () => items((await f.world()).colony).find(item => item.kind === 'bench')?.status).toBe('delivery');
    expect((await f.world()).colony.materials).toBe(initial.materials);
    await expect.poll(async () => flights((await f.world()).colony).length, { timeout: 12000 }).toBe(0);
    const retrieved = (await f.world()).colony;
    expect(items(retrieved).find(item => item.kind === 'bench')).toMatchObject({ x: 32, y: 30, status: 'ready' });
    expect(retrieved.settlement.stored.bench).toBe(0);
    expect(retrieved.materials).toBe(initial.materials);
    await page.screenshot({ path: info.outputPath('morrow-rearranged-home-desktop.png') });
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('phone Morrow tools and furnishing controls stay reachable through a real shuttle delivery', async ({ browser }, info) => {
  test.setTimeout(60000);
  const f = await colonyFixture(browser, { viewport: { width: 390, height: 844 }, seedColony: seededHome });
  try {
    const { page } = f;
    for (const name of toolbar) {
      const control = page.locator(`#tool-${name}`);
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box.x, name).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, name).toBeLessThanOrEqual(390);
      expect(box.y + box.height, name).toBeLessThanOrEqual(844);
      expect(box.width, name).toBeGreaterThanOrEqual(40);
      expect(box.height, name).toBeGreaterThanOrEqual(40);
    }
    await openCollection(page);
    for (const category of categories) {
      await page.locator(`#furnishing-category-${category}`).click();
      await expect(page.locator('.furnishing-card').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: info.outputPath('morrow-furnishing-catalogue-phone.png') });
    const before = (await f.world()).colony;
    await chooseFurnishing(page, 'stepping-stones');
    await expect(page.locator('.colony-touch-pad')).toBeHidden();
    await clickTile(page, 37, 32);
    await expect.poll(async () => items((await f.world()).colony).length).toBe(items(before).length + 1);
    await expect.poll(async () => flights((await f.world()).colony)[0]?.elapsed || 0).toBeGreaterThan(2);
    await page.screenshot({ path: info.outputPath('morrow-shuttle-lowering-phone.png') });
    await expect.poll(async () => flights((await f.world()).colony).length, { timeout: 12000 }).toBe(0);
    await openCollection(page, 'projects');
    await expect(page.locator('[data-project-id]')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('morrow-projects-phone.png') });
    expect((await f.world()).colony.materials).toBe(before.materials);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
