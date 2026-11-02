import { test, expect } from '@playwright/test';
import { colonyFixture } from './colony-motion-helper.js';

async function place(page, kind, x, y) {
  await page.locator(`#place-${kind}`).click();
  const point = await page.evaluate(async ({ x, y }) => {
    const { colonyWorldToScreen } = await import('/colony-view.js');
    const canvas = document.getElementById('colony-canvas');
    return colonyWorldToScreen({ x: x + .5, y: y + .5 }, window.colonyFrames.at(-1).camera, canvas.clientWidth, canvas.clientHeight);
  }, { x, y });
  await page.mouse.move(point.x, point.y);
  await expect(page.locator('#placement-reason')).toContainText('a gift from the ship');
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#inspector-title')).toHaveText('Camp');
  await expect(page.locator(`#place-${kind}`)).toBeVisible();
}
const latest = page => page.evaluate(() => window.colonyFrames.at(-1));

test('camp placement, atmosphere and cinema stay shared through a host reconnect', async ({ browser }, info) => {
  test.setTimeout(60000);
  const f = await colonyFixture(browser, { viewport: { width: 1440, height: 960 } });
  const movieRequests = []; f.page.on('request', req => { if (req.url().endsWith('big-buck-bunny.mp4')) movieRequests.push(req.url()); });
  try {
    let page = f.page;
    await page.locator('#tool-camp').click();
    await place(page, 'campfire', 40, 32);
    await place(page, 'cinema', 40, 35);
    const built = await f.world(), fire = built.colony.decorations.items.find(d => d.kind === 'campfire');
    expect(built.colony.decorations.items).toHaveLength(2);
    expect(built.colony.materials).toBe(40);
    expect(movieRequests).toHaveLength(0);
    await page.locator('#camp-sky summary').click();
    await page.locator('#camp-lighting').selectOption('night');
    await expect(page.locator('#camp-weather')).toBeEnabled();
    await page.locator('#camp-weather').selectOption('rain');
    await expect.poll(async () => (await latest(page)).environment.weather).toBe('rain');
    await expect.poll(async () => (await latest(page)).environment.lightingPreset).toBe('night');
    await page.locator(`#toggle-${fire.id}`).click();
    await expect(page.locator(`#toggle-${fire.id}`)).toHaveText('Light');
    await page.locator(`#toggle-${fire.id}`).click();
    await expect(page.locator(`#toggle-${fire.id}`)).toHaveText('Extinguish');
    await page.locator('#cinema-play').click();
    await expect(page.locator('#cinema-play')).toHaveText('Pause film');
    await expect.poll(async () => (await latest(page)).movie?.time, { timeout: 12000 }).toBeGreaterThan(0.4);
    expect(movieRequests.length).toBeGreaterThan(0);
    expect((await latest(page)).movie.muted).toBe(true);
    await page.locator('#cinema-sound').click();
    await expect(page.locator('#cinema-sound')).toHaveText('Mute');

    const invitation = await f.post(f.owner, '/api/campaigns/invite', { id: f.campaign.id });
    const friend = await f.account('Clover');
    await f.post(friend, '/api/campaigns/join', { code: invitation.code });
    const peer = await f.open(friend);
    await peer.locator('#tool-camp').click();
    await expect(peer.locator('#cinema-play')).toHaveText('Pause film');
    await peer.locator('#camp-sky summary').click();
    await expect(peer.locator('#camp-lighting')).toBeDisabled();
    await expect(peer.locator('#camp-lighting')).toHaveValue('night');
    await expect(peer.locator('#camp-weather')).toHaveValue('rain');
    const screen = (await f.world()).colony.decorations.items.find(d => d.kind === 'cinema');
    await peer.locator(`#find-${screen.id}`).click();
    await expect.poll(async () => (await latest(peer)).movie?.time, { timeout: 12000 }).toBeGreaterThan(1);
    expect((await latest(peer)).movie.muted).toBe(true);
    const clocks = [(await latest(page)).movie.time, (await latest(peer)).movie.time];
    expect(Math.abs(clocks[0] - clocks[1])).toBeLessThan(1.5);
    await peer.locator('#cinema-play').click();
    await expect(page.locator('#cinema-play')).toHaveText('Play film');
    // Seeking to the shared pause position can briefly clear the decoded frame.
    await expect.poll(async () => (await latest(page)).movie?.paused).toBe(true);
    await expect.poll(async () => (await latest(peer)).movie?.paused).toBe(true);
    await page.locator('#cinema-play').click();
    await expect(peer.locator('#cinema-play')).toHaveText('Pause film');
    await page.locator('#inspector-close').click();
    await page.screenshot({ path: info.outputPath('colony-camp-night-rain.png') });
    await page.close();
    await expect(peer.locator('#colony-connection')).toHaveText('Waiting for your host');
    const frozen = await f.world(friend);
    await peer.waitForTimeout(650); // Observe that the authoritative clock stays frozen.
    expect((await f.world(friend)).colony.time).toBe(frozen.colony.time);
    await expect.poll(async () => (await latest(peer)).movie?.paused).toBe(true);
    page = await f.open(f.owner);
    await expect(peer.locator('#colony-connection')).toHaveText('Together, growing');
    await page.locator('#tool-camp').click();
    await expect(page.locator('#cinema-play')).toHaveText('Pause film');
    expect((await f.world()).colony.environment).toMatchObject({ lighting: 'night', weather: 'rain' });
    expect((await f.world()).colony.decorations.items).toHaveLength(2);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('phone camp controls fit and reduced effects keep the shared atmosphere', async ({ browser }, info) => {
  const f = await colonyFixture(browser, { reduced: true, viewport: { width: 390, height: 844 } });
  try {
    const route = `/api/campaign-world/${f.campaign.id}/colony`;
    for (const data of [{ action: 'build-campfire', x: 40, y: 32 }, { action: 'build-cinema', x: 40, y: 35 }, { action: 'set-environment', lighting: 'sunset', weather: 'rain' }]) {
      await f.post(f.owner, route, { ...data, requestId: crypto.randomUUID() });
    }
    const { page } = f;
    await page.locator('#tool-camp').click();
    await expect(page.locator('#cinema-play')).toBeVisible();
    await page.locator('#camp-sky summary').click();
    await expect(page.locator('#camp-lighting')).toHaveValue('sunset');
    await expect(page.locator('#camp-weather')).toHaveValue('rain');
    await page.locator('#camp-weather').selectOption('clear');
    await expect.poll(async () => (await latest(page)).environment.weather).toBe('clear');
    await expect(page.locator('#camp-weather')).toBeEnabled();
    await page.locator('#camp-weather').selectOption('rain');
    await expect.poll(async () => (await latest(page)).environment.weather).toBe('rain');
    const measured = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      controls: [...document.querySelectorAll('.garden-toolbar button')].map(n => { const r = n.getBoundingClientRect(); return { x: r.x, right: r.right }; }) }));
    expect(measured.scroll).toBeLessThanOrEqual(measured.width);
    expect(measured.controls).toHaveLength(5);
    for (const r of measured.controls) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(measured.width); }
    expect((await latest(page)).reduced).toBe(true);
    expect((await latest(page)).environment).toMatchObject({ lightingPreset: 'sunset', weather: 'rain' });
    await page.locator('#inspector').evaluate(n => n.scrollTop = 0);
    await page.screenshot({ path: info.outputPath('colony-camp-phone-controls.png') });
    const screen = (await f.world()).colony.decorations.items.find(d => d.kind === 'cinema');
    await page.locator(`#find-${screen.id}`).click();
    await page.locator('#inspector-close').click();
    await page.screenshot({ path: info.outputPath('colony-camp-phone-sunset.png') });
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
