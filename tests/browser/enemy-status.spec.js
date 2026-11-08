import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { isolatedField } from './rover-helper.js';

// Isolated field only. Status shows on the unit itself (9 November 2026): gas bubbles
// while gas eats at a Breaker or Bulwark, a swirl over a confused Breaker, heat chevrons
// on a slowed Bulwark, and labels that say so. The page is served a real world snapshot
// with those states added, and the live stream is held back so the snapshot stays put.
const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-09');

for (const phone of [false, true]) test(`gassed, confused and slowed enemies show it on the unit / ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(60000);
  const arena = await isolatedField('enemy-status', [{ x: 24.5, y: 18.5 }]);
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1600, height: 1000 } });
  await arena.seat(context);
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/events', route => route.abort());
    await page.route('**/api/world', async route => {
      const response = await route.fetch(), state = await response.json(), now = state.combat.time || 0, later = now + 1e9;
      const enemy = (id, kind, x, hp, extra) => ({ id, kind, x, y: 18.5, hp, maxHp: { breaker: 180, bulwark: 450 }[kind], angle: 0, behavior: 'attacking', ...extra });
      state.combat.enemies = [
        enemy(901, 'breaker', 28.5, 120, { gassedUntil: later, confusedUntil: later }),
        enemy(902, 'bulwark', 20.5, 380, { gassedUntil: later }),
        enemy(903, 'bulwark', 24.5, 450, { slowedUntil: later, y: 22.5 }),
      ];
      await route.fulfill({ response, json: state });
    });
    await page.goto(arena.base + '/?legacy=1');
    await expect(page.locator('#loading')).toHaveClass(/hidden/);
    await page.locator('#world-canvas').focus(); await page.keyboard.press('c'); await page.waitForTimeout(1200);
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, `enemy-status-${phone ? 'phone' : 'desktop'}.png`) });
    expect(errors).toEqual([]);
  } finally { await context.close(); await arena.close(); }
});
