import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`Demo registration, private inbox, login and logout on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-account-ui-'));
  const app = createApp({ dataDir }), contexts = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile }); contexts.push(context);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/?legacy=1');
    await expect(page.locator('#connection')).toContainText('live');
    const id = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me.id);
    await page.locator('#account-link').click();
    await expect(page).toHaveURL(/\/login\//);
    await page.locator('#register-link').click(); await page.locator('#demo-mode').click();
    const form = page.locator('#register-form');
    await form.locator('[name=name]').fill('Orbit Pilot');
    await form.locator('[name=email]').fill('pilot@frontier.test');
    await form.locator('[name=password]').fill('a unique browser password 123!');
    await page.screenshot({ path: info.outputPath('registration.png') });
    await form.locator('button').click();
    await expect(page.locator('#next')).toBeVisible(); await page.locator('#next').click();
    await page.locator('#messages a').click(); await page.locator('#verify-form button').click();
    await expect(page.locator('#message')).toContainText('Demo account activated');
    await page.locator('#next').click();
    const login = page.locator('#login-form');
    await login.locator('[name=email]').fill('pilot@frontier.test');
    await login.locator('[name=password]').fill('a unique browser password 123!');
    await login.locator('button').first().click();
    await expect(page.locator('#identity')).toContainText('Demo account');
    expect(await page.evaluate(async () => (await (await fetch('/api/world')).json()).me.id)).toBe(id);
    await page.getByRole('link', { name: 'Account', exact: true }).click();
    await expect(page.locator('#identity')).toContainText('Demo (simulated verification)');
    await page.screenshot({ path: info.outputPath('account.png') });
    const stranger = await browser.newContext(); contexts.push(stranger);
    const other = await stranger.newPage(); await other.goto(base + '/demo-inbox/');
    await expect(other.locator('#message')).toContainText('Sign in with your Demo address');
    await page.locator('#logout').click(); await expect(page).toHaveURL(/\/login\//);
    await page.locator('#guest').click(); await expect(page.locator('#identity')).toContainText('Guest visitor');
    expect(await page.evaluate(async () => (await (await fetch('/api/world')).json()).me.id)).not.toBe(id);
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(c => c.close())); await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});
