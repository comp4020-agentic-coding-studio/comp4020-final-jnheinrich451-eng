import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { colonyFixture } from './colony-motion-helper.js';

const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-08');

// A pond two tiles from the arrival tile (36.5, 31.5) so the worker can fish without walking,
// and enough materials to adopt the companion from Camp.
function seed(colony) {
  colony.settlement = { version: 1, revision: 0, stored: {}, deliveries: [], completed: [], undo: null, items: [
    { id: 'f-pond', kind: 'pond', x: 37, y: 32, dir: 0, variant: 'ivory', status: 'ready', revision: 0, owner: 'seed' },
  ] };
  colony.materials = 40;
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

// Play the reel fight as a steady angler: hold (E, or the reel button on a phone) while the
// fish is above the middle of the ring. A hard fish may escape; the line recasts, so try again.
async function fight(page, phone, shot) {
  const reel = page.locator('#fish-reel');
  const hold = async on => {
    if (!phone) { if (on) await page.keyboard.down('e'); else await page.keyboard.up('e'); return; }
    if (on) { const box = await reel.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); } else await page.mouse.up();
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    await expect(page.locator('#rest-prompt')).toContainText('Reel in', { timeout: 15000 });
    if (phone) await page.locator('#rest-prompt').click(); else await page.keyboard.press('e');
    await expect(page.locator('#fish-fight')).toBeVisible();
    let held = false, shotTaken = attempt > 0;
    for (let i = 0; i < 1500; i++) {
      const state = await page.evaluate(() => window.colonyFight || null);
      if (state?.done) break;
      if (state) {
        if (!shotTaken && state.t > 1.2) { shotTaken = true; await shot(); }
        const want = state.fish > state.y + state.size * .5 + (state.v > 0 ? .06 : -.02);
        if (want !== held) { held = want; await hold(want); }
      }
      await page.waitForTimeout(20);
    }
    if (held) await hold(false);
    await expect(page.locator('#fish-fight')).toBeHidden({ timeout: 5000 });
    if (await page.locator('#catch-card').isVisible()) return attempt;
    await expect(page.locator('#colony-toast')).toContainText('slipped away');
  }
  throw new Error('the steady angler lost four fish in a row');
}

for (const phone of [false, true]) test(`a worker fishes the pond, adopts the spider, is followed and pets it / ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(240000);
  const f = await colonyFixture(browser, { viewport: phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, seedColony: seed });
  try {
    const { page } = f;
    await mkdir(evidence, { recursive: true });
    const me = async () => page.evaluate(() => window.colonyPackets.at(-1)?.me || null);
    const press = async () => { if (phone) await page.locator('#rest-prompt').click(); else await page.keyboard.press('e'); };
    // Fishing: cast, wait for the server's bite, reel.
    await expect(page.locator('#rest-prompt')).toContainText('Fish');
    await press();
    await expect(page.locator('#colony-toast')).toHaveText('Line cast. Wait for a bite, then press E.');
    await expect.poll(async () => (await me()).activity?.kind).toBe('fish');
    await expect(page.locator('#rest-prompt')).toContainText('Stop fishing');
    // The bite: E hooks the fish, the fight meter opens, the angler holds the ring on it.
    await fight(page, phone, () => page.screenshot({ path: path.join(evidence, `colony-fish-fight-${phone ? 'phone' : 'desktop'}.png`), fullPage: true }));
    await expect(page.locator('#catch-title')).toHaveText(/^You caught an? .+!$/);
    await expect(page.locator('#catch-detail')).toContainText('sent to the warehouse');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(evidence, `colony-catch-card-${phone ? 'phone' : 'desktop'}.png`), fullPage: true });
    if (phone) await page.locator('#catch-close').click(); else await page.keyboard.press('e');
    await expect(page.locator('#catch-card')).toBeHidden();
    await expect.poll(async () => (await f.world()).colony.fishing?.treats).toBe(1);
    // Stop fishing by moving, then adopt the companion from Camp.
    await page.keyboard.down('a'); await page.waitForTimeout(120); await page.keyboard.up('a');
    await expect.poll(async () => (await me()).activity).toBeNull();
    await page.locator('#tool-camp').click();
    await page.locator('#adopt-pet').click();
    await expect(page.locator('#colony-toast')).toContainText('scuttles down');
    await expect.poll(async () => !!(await f.world()).colony.pet).toBe(true);
    await expect(page.locator('#camp-companion')).toContainText('Spider · petted 0 times');
    await expect(page.locator('#camp-companion')).toContainText('Warehouse · 1 fish · 1 kind caught · longest ');
    await expect(page.locator('#camp-companion')).not.toContainText('longest Fish ');
    await expect(page.locator('#creel-gallery figure')).toHaveCount(1);
    // Name it in Camp: the field keeps a half-typed name while the panel stays open.
    await page.locator('#pet-name').fill('Bramble');
    await page.locator('#pet-rename-button').click();
    await expect(page.locator('#colony-toast')).toHaveText('Your companion is now called Bramble.');
    await expect.poll(async () => (await f.world()).colony.pet.name).toBe('Bramble');
    await expect(page.locator('#camp-companion')).toContainText('Bramble · petted 0 times');
    // It follows: walk away west and it closes in.
    await page.keyboard.press('Escape');
    await walkTo(page, me, 32.5, 31.5);
    await expect.poll(async () => { const w = (await f.world()).colony, m = await me(); return Math.hypot(w.pet.x - m.x, w.pet.y - m.y); }, { timeout: 15000 }).toBeLessThan(2.4);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(evidence, `colony-companion-${phone ? 'phone' : 'desktop'}.png`), fullPage: true });
    // Petting with a fish in the creel feeds it.
    await expect(page.locator('#rest-prompt')).toContainText('Pet');
    await press();
    await expect(page.locator('#colony-toast')).toHaveText('Bramble gobbles the fish and spins with joy.');
    await expect.poll(async () => (await f.world()).colony.pet.fed).toBe(1);
    expect((await f.world()).colony.fishing.treats).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
