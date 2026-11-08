import { test, expect } from '@playwright/test';
import { colonyFixture } from './colony-motion-helper.js';
import { colonyAction } from '../../public/colonization.js';

// This is a disposable established garden, not the player's saved expedition.
function establishedGarden(colony) {
  colony.materials = 160; colony.storage.sundrop = 20;
  colonyAction(colony, { id: 'fixture', players: [] }, 'build-bed', { x: 31, y: 32 });
  const bed = colony.beds[0];
  colonyAction(colony, { id: 'fixture' }, 'plant', { bedId: bed.id, revision: bed.revision, crop: 'sundrop' });
  colonyAction(colony, { id: 'fixture' }, 'water', { bedId: bed.id, revision: bed.revision });
  bed.growth = 45;
  // Conveyors left the catalogue on 8 November 2026 but stay valid in saves, so the chain's belts are seeded:
  // outlet (31,30) east along row 30 into the processor at (38,30), provisions on to the pad, biomass south to the generator at (38,35).
  const fixture = { id: 'fixture', players: [] };
  for (let x = 32; x <= 37; x++) colonyAction(colony, fixture, 'build-industry', { kind: 'belt', x, y: 30, dir: 1 });
  for (const [x, y, dir] of [[40, 30, 1], [41, 30, 1], [42, 30, 1], [43, 30, 0], [39, 32, 2], [39, 33, 2], [39, 34, 2]]) colonyAction(colony, fixture, 'build-industry', { kind: 'belt', x, y, dir });
  colony.materials = 160;
}
async function clickTile(page, x, y) {
  const point = await page.evaluate(async ({ x, y }) => {
    const { colonyWorldToScreen } = await import('/colony-view.js');
    const c = document.getElementById('colony-canvas');
    return colonyWorldToScreen({ x: x + .5, y: y + .5 }, window.colonyFrames.at(-1).camera, c.clientWidth, c.clientHeight);
  }, { x, y });
  await page.mouse.click(point.x, point.y);
}
async function chooseBuild(page, kind, direction = 'East') {
  await page.locator('#tool-industry').click();
  await page.locator(`#place-industry-${kind}`).click();
  for (let n = 0; n < 4 && !(await page.locator('#placement-rotate').innerText()).includes(direction); n++) {
    await page.locator('#placement-rotate').click();
  }
  await expect(page.locator('#placement-rotate')).toContainText(direction);
}
async function build(f, kind, x, y, direction = 'East') {
  await chooseBuild(f.page, kind, direction);
  await clickTile(f.page, x, y);
  await expect.poll(async () => {
    const industry = (await f.world()).colony.industry;
    return [...(industry?.machines || []), ...(industry?.belts || [])].some(m => m.kind === kind && m.x === x && m.y === y);
  }).toBe(true);
}
async function selectMachine(page, id) {
  await page.locator('#tool-industry').click();
  await page.locator('.industry-machines summary').click();
  await page.locator(`[data-industry-select="${id}"]`).click();
  await expect(page.locator('#industry-status')).toBeVisible();
}

test('a real conveyor chain harvests, processes, fuels, exports and stays shared with a second gardener', async ({ browser }, info) => {
  test.setTimeout(120000);
  const f = await colonyFixture(browser, { viewport: { width: 1440, height: 1000 }, seedColony: establishedGarden });
  try {
    const { page } = f;
    for (let n = 0; n < 3; n++) await page.locator('#colony-zoom-out').click();
    // Every footprint cell stays on conditioned ground: the 10-tile starting
    // clearing around the hub (36,28). The output belts end against the pad
    // and the byproduct belts feed the generator from the north.
    await build(f, 'processor', 38, 30);
    await build(f, 'generator', 38, 35, 'South');
    await build(f, 'outlet', 31, 30);
    // Belts and collectors are no longer on the shelf; the warehouse is.
    await page.locator('#tool-industry').click(); if (await page.locator('#industry-back').count()) await page.locator('#industry-back').click();
    await expect(page.locator('#place-industry-belt')).toHaveCount(0);
    await expect(page.locator('#place-industry-collector')).toHaveCount(0);
    await expect(page.locator('#place-industry-warehouse')).toBeVisible();
    await page.keyboard.press('Escape');
    const colony = (await f.world()).colony;
    const generator = colony.industry.machines.find(m => m.kind === 'generator');
    const processor = colony.industry.machines.find(m => m.kind === 'processor');
    await selectMachine(page, generator.id);
    await expect(page.locator('#industry-status')).toHaveText('Needs fuel');
    await expect(page.locator('#industry-load')).toHaveText('Load 4 Sundrop');
    await page.locator('#industry-load').click();
    await expect.poll(async () => (await f.world()).colony.industry.machines.find(m => m.id === processor.id).job?.crop, { timeout: 12000 }).toBe('sundrop');
    await selectMachine(page, processor.id);
    await expect(page.locator('#industry-status')).toHaveText('Processing');
    await page.screenshot({ path: info.outputPath('colony-industry-production-desktop.png') });
    await expect.poll(async () => (await f.world()).colony.industry.storage.provisions, { timeout: 25000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => (await f.world()).colony.industry.machines.find(m => m.id === generator.id).input.biomass || 0).toBeGreaterThanOrEqual(1);
    const harvested = (await f.world()).colony.beds[0];
    expect(harvested).toMatchObject({ crop: 'sundrop', harvests: 1 });

    const invitation = await f.post(f.owner, '/api/campaigns/invite', { id: f.campaign.id });
    const friend = await f.account('Basil');
    await f.post(friend, '/api/campaigns/join', { code: invitation.code });
    const peer = await f.open(friend);
    await selectMachine(peer, generator.id);
    await peer.locator('#industry-toggle').click();
    await expect.poll(async () => (await f.world()).colony.industry.machines.find(m => m.id === generator.id).enabled).toBe(false);
    await selectMachine(page, generator.id);
    await expect(page.locator('#industry-status')).toHaveText('Paused');
    await page.locator('#industry-toggle').click();
    await expect(peer.locator('#industry-status')).toHaveText('Generating');
    const beforeExport = (await f.world()).colony.materials;
    await page.locator('#tool-shipment').click();
    for (const id of ['sundrop', 'moonberry', 'cloudmelon']) if (await page.locator(`#parcel-${id}`).isEnabled()) await page.locator(`#parcel-${id}`).fill('0');
    await page.locator('#parcel-provisions').fill('2');
    await expect(page.locator('#ship-cargo')).toContainText('+24');
    await page.locator('#ship-cargo').click();
    await expect.poll(async () => (await f.world()).colony.shipments, { timeout: 20000 }).toBe(1);
    // The reward waits as crates beside the pad until a worker or collector takes them.
    expect((await f.world()).colony.materials + (await f.world()).colony.crates.reduce((total, crate) => total + crate.materials, 0)).toBe(beforeExport + 24);
    await page.reload();
    await expect(page.locator('#colony-loading')).toBeHidden();
    const restored = (await f.world()).colony;
    expect(restored.industry.belts).toHaveLength(13);
    expect(restored.industry.machines).toHaveLength(3);
    expect(restored.beds[0].crop).toBe('sundrop');
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('phone controls build, rotate and recover a stalled processor without losing crops', async ({ browser }, info) => {
  // An established garden whose starter reserve is already spent, so the processor stalls for power.
  const f = await colonyFixture(browser, { viewport: { width: 390, height: 844 }, seedColony: colony => { establishedGarden(colony); colony.industry = { version: 1, machines: [], belts: [], storage: { provisions: 0, biomass: 0 }, energy: 0, starter: true }; } });
  try {
    const { page } = f;
    await page.locator('#colony-zoom-out').click();
    await build(f, 'processor', 38, 31, 'South');
    await expect(page.locator('#industry-status')).toHaveText('Needs crops');
    await expect(page.locator('#industry-hint')).toHaveText('Load crops, or belt a harvest into its IN side.');
    await page.locator('#industry-load').click();
    await expect(page.locator('#industry-status')).toHaveText('Needs power');
    await page.screenshot({ path: info.outputPath('colony-industry-processor-phone.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const id of ['tool-inspect','tool-bed','tool-sprinkler','tool-industry','tool-shipment','tool-camp']) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390); expect(box.height).toBeGreaterThanOrEqual(40);
    }
    const loaded = (await f.world()).colony;
    await page.locator('#industry-remove').click();
    await expect.poll(async () => (await f.world()).colony.industry.machines.length).toBe(0);
    const recovered = (await f.world()).colony;
    expect(recovered.storage.sundrop).toBe(20);
    expect(recovered.materials).toBe(loaded.materials + 16);
    await page.keyboard.press('Escape');
    await expect(page.locator('#inspector')).toBeHidden();
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
