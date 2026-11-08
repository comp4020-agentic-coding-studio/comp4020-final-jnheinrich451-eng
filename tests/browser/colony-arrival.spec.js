import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

// These rehearsals own a temporary registry and world directory. They never
// open a developer save or send real mail.
async function fixture(browser, mobile, run, reducedMotion = 'no-preference') {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-arrival-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 }, isMobile: mobile, hasTouch: mobile, reducedMotion });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const value = await response.json(); expect(response.ok(), JSON.stringify(value)).toBe(true); return value;
    };
    const credentials = { name: 'Shuttle Keeper', email: 'shuttle@frontier.test', password: 'isolated controlled flight password 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    // Observe actual sprite painting, not just successful network requests.
    await context.addInitScript(() => {
      window.arrivalDraws = {};
      window.arrivalFrame = [];
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function(x, y, width, height) {
        // A frame starts with a plain full clear; the descent's light grade fills the frame too, but blended.
        if (this.canvas.classList.contains('entry-scene') && this.globalCompositeOperation === 'source-over' && x === 0 && y === 0 && width >= innerWidth && height >= innerHeight) window.arrivalFrame = [];
        return fill.apply(this, arguments);
      };
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(source) {
        if (source instanceof HTMLImageElement && /mycorrhizal/.test(source.src)) {
          const name = source.src.split('/').pop();
          window.arrivalDraws[name] = (window.arrivalDraws[name] || 0) + 1;
          if (this.canvas.classList.contains('entry-scene') && this.globalAlpha > 0) window.arrivalFrame.push(name);
        }
        return draw.apply(this, arguments);
      };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await run({ base, context, page, post, errors });
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-arrival-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
}

const worlds = [['Morrow', 'morrow-v1'], ['Nacre', 'nacre-v1'], ['Aurelia', 'aurelia-v1']];
const colonyUrl = (base, view = 'new', planet = 'morrow-v1') => `${base}/campaigns/#view=${view}&mode=colonization&planet=${planet}`;
async function carrierPainted(page) {
  await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
  await expect(page.locator('body')).toHaveAttribute('data-entry-carrier', 'mycorrhizal');
  await expect.poll(() => page.evaluate(() => Object.entries(window.arrivalDraws).some(([name, count]) => name === 'mycorrhizal-white-gold-top-v1.png' && count > 0))).toBe(true);
  await expect.poll(() => page.evaluate(() => Object.entries(window.arrivalDraws).some(([name, count]) => name.includes('shuttle') && count > 0))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.arrivalFrame.filter(name => name === 'mycorrhizal-shuttle-top-v1.png').length)).toBe(2);
}
async function liveGarden(page) {
  await page.waitForURL('**/colony/?campaign=*', { timeout: 18000 });
  await expect(page.locator('#colony-loading')).toBeHidden();
  await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
}

for (const mobile of [false, true]) test(`MYCORRHIZAL follows each peaceful destination in New and Continue / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(90000);
  await fixture(browser, mobile, async ({ base, page, post }) => {
    for (const [name, template] of worlds) await post('/api/campaigns/create', { name: `${name} garden`, template, mode: 'colonization' });
    const civilianImages = [];
    page.on('request', request => { if (/\/assets\/entry\/mycorrhizal/.test(request.url())) civilianImages.push(request.url()); });
    if (!mobile) {
      await page.goto(base + '/campaigns/');
      await expect(page.locator('body')).toHaveAttribute('data-entry-mode', 'combat');
      await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
      await expect(page.locator('body')).toHaveAttribute('data-entry-ship', 'ready');
      expect(civilianImages).toEqual([]);
      await page.locator('#colonization-game').click();
      await page.locator('#new-expedition').click();
    }
    // Reduced motion retains a real, static carrier; the normal animation
    // route is exercised by the two flight rehearsals below.
    for (const view of ['new', 'continue']) {
      if (mobile || view !== 'new') await page.goto(colonyUrl(base, view));
      for (const [name, template] of worlds) {
        await expect(page.locator('#planet-heading')).toHaveText(name);
        await expect(page.locator('body')).toHaveAttribute('data-entry-planet', template);
        await carrierPainted(page);
        if (view === 'continue') await expect(page.locator('.campaign-card')).toContainText(`${name} garden`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`white-gold-carrier-${view}-${template}-${mobile ? 'phone' : 'desktop'}.png`), fullPage: true });
        await page.evaluate(() => { window.arrivalDraws = {}; });
        await page.locator('#planet-next').click();
      }
      // The two art layers load once per document, not again for every planet.
      if (!mobile && view === 'new') expect(civilianImages).toHaveLength(2);
    }
  }, 'reduce');
});

for (const mobile of [false, true]) test(`civilian shuttle waits for admission then flies into the garden / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(90000);
  await fixture(browser, mobile, async ({ base, page, post }) => {
    let release; const gate = new Promise(resolve => { release = resolve; });
    let pending = false;
    await page.route('**/api/campaigns/enter', async route => { pending = true; await gate; await route.continue(); });
    try {
      await page.goto(colonyUrl(base));
      await carrierPainted(page);
      await page.locator('#select-planet').click();
      await page.locator('#campaign-name').fill('Controlled arrival');
      await page.locator('#create-submit').click();
      const body = page.locator('body');
      await expect(body).toHaveClass(/entry-diving/);
      await expect(body).toHaveAttribute('data-entry-arrival', 'civilian');
      await expect.poll(() => pending).toBe(true);
      // A deliberate slow server response must never release a shuttle or
      // navigate to a garden before the player has actually been admitted.
      await page.waitForFunction(start => performance.now() - start > 2300, await page.evaluate(() => performance.now()));
      await expect(body).toHaveAttribute('data-entry-drop', 'zoom');
      expect(new URL(page.url()).pathname).toBe('/campaigns/');
      expect(await page.evaluate(() => window.arrivalFrame.filter(name => name === 'mycorrhizal-shuttle-top-v1.png').length)).toBe(2);
      await page.screenshot({ path: info.outputPath(`white-gold-shuttle-${mobile ? 'phone' : 'desktop'}-waiting.png`) });
      release();
      await expect(body).toHaveAttribute('data-entry-drop', 'release', { timeout: 7000 });
      await page.waitForFunction(start => performance.now() - start > 450, await page.evaluate(() => performance.now()));
      await page.screenshot({ path: info.outputPath(`white-gold-shuttle-${mobile ? 'phone' : 'desktop'}-release.png`) });
      await expect(body).toHaveAttribute('data-entry-drop', 'dive', { timeout: 7000 });
      await page.waitForFunction(start => performance.now() - start > 850, await page.evaluate(() => performance.now()));
      await page.screenshot({ path: info.outputPath(`white-gold-shuttle-${mobile ? 'phone' : 'desktop'}-atmosphere.png`) });
      // The second shuttle stays with the receding carrier. Only the released
      // shuttle accompanies the camera through the rest of the approach.
      await expect.poll(() => page.evaluate(() => window.arrivalFrame.filter(name => name === 'mycorrhizal-shuttle-top-v1.png').length)).toBe(1);
      await page.screenshot({ path: info.outputPath(`white-gold-shuttle-${mobile ? 'phone' : 'desktop'}-approach.png`) });
      await liveGarden(page);
      await page.screenshot({ path: info.outputPath(`white-gold-shuttle-${mobile ? 'phone' : 'desktop'}-garden.png`) });
      if (!mobile) {
        const id = new URL(page.url()).searchParams.get('campaign');
        await post('/api/campaigns/leave', {});
        await page.goto(colonyUrl(base, 'continue'));
        await carrierPainted(page);
        await page.getByRole('button', { name: 'Enter Controlled arrival', exact: true }).click();
        await expect(body).toHaveAttribute('data-entry-arrival', 'civilian');
        await expect(body).toHaveAttribute('data-entry-drop', 'release', { timeout: 7000 });
        await expect(body).toHaveAttribute('data-entry-drop', 'dive', { timeout: 7000 });
        await liveGarden(page);
        expect(new URL(page.url()).searchParams.get('campaign')).toBe(id);
      }
    } finally { release(); }
  });
});

test('refused civilian entry preserves one save; Continue supports skip and reduced motion', async ({ browser }, info) => {
  test.setTimeout(90000);
  await fixture(browser, false, async ({ base, context, page, post }) => {
    let refuse = true, creations = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/campaigns/create' && request.method() === 'POST') creations++; });
    await page.route('**/api/campaigns/enter', route => refuse ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Arrival temporarily unavailable.' }) }) : route.continue());
    await page.goto(colonyUrl(base, 'new', 'nacre-v1'));
    await carrierPainted(page);
    await page.locator('#select-planet').click();
    await page.locator('#campaign-name').fill('One peaceful save');
    await page.locator('#create-submit').click();
    const body = page.locator('body');
    await expect(page.locator('#message')).toContainText('Arrival temporarily unavailable.');
    await expect(body).toHaveAttribute('data-entry-view', 'continue');
    await expect.poll(() => body.getAttribute('data-entry-drop')).toBeNull();
    await expect(body).not.toHaveClass(/entry-diving/);
    await expect(page.locator('#dive-skip')).toBeHidden();
    await expect(page.locator('#lobby')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: info.outputPath('white-gold-shuttle-refused-return.png') });
    expect(creations).toBe(1);
    const listing = await (await context.request.get(base + '/api/campaigns/list')).json();
    expect(listing.campaigns).toHaveLength(1);
    expect(listing.campaigns[0]).toMatchObject({ name: 'One peaceful save', mode: 'colonization', template: 'nacre-v1' });
    const id = listing.campaigns[0].id;
    refuse = false;
    await page.getByRole('button', { name: 'Enter One peaceful save', exact: true }).click();
    await expect(body).toHaveClass(/entry-diving/);
    await page.keyboard.press('Space');
    await page.waitForURL('**/colony/?campaign=*', { timeout: 5000 });
    await liveGarden(page);
    expect(new URL(page.url()).searchParams.get('campaign')).toBe(id);
    expect(creations).toBe(1);
    await post('/api/campaigns/leave', {});
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(colonyUrl(base, 'continue', 'nacre-v1'));
    await carrierPainted(page);
    await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
    const phases = [];
    await page.exposeFunction('noteColonyPhase', value => phases.push(value));
    await page.evaluate(() => new MutationObserver(() => window.noteColonyPhase(document.body.dataset.entryDrop || '')).observe(document.body, { attributes: true, attributeFilter: ['data-entry-drop'] }));
    await page.getByRole('button', { name: 'Enter One peaceful save', exact: true }).click();
    await page.waitForURL('**/colony/?campaign=*', { timeout: 5000 });
    await liveGarden(page);
    expect(new URL(page.url()).searchParams.get('campaign')).toBe(id);
    expect(phases).toEqual([]);
  });
});
