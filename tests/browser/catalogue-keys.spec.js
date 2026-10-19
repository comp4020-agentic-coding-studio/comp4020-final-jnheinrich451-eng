import { test, expect } from '@playwright/test';
import { isolatedField, landCore } from './rover-helper.js';

const me = page => page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
async function pickTile(page, x, y) {
  if (!await page.locator('#tile-x').isVisible()) await page.locator('#coordinate-details summary').click();
  await page.locator('#tile-x').fill(String(x)); await page.locator('#tile-y').fill(String(y)); await page.locator('#select-tile').click();
  await page.locator('#world-canvas').focus();
}

test('catalogue tabs, spec sheet and keyboard placement on desktop', async ({ browser }) => {
  test.setTimeout(60000);
  const arena = await isolatedField('catalogue-keys');
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(arena.base + '/?legacy=1'); await expect(page.locator('#connection')).toContainText('live');
    await landCore(page);
    await page.locator('#world-canvas').focus(); await page.keyboard.press('b');
    await expect(page.locator('#deployment-tray')).toBeVisible();
    await expect(page.locator('[role=tab]')).toHaveCount(6);
    await expect(page.locator('#tab-ground')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#sentry-card .asset-cost')).toHaveText('25 ORB');
    await expect(page.locator('#core-card .asset-cost')).toContainText('120 ORB');
    await page.locator('#tank-card').hover();
    await expect(page.locator('#asset-spec')).toContainText('Tank drop pod');
    await expect(page.locator('#asset-spec')).toContainText('HE 14 t');
    // Z / X cycle categories; arrow keys move between tabs without moving the robot.
    await page.keyboard.press('x'); await expect(page.locator('#tab-rail')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#rail-card')).toBeVisible(); await expect(page.locator('#sentry-card')).toBeHidden();
    const before = await me(page);
    await page.locator('#tab-rail').focus(); await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-strike')).toHaveAttribute('aria-selected', 'true');
    expect((await me(page)).x).toBe(before.x);
    await page.keyboard.press('z'); await page.keyboard.press('z');
    await expect(page.locator('#tab-ground')).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: '.local/catalogue-desktop.png' });
    // 1 picks the first asset; Enter confirms; Shift+Enter keeps placing.
    await page.keyboard.press('1'); await expect(page.locator('#site-panel')).toBeVisible();
    await expect(page.locator('#state-banner')).toHaveText('PLACING · APCR SENTRY');
    await pickTile(page, 28, 21); await page.keyboard.press('Enter');
    await expect(page.locator('#toast')).toContainText('deployment saved'); await expect(page.locator('#site-panel')).toBeHidden();
    await page.keyboard.press('b'); await page.keyboard.press('1'); await pickTile(page, 30, 22);
    await page.keyboard.press('Shift+Enter');
    await expect.poll(async () => (await page.evaluate(async () => (await (await fetch('/api/world')).json()).buildings.filter(b => !b.coreId).length))).toBe(2);
    await expect(page.locator('#site-panel')).toBeVisible(); await expect(page.locator('#state-banner')).toHaveText('PLACING · APCR SENTRY');
    await page.keyboard.press('Escape');
    await expect(page.locator('#site-panel')).toBeHidden(); await expect(page.locator('#state-banner')).toHaveText('ON FOOT · ROBOT');
    // Rail placement: R cycles the shape, T toggles the length.
    await page.keyboard.press('b'); await page.keyboard.press('x'); await page.keyboard.press('1');
    await expect(page.locator('#rail-options')).toBeVisible(); await page.locator('#world-canvas').focus();
    const shape = await page.locator('#rail-shape').inputValue(), length = await page.locator('#rail-length').inputValue();
    await page.keyboard.press('r'); await expect(page.locator('#rail-shape')).not.toHaveValue(shape);
    await page.locator('#rail-shape').selectOption('EW'); await page.locator('#world-canvas').focus();
    await page.keyboard.press('t'); await expect(page.locator('#rail-length')).not.toHaveValue(length);
    await page.keyboard.press('Escape');
    // L, F1, M and O.
    await page.keyboard.press('l'); await expect(page.locator('#logistics-dialog')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('#logistics-dialog')).toBeHidden();
    await page.locator('#world-canvas').focus(); await page.keyboard.press('F1');
    await expect(page.locator('#keys-dialog')).toBeVisible();
    await expect(page.locator('#keys-now')).toContainText('Deploy catalogue'); await expect(page.locator('#keys-now')).toContainText('Pointer and movement');
    await expect(page.locator('#keys-now')).not.toContainText('Toggle LMB: HE / Magnetic');
    await page.screenshot({ path: '.local/key-reference-desktop.png' });
    await page.keyboard.press('Escape'); await expect(page.locator('#keys-dialog')).toBeHidden();
    const zoom = await page.locator('#zoom-label').textContent();
    await page.locator('#world-canvas').focus(); await page.keyboard.press('m');
    await expect(page.locator('#zoom-label')).not.toHaveText(zoom);
    await page.keyboard.press('m'); await expect(page.locator('#zoom-label')).toHaveText(zoom);
    await page.keyboard.press('o'); await expect(page.locator('#toast')).toContainText(/Hostile site|No hostile sites/);
    expect(errors).toEqual([]);
  } finally { await context.close(); await arena.close(); }
});

test('tank weapon keys and the context key reference', async ({ browser }) => {
  const arena = await isolatedField('tank-keys', [{ x: 24.5, y: 18.5 }]);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await arena.seat(context);
  try {
    const page = await context.newPage(); await page.goto(arena.base + '/?legacy=1');
    await expect(page.locator('#connection')).toContainText('live'); await page.locator('#world-canvas').focus();
    await page.keyboard.press('1'); await expect.poll(async () => (await me(page)).tankWeapon).toBe('MAGNETIC');
    expect((await me(page)).tankSecondary).toBe('APCR');
    await page.keyboard.press('1'); await expect.poll(async () => (await me(page)).tankWeapon).toBe('HE');
    await page.keyboard.press('2'); await expect.poll(async () => (await me(page)).tankSecondary).toBe('HEAVY_FLAME');
    await page.keyboard.press('2'); await expect.poll(async () => (await me(page)).tankSecondary).toBe('APCR');
    expect((await me(page)).tankWeapon).toBe('HE');
    // Repeated keydown events from a held key must not toggle the slot back.
    await page.keyboard.down('1'); await expect.poll(async () => (await me(page)).tankWeapon).toBe('MAGNETIC');
    await page.keyboard.down('1'); await page.keyboard.up('1');
    expect((await me(page)).tankWeapon).toBe('MAGNETIC');
    await expect(page.locator('#tank-primary')).toHaveValue('MAGNETIC');
    await expect(page.locator('#tank-secondary')).toHaveValue('APCR');
    await expect(page.locator('.battlefield')).toHaveAttribute('data-state', 'vehicle');
    await page.keyboard.press('F1'); await expect(page.locator('#keys-now')).toContainText('Toggle LMB: HE / Magnetic');
    await expect(page.locator('#keys-now')).toContainText('Toggle RMB: machine gun / fuel jet');
    await page.keyboard.press('Escape');
  } finally { await context.close(); await arena.close(); }
});

test('phone catalogue is a bottom sheet without page scrolling', async ({ browser }) => {
  const arena = await isolatedField('catalogue-phone');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); await page.goto(arena.base + '/?legacy=1');
    await expect(page.locator('#connection')).toContainText('live'); await landCore(page);
    await page.locator('#build-mode').tap(); await expect(page.locator('#deployment-tray')).toBeVisible();
    await expect(page.locator('#asset-spec')).toBeHidden();
    await page.locator('#tab-logistics').tap(); await expect(page.locator('#factory-card')).toBeInViewport();
    await expect(page.locator('#factory-card .asset-cost')).toHaveText('150 ORB');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    const tray = await page.locator('#deployment-tray').boundingBox();
    expect(tray.height).toBeLessThanOrEqual(844 * .47);
    await page.screenshot({ path: '.local/catalogue-mobile.png' });
    await page.locator('#recycler-card').tap(); await expect(page.locator('#site-panel')).toBeVisible();
  } finally { await context.close(); await arena.close(); }
});
