import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

// Two independent browser identities exercise the real room, invitation and SSE
// paths. This fixture never reads developer saves or contacts a mail provider.
test('two gardeners share work, stop on focus loss, and safely resume after host reconnect', async ({ browser }, info) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-coop-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }), contexts = [], errors = [], propagation = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const post = async (context, route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const result = await response.json(); expect(response.ok(), JSON.stringify(result)).toBe(true); return result;
    };
    const account = async (name, email) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
      contexts.push(context);
      const credentials = { name, email, password: 'a shared garden test password 123!', kind: 'demo' };
      await post(context, '/api/auth/register', credentials);
      const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
      await post(context, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
      await post(context, '/api/auth/login', credentials);
      return context;
    };
    const open = async (context, next) => {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + next);
      await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
      await expect(page.locator('#colony-loading')).toBeHidden();
      return page;
    };
    const owner = await account('Sunny', 'sunny@frontier.test'), friend = await account('Clover', 'clover@frontier.test');
    const campaign = await post(owner, '/api/campaigns/create', { name: 'Together in Meadowlight', mode: 'colonization', template: 'caldera-v1' });
    const entered = await post(owner, '/api/campaigns/enter', { id: campaign.id });
    expect(entered.next).toBe('/colony/?campaign=' + campaign.id);
    let ownerPage = await open(owner, entered.next);
    await ownerPage.locator('#room-open').click();
    await ownerPage.locator('#colony-invite').click();
    await expect(ownerPage.locator('#invite-code')).not.toHaveValue('');
    const joined = await post(friend, '/api/campaigns/join', { code: await ownerPage.locator('#invite-code').inputValue() });
    expect(joined.next).toBe(entered.next);
    const friendPage = await open(friend, joined.next);
    await expect(ownerPage.locator('#crew-count')).toHaveText('2');
    await expect(friendPage.locator('#crew-count')).toHaveText('2');
    await ownerPage.locator('#room-close').click();
    // Reopen the welcome panel by reconnecting before any bed exists. The
    // ordinary gift button makes the first placement accessible without aim.
    await ownerPage.reload();
    await expect(ownerPage.locator('#place-bed-gift')).toBeEnabled();
    await friendPage.locator('#tool-inspect').click();
    let began = performance.now();
    await ownerPage.locator('#place-bed-gift').click();
    await expect(friendPage.locator('[data-select-bed]')).toHaveCount(1, { timeout: 1000 });
    propagation.push({ action: 'place-bed', milliseconds: Math.round(performance.now() - began) });
    const bedId = await friendPage.locator('[data-select-bed]').getAttribute('data-select-bed');
    await friendPage.locator('[data-select-bed]').click();
    began = performance.now();
    await friendPage.locator('[data-plant="sundrop"]').click();
    await expect(ownerPage.locator('#inspector-title')).toHaveText('Sundrop', { timeout: 1000 });
    propagation.push({ action: 'plant', milliseconds: Math.round(performance.now() - began) });
    began = performance.now();
    await ownerPage.locator('#water-bed').click();
    await expect(friendPage.locator('.water-status')).toContainText('Watered', { timeout: 1000 });
    propagation.push({ action: 'water', milliseconds: Math.round(performance.now() - began) });
    for (const measurement of propagation) expect(measurement.milliseconds, measurement.action + ' reaches the peer UI within one second').toBeLessThan(1000);
    const growth = page => page.getByRole('progressbar', { name: 'Crop growth' });
    await expect.poll(async () => Number(await growth(friendPage).getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    const ownerProgress = Number(await growth(ownerPage).getAttribute('aria-valuenow'));
    const friendProgress = Number(await growth(friendPage).getAttribute('aria-valuenow'));
    expect(Math.abs(ownerProgress - friendProgress)).toBeLessThanOrEqual(1);
    const readWorld = async context => {
      const response = await context.request.get(base + '/api/campaign-world/' + campaign.id + '/world');
      expect(response.ok()).toBe(true); return response.json();
    };
    const shared = await readWorld(friend);
    expect(shared.mode).toBe('colonization');
    expect(shared.colony.beds).toHaveLength(1);
    expect(shared.colony.beds[0]).toMatchObject({ id: bedId, crop: 'sundrop' });
    expect(shared).not.toHaveProperty('enemies');
    expect(shared).not.toHaveProperty('combat');

    // The browser's blur event must release a held driving key. Headless
    // Chromium keeps separate contexts focused despite bringToFront, so emit
    // that event explicitly; do not release the key until after the assertion.
    await ownerPage.bringToFront();
    await ownerPage.locator('#inspector-close').click();
    await ownerPage.locator('#colony-canvas').focus();
    const origin = (await readWorld(owner)).me;
    await ownerPage.keyboard.down('d');
    await expect.poll(async () => (await readWorld(owner)).me.x - origin.x).toBeGreaterThan(0.3);
    await friendPage.bringToFront();
    await ownerPage.evaluate(() => window.dispatchEvent(new Event('blur')));
    const lostFocusAt = (await readWorld(owner)).colony.time;
    await expect.poll(async () => (await readWorld(owner)).colony.time - lostFocusAt).toBeGreaterThan(0.6);
    const stopped = await readWorld(owner);
    await expect.poll(async () => (await readWorld(owner)).colony.time - stopped.colony.time).toBeGreaterThan(0.7);
    expect(Math.hypot((await readWorld(owner)).me.x - stopped.me.x, (await readWorld(owner)).me.y - stopped.me.y)).toBeLessThan(0.03);
    await ownerPage.keyboard.up('d');

    // A closed host tab pauses the actual simulation, including growth, while
    // the remaining browser explains what happened and disables mutations.
    await ownerPage.close();
    await expect(friendPage.locator('#colony-connection')).toHaveText('Waiting for your host');
    await expect(friendPage.locator('#water-bed')).toBeDisabled();
    await friendPage.locator('#room-open').click();
    await expect(friendPage.locator('#room-status')).toContainText('Owner reconnecting');
    const frozen = await readWorld(friend);
    expect(frozen.room.paused).toBe(true);
    // An observation interval is intentional here: no event should advance
    // either simulation time or the plant during the host's absence.
    await friendPage.waitForTimeout(1100);
    const stillFrozen = await readWorld(friend);
    expect(stillFrozen.colony.time).toBe(frozen.colony.time);
    expect(stillFrozen.colony.beds[0].growth).toBe(frozen.colony.beds[0].growth);
    ownerPage = await open(owner, entered.next);
    await expect(friendPage.locator('#colony-connection')).toHaveText('Together, growing');
    await expect.poll(async () => (await readWorld(friend)).colony.beds[0].growth).toBeGreaterThan(frozen.colony.beds[0].growth);
    await friendPage.locator('#room-close').click();
    await friendPage.locator('#tool-inspect').click();
    await expect(friendPage.locator(`[data-select-bed="${bedId}"]`)).toHaveCount(1);
    await friendPage.locator(`[data-select-bed="${bedId}"]`).click();
    await expect(friendPage.locator('#water-bed')).toBeEnabled();
    await expect(friendPage.locator('#inspector-title')).toHaveText('Sundrop');
    expect(errors).toEqual([]);
    const report = JSON.stringify({ milliseconds: propagation, browserErrors: errors, hostReconnect: 'passed', focusLossStop: 'passed', focusLossMethod: 'Synthetic browser blur event; headless Chromium retains focus across contexts' }, null, 2);
    await writeFile(info.outputPath('peer-ui-propagation.json'), report + '\n');
    await info.attach('peer-ui-propagation', { body: report, contentType: 'application/json' });
    await friendPage.screenshot({ path: info.outputPath('shared-peaceful-garden.png'), fullPage: true });
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-coop-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
