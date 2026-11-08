import { test, expect } from '@playwright/test';
import { colonyFixture } from './colony-motion-helper.js';
import { colonyAction } from '../../public/colonization.js';

function poweredWorkshop(colony) {
  colony.materials = 100; colony.storage.sundrop = 20; colony.storage.moonberry = 6;
  const actor = { id: 'fixture', players: [] };
  colonyAction(colony, actor, 'build-industry', { kind: 'processor', x: 40, y: 32, dir: 1 });
  // The generator sits inside the 10-tile conditioned starting clearing around the hub (36,28).
  const generator = colonyAction(colony, actor, 'build-industry', { kind: 'generator', x: 38, y: 35, dir: 2 });
  colonyAction(colony, actor, 'industry-load', { machineId: generator.targetId, revision: 0, item: 'sundrop', amount: 4 });
  colony.industry.energy = 0;
}
async function inspect(page, id) {
  await page.locator('#tool-industry').click();
  await page.locator('.industry-machines summary').click();
  await page.locator(`[data-industry-select="${id}"]`).click();
}
// The card never rebuilds under a focused control: live power updates change its text only.
async function holdAcrossPowerUpdates(page, selector) {
  const control = page.locator(selector); await control.focus();
  const handle = await control.elementHandle();
  const power = () => page.locator('#industry-power strong').innerText().then(text => Number(text.split('/')[0].trim()));
  const before = await power();
  await expect.poll(power).toBeGreaterThanOrEqual(before + 3);
  expect(await handle.evaluate(node => node.isConnected && document.activeElement === node)).toBe(true);
  return handle;
}

test('the machine card keeps its buttons mounted through live power updates and follows cargo and pause state', async ({ browser }) => {
  const f = await colonyFixture(browser, { seedColony: poweredWorkshop });
  try {
    const { page } = f, route = `/api/campaign-world/${f.campaign.id}/colony`;
    const colony = (await f.world()).colony;
    const generator = colony.industry.machines.find(machine => machine.kind === 'generator');
    const processor = colony.industry.machines.find(machine => machine.kind === 'processor');
    // No recipe to set: the card reads in three lines and Load picks the crop with the most stock.
    await inspect(page, processor.id);
    await expect(page.locator('#industry-status')).toHaveText('Needs crops');
    await expect(page.locator('#industry-holding')).toHaveText('no crops in · nothing out');
    await expect(page.locator('#industry-hint')).toHaveText('Load crops, or belt a harvest into its IN side.');
    await expect(page.locator('select')).toHaveCount(0);
    await holdAcrossPowerUpdates(page, '#industry-load');
    await expect(page.locator('#industry-load')).toHaveText('Load 4 Sundrop');
    await page.locator('#industry-load').click();
    await expect.poll(async () => (await f.world()).colony.industry.machines.find(machine => machine.id === processor.id).job?.crop).toBe('sundrop');
    await expect(page.locator('#industry-status')).toHaveText('Processing');
    await expect(page.locator('#industry-hint')).toBeHidden();

    await inspect(page, generator.id);
    await holdAcrossPowerUpdates(page, '#industry-load');
    const latest = (await f.world()).colony.industry.machines.find(machine => machine.id === generator.id);
    const space = 8 - Object.values(latest.input).reduce((sum, count) => sum + count, 0);
    // A teammate fills the machine while this gardener is looking at it: Load greys out, and a disabled
    // button cannot keep focus, so only then may the card rebuild.
    await f.post(f.owner, route, { action: 'industry-load', machineId: generator.id, revision: latest.revision, item: 'moonberry', amount: space, requestId: crypto.randomUUID() });
    await expect(page.locator('#industry-load')).toBeDisabled();
    const full = (await f.world()).colony.industry.machines.find(machine => machine.id === generator.id);
    await f.post(f.owner, route, { action: 'industry-unload', machineId: generator.id, revision: full.revision, requestId: crypto.randomUUID() });
    await expect(page.locator('#industry-load')).toBeEnabled();
    // Sundrop has the most stock and the reserve holds no biomass, so Load takes sundrop.
    await expect(page.locator('#industry-load')).toHaveText('Load 4 Sundrop');
    await page.locator('#industry-load').click();
    await expect.poll(async () => (await f.world()).colony.industry.machines.find(machine => machine.id === generator.id).input.sundrop).toBe(4);

    await page.locator('#industry-load').focus();
    await f.post(f.owner, '/api/campaigns/pause', { id: f.campaign.id, paused: true });
    await expect(page.locator('#industry-load')).toBeDisabled();
    await expect(page.locator('#industry-toggle')).toBeDisabled();
    await expect(page.locator('#industry-remove')).toBeDisabled();
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
