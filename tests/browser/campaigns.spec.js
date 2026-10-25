import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../../server.js';

for (const mobile of [false, true]) test(`campaign create, invite, pause and saved return ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-room-browser-'));
  const app = createApp({ dataDir: dir }); const contexts = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${app.server.address().port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile }); contexts.push(owner);
    const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(guest);
    const post = (context, route, data) => context.request.post(base + route, { data, headers: { Origin: base } });
    const credentials = { name: 'Commander', email: 'commander@frontier.test', password: 'a unique browser password 123!', kind: 'demo' };
    expect((await post(owner, '/api/auth/register', credentials)).status()).toBe(200);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    expect((await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] })).status()).toBe(200);
    expect((await post(owner, '/api/auth/login', credentials)).status()).toBe(200);
    const page = await owner.newPage(), visitor = await guest.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message)); visitor.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: mobile ? 'reduce' : 'no-preference' });
    await page.goto(base); await expect(page.locator('#identity')).toContainText('Demo account');
    await expect(page.locator('#create-panel')).toBeHidden();
    await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', String(mobile));
    expect(await page.locator('.planet-surface').first().evaluate(el => getComputedStyle(el).animationPlayState)).toBe(mobile ? 'paused' : 'running');
    if (!mobile) { await page.locator('#motion').click(); await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true'); }
    await page.getByRole('button', { name: 'Select Caldera' }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Caldera selected' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#create-panel')).toBeVisible();
    await page.locator('#create input[name=name]').fill('Operation First Light'); await page.locator('#create button').click();
    await expect(page.locator('.campaign-card')).toContainText('Operation First Light');
    await page.screenshot({ path: info.outputPath('campaign-lobby.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Open / resume' }).click(); await expect(page.locator('#connection')).toContainText('live');
    const id = new URL(page.url()).searchParams.get('campaign');
    const state = () => owner.request.get(base + `/api/campaign-world/${id}/world`).then(r => r.json());
    expect((await state()).me.body).toBe('orbital');
    // DEMO opens the same live room menu, without navigating to the account/lobby.
    const battleURL = page.url();
    const accountPage = await owner.newPage();
    await accountPage.goto(base + '/account/');
    await expect(accountPage.locator('#return-battle')).toHaveAttribute('href', '/?campaign=' + id);
    await accountPage.close(); await page.bringToFront();
    await page.locator('#account-link').click();
    await expect(page.locator('#room-dialog')).toBeVisible();
    await expect(page.locator('#room-status')).toContainText('paused');
    await page.locator('#room-code').focus(); await page.keyboard.press('Escape');
    await expect(page.locator('#room-dialog')).toBeHidden();
    await expect.poll(async () => (await state()).room.paused).toBe(false);
    expect(page.url()).toBe(battleURL);
    await page.locator('#account-link').click();
    await page.locator('#room-resume').click();
    await expect(page.locator('#room-dialog')).toBeHidden();
    expect(page.url()).toBe(battleURL);

    await page.locator('#room-button').click(); await expect(page.locator('#room-dialog')).toBeVisible();
    await expect(page.locator('#room-status')).toContainText('paused');
    await page.locator('#room-invite').click(); await expect(page.locator('#room-code')).toHaveValue(/^[A-F0-9-]{27}$/); const code = await page.locator('#room-code').inputValue();
    await page.screenshot({ path: info.outputPath('campaign-room.png') });
    await visitor.goto(base + '/campaigns/'); await expect(visitor.locator('#create-panel')).toBeHidden();
    await visitor.locator('#join input').fill(code); await visitor.locator('#join button').click();
    await expect(visitor.locator('#connection')).toContainText('live');
    await expect(page.locator('#room-status')).toContainText('resumed');
    await page.locator('#room-resume').click();
    const core = await post(owner, `/api/campaign-world/${id}/cores`, { x: 24, y: 18 }); expect(core.status()).toBe(201);
    await expect.poll(async () => (await state()).me.deploying, { timeout: 12000 }).toBe(false);
    await page.locator('#world-canvas').focus(); await page.keyboard.down('w'); await page.waitForTimeout(350); await page.keyboard.up('w');
    await page.locator('#room-button').click(); await page.locator('#room-leave').click();
    await expect(page).toHaveURL(/\/campaigns\//); await expect(visitor).toHaveURL(/\/campaigns\//);
    await expect(page.locator('#create-panel')).toBeHidden();
    await page.getByRole('button', { name: 'Open / resume' }).click(); await expect(page.locator('#connection')).toContainText('live');
    expect((await state()).cores).toHaveLength(1); expect((await state()).me.body).toBe('robot');
    await page.screenshot({ path: info.outputPath('campaign-return.png') });
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(c => c.close())); await app.close(); await rm(dir, { recursive: true, force: true }); }
});
