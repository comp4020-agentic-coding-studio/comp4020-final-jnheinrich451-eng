import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';

test('a/b/d/e/f: late join, rendered propagation, real tab close/return and room isolation', async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-multiplayer-lifecycle-'));
  const logs = [], app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
  const contexts = [], errors = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const context = async () => {
      const c = await browser.newContext({ viewport: { width: 1920, height: 1080 } }); contexts.push(c);
      await c.addInitScript(() => {
        const Native = window.EventSource;
        window.testSnapshots = [];
        window.EventSource = class extends Native {
          constructor(...args) {
            super(...args);
            this.addEventListener('message', event => {
              window.testSnapshots.push(JSON.parse(event.data));
              window.testSnapshots = window.testSnapshots.slice(-32);
            });
          }
        };
      });
      return c;
    };
    const post = async (c, route, data) => {
      const response = await c.request.post(base + route, { data, headers: { Origin: base } });
      const result = await response.json(); expect(response.status(), JSON.stringify(result)).toBeLessThan(300); return result;
    };
    const account = async (name) => {
      const c = await context(), credentials = { name, email: `${name}@frontier.test`, kind: 'demo', password: 'unique lifecycle password 123!' };
      await post(c, '/api/auth/register', credentials);
      const inbox = await (await c.request.get(base + '/api/auth/inbox')).json();
      await post(c, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
      await post(c, '/api/auth/login', credentials); return c;
    };
    const openPage = async (c, id) => {
      const page = await c.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live'); return page;
    };
    const owner = await account('LifecycleOwner'), guest = await context(), outsider = await account('SeparateOwner');
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Lifecycle room' });
    await post(owner, '/api/campaigns/enter', { id });
    const route = `/api/campaign-world/${id}`, state = async c => (await c.request.get(base + route + '/world')).json();
    const pilot = (await state(owner)).me.id;
    await post(owner, '/api/campaigns/leave', {});
    // A ready core and flat ground isolate lifecycle checks from deployment timing.
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('lifecycle-core', pilot, 10, 10, 99);
      db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(24.5, 18.5, pilot);
    } finally { db.close(); }
    await post(owner, '/api/campaigns/enter', { id });
    let hostPage = await openPage(owner, id);
    const first = (await post(owner, route + '/buildings', { x: 30, y: 22 })).building;

    // d: this participant did not exist when the construction was accepted.
    const { code } = await post(owner, '/api/campaigns/invite', { id });
    let peer = await guest.newPage(); peer.on('pageerror', e => errors.push(e.message));
    await peer.goto(base + '/campaigns/'); await peer.locator('#join input').fill(code); await peer.locator('#join button').click();
    await expect(peer.locator('#connection')).toContainText('live');
    const guestPilot = (await state(guest)).me.id;
    expect(guestPilot).not.toBe(pilot);
    await expect.poll(async () => (await state(owner)).room.players).toBe(2);
    await expect(peer.locator('#building-count')).toHaveText('2 FOUNDATIONS');
    await expect.poll(() => peer.evaluate(id => window.testSnapshots.some(s => s.buildings?.some(b => b.id === id)), first.id)).toBe(true);

    // f: another real room remains isolated while the first room changes.
    const otherId = (await post(outsider, '/api/campaigns/create', { name: 'Isolated room' })).id;
    await post(outsider, '/api/campaigns/enter', { id: otherId });
    const isolated = await openPage(outsider, otherId);
    await expect.poll(() => isolated.evaluate(id => window.testSnapshots.some(s => s.room?.id === id), otherId)).toBe(true);
    expect((await outsider.request.get(base + route + '/world')).status()).toBe(403);
    expect((await outsider.request.get(base + route + '/events')).status()).toBe(403);
    const denied = await outsider.request.post(base + route + '/buildings', { data: { x: 32, y: 22 }, headers: { Origin: base } });
    expect(denied.status()).toBe(403);
    // Each orbital sentry has a five-tile cross. Keep the second pod clear of
    // both the first reservation and its lasting centre; adjacent 31:22 overlaps.
    const started = performance.now();
    const second = (await post(owner, route + '/buildings', { x: 34, y: 22 })).building;
    // b: a peer's rendered HUD changes, as well as its received snapshot.
    await expect(peer.locator('#building-count')).toHaveText('3 FOUNDATIONS');
    await peer.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const propagationMs = Math.round(performance.now() - started);
    await expect.poll(() => peer.evaluate(id => window.testSnapshots.some(s => s.buildings?.some(b => b.id === id)), second.id)).toBe(true);
    await expect(isolated.locator('#building-count')).toHaveText('0 FOUNDATIONS');
    expect(await isolated.evaluate(ids => window.testSnapshots.some(s => s.buildings?.some(b => ids.includes(b.id))), [first.id, second.id])).toBe(false);

    // e: close the tab (no Leave API), keep the browser's cookies, reopen in grace.
    const beforeClose = logs.length;
    await peer.close();
    await expect.poll(() => logs.slice(beforeClose).some(e => e.event === 'participant.disconnected' && e.pilotId === guestPilot)).toBe(true);
    peer = await openPage(guest, id);
    expect((await state(guest)).me.id).toBe(guestPilot);
    await expect(peer.locator('#building-count')).toHaveText('3 FOUNDATIONS');
    expect(logs.slice(beforeClose).some(e => e.action === 'campaigns/leave')).toBe(false);
    await hostPage.close();
    await expect.poll(async () => (await state(guest)).room.state).toBe('reconnecting');
    const frozen = (await state(guest)).combat.time;
    await peer.waitForTimeout(250); expect((await state(guest)).combat.time).toBe(frozen);
    hostPage = await openPage(owner, id);
    await expect.poll(async () => (await state(guest)).room.state).toBe('open');
    expect((await state(owner)).me.id).toBe(pilot);
    expect((await state(guest)).buildings.filter(b => [first.id, second.id].includes(b.id))).toHaveLength(2);
    await peer.setViewportSize({ width: 390, height: 844 });
    expect(await peer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await peer.screenshot({ path: info.outputPath('late-join-return-phone.png') });
    await hostPage.screenshot({ path: info.outputPath('shared-room-desktop.png') });
    const evidence = JSON.stringify({ categories: ['a', 'b', 'd', 'e', 'f'], propagationMs, scope: 'one local process, two isolated rooms; not Fly capacity evidence' }, null, 2);
    await writeFile(info.outputPath('lifecycle.json'), evidence);
    await info.attach('local-lifecycle-evidence', { body: evidence, contentType: 'application/json' });
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(c => c.close())); await app.close(); await rm(dir, { recursive: true, force: true }); }
});
