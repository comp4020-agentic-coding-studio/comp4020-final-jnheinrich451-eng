import { test, expect } from '@playwright/test';
import { isolatedField } from './rover-helper.js';

for (const mobile of [false, true]) test('campaign globe navigates without moving a unit / ' + (mobile ? 'phone' : 'desktop'), async ({ browser }) => {
  const field = await isolatedField('planet', [{ x: 24.5, y: 18.5 }]); let context;
  try {
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    await field.seat(context); const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(field.base + '/?legacy=1'); await expect(page.locator('#connection')).toContainText('live');
    const state = () => page.evaluate(async () => (await fetch('/api/world')).json());
    const initial = await state(); expect([initial.world.width, initial.world.height]).toEqual([512, 384]);
    if (mobile) await page.locator('#planet-open').click(); else { await page.locator('#world-canvas').focus(); await page.keyboard.press('n'); }
    await expect(page.locator('#planet-dialog')).toBeVisible();
    await expect(page.locator('#planet-status')).toContainText('512 × 384');
    const globe = page.locator('#planet-globe'); const before = await globe.getAttribute('data-longitude');
    if (mobile) await page.locator('[aria-label="Rotate east"]').click(); else { await globe.focus(); await page.keyboard.press('ArrowRight'); }
    await expect(globe).not.toHaveAttribute('data-longitude', before);
    const box = await globe.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .75, box.y + box.height * .55, { steps: 8 }); await page.mouse.up();
    await expect(page.locator('#planet-dialog')).toBeVisible();
    await page.locator('#planet-regions').selectOption('meridian');
    await expect(globe).toHaveAttribute('data-longitude', /1\.4/);
    await page.screenshot({ path: '.local/planet-' + (mobile ? 'phone' : 'desktop') + '.png' });
    if (mobile) await globe.tap({ position: { x: box.width / 2, y: box.height / 2 } }); else await page.locator('#planet-visit').click();
    await expect(page.locator('#planet-dialog')).not.toBeVisible();
    await expect(page.locator('#tile-x')).toHaveValue('370'); await expect(page.locator('#tile-y')).toHaveValue('250');
    const after = await state(); expect(after.me.x).toBe(initial.me.x); expect(after.me.y).toBe(initial.me.y);
    await page.screenshot({ path: '.local/planet-surface-' + (mobile ? 'phone' : 'desktop') + '.png' });
    await page.locator('#planet-open').click(); await page.keyboard.press('Escape'); await expect(page.locator('#planet-dialog')).not.toBeVisible();
    if (!mobile) {
      await page.locator('#world-canvas').focus(); await page.keyboard.press('m');
      const zoom = parseInt(await page.locator('#zoom-label').textContent()); await page.keyboard.press('-'); expect(parseInt(await page.locator('#zoom-label').textContent())).toBeLessThanOrEqual(zoom);
      await page.keyboard.press('m'); await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#planet-open').click(); await expect(page.locator('#planet-visit')).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context?.close(); await field.close(); }
});
