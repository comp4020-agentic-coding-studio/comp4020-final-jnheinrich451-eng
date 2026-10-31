import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

// Each rehearsal has an isolated registry and fresh browser identities. No local
// developer saves, live mail or production accounts participate in these tests.
async function fixture(browser, run) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-entry-ui-'));
  const app = createApp({ dataDir, logSink: () => {} }), contexts = [];
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const context = async options => { const value = await browser.newContext(options); contexts.push(value); return value; };
    const post = async (client, route, data) => {
      const response = await client.request.post(base + route, { data, headers: { Origin: base } });
      const result = await response.json(); expect(response.ok(), JSON.stringify(result)).toBe(true); return result;
    };
    const account = async client => {
      const credentials = { name: 'Entry Pilot', email: 'entry@frontier.test', password: 'an isolated entry password 123!', kind: 'demo' };
      await post(client, '/api/auth/register', credentials);
      const inbox = await (await client.request.get(base + '/api/auth/inbox')).json();
      await post(client, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
      await post(client, '/api/auth/login', credentials);
    };
    await run({ base, context, post, account });
  } finally {
    await Promise.all(contexts.map(value => value.close()));
    await app.close(); await rm(dataDir, { recursive: true, force: true });
  }
}

async function choosePlanet(page, template) {
  for(let i=0;i<3&&await page.locator('body').getAttribute('data-entry-planet')!==template;i++)await page.locator('#planet-next').click();
  await expect(page.locator('body')).toHaveAttribute('data-entry-planet', template);
}

for (const viewport of [{ width: 1920, height: 1080, label: 'desktop' }, { width: 1280, height: 900, label: 'laptop' }, { width: 390, height: 844, label: 'phone' }]) test(`entry navigation, planet saves and failed Join remain usable on ${viewport.label}`, async ({ browser }, info) => {
  const mobile = viewport.label === 'phone';
  await fixture(browser, async ({ base, context, post, account }) => {
    const client = await context({ viewport: { width: viewport.width, height: viewport.height }, isMobile: mobile, hasTouch: mobile });
    const page = await client.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: mobile ? 'reduce' : 'no-preference' });
    await page.goto(base);
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('#guest')).toBeVisible();
    await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', String(mobile));
    // Freeze decorative camera motion for review captures, after checking that
    // desktop animation starts enabled and the explicit pause control works.
    if (!mobile) { await page.locator('#motion').click(); await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true'); }
    await page.screenshot({ path: info.outputPath('entry-login.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await account(client);
    await post(client, '/api/campaigns/create', { name: 'Caldera first landing', template: 'caldera-v1' });
    await post(client, '/api/campaigns/create', { name: 'Vesper crossing with a deliberately long name', template: 'vesper-v1' });
    await page.goto(base + '/campaigns/');
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'menu');
    expect(await page.locator('#menu-heading').evaluate(element => getComputedStyle(element).textAlign)).toBe('center');
    await page.screenshot({ path: info.outputPath('entry-menu.png'), fullPage: true });
    await expect(page.locator('#create')).toBeHidden();
    await expect(page.locator('#join')).toBeHidden();
    await page.locator('#new-game').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'new');
    await choosePlanet(page, 'vesper-v1');
    if (!mobile) {
      await page.locator('#planet-next').hover();
      expect(await page.locator('#planet-next').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    }
    const planetBottom = await page.evaluate(() => parseFloat(getComputedStyle(document.body).getPropertyValue('--entry-planet-bottom')));
    const select = await page.locator('#select-planet').boundingBox();
    expect(select.y + await page.evaluate(() => scrollY)).toBeGreaterThan(planetBottom);
    expect(await page.locator('.planet-info').evaluate(element => getComputedStyle(element).backgroundImage)).toBe('none');
    await page.screenshot({ path: info.outputPath('entry-new-vesper.png'), fullPage: true });
    await choosePlanet(page, 'sirocco-v1');
    await expect(page.locator('#select-planet')).toContainText('Sirocco');
    await expect(page.locator('.planet-info')).toContainText('sand');
    await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('entry-new-sirocco.png'), fullPage: true });
    await page.goBack();
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'menu');

    await page.locator('#continue-game').click();
    await choosePlanet(page, 'caldera-v1');
    await expect(page.locator('.campaign-card')).toHaveCount(1);
    await expect(page.locator('.campaign-card')).toContainText('Caldera first landing');
    await choosePlanet(page, 'vesper-v1');
    await expect(page.locator('.campaign-card')).toHaveCount(1);
    await expect(page.locator('.campaign-card')).toContainText('Vesper crossing with a deliberately long name');
    const arrow = await page.locator('#planet-next').boundingBox();
    expect(arrow.x + arrow.width / 2).toBeGreaterThan(viewport.width * .9);
    if (!mobile) expect((await page.locator('.save-view').boundingBox()).width).toBeLessThan(viewport.width * .45);
    await page.screenshot({ path: info.outputPath('entry-continue.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'menu');
    await page.locator('#join-game').click();
    const code = page.locator('#join input[name=code]');
    await code.fill('INVALID-CODE');
    if (mobile) await page.setViewportSize({ width: 390, height: 500 });
    await page.locator('#join button').click();
    await expect(page.locator('#message')).toContainText('Invalid');
    await expect(code).toHaveValue('INVALID-CODE');
    await expect(page.locator('#join button')).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: info.outputPath('entry-join.png'), fullPage: true });
    await page.locator('#back').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'menu');
    expect(errors).toEqual([]);
  });
});

test('a failed decorative canvas does not block login, guest access or menu forms', async ({ browser }, info) => {
  await fixture(browser, async ({ base, context }) => {
    const client = await context({ viewport: { width: 390, height: 844 } });
    await client.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    const page = await client.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await expect(page.locator('#login-form')).toBeVisible();
    await page.locator('#guest').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'join');
    await expect(page.locator('#identity')).toContainText('Guest visitor');
    await expect(page.locator('#new-game')).toBeHidden();
    const historyLength = await page.evaluate(() => history.length);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'join');
    await page.locator('#join input[name=code]').fill('BAD-CODE');
    await page.locator('#join button').click();
    await expect(page.locator('#message')).toContainText('Invalid');
    await page.screenshot({ path: info.outputPath('entry-renderer-fallback.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
});

test('account mode changes keep the live scene and paused refresh keeps its planet camera', async ({ browser }, info) => {
  await fixture(browser, async ({ base, context, account, post }) => {
    const client = await context({ viewport: { width: 1280, height: 900 } });
    const page = await client.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const painting = () => page.locator('canvas.entry-scene').evaluate(canvas => canvas.toDataURL());
    await page.goto(base + '/login/');
    await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
    const firstFrame = await painting();
    await expect.poll(painting).not.toBe(firstFrame);
    // Keyboard pause avoids changing pointer parallax while taking the baseline.
    await page.locator('#motion').focus(); await page.keyboard.press('Space');
    await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
    const pausedFrame = await painting();
    await page.evaluate(() => { window.entryCanvasBeforeMode = document.querySelector('canvas.entry-scene'); });
    await page.locator('#demo-mode').click();
    await expect(page.locator('#demo-mode')).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => window.entryCanvasBeforeMode === document.querySelector('canvas.entry-scene'))).toBe(true);
    expect(await painting()).toBe(pausedFrame);

    const sentModes = [];
    await page.route('**/api/auth/login', async route => {
      sentModes.push(route.request().postDataJSON().kind);
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Mode serialization rehearsal.' }) });
    });
    await page.locator('#login-form input[name=email]').fill('test@frontier.test');
    await page.locator('#login-form input[name=password]').fill('mode rehearsal password only');
    await page.locator('#login-form button').first().click();
    await expect(page.locator('#message')).toContainText('Mode serialization rehearsal');
    await page.locator('#email-mode').click();
    await expect(page.locator('#email-mode')).toHaveAttribute('aria-current', 'page');
    await page.locator('#login-form input[name=email]').fill('test@example.com');
    await page.locator('#login-form input[name=password]').fill('mode rehearsal password only');
    await page.locator('#login-form button').first().click();
    await expect.poll(() => sentModes.length).toBe(2);
    expect(sentModes).toEqual(['demo', 'email']);
    expect(await painting()).toBe(pausedFrame);
    await page.unroute('**/api/auth/login');

    await page.reload();
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
    await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
    expect(await painting()).toBe(pausedFrame);
    await page.screenshot({ path: info.outputPath('entry-persistent-login.png'), fullPage: true });

    await account(client);
    await post(client, '/api/campaigns/create', { name: 'Persistent Vesper camera', template: 'vesper-v1' });
    await page.goto(base + '/campaigns/');
    await page.locator('#continue-game').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-planet', 'vesper-v1');
    const continueFrame = await painting();
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'continue');
    await expect(page.locator('.campaign-card')).toContainText('Persistent Vesper camera');
    await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
    expect(await painting()).toBe(continueFrame);
    await page.screenshot({ path: info.outputPath('entry-persistent-continue.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
});

test('blocked browser storage leaves animated entry and guest forms usable', async ({ browser }) => {
  await fixture(browser, async ({ base, context }) => {
    const client = await context({ viewport: { width: 390, height: 844 } });
    await client.addInitScript(() => {
      for (const name of ['sessionStorage', 'localStorage']) Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException('Storage disabled for this rehearsal.', 'SecurityError'); } });
    });
    const page = await client.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/login/');
    await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
    await page.locator('#demo-mode').click();
    await expect(page.locator('#demo-mode')).toHaveAttribute('aria-current', 'page');
    await page.locator('#guest').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'join');
    await page.locator('#join input[name=code]').fill('BAD-CODE');
    await page.locator('#join button').click();
    await expect(page.locator('#message')).toContainText('Invalid');
    await expect(page.locator('#join button')).toBeEnabled();
    expect(errors).toEqual([]);
  });
});

test('planet arrows jump the ship between worlds, including rapid presses and reduced motion', async ({ browser }, info) => {
  await fixture(browser, async ({ base, context, account }) => {
    const client = await context({ viewport: { width: 1280, height: 900 } });
    await account(client);
    // Observe the actual scene's globe destinations without a renderer-only test
    // API. Offscreen texture generation and the sky's larger buffers are ignored.
    await client.addInitScript(() => {
      const sources = new WeakMap(); let nextId = 1;
      const originalFill = CanvasRenderingContext2D.prototype.fillRect;
      const originalDraw = CanvasRenderingContext2D.prototype.drawImage;
      window.entryGlobeFrames = [];
      CanvasRenderingContext2D.prototype.fillRect = function(x, y, width, height) {
        if (this.canvas.classList.contains('entry-scene') && x === 0 && y === 0 && width === innerWidth && height === innerHeight) {
          window.entryGlobeFrames.push({ planets: [] });
          if (window.entryGlobeFrames.length > 300) window.entryGlobeFrames.shift();
        }
        return originalFill.apply(this, arguments);
      };
      CanvasRenderingContext2D.prototype.drawImage = function(source, x, y, width, height) {
        if (this.canvas.classList.contains('entry-scene') && source instanceof HTMLCanvasElement && [128, 256, 320, 448].includes(source.width) && source.width === source.height && arguments.length === 5) {
          if (!sources.has(source)) sources.set(source, nextId++);
          window.entryGlobeFrames.at(-1)?.planets.push({ source: sources.get(source), x: x + width / 2, y: y + height / 2, r: width / 2 });
        }
        return originalDraw.apply(this, arguments);
      };
    });
    const page = await client.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/campaigns/#view=new&planet=caldera-v1');
    await expect(page.locator('#planet-next')).toBeEnabled();
    await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
    const latest = () => page.evaluate(() => window.entryGlobeFrames.at(-1)?.planets || []);
    const geometry = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return { x: parseFloat(style.getPropertyValue('--entry-planet-x')), y: parseFloat(style.getPropertyValue('--entry-planet-y')), r: parseFloat(style.getPropertyValue('--entry-planet-r')) };
    });
    const settled = async () => {
      await expect.poll(async () => {
        const bodies = await latest(), main = bodies.reduce((a, b) => !a || b.r > a.r ? b : a, null);
        return main ? Math.max(Math.abs(main.x - geometry.x), Math.abs(main.y - geometry.y), Math.abs(main.r - geometry.r)) : Infinity;
      }).toBeLessThan(3);
    };
    await settled();
    await page.locator('body[data-entry-ship="ready"]').waitFor({ state: 'attached' });
    const body = page.locator('body');
    const mainGlobe = bodies => [...bodies].sort((a, b) => b.r - a.r)[0];
    const atRest = source => expect.poll(async () => {
      const main = mainGlobe(await latest());
      return !!main && (!source || main.source === source) && Math.abs(main.x - geometry.x) < 3 && Math.abs(main.y - geometry.y) < 3 && Math.abs(main.r - geometry.r) < 1;
    }).toBe(true);
    const jumpTo = async (direction, template, capture) => {
      const before = mainGlobe(await latest());
      await page.evaluate(id => { window.entryGlobeFrames = []; document.getElementById(id).click(); }, direction > 0 ? 'planet-next' : 'planet-prev');
      await expect(body).toHaveAttribute('data-entry-planet', template);
      await expect(body).toHaveAttribute('data-entry-jump', /charge|streak/);
      if (capture) await page.screenshot({ path: info.outputPath(capture) });
      await expect.poll(async () => mainGlobe(await latest()).source !== before.source).toBe(true);
      await expect.poll(() => body.getAttribute('data-entry-jump')).toBeNull();
      await atRest();
      const frames = await page.evaluate(() => window.entryGlobeFrames);
      const final = frames.at(-1).planets, main = mainGlobe(final);
      const mains = frames.map(frame => mainGlobe(frame.planets)).filter(Boolean);
      // The globes hold still, then swap in a single frame beneath the flash.
      expect(mains.every(globe => Math.abs(globe.r - geometry.r) < 1)).toBe(true);
      const swap = mains.findIndex(globe => globe.source !== before.source);
      expect(swap).toBeGreaterThan(0);
      expect(mains.slice(swap).every(globe => globe.source === main.source)).toBe(true);
      expect(final).toHaveLength(3);
      // The world the ship just left stays behind it in the sky.
      expect(final.some(globe => globe.source !== main.source && (globe.x - geometry.x) * direction < -100 && globe.r < geometry.r * .35)).toBe(true);
      return main.source;
    };
    const vesperSource = await jumpTo(1, 'vesper-v1', 'entry-planet-jump-right.png');
    const calderaSource = await jumpTo(-1, 'caldera-v1', 'entry-planet-jump-left.png');
    await jumpTo(1, 'vesper-v1');
    await jumpTo(1, 'sirocco-v1', 'entry-planet-jump-sirocco.png');
    await jumpTo(1, 'caldera-v1');
    // Quick presses before the swap only change the destination of this jump.
    await page.evaluate(() => {
      window.entryGlobeFrames = [];
      window.entryReversalDone = false;
      document.getElementById('planet-next').click();
      setTimeout(() => document.getElementById('planet-prev').click(), 100);
      setTimeout(() => { document.getElementById('planet-next').click(); window.entryReversalDone = true; }, 200);
    });
    await page.waitForFunction(() => window.entryReversalDone);
    await expect(page.locator('body')).toHaveAttribute('data-entry-planet', 'vesper-v1');
    await expect.poll(() => body.getAttribute('data-entry-jump')).toBeNull();
    await atRest(vesperSource);
    expect((await latest())).toHaveLength(3);
    // A press during the arrival waits its turn, then jumps again without teleporting.
    await page.evaluate(() => { document.getElementById('planet-prev').click(); });
    await page.waitForFunction(() => !document.body.dataset.entryJump);
    await page.evaluate(() => { window.entryGlobeFrames = []; document.getElementById('planet-next').click(); });
    await expect(body).toHaveAttribute('data-entry-planet', 'vesper-v1');
    await expect(body).toHaveAttribute('data-entry-jump', /.+/);
    await expect.poll(() => body.getAttribute('data-entry-jump'), { timeout: 8000 }).toBeNull();
    await atRest(vesperSource);
    expect(calderaSource).not.toBe(vesperSource);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => { window.entryGlobeFrames = []; document.getElementById('planet-prev').click(); });
    await expect(page.locator('body')).toHaveAttribute('data-entry-planet', 'caldera-v1');
    await settled();
    expect(await body.getAttribute('data-entry-jump')).toBeNull();
    const pausedFrames = await page.evaluate(() => window.entryGlobeFrames);
    expect(pausedFrames.length).toBeGreaterThan(0);
    expect(pausedFrames.every(frame => frame.planets.length === 3 && frame.planets.some(body => Math.abs(body.r - geometry.r) < 1))).toBe(true);
    const pausedPainting = await page.locator('canvas.entry-scene').evaluate(canvas => canvas.toDataURL());
    await page.screenshot({ path: info.outputPath('entry-planet-jump-reduced-motion.png') });
    expect(await page.locator('canvas.entry-scene').evaluate(canvas => canvas.toDataURL())).toBe(pausedPainting);
    expect(errors).toEqual([]);
  });
});

for (const viewport of [{ width: 1920, height: 1080, label: 'desktop' }, { width: 390, height: 844, label: 'phone' }]) test(`the pod waits for admission, then dives and fades into the game on ${viewport.label}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  await fixture(browser, async ({ base, context, account }) => {
    const { width, height, label } = viewport, phone = label === 'phone';
    const client = await context({ viewport: { width, height }, isMobile: phone, hasTouch: phone }); await account(client);
    await client.addInitScript(() => {
      window.coverFade = [];
      const sample = () => { const cover = document.getElementById('arrival'); if (cover && !cover.hidden) window.coverFade.push(Number(getComputedStyle(cover).opacity)); requestAnimationFrame(sample); };
      requestAnimationFrame(sample);
      // Reshading a globe mid-flight is what the zoom turns into a low frame rate.
      const put = CanvasRenderingContext2D.prototype.putImageData; window.flightBakes = 0;
      CanvasRenderingContext2D.prototype.putImageData = function() { if (document.body?.dataset.entryDrop) window.flightBakes++; return put.apply(this, arguments); };
    });
    const page = await client.newPage(), errors = [], body = page.locator('body');
    page.on('pageerror', error => errors.push(error.message));
    // The first entry is held open, so the sequence can be seen waiting for the server.
    let release, entries = 0; const held = new Promise(resolve => { release = resolve; });
    await page.route('**/api/campaigns/enter', async route => { if (!entries++) await held; await route.continue(); });
    await page.goto(base + '/campaigns/'); await page.locator('#new-game').click();
    await page.locator('body[data-entry-ship="ready"]').waitFor({ state: 'attached' });
    await page.locator('#select-planet').click(); await page.locator('#campaign-name').fill('Dive rehearsal');
    await page.screenshot({ path: info.outputPath(`dive-${label}-hover.png`) });
    await page.locator('#create-submit').click();
    await expect(body).toHaveAttribute('data-entry-drop', 'zoom');
    await expect(body).toHaveClass(/entry-diving/);
    await expect(page.locator('#dive-skip')).toBeVisible();
    // Past the zoom's 1.5 seconds with no answer: the pod has not left.
    await page.waitForFunction(start => performance.now() - start > 2200, await page.evaluate(() => performance.now()));
    await expect(body).toHaveAttribute('data-entry-drop', 'zoom');
    await page.screenshot({ path: info.outputPath(`dive-${label}-zoom.png`) });
    release();
    await expect(body).toHaveAttribute('data-entry-drop', 'release', { timeout: 5000 });
    await page.waitForFunction(() => document.body.dataset.entryDrop === 'dive', null, { timeout: 5000 });
    // At most the first sample of each of the three globes, across several seconds of flight.
    expect(await page.evaluate(() => window.flightBakes)).toBeLessThanOrEqual(3);
    await page.screenshot({ path: info.outputPath(`dive-${label}-dive.png`) });
    await page.waitForURL(/campaign=/, { timeout: 15000 });
    await expect(page.locator('#connection')).toContainText('live', { timeout: 10000 });
    // The black cover lifts by itself, and never takes the pointer from the game.
    await expect(page.locator('#loading')).toHaveClass(/hidden/);
    await expect(page.locator('#arrival')).toHaveCount(0, { timeout: 5000 });
    const fade = await page.evaluate(() => window.coverFade);
    expect(fade[0]).toBeGreaterThan(.9); expect(fade.at(-1)).toBeLessThan(.2);
    expect(fade.some(opacity => opacity > .25 && opacity < .75)).toBe(true);
    await page.screenshot({ path: info.outputPath(`dive-${label}-game.png`) });
    expect(errors).toEqual([]);
  });
});

test('a refused entry pulls the camera back and a key skips the dive', async ({ browser }, info) => {
  test.setTimeout(60000);
  await fixture(browser, async ({ base, context, account }) => {
    const client = await context({ viewport: { width: 1280, height: 900 } }); await account(client);
    const page = await client.newPage(), errors = [], body = page.locator('body');
    page.on('pageerror', error => errors.push(error.message));
    let refuse = true;
    await page.route('**/api/campaigns/enter', route => refuse ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'The room is full.' }) }) : route.continue());
    await page.goto(base + '/campaigns/'); await page.locator('#new-game').click();
    await page.locator('#select-planet').click(); await page.locator('#campaign-name').fill('Refused rehearsal');
    await page.locator('#create-submit').click();
    await expect(page.locator('#message')).toContainText('The room is full.');
    await expect.poll(() => body.getAttribute('data-entry-drop')).toBeNull();
    await expect(body).not.toHaveClass(/entry-diving/);
    await expect(page.locator('#dive-skip')).toBeHidden();
    await expect(page.locator('#lobby')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: info.outputPath('dive-refused.png') });
    // Skipping: any key, whether the server answers before or after it.
    refuse = false;
    await page.locator('.campaign-card').getByRole('button', { name: 'Enter Refused rehearsal', exact: true }).click();
    await page.keyboard.press('Space');
    await page.waitForURL(/campaign=/, { timeout: 3500 });
    await expect(page.locator('#connection')).toContainText('live', { timeout: 10000 });
    // Return to a room already open: no second dive.
    await page.goto(base + '/campaigns/#view=continue&planet=caldera-v1');
    await page.locator('.campaign-card').getByRole('button', { name: 'Return Refused rehearsal', exact: true }).click();
    await page.waitForURL(/campaign=/, { timeout: 3000 });
    await page.locator('#leave').waitFor({ state: 'detached' });
    expect(errors).toEqual([]);
    // Slow or failed loading keeps words on the black cover.
    const failing = await client.newPage();
    await failing.route('**/api/world*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Offline rehearsal.' }) }));
    await failing.goto(base + '/?legacy=1');
    await expect(failing.locator('#loading strong')).toHaveText('Uplink unavailable', { timeout: 10000 });
    await expect(failing.locator('#loading strong')).toHaveCSS('opacity', '1');
    await expect(failing.locator('#arrival')).toBeHidden();
  });
});

test('reduced motion enters a campaign with no dive', async ({ browser }) => {
  await fixture(browser, async ({ base, context, account }) => {
    const client = await context({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); await account(client);
    const page = await client.newPage(), errors = [], drops = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('noteDrop', value => drops.push(value));
    await page.goto(base + '/campaigns/'); await page.locator('#new-game').click();
    await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => new MutationObserver(() => window.noteDrop(document.body.dataset.entryDrop || '')).observe(document.body, { attributes: true, attributeFilter: ['data-entry-drop'] }));
    await page.locator('#select-planet').click(); await page.locator('#campaign-name').fill('Still rehearsal');
    await page.locator('#create-submit').click();
    await page.waitForURL(/campaign=/, { timeout: 4000 });
    await expect(page.locator('#connection')).toContainText('live', { timeout: 10000 });
    expect(drops).toEqual([]); expect(errors).toEqual([]);
  });
});

test('Vesper creation is saved once when admission fails, then Continue enters that same save', async ({ browser }) => {
  test.setTimeout(45000);
  await fixture(browser, async ({ base, context, account }) => {
    const client = await context(); await account(client);
    const page = await client.newPage();
    let createRequests = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/campaigns/create' && request.method() === 'POST') createRequests++; });
    await page.route('**/api/campaigns/enter', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Both active campaign slots are in use. Close a room before opening another.' }) }), { times: 1 });
    await page.goto(base + '/campaigns/');
    await page.locator('#new-game').click(); await choosePlanet(page, 'vesper-v1');
    await page.locator('#select-planet').click();
    await page.locator('#create input[name=name]').fill('Saved Vesper rehearsal');
    await page.locator('#create button').dblclick();
    await expect(page.locator('#message')).toContainText('Both active campaign slots');
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'continue');
    await expect(page.locator('.campaign-card')).toContainText('Saved Vesper rehearsal');
    const saved = await (await client.request.get(base + '/api/campaigns/list')).json();
    expect(saved.campaigns).toHaveLength(1); expect(saved.campaigns[0].template).toBe('vesper-v1');
    expect(createRequests).toBe(1);
    await page.locator('.campaign-card').getByRole('button', { name: 'Enter Saved Vesper rehearsal', exact: true }).click();
    await page.keyboard.press('Shift');
    await expect(page.locator('#connection')).toContainText('live', { timeout: 10000 });
    expect(new URL(page.url()).searchParams.get('campaign')).toBe(saved.campaigns[0].id);
    // Browser Back must recover controls even when the browser restores the
    // document that navigated while its submission buttons were disabled.
    await page.goBack();
    await expect(page.locator('#active')).toBeVisible();
    await expect(page.locator('#back')).toBeEnabled();
    await expect(page.locator('#resume')).toHaveAttribute('href', '/?campaign=' + saved.campaigns[0].id);
    const expectClearTitle = async () => {
      const room = await page.locator('#active').boundingBox(), title = await page.locator('#planet-heading').boundingBox();
      const intersects = room.x < title.x + title.width && room.x + room.width > title.x && room.y < title.y + title.height && room.y + room.height > title.y;
      expect(intersects, 'Current-room controls must not cover the planet name').toBe(false);
    };
    await expectClearTitle();
    await page.locator('#back').click(); await page.locator('#new-game').click();
    await expect(page.locator('#active')).toBeHidden();
    await page.locator('#back').click(); await page.locator('#continue-game').click();
    await expect(page.locator('#active')).toBeVisible();
    await page.locator('#resume').click();
    await expect(page.locator('#connection')).toContainText('live');
    expect(new URL(page.url()).searchParams.get('campaign')).toBe(saved.campaigns[0].id);
  });
});
