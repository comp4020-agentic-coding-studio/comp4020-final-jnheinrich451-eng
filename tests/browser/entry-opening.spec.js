import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

// The opening loop skips itself in automated browsers (navigator.webdriver), so
// every other entry spec starts on its page. These contexts report a person's
// browser instead, which is the only way the title screen appears in a test.
const asPerson = () => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); };

async function fixture(browser, run) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-opening-'));
  const app = createApp({ dataDir, logSink: () => {} }), contexts = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const context = async (options = {}, person = true) => {
      const value = await browser.newContext(options); contexts.push(value);
      if (person) await value.addInitScript(asPerson);
      return value;
    };
    const post = async (client, route, data) => {
      const response = await client.request.post(base + route, { data, headers: { Origin: base } });
      const result = await response.json(); expect(response.ok(), JSON.stringify(result)).toBe(true); return result;
    };
    const account = async client => {
      const credentials = { name: 'Opening Pilot', email: 'opening@frontier.test', password: 'an isolated opening password 123!', kind: 'demo' };
      await post(client, '/api/auth/register', credentials);
      const inbox = await (await client.request.get(base + '/api/auth/inbox')).json();
      await post(client, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
      await post(client, '/api/auth/login', credentials);
    };
    await run({ base, context, account });
  } finally {
    await Promise.all(contexts.map(value => value.close()));
    await app.close(); await rm(dataDir, { recursive: true, force: true });
  }
}

const playing = async page => {
  await expect(page.locator('.opening')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-opening', 'playing');
  await page.waitForFunction(() => { const v = document.querySelector('video.opening-picture'); return v && !v.paused && v.currentTime > 0.4; }, null, { timeout: 10000 });
};
const settled = async page => {
  await expect(page.locator('.opening')).toHaveCount(0);
  await expect.poll(() => page.locator('html').getAttribute('data-opening'), { timeout: 3000 }).toBeNull();
};

test('a guest sees the loop once, and any key blacks out into the login page', async ({ browser }, info) => {
  await fixture(browser, async ({ base, context }) => {
    const client = await context({ viewport: { width: 1920, height: 1080 } }), page = await client.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/');
    await playing(page);
    await expect(page.locator('.opening-keys')).toHaveText('Press any key to skip');
    await expect(page.locator('.opening-keys')).toBeVisible();
    await expect(page.locator('.opening-touch')).toBeHidden();
    // The loop waits for the player: the lobby has already decided to send a guest to login.
    await page.waitForTimeout(1200);
    expect(new URL(page.url()).pathname).toBe('/');
    await page.screenshot({ path: info.outputPath('opening-desktop.png') });
    // A lone modifier or a browser shortcut is not a skip.
    await page.keyboard.press('Shift');
    await page.keyboard.press('Control+KeyL');
    await page.waitForTimeout(300);
    await expect(page.locator('.opening')).not.toHaveClass(/opening-leaving/);

    await page.keyboard.press('Space');
    await expect(page.locator('.opening')).toHaveClass(/opening-leaving/);
    await page.waitForURL(url => url.pathname === '/login/');
    await expect(page.locator('#title')).toHaveText('Welcome back.');
    await settled(page);
    await expect(page.locator('#login-form')).toBeVisible();

    // Once per tab session: reload and a fresh visit to the root go straight through.
    await page.reload(); await expect(page.locator('#title')).toBeVisible(); await settled(page);
    await page.goto(base + '/'); await page.waitForURL(url => url.pathname === '/login/'); await settled(page);
    expect(errors).toEqual([]);
  });
});

test('a signed-in player skips into the lobby, and a fresh login page hands over to it', async ({ browser }) => {
  await fixture(browser, async ({ base, context, account }) => {
    const client = await context({ viewport: { width: 1280, height: 900 } });
    await account(client);
    const page = await client.newPage();
    await page.goto(base + '/');
    await playing(page);
    await page.mouse.click(640, 450);
    await settled(page);
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('#menu-heading')).toBeVisible();
    // The click that skipped never reached the lobby underneath.
    await expect(page.locator('#menu-view')).toBeVisible();

    // A new tab is a new session: a signed-in visit to /login/ opens on the loop, then moves to the lobby.
    const tab = await client.newPage();
    await tab.goto(base + '/login/');
    await playing(tab);
    await tab.keyboard.press('Enter');
    await tab.waitForURL(url => url.pathname === '/campaigns/');
    await settled(tab);
    await expect(tab.locator('#menu-heading')).toBeVisible();
  });
});

test('phones read Tap to skip, and a tap continues', async ({ browser }, info) => {
  await fixture(browser, async ({ base, context }) => {
    const client = await context({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), page = await client.newPage();
    await page.goto(base + '/');
    await playing(page);
    await expect(page.locator('.opening-touch')).toHaveText('Tap to skip');
    await expect(page.locator('.opening-touch')).toBeVisible();
    await expect(page.locator('.opening-keys')).toBeHidden();
    const box = await page.locator('.opening-skip').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath('opening-phone.png') });
    await page.tap('.opening');
    await page.waitForURL(url => url.pathname === '/login/');
    await settled(page);
  });
});

test('reduced motion shows the still frame and keeps the gate', async ({ browser }, info) => {
  await fixture(browser, async ({ base, context }) => {
    const client = await context({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' }), page = await client.newPage();
    await page.goto(base + '/');
    await expect(page.locator('.opening')).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.locator('img.opening-picture')).toBeVisible();
    await page.waitForFunction(() => document.querySelector('img.opening-picture').naturalWidth === 1672);
    expect(await page.locator('.opening-keys').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
    expect(await page.locator('.opening-keys').evaluate(element => getComputedStyle(element, '::after').display)).toBe('none');
    await page.screenshot({ path: info.outputPath('opening-reduced.png') });
    await page.keyboard.press('KeyA');
    await page.waitForURL(url => url.pathname === '/login/');
    await settled(page);
  });
});

test('automated browsers go straight to the page', async ({ browser }) => {
  await fixture(browser, async ({ base, context }) => {
    const client = await context({}, false), page = await client.newPage();
    await page.goto(base + '/');
    await page.waitForURL(url => url.pathname === '/login/');
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('.opening')).toHaveCount(0);
    expect(await page.locator('html').getAttribute('data-opening')).toBeNull();
  });
});
