import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { expandWorld } from '../../public/expansion.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`R turns a new double airbase before it lands on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-double-runway-')), token = randomUUID();
  let app = createApp({ dataDir, logSink: () => {} }), context; await app.close();
  const db = new DatabaseSync(path.join(dataDir, 'world.sqlite')), world = expandWorld(createWorld()); world.terrain.fill(2); world.bridges = [];
  db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world), 'world');
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token, 'pilot', 'Pilot', 54.6, 60.5, 0);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core', 'pilot', 63, 60, 4.5); db.close();
  app = createApp({ dataDir, logSink: () => {} });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    await context.addCookies([{ name: 'frontier', value: token, url }]);
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    const state = () => page.evaluate(async () => (await fetch('/api/world')).text()).then(JSON.parse);
    await page.goto(url + '/?legacy=1'); await expect(page.locator('#connection')).toContainText('live');
    await page.locator('#build-mode').click(); await page.locator('[data-force-tab="air"]').click();
    await page.locator('#airbase-card').click();
    await expect(page.locator('#runway-turn')).toBeVisible();
    await page.locator('#coordinate-details summary').click();
    await page.locator('#tile-x').fill('30'); await page.locator('#tile-y').fill('40'); await page.locator('#select-tile').click();
    await expect(page.locator('#place-building')).toBeEnabled();
    await expect(page.locator('#site-reason')).toContainText('6 x 20 payload / two long walls / 360 tiles');
    await page.screenshot({ path: info.outputPath('upright.png') });
    if (mobile) await page.locator('#runway-turn').click();
    else { await page.locator('#world-canvas').focus(); await page.keyboard.press('r'); }
    await expect(page.locator('#site-reason')).toContainText('20 x 6 payload / two long walls / 360 tiles');
    await page.screenshot({ path: info.outputPath('turned.png') });
    await page.locator('#place-building').click();
    await expect.poll(async () => (await state()).airbases[0]).toMatchObject({ runways: 2, turned: true, x: 30, y: 40 });
    await expect.poll(async () => Object.keys((await state()).logistics.jobs).length, { timeout: 20000 }).toBe(0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    await page.screenshot({ path: info.outputPath('built.png') });
    expect(errors).toEqual([]);
  } finally { await context?.close(); await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});
