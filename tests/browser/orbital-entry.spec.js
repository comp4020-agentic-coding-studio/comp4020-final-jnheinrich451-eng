import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`first landing and saved robot controls on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-entry-browser-'));
  const app = createApp({ dataDir });
  let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const state = () => page.evaluate(async () => (await fetch('/api/world')).json());
    await page.goto(base + '/?legacy=1');
    await expect(page.locator('#connection')).toContainText('live');
    await expect(page.locator('.battlefield')).toHaveClass(/in-orbit/);
    await expect(page.locator('#site-panel')).toBeVisible();
    await expect(page.locator('#place-building')).toBeEnabled();
    await expect(page.locator('#fire-button')).toBeHidden();
    // Orbit shows landing steps and a measured site readout instead of ground controls.
    await expect(page.locator('#orbit-steps')).toBeVisible(); await expect(page.locator('.mode-dock')).toBeHidden();
    await expect(page.locator('#orbit-steps li.current')).toContainText('Confirm drop');
    await expect(page.locator('#site-analysis')).toContainText('57-cell cross');
    await expect(page.locator('#site-analysis')).toContainText('server confirms on drop');
    if (!mobile) await expect(page.locator('#state-banner')).toHaveText('ORBIT · NO GROUND BODY');
    expect((await state()).me.body).toBe('orbital');
    await page.keyboard.press('Escape');
    await expect(page.locator('#site-panel')).toBeVisible();
    await page.reload();
    await expect(page.locator('#place-building')).toBeEnabled();
    await page.locator('#coordinate-details summary').click();
    await page.locator('#tile-x').fill('24'); await page.locator('#tile-y').fill('18');
    await page.locator('#select-tile').click();
    await expect(page.locator('#place-building')).toBeEnabled();
    await page.screenshot({ path: info.outputPath('orbital-survey.png') });
    await page.locator('#place-building').click();
    await expect.poll(async () => (await state()).me.body).toBe('robot');
    await expect.poll(async () => (await state()).me.deploying, { timeout: 7000 }).toBe(false);
    await expect(page.locator('#site-panel')).toBeHidden();
    await expect(page.locator('#orbit-steps')).toBeHidden(); await expect(page.locator('.mode-dock')).toBeVisible();
    await expect(page.locator('#landing-log')).toContainText('✓ Core landed');
    if (!mobile) await expect(page.locator('#state-banner')).toHaveText('ON FOOT · ROBOT');
    const landed = (await state()).me;
    if (mobile) {
      const button = page.locator('[data-direction="right"]');
      const box = await button.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    } else await page.keyboard.down('d');
    try { await expect.poll(async () => (await state()).me.x).toBeGreaterThan(landed.x + .25); }
    finally { if (mobile) await page.mouse.up(); else await page.keyboard.up('d'); }
    await page.reload();
    await expect(page.locator('#connection')).toContainText('live');
    await expect(page.locator('.battlefield')).not.toHaveClass(/in-orbit/);
    await expect(page.locator('#site-panel')).toBeHidden();
    expect((await state()).cores).toHaveLength(1);
    await page.screenshot({ path: info.outputPath('landed-robot.png') });
    expect(errors).toEqual([]);
  } finally { await context?.close(); await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});
