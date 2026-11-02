import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

async function fixture(browser, mobile, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-voyage-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const value = await response.json(); expect(response.ok(), JSON.stringify(value)).toBe(true); return value;
    };
    const credentials = { name: 'Voyage Keeper', email: 'voyage@frontier.test', password: 'isolated civilian voyage password 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    await context.addInitScript(() => {
      window.voyageFrames = [];
      let frame, nextSource = 1;
      const sources = new WeakMap();
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function(x, y, width, height) {
        if (this.canvas.classList.contains('entry-scene') && x === 0 && y === 0 && width >= innerWidth && height >= innerHeight) {
          frame = { planets: [], ships: [], view: document.body.dataset.entryView, planet: document.body.dataset.entryPlanet }; window.voyageFrames.push(frame);
          if (window.voyageFrames.length > 700) window.voyageFrames.shift();
        }
        return fill.apply(this, arguments);
      };
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(source, x, y, width, height) {
        if (frame && this.canvas.classList.contains('entry-scene')) {
          if (source instanceof HTMLCanvasElement && [128, 256, 320, 448].includes(source.width) && source.width === source.height && arguments.length === 5) {
            if (!sources.has(source)) sources.set(source, nextSource++);
            frame.planets.push({ source: sources.get(source), x: x + width / 2, y: y + height / 2, r: width / 2 });
          }
          if (source instanceof HTMLImageElement && source.src.includes('mycorrhizal-white-gold-top')) {
            const transform = this.getTransform();
            frame.ships.push({ x: transform.e, y: transform.f, angle: Math.atan2(transform.b, transform.a), alpha: this.globalAlpha });
          }
        }
        return draw.apply(this, arguments);
      };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await run({ base, page, context, post });
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-voyage-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
}

const noTransition = page => expect.poll(() => page.evaluate(() => [document.body.dataset.entryWormhole, document.body.dataset.entryWormholeDirection, document.body.dataset.entryColonyTravel, document.body.dataset.entryJump].filter(Boolean))).toEqual([]);
const warmReady = async page => {
  await expect(page.locator('body')).toHaveAttribute('data-entry-theme', 'colony-gold');
  await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
  await expect(page.locator('body')).toHaveAttribute('data-entry-colony-ship', 'ready');
};
const mainGlobe = planets => planets.reduce((largest, value) => !largest || value.r > largest.r ? value : largest, null);

// Count bright isolated points outside the central lens in the final canvas.
// Repainting star commands behind an opaque cover would not satisfy this check.
const visibleOuterStars = page => page.locator('canvas.entry-scene').evaluate(canvas => {
  const { width, height } = canvas, bytes = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  const light = (x, y) => { const offset = (y * width + x) * 4; return Math.max(bytes[offset], bytes[offset + 1], bytes[offset + 2]); };
  const step = 3, central = Math.min(width, height) * .3; let stars = 0;
  for (let y = step; y < height - step; y++) for (let x = step; x < width - step; x++) {
    if (Math.hypot(x - width * .5, y - height * .48) < central) continue;
    const value = light(x, y);
    if (value > 80 && value > light(x - step, y) + 25 && value > light(x + step, y) + 25 && value > light(x, y - step) + 25 && value > light(x, y + step) + 25) stars++;
  }
  return stars;
});

for (const mobile of [false, true]) test(`civilian system entry and smooth planet voyages / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(90000);
  await fixture(browser, mobile, async ({ base, page }) => {
    const body = page.locator('body'), label = mobile ? 'phone' : 'desktop';
    await page.goto(base + '/campaigns/');
    await expect(body).toHaveAttribute('data-entry-theme', 'combat-blue');
    await expect(body).toHaveAttribute('data-scene-ready', 'canvas');
    await noTransition(page);
    await page.screenshot({ path: info.outputPath(`white-gold-${label}-combat-before.png`) });
    await page.locator('#colonization-game').click();
    await expect(body).toHaveAttribute('data-entry-wormhole', 'collapse');
    await expect(body).toHaveAttribute('data-entry-wormhole-direction', 'gold');
    const goldStarted = await page.evaluate(() => performance.now());
    await page.waitForFunction(start => performance.now() - start > 350, goldStarted);
    await page.screenshot({ path: info.outputPath(`system-return-${label}-gold-collapse-early.png`) });
    await page.waitForFunction(start => performance.now() - start > 600, goldStarted);
    await page.screenshot({ path: info.outputPath(`system-return-${label}-gold-collapse.png`) });
    await page.waitForFunction(() => document.body.dataset.entryWormhole === 'converge');
    expect(await visibleOuterStars(page)).toBeGreaterThan(mobile ? 2 : 5);
    await page.screenshot({ path: info.outputPath(`system-return-${label}-gold-converge.png`) });
    await expect(body).toHaveAttribute('data-entry-wormhole', 'expand');
    await page.screenshot({ path: info.outputPath(`system-return-${label}-gold-expand.png`) });
    await expect.poll(() => body.getAttribute('data-entry-wormhole'), { timeout: 6000 }).toBeNull();
    await warmReady(page);
    await expect(page.locator('#back')).toBeHidden();
    await expect(page.locator('#war-zone')).toContainText('War Zone');
    await page.screenshot({ path: info.outputPath(`white-gold-${label}-civilian-system.png`) });
    await page.locator('#new-expedition').click();
    await expect(page.locator('#planet-heading')).toHaveText('Morrow');
    await expect(body).toHaveAttribute('data-entry-carrier', 'mycorrhizal');
    await noTransition(page);
    await expect.poll(() => page.evaluate(() => {
      const radius = Math.max(...(window.voyageFrames.at(-1)?.planets || []).map(planet => planet.r));
      return Math.abs(radius - parseFloat(getComputedStyle(document.body).getPropertyValue('--entry-planet-r')));
    })).toBeLessThan(1);
    await page.screenshot({ path: info.outputPath(`white-gold-${label}-overhead-orbit.png`) });

    const travel = async (button, name, direction) => {
      const before = mainGlobe(await page.evaluate(() => window.voyageFrames.at(-1)?.planets || []));
      const previousName = await page.locator('#planet-heading').textContent();
      await page.evaluate(id => { window.voyageFrames = []; document.getElementById(id).click(); }, button);
      await expect(body).toHaveAttribute('data-entry-colony-travel', /turn|depart/);
      await expect(page.locator('#planet-heading')).toHaveText(previousName);
      expect(await body.getAttribute('data-entry-jump')).toBeNull();
      expect(await body.getAttribute('data-entry-wormhole')).toBeNull();
      await expect(body).toHaveAttribute('data-entry-colony-travel', 'depart');
      await page.screenshot({ path: info.outputPath(`white-gold-${label}-travel-${direction}-depart.png`) });
      await expect(body).toHaveAttribute('data-entry-colony-travel', 'exchange');
      await page.waitForFunction(start => performance.now() - start > 180, await page.evaluate(() => performance.now()));
      await page.screenshot({ path: info.outputPath(`white-gold-${label}-travel-${direction}-exchange.png`) });
      await expect.poll(() => body.getAttribute('data-entry-colony-travel'), { timeout: 6500 }).toBeNull();
      await expect(page.locator('#planet-heading')).toHaveText(name);
      const frames = await page.evaluate(() => window.voyageFrames), after = mainGlobe(frames.at(-1)?.planets || []);
      expect(before).not.toBeNull(); expect(after).not.toBeNull();
      expect(after.source).not.toBe(before.source);
      // The selected distant globe grows continuously into the foreground;
      // an instantaneous identity swap under a jump flash would fail this.
      expect(frames.some(frame => frame.planets.some(globe => globe.source === after.source && globe.r > after.r * .3 && globe.r < after.r * .9))).toBe(true);
      expect(frames.some(frame => frame.ships.length)).toBe(true);
      await page.screenshot({ path: info.outputPath(`white-gold-${label}-travel-${direction}-settled.png`) });
    };
    await travel('planet-next', 'Nacre', 'right');
    await travel('planet-prev', 'Morrow', 'left');
    await page.evaluate(() => {
      document.getElementById('planet-next').click();
      setTimeout(() => document.getElementById('planet-next').click(), 100);
      setTimeout(() => document.getElementById('planet-prev').click(), 200);
    });
    await expect(page.locator('#planet-heading')).toHaveText('Morrow');
    await expect.poll(() => body.getAttribute('data-entry-colony-travel'), { timeout: 8000 }).toBeNull();
    await expect(page.locator('#planet-heading')).toHaveText('Nacre');
    await expect(body).toHaveAttribute('data-entry-planet', 'nacre-v1');
    await noTransition(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#back').click();
    await expect(body).toHaveAttribute('data-entry-view', 'colony');
    await page.locator('#war-zone').click();
    await expect(body).toHaveAttribute('data-entry-wormhole', 'collapse');
    await expect(body).toHaveAttribute('data-entry-wormhole-direction', 'blue');
    const blueStarted = await page.evaluate(() => performance.now());
    await page.waitForFunction(start => performance.now() - start > 350, blueStarted);
    await page.screenshot({ path: info.outputPath(`system-return-${label}-blue-collapse-early.png`) });
    await page.waitForFunction(start => performance.now() - start > 600, blueStarted);
    await page.screenshot({ path: info.outputPath(`system-return-${label}-blue-collapse.png`) });
    await page.waitForFunction(() => document.body.dataset.entryWormhole === 'converge');
    expect(await visibleOuterStars(page)).toBeGreaterThan(mobile ? 2 : 5);
    await page.screenshot({ path: info.outputPath(`system-return-${label}-blue-converge.png`) });
    await expect(body).toHaveAttribute('data-entry-wormhole', 'expand');
    await page.screenshot({ path: info.outputPath(`system-return-${label}-blue-expand.png`) });
    await noTransition(page);
    await expect(body).toHaveAttribute('data-entry-view', 'menu');
    await expect(body).toHaveAttribute('data-entry-theme', 'combat-blue');
    await page.screenshot({ path: info.outputPath(`system-return-${label}-combat-restored.png`) });
  });
});

for (const mobile of [false, true]) test(`Continue starts Morrow, groups legacy saves and keeps their terrain / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(90000);
  await fixture(browser, mobile, async ({ base, page, context, post }) => {
    const saves = {};
    for (const name of ['Caldera', 'Vesper', 'Sirocco']) saves[name] = await post('/api/campaigns/create', { name: `${name} old garden`, mode: 'colonization', template: `${name.toLowerCase()}-v1` });
    await post('/api/campaigns/enter', { id: saves.Sirocco.id });
    const saved = await (await context.request.get(`${base}/api/campaign-world/${saves.Sirocco.id}/world`)).json();
    expect(saved.world.template).toBe('sirocco-v1');
    await post('/api/campaigns/leave', { id: saves.Sirocco.id });

    await page.goto(base + '/campaigns/#view=new&mode=colonization&planet=aurelia-v1');
    await warmReady(page);
    await expect(page.locator('#planet-heading')).toHaveText('Aurelia');
    await page.locator('#back').click();
    await expect(page.locator('#war-zone')).toBeVisible();
    await page.evaluate(() => { window.voyageFrames = []; });
    await page.locator('#continue-expedition').click();
    await expect(page.locator('#planet-heading')).toHaveText('Morrow');
    await expect.poll(() => page.evaluate(() => window.voyageFrames.filter(frame => frame.view === 'continue' && frame.planet === 'morrow-v1' && frame.ships.some(ship => ship.alpha > .02)).length)).toBeGreaterThan(5);
    const frames = await page.evaluate(() => window.voyageFrames.filter(frame => frame.view === 'continue' && frame.planet === 'morrow-v1' && frame.ships.some(ship => ship.alpha > .02)));
    const first = frames[0], last = frames.at(-1);
    // No single frame may flash the ship over the previous Aurelia composition
    // before the Continue destination settles onto Morrow.
    expect(frames.every(frame => mainGlobe(frame.planets)?.source === mainGlobe(last.planets)?.source)).toBe(true);
    expect(Math.hypot(first.ships[0].x - last.ships[0].x, first.ships[0].y - last.ships[0].y)).toBeLessThan(24);
    await page.screenshot({ path: info.outputPath(`system-return-${mobile ? 'phone' : 'desktop'}-continue-morrow.png`), fullPage: true });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [destination, legacy] of [['Morrow', 'Caldera'], ['Nacre', 'Vesper'], ['Aurelia', 'Sirocco']]) {
      await expect(page.locator('#planet-heading')).toHaveText(destination);
      await expect(page.locator('.campaign-card')).toHaveCount(1);
      await expect(page.locator('.campaign-card')).toContainText(`${legacy} old garden`);
      await expect(page.locator('.campaign-card')).toContainText(`Legacy ${legacy}`);
      await page.locator('#planet-next').click();
    }
    await expect(page.locator('#planet-heading')).toHaveText('Morrow');
    await page.locator('#planet-prev').click();
    await expect(page.locator('#planet-heading')).toHaveText('Aurelia');
    await page.screenshot({ path: info.outputPath(`system-return-${mobile ? 'phone' : 'desktop'}-legacy-sirocco.png`), fullPage: true });
    await page.getByRole('button', { name: 'Enter Sirocco old garden', exact: true }).click();
    await page.waitForURL('**/colony/?campaign=*');
    await expect(page.locator('#colony-loading')).toBeHidden();
    const reopened = await (await context.request.get(`${base}/api/campaign-world/${saves.Sirocco.id}/world`)).json();
    expect(reopened.world.template).toBe('sirocco-v1');
    expect(reopened.world.terrain).toEqual(saved.world.terrain);
    expect(reopened.world.spawn).toEqual(saved.world.spawn);
    await post('/api/campaigns/leave', { id: saves.Sirocco.id });
    for (const [requested, expected] of [['sirocco-v1', 'Aurelia'], ['nacre-v1', 'Nacre'], ['unknown-v1', 'Morrow']]) {
      await page.goto(`${base}/campaigns/#view=continue&mode=colonization&planet=${requested}`);
      await warmReady(page); await noTransition(page);
      await expect(page.locator('#planet-heading')).toHaveText(expected);
      await page.reload();
      await expect(page.locator('#planet-heading')).toHaveText(expected);
      await noTransition(page);
    }
    const listing = await (await context.request.get(base + '/api/campaigns/list')).json();
    expect(listing.campaigns.map(save => save.template).sort()).toEqual(['caldera-v1', 'sirocco-v1', 'vesper-v1']);
  });
});

test('civilian transitions cancel on Back and never replay on reload or reduced motion', async ({ browser }, info) => {
  test.setTimeout(60000);
  await fixture(browser, false, async ({ base, page }) => {
    const body = page.locator('body');
    await page.goto(base + '/campaigns/#view=new&mode=colonization&planet=aurelia-v1');
    await warmReady(page);
    await noTransition(page);
    await page.locator('#planet-next').click();
    await expect(body).toHaveAttribute('data-entry-colony-travel', /.+/);
    await page.locator('#back').click();
    await expect(body).toHaveAttribute('data-entry-view', 'colony');
    await noTransition(page);
    await page.locator('#war-zone').click();
    await expect(body).toHaveAttribute('data-entry-theme', 'combat-blue');
    await noTransition(page);
    await page.locator('#colonization-game').click();
    await expect(body).toHaveAttribute('data-entry-wormhole', 'collapse');
    await page.goBack();
    await expect(body).toHaveAttribute('data-entry-view', 'menu');
    await expect(body).toHaveAttribute('data-entry-theme', 'combat-blue');
    await noTransition(page);
    await page.waitForFunction(start => performance.now() - start > 2000, await page.evaluate(() => performance.now()));
    await noTransition(page);
    await expect(body).toHaveAttribute('data-entry-theme', 'combat-blue');
    await page.goto(base + '/campaigns/#view=new&mode=colonization&planet=aurelia-v1');
    await warmReady(page); await noTransition(page);
    await page.reload();
    await warmReady(page); await noTransition(page);
    await expect(page.locator('#planet-heading')).toHaveText('Aurelia');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#planet-next').click();
    await expect(page.locator('#planet-heading')).toHaveText('Morrow');
    await noTransition(page);
    await page.locator('#back').click(); await page.locator('#war-zone').click();
    await page.locator('#colonization-game').click();
    await warmReady(page); await noTransition(page);
    await page.screenshot({ path: info.outputPath('white-gold-reduced-motion-system.png') });

    // A rendering failure mid-transition must not leave the working menu dimmed.
    await page.locator('#war-zone').click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function() {
        if (this.canvas.classList.contains('entry-scene')) {
          CanvasRenderingContext2D.prototype.drawImage = draw;
          throw new Error('Isolated entry renderer failure');
        }
        return draw.apply(this, arguments);
      };
      document.getElementById('colonization-game').click();
    });
    await expect(body).toHaveAttribute('data-scene-ready', 'fallback');
    await expect(page.locator('canvas.entry-scene')).toHaveCount(0);
    await noTransition(page);
    await expect(page.locator('#war-zone')).toBeVisible();
    await expect.poll(() => page.locator('#colony-view').evaluate(menu => Number(getComputedStyle(menu).opacity))).toBe(1);
    await page.locator('#war-zone').click();
    await expect(body).toHaveAttribute('data-entry-view', 'menu');
    await noTransition(page);
  });
});
