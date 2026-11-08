import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { colonyFixture } from './colony-motion-helper.js';
import { colonyAction } from '../../public/colonization.js';

const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-08');

// A harvest waiting in the reserve and materials for two builds. The parcel, the
// flight and the print are what this run looks at; vitest covers their rules.
function seed(colony) {
  colony.storage.sundrop = 5; colony.storage.moonberry = 3;
  colony.materials = 80; colony.nextId = 50;
}

for (const phone of [false, true]) test(`new builds print, the orbital post sends a chosen parcel and the shuttle launches and lands / ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(120000);
  const f = await colonyFixture(browser, { viewport: phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, seedColony: seed });
  try {
    const { page } = f, tag = phone ? 'phone' : 'desktop';
    await mkdir(evidence, { recursive: true });
    const order = (action, data = {}) => f.post(f.owner, `/api/campaign-world/${f.campaign.id}/colony`, { action, requestId: randomUUID(), ...data });
    const colony = async () => (await f.world()).colony;
    // Construction: a bed prints on its own clock (5 s); a lamp prints inside its delivery (8 s).
    await order('build-bed', { x: 40, y: 32 });
    await order('build-furnishing', { kind: 'path-lamp', x: 34, y: 33, dir: 0 });
    const built = (await colony()).beds[0].builtAt;
    expect(typeof built).toBe('number');
    await expect.poll(async () => (await colony()).time - built, { timeout: 8000, interval: 100 }).toBeGreaterThan(2.4);
    await page.screenshot({ path: path.join(evidence, `colony-print-${tag}.png`), fullPage: true });
    await expect.poll(async () => (await colony()).settlement.items[0].status, { timeout: 15000, interval: 250 }).toBe('ready');
    // The orbital post: every cargo starts at all of it; lower one and launch.
    await page.locator('#tool-shipment').click();
    await expect(page.locator('#parcel-sundrop')).toHaveValue('5');
    await expect(page.locator('#parcel-moonberry')).toHaveValue('3');
    await expect(page.locator('#parcel-cloudmelon')).toBeDisabled();
    await expect(page.locator('#ship-cargo')).toHaveText('Launch 8 items · +64 materials');
    await page.locator('#parcel-moonberry').fill('1');
    await expect(page.locator('#ship-cargo')).toHaveText('Launch 6 items · +48 materials');
    await page.screenshot({ path: path.join(evidence, `colony-parcel-${tag}.png`), fullPage: true });
    await page.locator('#ship-cargo').click();
    await expect(page.locator('#colony-toast')).toHaveText('Parcel launched with 6 items. The shuttle will return with 48 materials.');
    const sent = await colony();
    expect(sent.shipment).toMatchObject({ cargo: { sundrop: 5, moonberry: 1 }, reward: 48, duration: 14 });
    expect(sent.storage).toMatchObject({ sundrop: 0, moonberry: 2 });
    await page.keyboard.press('Escape');
    // Film the flight from the pad: lift on the belly thrusters, nose up on the main engine, the return hover.
    const elapsed = async () => { const value = await colony(); return value.shipment ? value.shipment.duration - value.shipment.remaining : 99; };
    for (const [at, name] of [[2.0, 'lift'], [4.2, 'climb'], [11.6, 'landing']]) {
      await expect.poll(elapsed, { timeout: 16000, interval: 80 }).toBeGreaterThan(at);
      await page.screenshot({ path: path.join(evidence, `colony-shuttle-${name}-${tag}.png`), fullPage: true });
    }
    await expect.poll(async () => (await colony()).shipments, { timeout: 10000, interval: 200 }).toBe(1);
    expect((await colony()).crates.reduce((total, crate) => total + crate.materials, 0)).toBe(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

// Reduced effects never fly the shuttle: it fades from the pad as it would lift off and fades back to land.
test('with reduced effects the shuttle fades away and back instead of flying', async ({ browser }) => {
  test.setTimeout(90000);
  const f = await colonyFixture(browser, { reduced: true, seedColony: seed });
  try {
    const { page } = f;
    const colony = async () => (await f.world()).colony;
    await page.locator('#tool-shipment').click();
    await page.locator('#ship-cargo').click();
    await expect(page.locator('#colony-toast')).toContainText('Parcel launched with 8 items');
    await page.keyboard.press('Escape');
    const elapsed = async () => { const value = await colony(); return value.shipment ? value.shipment.duration - value.shipment.remaining : 99; };
    await expect.poll(elapsed, { timeout: 16000, interval: 80 }).toBeGreaterThan(6.5);
    await page.screenshot({ path: path.join(evidence, 'colony-shuttle-away-reduced.png') });
    await expect.poll(async () => (await colony()).shipments, { timeout: 16000, interval: 200 }).toBe(1);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

// Working machines with their moving parts in view: a processor holding crops, a fuelled bio plant
// below a part-empty reserve, a harvest outlet over a bed and a sprinkler, all printed long ago.
function machines(colony) {
  colony.materials = 200; colony.storage.sundrop = 20;
  const fixture = { id: 'fixture', players: [] };
  colonyAction(colony, fixture, 'build-bed', { x: 31, y: 32 });
  const bed = colony.beds[0];
  colonyAction(colony, fixture, 'plant', { bedId: bed.id, revision: bed.revision, crop: 'sundrop' });
  colonyAction(colony, fixture, 'water', { bedId: bed.id, revision: bed.revision });
  colonyAction(colony, fixture, 'build-industry', { kind: 'processor', x: 38, y: 30, dir: 1 });
  colonyAction(colony, fixture, 'build-industry', { kind: 'generator', x: 38, y: 35, dir: 2 });
  colonyAction(colony, fixture, 'build-industry', { kind: 'outlet', x: 31, y: 30, dir: 1 });
  colonyAction(colony, fixture, 'build-sprinkler', { x: 33, y: 33 });
  for (const item of [...colony.industry.machines, ...colony.sprinklers, ...colony.beds]) item.builtAt = -100;
  colony.industry.machines.find(m => m.kind === 'processor').input = { sundrop: 8 };
  colony.industry.machines.find(m => m.kind === 'generator').input = { biomass: 8 };
  colony.industry.energy = 10;
}
// Canvas pixels that changed around each machine over 0.4 s (a summed RGB change above 30 counts).
async function machineChange(page) {
  const sample = () => page.evaluate(async () => {
    const { colonyWorldToScreen } = await import('/colony-view.js');
    const c = document.getElementById('colony-canvas'), k = c.width / c.clientWidth, camera = window.colonyFrames.at(-1).camera, context = c.getContext('2d');
    const at = (x, y) => colonyWorldToScreen({ x, y }, camera, c.clientWidth, c.clientHeight), tile = Math.abs(at(1, 0).x - at(0, 0).x);
    return Object.fromEntries([['processor', 39, 31, 1.1], ['generator', 39, 36, 1.1], ['outlet', 31.5, 30.5, .8], ['sprinkler', 33.5, 33.5, .7]].map(([name, x, y, r]) => {
      const p = at(x, y), half = r * tile;
      return [name, Array.from(context.getImageData(Math.round((p.x - half) * k), Math.round((p.y - half * 1.4) * k), Math.round(2 * half * k), Math.round(2 * half * k)).data)];
    }));
  });
  // The camera eases onto the worker after a load; hold the view still before comparing.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1500)));
  const before = await sample(); await page.waitForTimeout(400); const after = await sample();
  return Object.fromEntries(Object.keys(before).map(name => {
    let changed = 0; const a = before[name], b = after[name];
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) changed++;
    return [name, changed / (a.length / 4)];
  }));
}

// The author saw still machines and a fading shuttle: the header's reduce switch was on. Full animation
// is the default even when the system asks for reduced motion; only the switch reduces it, and says so.
test('machines run by default, rest when the header switch reduces animation, and the choice survives a reload', async ({ browser }) => {
  test.setTimeout(90000);
  const f = await colonyFixture(browser, { viewport: { width: 1440, height: 1000 }, seedColony: machines });
  try {
    const { page } = f, toggle = page.locator('#effects-toggle');
    await mkdir(evidence, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    for (const [name, share] of Object.entries(await machineChange(page))) expect(share, name).toBeGreaterThan(.01);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#colony-toast')).toHaveText('Reduced animation: machines rest and the shuttle fades away instead of flying.');
    await page.screenshot({ path: path.join(evidence, 'colony-reduced-switch-on.png'), clip: { x: 1000, y: 0, width: 440, height: 90 } });
    for (const share of Object.values(await machineChange(page))) expect(share).toBe(0);
    await page.reload();
    await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#colony-toast')).toHaveText('Full animation: machines run and the shuttle flies.');
    for (const [name, share] of Object.entries(await machineChange(page))) expect(share, name).toBeGreaterThan(.01);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
