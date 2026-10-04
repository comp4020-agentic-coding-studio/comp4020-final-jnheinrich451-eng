import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('stabilized turret trails a cursor reversal and shares its actual firing bearing', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), peer = await other.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await peer.goto('/');
  for (const p of [page, peer]) {
    await expect(p.locator('#connection')).toContainText('Uplink live');
    await p.evaluate(() => {
      window.turretShots = new Map(); window.turretStream = new EventSource('/api/events');
      window.turretStream.onmessage = e => JSON.parse(e.data).combat.shots.forEach(s => window.turretShots.set(s.id, s));
    });
  }
  await page.bringToFront();
  const initial = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  await page.mouse.move(960, 320); await page.waitForTimeout(350);
  // Reverse the cursor instantly; fire before the one-second half-turn finishes.
  await page.mouse.move(960, 760); await page.waitForTimeout(180);
  await page.mouse.click(960, 760);
  await expect.poll(() => page.evaluate(() => window.turretShots.size)).toBeGreaterThan(0);
  const shot = await page.evaluate(id => [...window.turretShots.values()].find(s => s.owner === id), initial.id);
  expect(Math.abs(shot.angle)).toBeLessThan(Math.PI - .3);
  await expect.poll(() => peer.evaluate(id => window.turretShots.get(id)?.angle, shot.id)).toBe(shot.angle);
  await page.screenshot({ path: 'docs/previews/stabilized-turret-desktop.png' });
  await expect.poll(() => page.evaluate(async () => Math.abs((await (await fetch('/api/world')).json()).me.turret))).toBeCloseTo(Math.PI, 2);
  const settled = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  expect(settled.angle).toBe(initial.angle); expect(settled.x).toBe(initial.x); expect(settled.y).toBe(initial.y);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.mouse.move(275, 310); await page.waitForTimeout(180);
  await page.screenshot({ path: 'docs/previews/stabilized-turret-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await context.close(); await other.close();
});

async function siteControls(page) {
  if (!await page.locator('#site-panel').isVisible()) await page.locator('#site-button').click();
  if (!await page.locator('#coordinate-details').getAttribute('open')) {
    if (!await page.locator('#tile-x').isVisible()) await page.locator('#coordinate-details summary').click();
  }
}

test('two scouts share a saved foundation; keyboard movement, reload, and resize work', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const other = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage(), peer = await other.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await peer.goto('/');
  await expect(page.locator('#connection')).toContainText('Uplink live');
  await expect(page.locator('#presence')).toContainText('2 SCOUTS');
  const initial = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  await page.locator('#world-canvas').focus();
  await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d'); await page.waitForTimeout(650);
  const moved = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  expect(moved.x).toBeGreaterThan(initial.x + .5);
  await page.locator('#build-mode').click();
  await page.locator('#sentry-card').click(); await siteControls(page);
  await page.locator('#tile-x').fill('28'); await page.locator('#tile-y').fill('21'); await page.locator('#select-tile').click();
  await expect(page.locator('#place-building')).toBeEnabled(); await page.locator('#place-building').click();
  await expect(page.locator('#toast')).toContainText('placed and saved');
  await expect(peer.locator('#building-count')).toHaveText('1 FOUNDATION');
  await page.reload(); await expect(page.locator('#connection')).toContainText('Uplink live');
  await expect(page.locator('#task-save')).toHaveClass(/done/);
  const returned = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  expect(returned.id).toBe(initial.id); expect(returned.x).toBeCloseTo(moved.x, 1);
  await siteControls(page);
  await page.locator('#tile-x').fill('0'); await page.locator('#tile-y').fill('0'); await page.locator('#select-tile').click();
  await expect(page.locator('#place-building')).toBeDisabled(); await expect(page.locator('#site-reason')).toContainText('water');
  await page.locator('#tile-x').fill('28'); await page.locator('#tile-y').fill('21'); await page.locator('#select-tile').click();
  await page.locator('#center').click();
  await page.locator('#close-site').click();
  await page.bringToFront(); await page.waitForTimeout(400);
  await mkdir('docs/previews', { recursive: true });
  await page.screenshot({ path: 'docs/previews/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  const field = await page.locator('#world-canvas').boundingBox();
  expect(field).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  await expect(page.locator('[data-direction="up"]')).toBeVisible();
  await page.screenshot({ path: 'docs/previews/mobile.png', fullPage: true });
  await page.locator('#help-button').click(); await expect(page.locator('#help-dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#help-dialog')).not.toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('#build-mode').click(); await expect(page.locator('#sentry-card')).toBeInViewport();
  await page.screenshot({ path: 'docs/previews/landscape.png' });
  expect(errors).toEqual([]);
  await context.close(); await other.close();
});

test('touch users can select a site and place a foundation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); await page.goto('/');
  await expect(page.locator('#connection')).toContainText('Uplink live');
  await page.locator('#build-mode').tap();
  await expect(page.locator('#deployment-tray')).toBeVisible();
  await page.locator('#sentry-card').tap();
  await expect(page.locator('#deployment-tray')).not.toBeVisible();
  // Two tiles east and three south of the spawn, in the unobscured play area.
  await page.touchscreen.tap(262, 523);
  await expect(page.locator('#site-panel')).toBeVisible();
  await expect(page.locator('#place-building')).toBeInViewport();
  await page.screenshot({ path: 'docs/previews/mobile-deployment.png' });
  await page.locator('#place-building').tap(); await expect(page.locator('#toast')).toContainText('placed and saved');
  await expect(page.locator('#site-panel')).not.toBeVisible();
  await page.locator('#site-button').tap();
  await expect(page.locator('#remove-building')).toBeVisible();
  await page.locator('#remove-building').tap(); await expect(page.locator('#toast')).toContainText('removed');
  await context.close();
});

test('two browsers see the same shell and enemy damage; drill and firing controls work', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), peer = await other.newPage();
  await page.goto('/'); await peer.goto('/');
  await expect(page.locator('#connection')).toContainText('Uplink live');
  await expect(peer.locator('#connection')).toContainText('Uplink live');
  for (const p of [page, peer]) await p.evaluate(() => {
    window.combatEvents = [];
    window.observer = new EventSource('/api/events');
    window.observer.onmessage = e => window.combatEvents.push(JSON.parse(e.data).combat);
  });
  await page.locator('#start-drill').click();
  await expect(peer.locator('#combat-status')).toContainText('3 hostiles');
  await page.bringToFront(); await page.locator('#world-canvas').focus();
  // Default aim is five tiles north, safely away from friendly scouts.
  await page.keyboard.press('Space');
  await expect.poll(() => peer.evaluate(() => window.combatEvents.some(c => c.shells.length))).toBe(true);
  const shot = await page.evaluate(() => window.combatEvents.flatMap(c => c.shells).find(Boolean).id);
  await expect.poll(() => peer.evaluate(id => window.combatEvents.some(c => c.shells.some(s => s.id === id)), shot)).toBe(true);
  await page.waitForTimeout(700);
  // Track one hostile with server-validated shots, independent of viewport size.
  const targetId = await page.evaluate(async () => (await (await fetch('/api/world')).json()).combat.enemies[0].id);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(async id => {
      const state = await (await fetch('/api/world')).json(), e = state.combat.enemies.find(e => e.id === id);
      if (e) await fetch('/api/fire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: e.x, y: e.y }) });
    }, targetId);
    await page.waitForTimeout(800);
  }
  await expect.poll(() => peer.evaluate(id => window.combatEvents.some(c => c.enemies.some(e => e.id === id && e.hp < 60)) || window.combatEvents.some(c => c.kills > 0), targetId)).toBe(true);
  const craterId = await page.evaluate(() => window.combatEvents.flatMap(c => c.marks).find(m => m.kind === 'crater').id);
  await expect.poll(() => peer.evaluate(id => window.combatEvents.some(c => c.marks.some(m => m.id === id && m.kind === 'crater')), craterId)).toBe(true);
  await page.bringToFront(); await page.screenshot({ path: 'docs/previews/combat.png' });
  await context.close(); await other.close();
});

test('HE leaves shared cosmetic craters; effects deduplicate and reduced mode persists', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#connection')).toContainText('Uplink live');
  await page.bringToFront();
  await page.locator('#zoom-in').click(); await page.locator('#zoom-in').click();
  await page.evaluate(async () => {
    window.lastBlast = null;
    window.fxObserver = new EventSource('/api/events');
    window.fxObserver.onmessage = e => { const c = JSON.parse(e.data).combat; if (c.impacts.length) window.lastBlast = c; };
    const state = await (await fetch('/api/world')).json();
    window.beforeMark = Math.max(0, ...state.combat.marks.filter(m => m.kind === 'crater').map(m => m.id));
    const result = await fetch('/api/fire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: state.me.x + 2, y: state.me.y - 1 }) });
    if (!result.ok) throw new Error('Test shot rejected');
  });
  await page.waitForFunction(() => window.lastBlast?.impacts.some(i => i.id > window.beforeMark));
  await page.screenshot({ path: 'docs/previews/he-impact.png' });
  await page.waitForTimeout(330); await page.screenshot({ path: 'docs/previews/he-dust.png' });
  const result = await page.evaluate(async () => {
    const { CombatEffects } = await import('/effects.js'); const fx = new CombatEffects(48), state = window.lastBlast;
    fx.ingest(state, performance.now()); const first = fx.bursts.length;
    fx.ingest(state, performance.now());
    const duplicate = fx.bursts.length;
    // Model a hidden tab receiving many snapshots without any render frames.
    for (let i = 0; i < 200; i++) fx.ingest({ ...state, time: i * 100, shots: [], impacts: [{ ...state.impacts[0], id: 10000 + i, at: i * 100, hits: [{ id: 10000 + i, x: 20, y: 20, killed: false }] }] }, i * 100);
    return { first, duplicate, marks: state.marks.length, retainedHits: fx.hits.size, retainedBursts: fx.bursts.length };
  });
  expect(result.first).toBeGreaterThan(0); expect(result.duplicate).toBe(result.first); expect(result.marks).toBeGreaterThan(0);
  expect(result.retainedHits).toBeLessThanOrEqual(5); expect(result.retainedBursts).toBeLessThanOrEqual(10);
  await page.waitForTimeout(1300); await page.screenshot({ path: 'docs/previews/he-crater.png' });
  await page.locator('#help-button').click(); await page.locator('#reduced-effects').check();
  await page.keyboard.press('Escape'); await page.reload(); await expect(page.locator('#connection')).toContainText('Uplink live');
  await page.locator('#help-button').click(); await expect(page.locator('#reduced-effects')).toBeChecked(); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#center').click();
  await page.screenshot({ path: 'docs/previews/he-mobile.png' });
  expect(errors).toEqual([]); await context.close();
});

test('mouse weapons are independent; readouts are passive; held fire stops on release, blur and menus', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#connection')).toContainText('Uplink live');
  await page.evaluate(() => {
    window.controlShots = new Map(); window.controlEvents = new EventSource('/api/events');
    window.controlEvents.onmessage = e => JSON.parse(e.data).combat.shots.forEach(s => window.controlShots.set(s.id, s));
    window.everCannonFlash = false;
    new MutationObserver(() => { if (document.getElementById('weapon-he').classList.contains('firing')) window.everCannonFlash = true; }).observe(document.getElementById('weapon-he'), { attributes: true, attributeFilter: ['class'] });
  });
  const count = weapon => page.evaluate(({ weapon, owner }) => [...window.controlShots.values()].filter(s => s.weapon === weapon && s.owner === owner).length, { weapon, owner: start.id });
  await expect(page.locator('#weapon-he')).toHaveText(/LMB.*Cannon/);
  await expect(page.locator('#weapon-mg')).toHaveText(/RMB.*Machine gun/);
  expect(await page.locator('.weapon-display button').count()).toBe(0);
  await expect(page.locator('#fire-button')).not.toBeVisible();
  const start = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  await page.mouse.move(1110, 650);
  await page.mouse.down({ button: 'right' });
  await expect.poll(() => count('APCR')).toBeGreaterThanOrEqual(2);
  await page.mouse.click(1110, 650, { button: 'left' });
  await expect.poll(() => count('HE')).toBe(1);
  await expect.poll(() => page.evaluate(() => window.everCannonFlash)).toBe(true);
  await page.mouse.up({ button: 'right' }); await page.waitForTimeout(250);
  const released = await count('APCR'); await page.waitForTimeout(450); expect(await count('APCR')).toBe(released);
  const unmoved = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  expect(unmoved.x).toBe(start.x); expect(unmoved.y).toBe(start.y);
  await page.locator('#weapon-mg').click(); await page.waitForTimeout(180); expect(await count('APCR')).toBe(released);
  await page.locator('#world-canvas').focus(); await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d');
  await page.mouse.move(1120, 640); await page.mouse.down({ button: 'right' }); await page.waitForTimeout(250);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.waitForTimeout(250);
  const blurred = await count('APCR'); await page.waitForTimeout(350); expect(await count('APCR')).toBe(blurred);
  await page.mouse.up({ button: 'right' });
  await page.locator('#world-canvas').focus(); await page.keyboard.down('j'); await page.waitForTimeout(250);
  await page.locator('#help-button').click(); await page.waitForTimeout(200);
  const paused = await count('APCR'); await page.waitForTimeout(350); expect(await count('APCR')).toBe(paused);
  await page.keyboard.up('j'); await page.keyboard.press('Escape');
  await page.locator('#build-mode').click(); await page.locator('#sentry-card').click();
  const beforeBuild = await count('HE'); await page.mouse.click(1130, 650); await page.waitForTimeout(200);
  expect(await count('HE')).toBe(beforeBuild); await expect(page.locator('#site-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#world-canvas').focus(); await page.keyboard.down('j'); await page.waitForTimeout(250);
  await context.setOffline(true); await expect(page.locator('#connection')).toContainText('Reconnecting');
  await page.keyboard.up('j'); await context.setOffline(false); await expect(page.locator('#connection')).toContainText('Uplink live', { timeout: 10000 });
  await page.waitForTimeout(250); const restored = await count('APCR'); await page.waitForTimeout(350); expect(await count('APCR')).toBe(restored);
  await page.screenshot({ path: 'docs/previews/dual-weapons-desktop.png' });
  expect(errors).toEqual([]); await context.close();
});

test('touch aim does not fire or move; cannon and held machine gun work without mode switches', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); await page.goto('/'); await expect(page.locator('#connection')).toContainText('Uplink live');
  const shotRequests = [];
  page.on('request', request => { if (request.url().endsWith('/api/fire')) shotRequests.push(request.postDataJSON()); });
  const initial = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  await page.touchscreen.tap(265, 495); await page.waitForTimeout(200);
  expect(shotRequests).toHaveLength(0);
  const afterAim = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  expect(afterAim.x).toBe(initial.x); expect(afterAim.y).toBe(initial.y);
  await page.locator('#fire-button').tap(); await expect.poll(() => shotRequests.filter(r => r.weapon === 'HE').length).toBe(1);
  const button = await page.locator('#machine-gun-button').boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2, id: 1 }] });
  await page.waitForTimeout(500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(shotRequests.filter(r => r.weapon === 'APCR').length).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(200); const stopped = shotRequests.length; await page.waitForTimeout(300); expect(shotRequests.length).toBe(stopped);
  await page.screenshot({ path: 'docs/previews/dual-weapons-mobile.png' });
  await context.close();
});

test('automatic sentries share gradual traverse and fire along the aligned barrel', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), peer = await other.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message)); peer.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await peer.goto('/');
  await expect(page.locator('#connection')).toContainText('Uplink live');
  await expect(peer.locator('#connection')).toContainText('Uplink live');
  // Earlier tests may have left a drill finishing. Use the same isolated test save.
  await expect(page.locator('#start-drill')).toBeEnabled({ timeout: 35000 });
  const building = await page.evaluate(async () => {
    const response = await fetch('/api/buildings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 24, y: 14 }) });
    if (!response.ok) throw new Error('Test sentry deployment failed');
    return (await response.json()).building;
  });
  for (const p of [page, peer]) await p.evaluate(() => {
    window.sentryEvents = []; window.sentryStream = new EventSource('/api/events');
    window.sentryStream.onmessage = e => window.sentryEvents.push(JSON.parse(e.data));
  });
  await expect.poll(() => peer.evaluate(id => window.sentryEvents.some(s => s.combat.sentries[id]), building.id)).toBe(true);
  await page.locator('#start-drill').click();
  await expect.poll(() => page.evaluate(id => window.sentryEvents.some(s => {
    const mount = s.combat.sentries[id];
    return mount?.targetId !== null && mount && Math.abs(Math.atan2(Math.sin(mount.aim - mount.angle), Math.cos(mount.aim - mount.angle))) > .04;
  }), building.id)).toBe(true);
  await expect.poll(() => page.evaluate(id => window.sentryEvents.some(s => s.combat.shots.some(shot => shot.owner === id)), building.id)).toBe(true);
  const sample = await page.evaluate(id => {
    const event = window.sentryEvents.find(s => s.combat.shots.some(shot => shot.owner === id));
    return { revision: event.revision, mount: event.combat.sentries[id], shot: event.combat.shots.find(shot => shot.owner === id) };
  }, building.id);
  expect(sample.shot.weapon).toBe('APCR'); expect(sample.shot.angle).toBeCloseTo(sample.mount.angle, 6);
  await expect.poll(() => peer.evaluate(({ id, revision }) => window.sentryEvents.find(s => s.revision === revision)?.combat.sentries[id], { id: building.id, revision: sample.revision })).toEqual(sample.mount);
  await page.bringToFront(); await page.screenshot({ path: 'docs/previews/sentry-traverse-desktop.png' });
  await peer.bringToFront(); await peer.screenshot({ path: 'docs/previews/sentry-traverse-mobile.png' });
  await page.evaluate(async id => {
    await fetch('/api/dismantle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  }, building.id);
  expect(errors).toEqual([]);
  await context.close(); await other.close();
});

test('orbital core lands, unfolds walkable panels, releases a robot and survives reload', async ({ browser }) => {
  test.setTimeout(70000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const other = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), peer = await other.newPage(), errors = [];
  for (const p of [page, peer]) p.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await peer.goto('/');
  await expect(page.locator('#connection')).toContainText('Uplink live');
  await expect(page.locator('#start-drill')).toBeEnabled({ timeout: 35000 });
  for (const p of [page, peer]) await p.evaluate(() => {
    window.coreStates = []; window.coreStream = new EventSource('/api/events');
    window.coreStream.onmessage = e => window.coreStates.push(JSON.parse(e.data));
  });
  await page.bringToFront(); await page.locator('#build-mode').click(); await page.locator('#core-card').click();
  await expect(page.locator('#core-status')).toContainText('ORBITAL SURVEY');
  await siteControls(page); await page.locator('#tile-x').fill('29'); await page.locator('#tile-y').fill('13'); await page.locator('#select-tile').click();
  await expect(page.locator('#place-building')).toHaveText(/Confirm orbital drop/);
  await page.screenshot({ path: 'docs/previews/core-survey-desktop.png' });
  await page.evaluate(() => { window.coreLabels = []; const el = document.getElementById('core-status'); window.coreLabelObserver = new MutationObserver(() => window.coreLabels.push(el.textContent)); window.coreLabelObserver.observe(el, { childList: true, characterData: true, subtree: true }); });
  await page.locator('#place-building').click();
  await expect(page.locator('#core-status')).toHaveText('ORBITAL DESCENT');
  await page.screenshot({ path: 'docs/previews/core-descent.png' });
  await expect.poll(() => page.evaluate(() => window.coreLabels.includes('GROUND CONTACT')), { intervals: [50] }).toBe(true);
  await page.screenshot({ path: 'docs/previews/core-impact.png' });
  await expect(page.locator('#core-status')).toHaveText('PANELS UNFOLDING');
  await page.waitForTimeout(450); await page.screenshot({ path: 'docs/previews/core-panels.png' });
  await expect(page.locator('#core-status')).toBeHidden({ timeout: 7000 });
  const saved = await page.evaluate(async () => (await (await fetch('/api/world')).json()));
  const core = saved.cores.find(c => c.owner === saved.me.id);
  expect(core.elapsed).toBe(4.5); expect(saved.me.body).toBe('robot'); expect(saved.me.x).toBeCloseTo(32.6);
  await expect.poll(() => peer.evaluate(id => window.coreStates.some(s => s.cores.some(c => c.id === id && c.elapsed === 4.5)), core.id)).toBe(true);
  await page.screenshot({ path: 'docs/previews/core-deployed-desktop.png' });
  await page.locator('#world-canvas').focus(); await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d'); await page.waitForTimeout(650);
  const walked = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
  expect(walked.x).toBeGreaterThan(33.2); // Walk through the rock tile covered by the right panel.
  await page.reload(); await expect(page.locator('#connection')).toContainText('Uplink live');
  const returned = await page.evaluate(async () => (await (await fetch('/api/world')).json()));
  expect(returned.cores.find(c => c.id === core.id)?.elapsed).toBe(4.5); expect(returned.me.x).toBeCloseTo(walked.x, 1);
  await page.locator('#build-mode').click(); await expect(page.locator('#core-card')).toBeDisabled();
  // The second player owns a separate core; native touch can confirm deployment.
  await peer.bringToFront(); await peer.locator('#build-mode').tap(); await peer.locator('#core-card').tap();
  await expect(peer.locator('#place-building')).toBeEnabled();
  await peer.screenshot({ path: 'docs/previews/core-survey-mobile.png' });
  await peer.locator('#place-building').tap(); await expect(peer.locator('#core-status')).toHaveText('ORBITAL DESCENT');
  await expect(peer.locator('#core-status')).toHaveText('PANELS UNFOLDING'); await peer.waitForTimeout(550);
  await peer.screenshot({ path: 'docs/previews/core-panels-mobile.png' });
  await expect(peer.locator('#core-status')).toBeHidden({ timeout: 7000 });
  await peer.screenshot({ path: 'docs/previews/core-deployed-mobile.png' });
  // Both deployed bodies now use their own equipment, including held touch fire.
  await expect(peer.locator('#weapon-he')).toContainText('Fuel jet');
  await expect(peer.locator('#weapon-mg')).toContainText('Laser rifle');
  const requests = [];
  peer.on('request', request => { if (request.url().endsWith('/api/fire')) requests.push(request.postDataJSON()); });
  await peer.touchscreen.tap(280, 400);
  const cdp = await other.newCDPSession(peer);
  for (const [selector, weapon] of [['#fire-button', 'FLAME'], ['#machine-gun-button', 'LASER']]) {
    const button = await peer.locator(selector).boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2, id: 1 }] });
    await peer.waitForTimeout(750);
    await peer.screenshot({ path: `docs/previews/robot-${weapon.toLowerCase()}-mobile.png` });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(requests.filter(r => r.weapon === weapon).length).toBeGreaterThanOrEqual(2);
    await peer.waitForTimeout(180); const stopped = requests.length;
    await peer.waitForTimeout(350); expect(requests.length).toBe(stopped);
  }
  await page.bringToFront(); await page.keyboard.press('Escape'); await page.keyboard.press('c');
  await page.mouse.move(1150, 540); await page.waitForTimeout(350);
  await page.mouse.down({ button: 'left' }); await page.waitForTimeout(450);
  await page.screenshot({ path: 'docs/previews/robot-fuel-desktop.png' });
  await page.mouse.up({ button: 'left' });
  await expect.poll(() => peer.evaluate(id => window.coreStates.some(s => s.combat.shots.some(shot => shot.owner === id && shot.weapon === 'FLAME')), saved.me.id)).toBe(true);
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(380);
  await page.screenshot({ path: 'docs/previews/robot-laser-desktop.png' });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => peer.evaluate(id => window.coreStates.some(s => s.combat.shots.some(shot => shot.owner === id && shot.weapon === 'LASER' && Number.isFinite(shot.endX))), saved.me.id)).toBe(true);
  await page.locator('#world-canvas').focus(); await page.keyboard.down(' '); await page.waitForTimeout(350);
  await page.locator('#help-button').click(); await page.keyboard.up(' '); await page.waitForTimeout(300);
  const stoppedAt = await page.evaluate(async () => (await (await fetch('/api/world')).json()).combat.shots.filter(s => s.weapon === 'FLAME').map(s => s.id));
  await page.waitForTimeout(400);
  const later = await page.evaluate(async () => (await (await fetch('/api/world')).json()).combat.shots.filter(s => s.weapon === 'FLAME').map(s => s.id));
  expect(later.every(id => stoppedAt.includes(id))).toBe(true);
  expect(await peer.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect(errors).toEqual([]);
  await context.close(); await other.close();
});
