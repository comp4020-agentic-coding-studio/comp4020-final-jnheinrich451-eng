import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';

test('two then four participants display shared construction and conquest promptly', async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-latency-'));
  const logs = [], app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
  const contexts = [], pages = [], samples = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const owner = await browser.newContext({ viewport: { width: 1920, height: 1080 } }); contexts.push(owner);
    const post = async (context, route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.status(), JSON.stringify(await response.json())).toBeLessThan(300); return response.json();
    };
    const credentials = { name: 'Timing pilot', email: 'timing@frontier.test', kind: 'demo', password: 'unique timing password 123!' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Latency rehearsal' });
    await post(owner, '/api/campaigns/enter', { id });
    const state = await (await owner.request.get(base + `/api/campaign-world/${id}/world`)).json(), site = state.combat.sites[0];
    await post(owner, '/api/campaigns/leave', {});
    // Isolated ready-vehicle fixture; all measured commands use the real HTTP,
    // authorization, persistence, SSE and rendering paths. Never modifies user saves.
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('timing-core', state.me.id, 10, 10, 99);
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      // Measure delivery/rendering of one objective, independent of later encounters.
      saved.enemies = [];
      // Named campaigns now replenish defenders through the encounter director,
      // independently of nextCall. Keep this delivery fixture free of combatants.
      if (saved.director) Object.assign(saved.director, { sleeping: [], nextPulse: 1e9, nextRaid: 1e9, lastEvent: null });
      for (const encounter of saved.sites) {
        encounter.guardsRemaining = 0; encounter.nextCall = 1e9; encounter.pending = null;
        if (encounter.id !== site.id) { encounter.state = 'conquered'; encounter.hp = 0; }
      }
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'timing-tank', owner: state.me.id, occupant: state.me.id, health: 180, hurt: 0,
        x: site.x - 4, y: site.y + 1.5, podX: 40, podY: 40, elapsed: 99, angle: Math.PI / 2, turret: Math.PI / 2, weapon: 'HE', secondary: 'APCR' };
      db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
    } finally { db.close(); }
    await post(owner, '/api/campaigns/enter', { id });
    const page = await owner.newPage(); pages.push(page);
    await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    await page.getByRole('button', { name: 'Locate alert station' }).click();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    async function addPeer() {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(context);
      const code = (await post(owner, '/api/campaigns/invite', { id })).code;
      const peer = await context.newPage(); pages.push(peer); peer.on('pageerror', e => errors.push(e.message));
      await peer.goto(base); await peer.locator('#join input').fill(code); await peer.locator('#join button').click();
      await expect(peer.locator('#connection')).toContainText('live');
      await post(context, `/api/campaign-world/${id}/cores`, { x: [24, 48, 64][pages.length - 2], y: 18 });
      await expect.poll(async () => (await (await context.request.get(base + `/api/campaign-world/${id}/world`)).json()).me.deploying, { timeout: 8000 }).toBe(false);
      await expect(peer.locator('#objective-health')).toBeVisible();
    }
    async function measure(action, invoke, selector, text) {
      for (const peer of pages) expect(await peer.evaluate(() => document.hidden)).toBe(false);
      for (const peer of pages.slice(1)) await expect(peer.locator(selector)).toBeVisible();
      const started = performance.now(); // One Node observer clock for every peer.
      const observed = pages.slice(1).map(async (peer, index) => {
        await peer.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text }, { polling: 'raf', timeout: 5000 });
        // The HUD is changed during snapshot application. Wait through the canvas
        // frame and a subsequent paint opportunity, not merely an HTTP/SSE receipt.
        await peer.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        samples.push({ players: pages.length, action, peer: index + 1, ms: Math.round(performance.now() - started) });
      });
      const [result] = await Promise.all([invoke(), ...observed]); return result;
    }
    await addPeer(); let hp = site.hp;
    for (const count of [2, 4]) {
      while (pages.length < count) await addPeer();
      // Joining/deploying a peer can outlive an idle HTTP keep-alive connection.
      const ready = await (await owner.request.get(base + `/api/campaign-world/${id}/world`, { maxRetries: 1 })).json();
      expect(ready.combat.enemies).toHaveLength(0);
      expect(ready.me.life).toBe('active');
      await post(owner, `/api/campaign-world/${id}/tanks/exit`, {});
      for (let i = 0; i < 5; i++) {
        const built = await measure('place', () => post(owner, `/api/campaign-world/${id}/buildings`, { x: 30, y: 22 }), '#building-count', `${count + 1} FOUNDATIONS`);
        await measure('remove', () => post(owner, `/api/campaign-world/${id}/dismantle`, { id: built.building.id }), '#building-count', `${count} FOUNDATIONS`);
      }
      await post(owner, `/api/campaign-world/${id}/tanks/board`, { id: 'timing-tank' });
      await page.getByRole('button', { name: 'Locate alert station' }).click();
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(800); hp = Math.max(0, hp - 75);
        const box = await page.locator('#world-canvas').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await expect.poll(async () => {
          const current = await (await owner.request.get(base + `/api/campaign-world/${id}/world`)).json();
          return Math.abs(current.me.turret - Math.PI / 2);
        }).toBeLessThan(.01);
        await measure('HE objective hit (includes flight)', () => post(owner, `/api/campaign-world/${id}/fire`, { x: site.x + 1.5, y: site.y + 1.5, weapon: 'HE' }), '#objective-health', hp ? `${hp} / ${site.maxHp} HP` : 'Permanent progress saved');
      }
    }
    const summaries = [2, 4].map(players => {
      const values = samples.filter(s => s.players === players).map(s => s.ms).sort((a, b) => a - b);
      return { players, samples: values.length, medianMs: values[Math.floor(values.length / 2)], p95Ms: values[Math.ceil(values.length * .95) - 1], maxMs: values.at(-1) };
    });
    const report = JSON.stringify({ environment: 'local loopback, headless Chrome, ready fixture; excludes cold startup; not Fly capacity evidence', summaries, samples }, null, 2);
    await writeFile(info.outputPath('latency.json'), report);
    await info.attach('latency.json', { body: report, contentType: 'application/json' });
    await info.attach('server-events.json', { body: JSON.stringify(logs, null, 2), contentType: 'application/json' });
    console.log('Peer display timings:', JSON.stringify(summaries));
    expect(samples.every(s => s.ms < 1000)).toBe(true);
    const launch = logs.find(e => e.event === 'weapon.launched');
    expect(logs.some(e => e.event === 'objective.damaged' && e.requestId === launch.requestId && e.projectileId === launch.projectileId)).toBe(true);
    expect(logs.some(e => e.event === 'objective.conquered' && e.saved)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('four-player-conquest.png') });
    await pages[1].screenshot({ path: info.outputPath('peer-conquest.png') });
  } finally {
    await writeFile(info.outputPath('diagnostic-events.json'), JSON.stringify(logs, null, 2));
    await info.attach('diagnostic-events.json', { body: JSON.stringify(logs, null, 2), contentType: 'application/json' });
    await Promise.all(contexts.map(c => c.close())); await app.close(); await rm(dir, { recursive: true, force: true });
  }
});
