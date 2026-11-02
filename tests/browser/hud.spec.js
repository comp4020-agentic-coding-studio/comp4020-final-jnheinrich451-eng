import { test, expect } from '@playwright/test';
import { isolatedField } from './rover-helper.js';

// The mission bar's fold is the behaviour under test, so these open a campaign-style
// body class on the isolated legacy field instead of its always-open drill panel.
const campaignHud = page => page.evaluate(() => document.body.classList.remove('legacy-world'));

for (const [label, viewport, phone] of [['desktop', { width: 1920, height: 1080 }, false], ['phone', { width: 390, height: 844 }, true]]) test(`the folded mission bar and single menu keep the battlefield clear on ${label}`, async ({ browser }) => {
  const field = await isolatedField('hud-' + label, [{ x: 24.5, y: 18.5 }]), context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone });
  try {
    await field.seat(context);
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(field.base + '/?legacy=1'); await expect(page.locator('#connection')).toContainText('live');
    await campaignHud(page);
    const bar = page.locator('#mission-bar'), detail = page.locator('#mission-detail'), menu = page.locator('#hud-menu');
    await expect(page.locator('#mission-current')).not.toBeEmpty();
    expect((await bar.boundingBox()).height).toBeLessThanOrEqual(40);
    await expect(detail).toBeHidden();
    // Drill controls leave campaigns; the legacy world alone keeps them.
    await expect(page.locator('#start-drill')).toBeHidden(); await expect(page.locator('#drill-front')).toBeHidden();
    await expect(page.locator('#frenzy-test')).toBeHidden();
    if (phone) {
      await page.locator('#mission-toggle').tap(); await expect(detail).toBeVisible();
      await expect(page.locator('#mission-toggle')).toHaveAttribute('aria-expanded', 'true');
      await page.locator('#mission-toggle').tap(); await expect(detail).toBeHidden();
    } else {
      await bar.hover(); await expect(detail).toBeVisible();
      await page.mouse.move(960, 700); await expect(detail).toBeHidden();
    }
    await expect(menu).toBeHidden();
    await page.locator('#hud-menu-button').click(); await expect(menu).toBeVisible();
    await expect(page.locator('#planet-open')).toBeVisible(); await expect(page.locator('#supplies-button')).toBeVisible();
    const box = await menu.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press('Escape'); await expect(menu).toBeHidden();
    await page.locator('#hud-menu-button').click(); await expect(menu).toBeVisible();
    await page.locator('#help-button').click(); await expect(page.locator('#help-dialog')).toBeVisible(); await expect(menu).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await context.close(); await field.close(); }
});

test('a finished step shows its gold check on the folded bar, then the bar moves on', async ({ browser }) => {
  const field = await isolatedField('hud-step', []), context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const page = await context.newPage(); await page.goto(field.base + '/?legacy=1'); await expect(page.locator('#connection')).toContainText('live');
    await expect(page.locator('#mission-current')).toHaveText('Land your core');
    const landed = await page.evaluate(async () => (await fetch('/api/cores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 60, y: 30 }) })).status);
    expect(landed).toBe(201);
    await expect(page.locator('#mission-mark')).toHaveText('✓', { timeout: 15000 });
    await expect(page.locator('#mission-current')).toHaveText('Core landed');
    await expect(page.locator('#mission-bar')).toHaveClass(/mission-done/);
    await expect(page.locator('#mission-current')).toHaveText('Place a sentry', { timeout: 6000 });
    await expect(page.locator('#mission-mark')).toHaveText('◆');
  } finally { await context.close(); await field.close(); }
});

async function landed(browser, label) {
  const field = await isolatedField('hud-' + label, []), context = await browser.newContext({ viewport: { width: 1920, height: 1080 } }), page = await context.newPage();
  await page.goto(field.base + '/?legacy=1'); await expect(page.locator('#connection')).toContainText('live');
  const post = (route, data) => page.evaluate(async ({ route, data }) => { const r = await fetch('/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, data: await r.json().catch(() => ({})) }; }, { route, data });
  const state = () => page.evaluate(async()=>(await fetch('/api/world')).text()).then(JSON.parse);
  expect((await post('cores', { x: 60, y: 30 })).status).toBe(201);
  await expect.poll(async () => (await state()).me.deploying, { timeout: 15000 }).toBeFalsy();
  return { field, context, page, post, state };
}

test('every Deploy tab fits one row on a desktop, and the wheel scrolls the shelf where it cannot', async ({ browser }) => {
  const { field, context, page } = await landed(browser, 'shelf');
  try {
    await page.locator('#build-mode').click();
    const row = page.locator('.unit-grid'), spill = () => row.evaluate(element => element.scrollWidth - element.clientWidth);
    for (const tab of ['ground', 'rail', 'strike', 'logistics', 'navy', 'air']) {
      await page.locator('#tab-' + tab).click();
      expect(await spill()).toBeLessThanOrEqual(0);
      expect(await page.locator('.unit-card:visible strong').evaluateAll(names => names.filter(name => name.scrollHeight > name.clientHeight).map(name => name.textContent))).toEqual([]);
      // Keys read 1, 2, 3 from the left, and every name starts on the same line.
      const tiles = await page.locator('.unit-card:visible').evaluateAll(cards => cards.map(card => ({ x: card.getBoundingClientRect().x, key: card.querySelector('.asset-key').textContent, top: card.querySelector('strong').getBoundingClientRect().top })).sort((a, b) => a.x - b.x));
      expect(tiles.map(tile => tile.key)).toEqual(tiles.map((_, index) => String(index + 1)));
      expect(new Set(tiles.map(tile => tile.top)).size).toBe(1);
    }
    await page.locator('#tab-strike').click();
    await page.setViewportSize({ width: 600, height: 800 });
    await expect.poll(spill).toBeGreaterThan(0);
    const box = await row.boundingBox();
    await page.mouse.move(box.x + 60, box.y + 30); await page.mouse.wheel(0, 120);
    await expect.poll(() => row.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await page.mouse.wheel(0, -120);
    await expect.poll(() => row.evaluate(element => element.scrollLeft)).toBe(0);
  } finally { await context.close(); await field.close(); }
});

test('a broken drawing state costs one frame and names itself, instead of ruining the view', async ({ browser }) => {
  const { field, context, page } = await landed(browser, 'repair');
  try {
    const transform = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { const m = document.getElementById('world-canvas').getContext('2d').getTransform(); resolve([m.b, m.c]); }))));
    await page.evaluate(() => { const c = document.getElementById('world-canvas').getContext('2d'); c.save(); c.rotate(.6); });
    await expect.poll(transform).toEqual([0, 0]);
    await expect(page.locator('#toast')).toContainText('Display repaired');
  } finally { await context.close(); await field.close(); }
});

test('one click on the map deploys: left with ORB, right with GND inside support, and the shelf stays small', async ({ browser }) => {
  const { field, context, page, state } = await landed(browser, 'deploy');
  try {
    await page.locator('#build-mode').click();
    const shelf = await page.locator('#deployment-tray').boundingBox();
    expect(shelf.width).toBeLessThanOrEqual(720); expect(shelf.height).toBeLessThanOrEqual(140);
    await expect(page.locator('#sentry-card')).toBeVisible(); await expect(page.locator('#sentry-card-ground')).toBeHidden();
    await expect(page.locator('#asset-spec')).toBeHidden();
    const count = async () => (await state()).buildings.length, before = await count(), orbital = (await state()).world.logistics.supplies;
    await page.locator('#sentry-card').click();
    const legal = async text => {
      for (const [x, y] of [[1250, 300], [1300, 640], [700, 300], [640, 720], [1184, 240], [1320, 420], [1500, 300], [1500, 700], [420, 300], [420, 700]]) {
        await page.mouse.move(x, y); await page.mouse.move(x + 4, y + 4);
        if ((await page.locator('#place-chip').textContent()).includes(text)) return [x + 4, y + 4];
      }
      return null;
    };
    const left = await legal('LMB'); expect(left).not.toBeNull();
    await expect(page.locator('#place-chip')).toContainText('ORB');
    await page.mouse.click(left[0], left[1]);
    await expect.poll(count).toBe(before + 1);
    await expect(page.locator('#state-banner')).toHaveText('ON FOOT · ROBOT');
    expect((await state()).world.logistics.supplies).toBeLessThan(orbital);
    await page.locator('#build-mode').click(); await page.locator('#sentry-card').click();
    // Any tile inside the core's support offers GND; the chip says which ones do.
    const spot = await legal('RMB'); expect(spot).not.toBeNull();
    await page.mouse.click(spot[0], spot[1], { button: 'right' });
    await expect.poll(async () => Object.keys((await state()).world.logistics.jobs || {}).length + (await state()).buildings.length).toBeGreaterThan(before + 1);
    await expect(page.locator('#field-equipment-list details')).not.toHaveCount(0);
  } finally { await context.close(); await field.close(); }
});

test('a missile battery opens near itself, M flips to the planet and back, and T jumps between targets', async ({ browser }) => {
  const { field, context, page, post, state } = await landed(browser, 'gun');
  try {
    const placed = await post('missiles', { x: 70, y: 18 }); expect(placed.status).toBe(201); const id = placed.data.gun.id;
    await expect.poll(async () => { const s = await state(); return !!s.artillery.find(g => g.id === id) && !s.logistics.jobs[id]; }, { timeout: 20000 }).toBe(true);
    expect((await post('artillery/control', { id })).status).toBe(200);
    await page.locator('#facility-controls').waitFor({ state: 'visible' });
    const battlefield = page.locator('.battlefield'), zoom = async () => Number((await page.locator('#zoom-label').textContent()).replace('%', ''));
    await expect(battlefield).not.toHaveClass(/artillery-orbit/);
    await expect.poll(zoom).toBeGreaterThan(10);
    await page.locator('#world-canvas').focus(); await page.keyboard.press('m');
    await expect(battlefield).toHaveClass(/artillery-orbit/); expect(await zoom()).toBeLessThan(10);
    await page.keyboard.press('m'); await expect(battlefield).not.toHaveClass(/artillery-orbit/); await expect.poll(zoom).toBeGreaterThan(10);
    await page.keyboard.press('t'); await expect(page.locator('#toast')).toContainText(/ t$|No target/);
  } finally { await context.close(); await field.close(); }
});

test('the map edge fades into weather on the real renderer, at every zoom', async ({ browser }) => {
  const { field, context, page } = await landed(browser, 'edge');
  try {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const pixel = (x, y) => page.evaluate(({ x, y }) => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve([...document.getElementById('world-canvas').getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3))))), { x, y });
    const near = (actual, wanted, tolerance = 6) => actual.every((value, i) => Math.abs(value - wanted[i]) <= tolerance);
    await page.locator('#world-canvas').focus(); await page.keyboard.press('m');
    await expect.poll(async () => Number((await page.locator('#zoom-label').textContent()).replace('%', ''))).toBeLessThan(10);
    // Far past the rim: solid weather, not the flat teal that used to surround the map.
    await expect.poll(async () => near(await pixel(12, 540), [6, 12, 20])).toBe(true);
    expect(near(await pixel(12, 540), [40, 78, 82], 20)).toBe(false);
    // Up close the surface keeps painting past the corner, on chunks with negative tiles.
    await page.keyboard.press('m');
    const zoom = async () => Number((await page.locator('#zoom-label').textContent()).replace('%', ''));
    await page.mouse.move(960, 540);
    for (let i = 0; i < 40 && await zoom() > 70; i++) await page.mouse.wheel(0, 120);
    expect(await zoom()).toBeGreaterThanOrEqual(50);
    await page.mouse.move(960, 200); await page.mouse.down({ button: 'middle' }); await page.mouse.move(960, 900, { steps: 8 }); await page.mouse.up({ button: 'middle' });
    await page.mouse.move(960, 200); await page.mouse.down({ button: 'middle' }); await page.mouse.move(960, 900, { steps: 8 }); await page.mouse.up({ button: 'middle' });
    expect(near(await pixel(960, 30), [40, 78, 82], 20)).toBe(false);
    expect(errors).toEqual([]);
  } finally { await context.close(); await field.close(); }
});
