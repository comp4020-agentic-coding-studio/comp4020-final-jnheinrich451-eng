import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';
import { COLONY_PLANETS } from '../../public/colony-planets.js';

test('three civilian worlds are playable, visually distinct and retain their saved gardens', async ({ browser }, info) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-destinations-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const value = await response.json(); expect(response.ok(), JSON.stringify(value)).toBe(true); return value;
    };
    const credentials = { name: 'Garden surveyor', email: 'surveyor@frontier.test', password: 'disposable new garden planets 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    const page = await context.newPage(), errors = [], terrains = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const planet of COLONY_PLANETS) {
      const save = await post('/api/campaigns/create', { name: `${planet.name} garden`, mode: 'colonization', template: planet.id });
      const entered = await post('/api/campaigns/enter', { id: save.id });
      const world = async () => (await context.request.get(base + `/api/campaign-world/${save.id}/world`)).json();
      await page.goto(base + entered.next);
      await expect(page.locator('#colony-planet')).toContainText(planet.name);
      await page.locator('#place-bed-gift').click();
      await page.locator('[data-plant=moonberry]').click();
      await page.locator('#water-bed').click();
      await expect(page.locator('.water-status')).toContainText('Watered');
      const saved = await world();
      expect(saved.world.template).toBe(planet.id);
      expect(saved.colony.beds[0].crop).toBe('moonberry');
      terrains.push(JSON.stringify(saved.world.terrain));
      await page.locator('#inspector-close').click();
      await expect(page.locator('#colony-toast')).toBeHidden({ timeout: 5000 });
      await page.screenshot({ path: info.outputPath(`${planet.name.toLowerCase()}-garden.png`), fullPage: true });
      for (let i = 0; i < 4; i++) await page.locator('#colony-zoom-out').click();
      await page.screenshot({ path: info.outputPath(`${planet.name.toLowerCase()}-district.png`), fullPage: true });
      await page.reload();
      await expect(page.locator('#colony-loading')).toBeHidden();
      const restored = await world();
      expect(restored.world.terrain).toEqual(saved.world.terrain);
      expect(restored.colony.beds[0]).toMatchObject({ id: saved.colony.beds[0].id, crop: 'moonberry', x: 32, y: 31 });
      await post('/api/campaigns/leave', { id: save.id });
    }
    expect(new Set(terrains).size).toBe(3);
    const listing = await (await context.request.get(base + '/api/campaigns/list')).json();
    expect(listing.campaigns.map(c => c.template).sort()).toEqual(COLONY_PLANETS.map(p => p.id).sort());
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-destinations-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
