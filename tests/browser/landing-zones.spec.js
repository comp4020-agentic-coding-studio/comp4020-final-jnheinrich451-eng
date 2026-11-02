import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

for (const mobile of [false, true]) test(`four starting areas preview before shared saved deployment / ${mobile ? 'Vesper phone' : 'Caldera desktop'}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-landing-zones-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }), contexts = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const guest = await browser.newContext(); contexts.push(owner, guest);
    const post = async (client, route, data) => {
      const response = await client.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.ok(), await response.text()).toBe(true); return response.json();
    };
    const credentials = { name: 'Landing planner', kind: 'demo', email: 'landing@frontier.test', password: 'isolated landing zones 123!' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Four footholds', template: mobile ? 'vesper-v1' : 'caldera-v1' });
    await post(owner, '/api/campaigns/enter', { id });
    const read = async (client = owner) => (await client.request.get(base + `/api/campaign-world/${id}/world`)).json();
    const page = await owner.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    const initial = await read(), zones = initial.world.landingZones, chosen = zones[mobile ? 3 : 2];
    expect(zones).toHaveLength(4); expect(initial.cores).toHaveLength(0);
    await expect(page.locator('#landing-zone-row')).toBeVisible();
    await expect(page.locator('#landing-zone option')).toHaveCount(5);
    await page.locator('#landing-zone').selectOption(chosen.id);
    await expect(page.locator('#tile-x')).toHaveValue(String(chosen.x));
    await expect(page.locator('#tile-y')).toHaveValue(String(chosen.y));
    await expect(page.locator('#place-building')).toBeEnabled();
    expect((await read()).cores).toHaveLength(0);
    expect((await read()).me).toMatchObject({ x: initial.me.x, y: initial.me.y, body: 'orbital' });
    await page.screenshot({ path: info.outputPath('landing-area-preview.png') });
    // Browsing the globe also changes only the selected map location, not a body.
    await page.locator('#hud-menu-button').click().then(()=>page.locator('#planet-open').click());
    await expect(page.locator('#planet-regions optgroup[label="Starting areas"] option')).toHaveCount(4);
    await expect(page.locator('#planet-landing-legend')).toBeVisible();
    await page.locator('#planet-regions').selectOption('landing:' + zones[1].id);
    await page.locator('#planet-visit').click();
    await expect(page.locator('#tile-x')).toHaveValue(String(zones[1].x));
    expect((await read()).cores).toHaveLength(0);
    await page.locator('#landing-zone').selectOption(chosen.id);
    await page.locator('#place-building').click();
    await expect.poll(async () => (await read()).cores.length).toBe(1);
    expect((await read()).cores[0]).toMatchObject({ owner: initial.me.id, x: chosen.x, y: chosen.y });
    await expect.poll(async () => (await read()).me.deploying, { timeout: 10000 }).toBe(false);
    await expect(page.locator('#landing-zone-row')).toBeHidden();
    // The recommendations are shared choices rather than exclusive player slots.
    const invitation = await post(owner, '/api/campaigns/invite', { id });
    const admission = await post(guest, '/api/campaigns/join', { code: invitation.code });
    const peer = await guest.newPage(); peer.on('pageerror', error => errors.push(error.message));
    await peer.goto(base + admission.next); await expect(peer.locator('#connection')).toContainText('live');
    const second = zones[0];
    await peer.locator('#landing-zone').selectOption(second.id);
    expect((await read()).cores).toHaveLength(1);
    await peer.locator('#place-building').click();
    await expect.poll(async () => (await read()).cores.length).toBe(2);
    expect((await read()).cores.map(core => [core.x, core.y])).toEqual(expect.arrayContaining([[chosen.x, chosen.y], [second.x, second.y]]));
    await page.reload(); await expect(page.locator('#connection')).toContainText('live');
    expect((await read()).world.landingZones).toEqual(zones);
    expect((await read()).cores).toHaveLength(2);
    await page.locator('#hud-menu-button').click().then(()=>page.locator('#planet-open').click());
    await page.locator('#planet-regions').selectOption('landing:' + chosen.id);
    await page.screenshot({ path: info.outputPath('landing-areas-globe.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(context => context.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-landing-zones-')) throw Error('Unexpected fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
