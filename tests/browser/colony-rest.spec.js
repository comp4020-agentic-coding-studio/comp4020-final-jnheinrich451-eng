import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { colonyFixture } from './colony-motion-helper.js';

const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-08');

// A bench beside the arrival tile (36.5, 31.5), a kettle a short walk east and a charging
// post south. Seeding keeps the run short; the rules are covered by vitest.
function seed(colony) {
  const ready = (id, kind, x, y, dir = 0) => ({ id, kind, x, y, dir, variant: 'ivory', status: 'ready', revision: 0, owner: 'seed' });
  colony.settlement = { version: 1, revision: 0, stored: {}, deliveries: [], completed: [], undo: null, items: [
    ready('f-bench', 'bench', 37, 31), ready('f-kettle', 'kettle', 40, 30), ready('f-post', 'charging-post', 34, 33), ready('f-lamp', 'path-lamp', 39, 33),
  ] };
  colony.nextId = 50;
}

async function walkTo(page, me, tx, ty) {
  for (let step = 0; step < 60; step++) {
    const at = await me(); const dx = tx - at.x, dy = ty - at.y;
    if (Math.abs(dx) < .3 && Math.abs(dy) < .3) return at;
    const key = Math.abs(dy) > .3 && (Math.abs(dy) >= Math.abs(dx) || Math.abs(dx) < .3) ? (dy > 0 ? 's' : 'w') : (dx > 0 ? 'd' : 'a');
    await page.keyboard.down(key); await page.waitForTimeout(70); await page.keyboard.up(key); await page.waitForTimeout(320);
  }
  throw new Error('walkTo did not arrive');
}

for (const phone of [false, true]) test(`a worker sits with E, stands up by moving, and brews at a kettle / ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(90000);
  const f = await colonyFixture(browser, { viewport: phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, seedColony: seed });
  try {
    const { page } = f;
    await mkdir(evidence, { recursive: true });
    // The local worker's record from the latest authoritative packet (a small object, never the world).
    const me = async () => page.evaluate(() => window.colonyPackets.at(-1)?.me || null);
    await expect(page.locator('#rest-prompt')).toBeVisible();
    await expect(page.locator('#rest-prompt')).toContainText('Sit');
    if (phone) await page.locator('#rest-prompt').click(); else await page.keyboard.press('e');
    await expect(page.locator('#colony-toast')).toHaveText('Taking a seat.');
    await expect.poll(async () => (await me()).activity?.kind).toBe('sit');
    const seated = await me();
    expect(seated).toMatchObject({ x: 38, y: 31.5 });
    expect(seated.activity).not.toHaveProperty('from');
    await expect(page.locator('#rest-prompt')).toContainText('Stand up');
    await page.screenshot({ path: path.join(evidence, `colony-rest-sit-${phone ? 'phone' : 'desktop'}.png`), fullPage: true });
    // The sitting worker can see the garden has not changed, and standing is any movement.
    expect((await f.world()).colony.settlement.items).toHaveLength(4);
    if (phone) await page.locator('#rest-prompt').click();
    else { await page.keyboard.down('a'); await page.waitForTimeout(120); await page.keyboard.up('a'); }
    await expect.poll(async () => (await me()).activity).toBeNull();
    await expect.poll(async () => (await me()).x).toBeLessThan(37.5);
    if (phone) return;
    // Walk to the kettle's brewing spot (40.5, 31.5) in short taps: a held key keeps moving between polls.
    // Around the solid bench first, then east below it, then up to the kettle.
    await walkTo(page, me, 36.3, 32.7); await walkTo(page, me, 40.5, 32.7); await walkTo(page, me, 40.5, 31.7);
    await expect(page.locator('#rest-prompt')).toContainText('Brew');
    await page.keyboard.press('e');
    await expect.poll(async () => (await me()).activity?.kind).toBe('brew');
    expect(await me()).toMatchObject({ x: 40.5, y: 31.5, angle: 0 });
    await page.waitForTimeout(400);
    const first = await page.screenshot({ path: path.join(evidence, 'colony-rest-brew-desktop.png'), fullPage: true });
    await page.waitForTimeout(500);
    // Steam and the cup sway: two frames of a brewing worker differ.
    expect(Buffer.compare(first, await page.screenshot())).not.toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
