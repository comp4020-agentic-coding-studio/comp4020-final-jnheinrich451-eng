import { test, expect } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

// A host and a guest on isolated accounts: the join arrival and the room's goodbye.
async function fixture(browser, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-room-arrival-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }), contexts = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const post = async (client, route, data = {}) => {
      const response = await client.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.status(), await response.text()).toBeLessThan(300); return response.json();
    };
    const account = async name => {
      const client = await browser.newContext(); contexts.push(client);
      const credentials = { name, kind: 'demo', email: name.toLowerCase() + '@frontier.test', password: 'isolated room arrival 123!' };
      await post(client, '/api/auth/register', credentials);
      const inbox = await (await client.request.get(base + '/api/auth/inbox')).json();
      await post(client, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
      await post(client, '/api/auth/login', credentials);
      return client;
    };
    await run({ base, post, account });
  } finally {
    await Promise.all(contexts.map(client => client.close()));
    await app.close(); await rm(dir, { recursive: true, force: true });
  }
}
async function hostOn(env, template) {
  const owner = await env.account('Host'), guest = await env.account('Friend');
  const { id } = await env.post(owner, '/api/campaigns/create', { name: 'Shared front', template });
  await env.post(owner, '/api/campaigns/enter', { id });
  const host = await owner.newPage(); await host.goto(env.base + '/?campaign=' + id);
  await expect(host.locator('#connection')).toContainText('live');
  return { owner, guest, host, id, code: (await env.post(owner, '/api/campaigns/invite', { id })).code };
}
async function joinByCode(page, base, code) {
  await page.goto(base + '/campaigns/#view=join');
  await expect(page.locator('#join-heading')).toBeVisible();
  await page.locator('#invitation-code').fill(code);
  await page.locator('#join-submit').click();
}

test('a join warps to the host\'s planet, drops the pod and lands in the room', async ({ browser }) => {
  test.setTimeout(45000);
  await fixture(browser, async env => {
    const { guest, code, id } = await hostOn(env, 'vesper-v1'), page = await guest.newPage();
    await joinByCode(page, env.base, code);
    const body = page.locator('body');
    await expect(body).toHaveAttribute('data-entry-view', 'arrival');
    await expect(body).toHaveAttribute('data-entry-planet', 'vesper-v1');
    for (const phase of ['line', 'expand']) await expect(body).toHaveAttribute('data-entry-warp', phase);
    for (const phase of ['zoom', 'release', 'dive']) await expect(body).toHaveAttribute('data-entry-drop', phase, { timeout: 8000 });
    await page.waitForURL(url => url.search.includes(id), { timeout: 12000 });
    await expect(page.locator('#connection')).toContainText('live');
  });
});

test('any input skips the join arrival, and paused animation never plays it', async ({ browser }) => {
  test.setTimeout(45000);
  await fixture(browser, async env => {
    const { guest, code, id } = await hostOn(env, 'caldera-v1'), page = await guest.newPage();
    await joinByCode(page, env.base, code);
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'arrival');
    await page.keyboard.press('Space');
    await page.waitForURL(url => url.search.includes(id), { timeout: 4000 });
    await expect(page.locator('#connection')).toContainText('live');
  });
  await fixture(browser, async env => {
    const { guest, code, id } = await hostOn(env, 'caldera-v1'), page = await guest.newPage();
    await page.addInitScript(() => sessionStorage.setItem('frontier-entry-paused', '1'));
    await joinByCode(page, env.base, code);
    await page.waitForURL(url => url.search.includes(id), { timeout: 4000 });
    await expect(page.locator('#connection')).toContainText('live');
  });
});

test('the host leaving tells the guest why, and the lobby keeps the reason', async ({ browser }) => {
  test.setTimeout(45000);
  await fixture(browser, async env => {
    const { guest, host, code, id } = await hostOn(env, 'caldera-v1');
    await env.post(guest, '/api/campaigns/join', { code });
    const page = await guest.newPage(); await page.goto(env.base + '/?campaign=' + id);
    await expect(page.locator('#connection')).toContainText('live');
    await host.locator('#hud-menu-button').click().then(() => host.locator('#room-button').click());
    await host.locator('#room-leave').click();
    await expect(host.locator('#room-ended')).not.toBeVisible();
    await host.waitForURL(url => url.pathname === '/campaigns/');
    await expect(page.locator('#room-ended')).toBeVisible();
    await expect(page.locator('#room-ended-reason')).toHaveText('The host closed this room. Progress is saved.');
    await page.locator('#room-ended-return').click();
    await page.waitForURL(url => url.pathname === '/campaigns/');
    await expect(page.locator('#message')).toHaveText('The host closed this room. Progress is saved.');
    await expect(page.locator('#message')).toHaveClass(/error/);
  });
});

// Leaving passes through black, as the colony does (author, 9 November 2026): the host's
// view zooms out while the battlefield fades, and a guest's battlefield fades to black
// behind the dialog that names the reason, which stays.
test('leaving zooms the battlefield out into black, and a closed room fades behind its reason', async ({ browser }) => {
  test.setTimeout(45000);
  await fixture(browser, async env => {
    const evidence = path.join(process.cwd(), 'docs/testing/evidence/2026-11-09');
    await mkdir(evidence, { recursive: true });
    const { guest, host, code, id } = await hostOn(env, 'caldera-v1');
    await host.setViewportSize({ width: 1920, height: 1080 });
    await env.post(guest, '/api/campaigns/join', { code });
    const page = await guest.newPage(); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(env.base + '/?campaign=' + id);
    await expect(page.locator('#connection')).toContainText('live');
    const look = p => p.evaluate(() => { const layer = document.getElementById('departure'); return { hidden: layer.hidden, opacity: Number(getComputedStyle(layer).opacity), zoom: parseInt(document.getElementById('zoom-label').textContent, 10) }; });
    // A page behind another window draws no frames, so each player is brought forward to be watched.
    // The host is still in orbit at survey scale; zoom in so the change reads in whole percent.
    await host.bringToFront();
    await host.evaluate(() => { for (let i = 0; i < 15; i++) document.getElementById('zoom-in').click(); });
    const before = await look(host);
    expect(before.hidden).toBe(true);
    await host.locator('#hud-menu-button').click().then(() => host.locator('#room-button').click());
    // Every frame the page draws while leaving is recorded where the next page can read it,
    // so a slow frame cannot hide the fade between two polls.
    await host.evaluate(() => {
      const frames = [];
      const tick = now => {
        const layer = document.getElementById('departure');
        if (!layer.hidden) { frames.push([Math.round(now), Number(getComputedStyle(layer).opacity), parseInt(document.getElementById('zoom-label').textContent, 10)]); sessionStorage.setItem('departure-frames', JSON.stringify(frames)); }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      document.getElementById('departure').addEventListener('transitionend', () => sessionStorage.setItem('departure-black', '1'));
    });
    await host.locator('#room-leave').click();
    await host.waitForTimeout(500).catch(() => {});
    await host.screenshot({ path: path.join(evidence, 'war-zone-leave-desktop.png') }).catch(() => {});
    await host.waitForURL(url => url.pathname === '/campaigns/');
    const frames = JSON.parse(await host.evaluate(() => sessionStorage.getItem('departure-frames')) || '[]');
    expect(frames.length).toBeGreaterThan(2);
    expect(frames.some(([, opacity]) => opacity > .05 && opacity < .95)).toBe(true);
    expect(frames.at(-1)[1]).toBeGreaterThan(frames[0][1]);
    // The lobby opened only once the screen was fully black.
    expect(await host.evaluate(() => sessionStorage.getItem('departure-black'))).toBe('1');
    expect(Math.min(...frames.map(([, , zoom]) => zoom))).toBeLessThan(before.zoom * .9);
    expect(await host.evaluate(() => sessionStorage.getItem('frontier-room-ended'))).toBeNull();
    // The guest's dialog appears at once; the battlefield behind it fades to black.
    await page.bringToFront();
    await expect(page.locator('#room-ended')).toBeVisible();
    await expect(page.locator('#room-ended-reason')).toHaveText('The host closed this room. Progress is saved.');
    await expect.poll(async () => (await look(page)).opacity, { timeout: 5000 }).toBeGreaterThan(.95);
    await page.screenshot({ path: path.join(evidence, 'war-zone-room-closed-phone.png') });
    await page.locator('#room-ended-return').click();
    await page.waitForURL(url => url.pathname === '/campaigns/');
    await expect(page.locator('#message')).toHaveText('The host closed this room. Progress is saved.');
  });
});
