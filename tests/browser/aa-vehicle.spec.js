import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { freshLife } from '../../public/survival.js';
import { newAerialEnemy } from '../../public/aerial-enemy.js';
import { groupKey } from '../../public/encounter-director.js';

for (const mobile of [false, true]) test(`AA controls, free cursor and flying contact ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(45000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-aa-client-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      expect(response.ok(), await response.text()).toBe(true); return response.json();
    };
    const credentials = { name: 'AA visual pilot', email: 'aa-client@frontier.test', password: 'isolated aa client password 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] }); await post('/api/auth/login', credentials);
    const { id } = await post('/api/campaigns/create', { name: 'AA client check' }); await post('/api/campaigns/enter', { id });
    const route = `/api/campaign-world/${id}`, read = async () => (await context.request.get(base + route + '/world')).json();
    const initial = await read(); await post('/api/campaigns/leave', {});
    // Only this disposable save is staged. Actual controls, aiming, shots and
    // rendering use the production server and browser code.
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      const zone = world.landingZones[0], x = zone.x + 1.5, y = zone.y + 1.5;
      for (const site of saved.sites) { site.guardsRemaining = 0; site.pending = null; site.nextCall = 1e9; }
      saved.director.nextRaid = 1e9; saved.director.sleeping = [];
      saved.director.groups = Object.fromEntries(saved.sites.map(s => [groupKey(s), { next: 1e9, wave: 0 }]));
      const skimmer = newAerialEnemy(9001, { x: x + 1, y: y - 6 }, { now: saved.now });
      skimmer.hp = skimmer.maxHp = 10000;
      skimmer.flight.nextSense = 1e9; skimmer.flight.nextAttack = 1e9;
      saved.enemies = [skimmer]; saved.serial = 9001;
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'aa-client-tank', kind: 'aa', owner: initial.me.id, occupant: initial.me.id, health: 200, hurt: 0,
        x, y, podX: zone.x + 4, podY: zone.y + 4, elapsed: 20, angle: 0, turret: 0, weapon: 'AA35', secondary: 'APCR', aaGuard: { search: 1e9, targetId: null } };
      db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
      db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(x, y, initial.me.id);
      db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(initial.me.id, JSON.stringify({ ...freshLife(), deployed: true, shield: 0 }));
    } finally { db.close(); }
    await post('/api/campaigns/enter', { id });
    const page = await context.newPage(), errors = [], inputs = [], fires = [], switches = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.method() !== 'POST') return;
      if (request.url().endsWith('/input')) inputs.push(request.postDataJSON());
      if (request.url().endsWith('/fire')) fires.push(request.postDataJSON());
      if (request.url().endsWith('/tank-weapon')) switches.push(request.postDataJSON());
    });
    await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    await expect(page.locator('#aa-loadout')).toBeVisible(); await expect(page.locator('#tank-primary')).toBeHidden();
    await expect(page.locator('#tank-secondary')).toBeHidden(); await expect(page.locator('#state-banner')).toContainText('AA VEHICLE');
    await page.locator('#world-canvas').focus(); await page.keyboard.press('1'); await page.keyboard.press('2');
    expect(switches).toEqual([]); expect((await read()).me.tankWeapon).toBe('AA35');
    await page.keyboard.press('F1');
    await expect(page.locator('#keys-now')).toContainText('fire while moving');
    await expect(page.locator('#keys-now')).toContainText('Hold LMB / Space');
    await expect(page.locator('#keys-now')).toContainText('your mouse cursor never moves');
    await expect(page.locator('#keys-now')).toContainText('automatic air and ground defense');
    await expect(page.locator('#keys-now')).not.toContainText('Toggle LMB');
    await page.keyboard.press('Escape');
    // The deployment catalogue remains accessible from the robot and reuses the
    // five-tile tank preview, then E returns to the same AA vehicle.
    await page.locator('#tank-interact').click(); await expect(page.locator('#aa-loadout')).toBeHidden();
    await page.locator('#build-mode').click(); await expect(page.locator('#aa-tank-card')).toContainText('120 ORB');
    await page.locator('#aa-tank-card').click(); await expect(page.locator('#site-title')).toContainText('AA vehicle');
    await expect(page.locator('#site-reason')).toContainText('5 tiles');
    await page.keyboard.press('Escape'); await page.locator('#tank-interact').click();
    await expect(page.locator('#aa-loadout')).toBeVisible(); await page.locator('#center').click();
    const bounds = await page.locator('#world-canvas').boundingBox(), zoom = Number((await page.locator('#zoom-label').textContent()).replace('%', '')) / 100;
    const state = await read(), target = state.combat.enemies.find(e => e.kind === 'skimmer');
    expect(target).toBeTruthy();
    const raw = { x: target.x + .7, y: target.y + .2 };
    const pixel = { x: bounds.x + bounds.width / 2 + (raw.x - state.me.x) * 48 * zoom, y: bounds.y + bounds.height / 2 + (raw.y - state.me.y) * 48 * zoom };
    if (mobile) await page.touchscreen.tap(pixel.x, pixel.y); else await page.mouse.move(pixel.x, pixel.y);
    await expect.poll(() => inputs.some(p => p.target && Math.hypot(p.target.x - raw.x, p.target.y - raw.y) < .12)).toBe(true);
    await expect.poll(async () => (await read()).tanks.find(t => t.kind === 'aa').aaAim?.domain).toBe('air');
    await expect(page.locator('#tank-charge')).toContainText('AIR TRACK');
    await page.screenshot({ path: info.outputPath(mobile ? 'aa-skimmer-phone.png' : 'aa-skimmer-desktop.png') });
    // Keep the trigger down: one initial HTTP shot followed by the server's
    // leased cadence, exercised through actual mouse/touch input.
    const touch = mobile ? await context.newCDPSession(page) : null;
    if (mobile) {
      const trigger = await page.locator('#fire-button').boundingBox();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: trigger.x + trigger.width / 2, y: trigger.y + trigger.height / 2, id: 1 }] });
    } else await page.mouse.down();
    await expect.poll(() => fires.some(f => f.weapon === 'AA35')).toBe(true);
    const sent = fires.find(f => f.weapon === 'AA35');
    expect(Math.hypot(sent.x - raw.x, sent.y - raw.y)).toBeLessThan(.12);
    const observed = new Map();
    const collectMuzzles = async () => {
      const latest = await read();
      for (const shot of latest.combat.shots) if (shot.mount === 'aa-35mm' && shot.owner === initial.me.id) observed.set(shot.id, shot);
      return observed.size;
    };
    await expect.poll(collectMuzzles, { timeout: 5000, intervals: [100] }).toBeGreaterThanOrEqual(6);
    const muzzles = [...observed.values()].sort((a, b) => a.at - b.at || a.id - b.id);
    expect(muzzles.slice(0, 6).map(s => s.barrel)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(fires.filter(f => f.weapon === 'AA35')).toHaveLength(1);
    expect(inputs.filter(p => p.aaFire === true).length).toBeGreaterThan(1);
    await expect.poll(async () => (await read()).combat.shots.some(s => s.mount === 'aa-tracer')).toBe(true);
    await page.screenshot({ path: info.outputPath(mobile ? 'aa-firing-phone.png' : 'aa-firing-desktop.png') });
    const releaseIndex = inputs.length;
    if (mobile) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    await expect.poll(() => inputs.slice(releaseIndex).some(p => p.aaFire === false)).toBe(true);
    // Released projectiles can still arrive; only new muzzle events must stop.
    await page.waitForTimeout(180); const stoppedAt = await collectMuzzles();
    await page.waitForTimeout(550); expect(await collectMuzzles()).toBe(stoppedAt);
    const sequences = inputs.filter(p => p.aaFireSequence !== undefined).map(p => p.aaFireSequence);
    expect(sequences.every((sequence, i) => !i || sequence > sequences[i - 1])).toBe(true);
    if (!mobile) {
      await page.locator('#world-canvas').focus();
      const keyboardStart = observed.size; await page.keyboard.down('Space');
      await expect.poll(collectMuzzles, { timeout: 3000, intervals: [100] }).toBeGreaterThanOrEqual(keyboardStart + 3);
      await page.keyboard.up('Space'); await page.waitForTimeout(180);
      const keyboardStop = await collectMuzzles(); await page.waitForTimeout(450);
      expect(await collectMuzzles()).toBe(keyboardStop);
      // Losing focus stops the stream and refocusing never restarts it.
      await page.mouse.move(pixel.x, pixel.y); await page.mouse.down();
      await expect.poll(collectMuzzles, { timeout: 3000, intervals: [100] }).toBeGreaterThanOrEqual(keyboardStop + 2);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await page.waitForTimeout(180); const blurredAt = await collectMuzzles();
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForTimeout(450); expect(await collectMuzzles()).toBe(blurredAt);
      await page.mouse.up();
    }
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-aa-client-')) throw Error('Unexpected fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
