import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';
import { COLONY_DEPTH, colonyWorldToScreen } from '../../public/colony-view.js';

for (const mobile of [false, true]) test(`peaceful gardening through real controls / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(120000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-play-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 };
    context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const value = await response.json(); expect(response.ok(), JSON.stringify(value)).toBe(true); return value;
    };
    const credentials = { name: 'Aster', email: 'aster@frontier.test', password: 'a lovely isolated garden password 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/campaigns/');
    await page.locator('#colonization-game').click();
    await page.locator('#new-expedition').click();
    await page.locator('#select-planet').click();
    await page.locator('#campaign-name').fill('Meadowlight');
    await page.locator('#create-submit').click();
    await page.waitForURL('**/colony/?campaign=*');
    const id = new URL(page.url()).searchParams.get('campaign');
    const snapshot = async () => (await context.request.get(`${base}/api/campaign-world/${id}/world`)).json();
    await expect(page.locator('#colony-loading')).toBeHidden();
    await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
    await expect(page.locator('#project-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#milestones')).toBeHidden();
    await page.locator('#colony-help').click();
    await expect(page.locator('#colony-help-dialog')).toBeVisible();
    await page.locator('#colony-help-close').click();
    await expect(page.locator('#colony-help-dialog')).toBeHidden();
    await page.locator('#place-bed-gift').click();
    await page.locator('[data-plant=sundrop]').click();
    await page.locator('#water-bed').click();
    await expect(page.locator('.water-status')).toContainText('Watered');
    await expect.poll(async () => (await snapshot()).colony.beds[0].growth).toBeGreaterThan(0);
    expect((await snapshot()).colony.materials).toBe(40);
    await page.screenshot({ path: info.outputPath('garden-growing.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    if (mobile) {
      const sheet = await page.locator('#inspector').boundingBox();
      const tools = await page.locator('.garden-toolbar').boundingBox();
      expect(sheet.height).toBeLessThanOrEqual(240);
      expect(sheet.y + sheet.height).toBeLessThanOrEqual(tools.y + 1);
      await page.locator('#inspector-close').click();
      const before = (await snapshot()).me;
      const east = page.getByRole('button', { name: 'Move east', exact: true });
      const box = await east.boundingBox(); expect(box).not.toBeNull();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await expect.poll(async () => (await snapshot()).me.x, { timeout: 3000 }).toBeGreaterThan(before.x + .4);
      await page.mouse.up();
      await page.waitForTimeout(300);
      const stopped = (await snapshot()).me;
      await page.waitForTimeout(650);
      expect(Math.abs((await snapshot()).me.x - stopped.x)).toBeLessThan(.1);
      await page.locator('#tool-inspect').click();
      await page.locator('[data-select-bed]').first().click();
      await expect(page.locator('#water-bed')).toBeVisible();
      await page.locator('#add-sprinkler-nearby').click();
      await expect.poll(async () => (await snapshot()).colony.sprinklers.length).toBe(1);
      await expect(page.locator('#materials-count')).toHaveText('28');
      await page.locator('[data-select-bed]').first().click();
      await expect(page.locator('.water-status')).toContainText('Sprinkler');
      await page.screenshot({ path: info.outputPath('garden-phone.png'), fullPage: true });
    } else {
      // The gift is centered above the contextual tool dock. Place the
      // sprinkler on tile 34:32 through the same pointer path players use.
      await page.locator('#tool-inspect').click();
      await page.locator('#place-sprinkler').click();
      const point = colonyWorldToScreen({ x: 34.5, y: 32.5 }, { x: 32.5, y: 31.5 + 1.2 / COLONY_DEPTH, tile: 45 }, viewport.width, viewport.height);
      await page.mouse.click(point.x, point.y);
      await expect.poll(async () => (await snapshot()).colony.sprinklers.length).toBe(1);
      expect((await snapshot()).colony.sprinklers[0]).toMatchObject({ x: 34, y: 32 });
      await expect(page.locator('#materials-count')).toHaveText('28');
      await page.locator('[data-select-bed]').first().click();
      await expect(page.locator('.water-status')).toContainText('Sprinkler');

      // Wait through a genuine growing cycle, without a client clock or save edit.
      await expect(page.locator('#harvest-bed')).toBeEnabled({ timeout: 55000 });
      await page.screenshot({ path: info.outputPath('garden-ripe.png'), fullPage: true });
      await page.locator('#harvest-bed').click();
      await expect.poll(async () => (await snapshot()).colony.storage.sundrop).toBe(2);
      await page.locator('#tool-shipment').click();
      await page.locator('#ship-cargo').click();
      await expect(page.locator('.shipment-summary').first()).toContainText(/Loading harvest|Departing for MYCORRHIZAL/);
      await expect.poll(async () => (await snapshot()).colony.shipments, { timeout: 20000 }).toBe(1);
      // The reward lands as crates beside the pad; materials rise only when a crate is collected.
      await expect(page.locator('#materials-count')).toHaveText('28');
      const delivered=(await snapshot()).colony;
      expect(delivered.materials+delivered.crates.reduce((total,crate)=>total+crate.materials,0)).toBe(44);
      expect(delivered.decorations.pennant).toBe(true);
      await page.screenshot({ path: info.outputPath('garden-delivery.png'), fullPage: true });

      // Pausing must keep its live connection and Resume control after the
      // client's stale-stream watchdog period, while the growth clock freezes.
      await page.locator('#room-open').click();
      await page.locator('#colony-pause').click();
      await expect(page.locator('#colony-pause')).toHaveText('Resume expedition');
      const pausedTime = (await snapshot()).colony.time;
      await page.waitForTimeout(7000);
      expect((await snapshot()).colony.time).toBe(pausedTime);
      await expect(page.locator('#colony-pause')).toBeEnabled();
      await expect(page.locator('#colony-connection')).toHaveText('Taking a little break');
      await page.locator('#colony-pause').click();
      await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
      await page.locator('#room-close').click();
      await page.keyboard.press('F1');
      await expect(page.locator('#colony-help-dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#colony-help-dialog')).toBeHidden();
      const before = (await snapshot()).me;
      await page.keyboard.down('d');
      await expect.poll(async () => (await snapshot()).me.x).toBeGreaterThan(before.x + .4);
      await page.keyboard.up('d');
      // A reload restores the accepted harvest, reward and irrigation.
      await page.reload();
      await expect(page.locator('#colony-loading')).toBeHidden();
      const returned = await snapshot();
      expect(returned.colony.materials+returned.colony.crates.reduce((total,crate)=>total+crate.materials,0)).toBe(44);
      expect(returned.colony).toMatchObject({ materials: 28, shipments: 1, milestones: { firstPlant: true, firstHarvest: true, firstShipment: true } });
      expect(returned.colony.sprinklers).toHaveLength(1);
    }
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-play-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
