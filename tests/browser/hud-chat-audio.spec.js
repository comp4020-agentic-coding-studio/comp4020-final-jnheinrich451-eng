import { test, expect } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

// Isolated saves only. The author's 9 November 2026 HUD notes: a chat bar that only says
// how to chat, music and effects switches beside the menu, the music's default level, and
// fades around the Esc room menu and its Account settings link.
const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-09');

async function inRoom(browser, viewport, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-hud-chat-audio-'));
  const app = createApp({ dataDir: dir, logSink: () => {} });
  const context = await browser.newContext({ viewport });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const post = async (route, data = {}) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.status(), await response.text()).toBeLessThan(300); return response.json();
    };
    const credentials = { name: 'Listener', kind: 'demo', email: 'listener@frontier.test', password: 'isolated hud chat audio 123!' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    const { id } = await post('/api/campaigns/create', { name: 'Quiet front', template: 'caldera-v1' });
    await post('/api/campaigns/enter', { id });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/?campaign=' + id);
    await expect(page.locator('#connection')).toContainText('live');
    await mkdir(evidence, { recursive: true });
    await run({ page, base, id, errors });
    expect(errors).toEqual([]);
  } finally {
    await context.close(); await app.close(); await rm(dir, { recursive: true, force: true });
  }
}

for (const phone of [false, true]) test(`the chat bar says only how to chat, and music and effects switch beside the menu / ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
  test.setTimeout(60000);
  await inRoom(browser, phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, async ({ page }) => {
    const tag = phone ? 'phone' : 'desktop';
    // In orbit a phone's landing-site sheet covers the lower screen; Esc puts it away.
    if (await page.locator('#site-panel').isVisible()) { await page.locator('#world-canvas').focus(); await page.keyboard.press('Escape'); await expect(page.locator('#site-panel')).toBeHidden(); }
    // One bar with a gold edge: the words and the Enter mark, no heading, buttons or Esc reminder.
    const prompt = page.locator('#chat-prompt');
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveText('Press Enter to chat');
    await expect(prompt.locator('svg')).toBeVisible();
    expect(await prompt.evaluate(element => getComputedStyle(element).boxShadow)).toContain('inset');
    await prompt.click();
    await expect(page.locator('#chat-input')).toBeFocused();
    await expect(prompt).toBeHidden();
    const form = page.locator('#chat-form');
    await expect(form).toBeVisible();
    await expect(form).not.toContainText('Esc');
    await expect(form).not.toContainText('Send');
    await expect(form.locator('button')).toHaveCount(1);
    await page.locator('#chat-input').fill('Keep this');
    await page.screenshot({ path: path.join(evidence, `chat-bar-open-${tag}.png`) });
    // A click outside closes chat and keeps the draft, as Esc does: phones have no Esc key.
    await page.mouse.click(phone ? 195 : 960, phone ? 420 : 540);
    await expect(form).toBeHidden();
    await expect(prompt).toBeVisible();
    await prompt.click();
    await expect(page.locator('#chat-input')).toHaveValue('Keep this');
    await page.keyboard.press('Escape');
    await expect(form).toBeHidden();

    // The switches sit with the menu: left of it on a desktop.
    const [music, sound, menu] = await Promise.all(['#music-quick', '#sound-quick', '#hud-menu-button'].map(selector => page.locator(selector).boundingBox()));
    const survey = await page.locator('.survey').boundingBox();
    // A phone puts them side by side under the minimap, clear of the mission bar and landing banners.
    if (phone) { expect(music.y).toBeGreaterThanOrEqual(survey.y + survey.height); expect(music.y).toBe(sound.y); expect(music.x + music.width).toBeLessThanOrEqual(sound.x + 1); expect(sound.x + sound.width).toBeLessThanOrEqual(survey.x + survey.width + 1); }
    else { expect(music.x + music.width).toBeLessThanOrEqual(sound.x + 1); expect(sound.x + sound.width).toBeLessThanOrEqual(menu.x + 1); expect(music.y).toBe(menu.y); }
    const objective = await page.locator('.objective').boundingBox();
    if (objective) expect(objective.x + objective.width).toBeLessThanOrEqual(Math.min(music.x, sound.x) + 1);
    if (phone) { const banner = await page.locator('#core-status').boundingBox(); if (banner) expect(banner.x + banner.width).toBeLessThanOrEqual(music.x); }
    await page.screenshot({ path: path.join(evidence, `hud-switches-${tag}.png`) });
    // Each switch drives the field guide's own control, and the choice is saved.
    await page.locator('#music-quick').click();
    await expect(page.locator('#music-quick')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#sound-quick').click();
    await expect(page.locator('#sound-quick')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(page.locator('#connection')).toContainText('live');
    await expect(page.locator('#music-quick')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sound-quick')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#music-quick').click();
    await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed', 'true');
    // Never saved a volume: the music starts at the author's 3%.
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('frontier-music'))).volume).toBe(.03);
    await expect(page.locator('#music-volume')).toHaveValue('3');
  });
});

test('the Esc room menu fades in and out, and Account settings fades through black both ways', async ({ browser }) => {
  test.setTimeout(60000);
  await inRoom(browser, { width: 1920, height: 1080 }, async ({ page, id }) => {
    // Every drawn frame is recorded, so a slow frame cannot hide a fade between two polls.
    const record = (selector, key) => page.evaluate(([selector, key]) => {
      const frames = []; window[key] = frames;
      const tick = () => { const element = document.querySelector(selector); if (element && getComputedStyle(element).display !== 'none') frames.push(Number(getComputedStyle(element).opacity)); sessionStorage.setItem(key, JSON.stringify(frames)); if (window[key] === frames) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, [selector, key]);
    const between = frames => frames.some(value => value > .05 && value < .95);
    // In orbit the first Esc may close the landing-site panel; the next opens the room menu.
    const openMenu = async () => { for (let i = 0; i < 3 && !(await page.locator('#room-dialog').isVisible()); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); } await expect(page.locator('#room-dialog')).toBeVisible(); };
    await page.locator('#world-canvas').focus();
    await record('#room-dialog', 'opening');
    await openMenu();
    await expect.poll(() => page.evaluate(() => window.opening.at(-1))).toBe(1);
    expect(between(await page.evaluate(() => window.opening))).toBe(true);
    await record('#room-dialog', 'closing');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => document.getElementById('room-dialog').open)).toBe(false);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('room-dialog')).display)).toBe('none');
    expect(between(await page.evaluate(() => window.closing))).toBe(true);

    // Account settings: the battlefield and the open menu fade to black, the account page fades in from it.
    await page.context().addInitScript(() => document.addEventListener('DOMContentLoaded', () => { window.arrival = document.documentElement.dataset.opening || null; }));
    await openMenu();
    await record('#departure', 'leaving');
    await page.locator('#room-account').click();
    await page.waitForURL('**/account/');
    const leaving = JSON.parse(await page.evaluate(() => sessionStorage.getItem('leaving')) || '[]');
    expect(between(leaving)).toBe(true);
    expect(await page.evaluate(() => window.arrival)).toBe('arrive');
    await page.screenshot({ path: path.join(evidence, 'account-arrival.png') });
    // Return to battlefield fades the account page into the game's own black cover.
    const back = page.locator('#return-battle');
    await expect(back).toHaveText('Return to battlefield');
    await back.click();
    expect(await page.evaluate(() => document.documentElement.dataset.opening)).toBe('leave');
    await page.waitForURL(url => url.search.includes(id));
    await expect(page.locator('#connection')).toContainText('live');
  });
});
