import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

for (const mobile of [false, true]) test(`peaceful expedition selection persists and saves retain their mode / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-lobby-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const value = await response.json(); expect(response.ok(), JSON.stringify(value)).toBe(true); return value;
    };
    const credentials = { name: 'Meadow Keeper', email: 'meadow@frontier.test', password: 'an isolated peaceful password 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    await post('/api/campaigns/create', { name: 'Original combat world' });
    await post('/api/campaigns/create', { name: 'Legacy colony garden', mode: 'colonization', template: 'caldera-v1' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/campaigns/');
    await expect(page.locator('#menu-view .menu-actions > button')).toHaveCount(4);
    expect(await page.locator('#menu-view .menu-actions > button').evaluateAll(buttons => buttons.map(b => b.id)))
      .toEqual(['new-game', 'continue-game', 'colonization-game', 'join-game']);
    await page.locator('#colonization-game').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'colony');
    await page.locator('#new-expedition').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-mode', 'colonization');
    await expect(page.locator('#planet-status')).toContainText('PEACEFUL');
    await expect(page.locator('#planet-description')).not.toContainText('hostile');
    for (const [name, id] of [['Morrow', 'morrow-v1'], ['Nacre', 'nacre-v1'], ['Aurelia', 'aurelia-v1']]) {
      await expect(page.locator('#planet-heading')).toHaveText(name);
      await expect(page.locator('body')).toHaveAttribute('data-entry-planet', id);
      await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
      await page.screenshot({ path: info.outputPath(`colony-destination-${id}.png`), fullPage: true });
      await page.locator('#planet-next').click();
    }
    await expect(page.locator('#planet-heading')).toHaveText('Morrow');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-entry-mode', 'colonization');
    await expect(page.locator('#planet-heading')).toHaveText('Morrow');
    await page.locator('#select-planet').click();
    await expect(page.locator('#create-heading')).toHaveText('Name your expedition');
    await expect(page.locator('#create input[name=mode]')).toHaveValue('colonization');
    await page.locator('#campaign-name').fill('Meadowlight');
    await page.screenshot({ path: info.outputPath('colonization-entry.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // A transient entry refusal must keep the newly created peaceful save and
    // offer Continue, never recreate it or fall back to a combat campaign.
    await page.route('**/api/campaigns/enter', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Expedition is briefly unavailable.' }) }));
    await page.locator('#create-submit').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'continue');
    const peaceful = page.locator('.campaign-card').filter({ has: page.locator('strong', { hasText: 'Meadowlight' }) });
    await expect(peaceful).toContainText('Colonization');
    await expect(page.locator('.campaign-card').filter({ has: page.locator('strong', { hasText: 'Original combat world' }) })).toHaveCount(0);
    // Old peaceful templates are grouped under the three civilian destinations,
    // without changing their saved geography or exposing combat selector entries.
    await expect(page.locator('#planet-heading')).toHaveText('Morrow');
    await expect(page.locator('.campaign-card').filter({ hasText: 'Legacy colony garden' })).toBeVisible();
    await expect(page.locator('.campaign-card').filter({ hasText: 'Legacy colony garden' })).toContainText('Legacy Caldera');
    await expect(page.locator('.campaign-card').filter({ hasText: 'Original combat world' })).toHaveCount(0);
    for (const name of ['Nacre', 'Aurelia', 'Morrow']) {
      await page.locator('#planet-next').click();
      await expect(page.locator('#planet-heading')).toHaveText(name);
    }
    await page.locator('#back').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'colony');
    await expect(page.locator('#back')).toBeHidden();
    await page.locator('#war-zone').click();
    await page.locator('#continue-game').click();
    await expect(page.locator('.campaign-card').filter({ hasText: 'Original combat world' })).toBeVisible();
    await expect(page.locator('.campaign-card').filter({ hasText: 'Legacy colony garden' })).toHaveCount(0);
    const listing = await (await context.request.get(base + '/api/campaigns/list')).json();
    expect(listing.campaigns).toHaveLength(3);
    expect(listing.campaigns.find(c => c.name === 'Meadowlight')).toMatchObject({ mode: 'colonization', template: 'morrow-v1' });
    expect(listing.campaigns.find(c => c.name === 'Original combat world').mode).toBe('combat');
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-lobby-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
