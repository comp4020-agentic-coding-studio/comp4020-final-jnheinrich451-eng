import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

for (const mobile of [false, true]) test(`Sirocco campaign, landing, sandport preview and saved return / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(90000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-sirocco-ui-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.ok(), await response.text()).toBe(true); return response.json();
    };
    const credentials = { name: 'Sirocco explorer', kind: 'demo', email: 'sirocco@frontier.test', password: 'isolated sirocco expedition 123!' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base + '/campaigns/');
    await page.locator('#new-game').click();
    await page.locator('#planet-prev').click();
    await expect(page.locator('#planet-heading')).toContainText('Sirocco');
    await expect(page.locator('body')).toHaveAttribute('data-entry-planet', 'sirocco-v1');
    await expect(page.locator('.planet-info')).toContainText('sand');
    await page.screenshot({ path: info.outputPath('sirocco-selection.png'), fullPage: true });
    await page.reload();
    await expect(page.locator('#planet-heading')).toContainText('Sirocco');
    await page.locator('#select-planet').click();
    await page.locator('#campaign-name').fill('Sirocco expedition');
    await page.locator('#create-submit').click();
    await expect(page.locator('#connection')).toContainText('live', { timeout: 15000 });
    const id = new URL(page.url()).searchParams.get('campaign');
    const read = async () => (await context.request.get(base + `/api/campaign-world/${id}/world`)).json();
    const initial = await read(), zones = initial.world.landingZones;
    expect(initial.world.template).toBe('sirocco-v1'); expect(zones).toHaveLength(4);
    expect(initial.combat.sites.length).toBeGreaterThan(100);
    await page.locator('#landing-zone').selectOption(zones[0].id);
    await expect(page.locator('#place-building')).toBeEnabled();
    await page.locator('#place-building').click();
    await expect.poll(async () => (await read()).me.deploying, { timeout: 12000 }).toBe(false);
    expect((await read()).me.body).toBe('robot');
    await page.locator('#world-canvas').focus();
    const before = (await read()).me.x;
    await page.keyboard.down('d');
    try { await expect.poll(async () => (await read()).me.x).toBeGreaterThan(before + .4); }
    finally { await page.keyboard.up('d'); }
    await page.locator('#planet-open').click();
    await expect(page.locator('#planet-title')).toHaveText('Sirocco');
    await page.screenshot({ path: info.outputPath('sirocco-globe.png') });
    await page.locator('#planet-regions').selectOption('lake');
    await page.locator('#planet-visit').click();
    await page.screenshot({ path: info.outputPath('sirocco-oasis.png') });
    // Existing orbit deployment rules must work at the authored dry shoreline.
    await page.locator('#world-canvas').focus(); await page.keyboard.press('b');
    await page.locator('#tab-navy').click();
    await expect(page.locator('#dock-card')).toContainText('Empty sandport');
    await page.locator('#dock-card').click();
    await page.locator('#coordinate-details summary').click();
    await page.locator('#tile-x').fill('112'); await page.locator('#tile-y').fill('172');
    await page.locator('#select-tile').click();
    await expect(page.locator('#place-building')).toBeEnabled();
    await expect(page.locator('#site-title')).toContainText('sandport');
    await expect(page.locator('#terrain-name')).toContainText('sand sea');
    await expect(page.locator('#site-reason')).toContainText('loose sand');
    await page.screenshot({ path: info.outputPath('sirocco-sandport-preview.png') });
    await page.locator('#place-building').click();
    await expect.poll(async () => (await read()).logistics.shipyards.length).toBe(1);
    const saved = await read();
    expect(saved.logistics.supplies).toBeLessThan(initial.logistics.supplies - 90);
    await page.reload(); await expect(page.locator('#connection')).toContainText('live');
    const returned = await read();
    expect(returned.world.terrain).toEqual(initial.world.terrain);
    expect(returned.world.waterKinds).toEqual(initial.world.waterKinds);
    expect(returned.world.landingZones).toEqual(zones);
    expect(returned.cores[0].id).toBe(saved.cores[0].id);
    expect(returned.logistics.shipyards[0].id).toBe(saved.logistics.shipyards[0].id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-sirocco-ui-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
