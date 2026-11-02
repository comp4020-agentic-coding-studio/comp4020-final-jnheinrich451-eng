import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

async function fixture(browser, mobile, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-destination-arrival-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const value = await response.json(); expect(response.ok(), JSON.stringify(value)).toBe(true); return value;
    };
    const credentials = { name: 'Arrival Keeper', email: 'destination@frontier.test', password: 'isolated destination arrival password 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    await context.addInitScript(() => {
      window.destinationFrame = { planets: [] };
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function(x, y, width, height) {
        if (this.canvas.classList.contains('entry-scene') && x === 0 && y === 0 && width >= innerWidth && height >= innerHeight) window.destinationFrame = { planets: [] };
        return fill.apply(this, arguments);
      };
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(source, x, y, width, height) {
        if (this.canvas.classList.contains('entry-scene')) {
          if (source instanceof HTMLCanvasElement && [128, 256, 320, 448].includes(source.width) && source.width === source.height && arguments.length === 5) window.destinationFrame.planets.push({ r: width / 2 });
          if (source instanceof HTMLImageElement && source.src.includes('mycorrhizal-white-gold-top')) {
            const m = this.getTransform();
            window.destinationFrame.carrier = { x: m.e, y: m.f, angle: Math.atan2(m.b, m.a), scale: Math.hypot(m.a, m.b), length: arguments[7], alpha: this.globalAlpha };
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
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-destination-arrival-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
}

async function ready(page) {
  await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
  await expect(page.locator('body')).toHaveAttribute('data-entry-carrier', 'mycorrhizal');
  await expect.poll(() => page.evaluate(() => window.destinationFrame.carrier?.alpha || 0)).toBeGreaterThan(.9);
}
async function settled(page, name) {
  await expect.poll(() => page.locator('body').getAttribute('data-entry-planet-pending'), { timeout: 7000 }).toBeNull();
  await expect.poll(() => page.locator('body').getAttribute('data-entry-colony-travel')).toBeNull();
  await expect(page.locator('#planet-heading')).toHaveText(name);
}
const destinationCopy = page => page.evaluate(() => Object.fromEntries(['planet-heading', 'designation', 'planet-description', 'planet-facts', 'select-planet', 'create-detail'].map(id => [id, document.getElementById(id).textContent])));

async function enginePixels(page) {
  return page.evaluate(async () => {
    const captures = [];
    for (let frame = 0; frame < 16; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const canvas = document.querySelector('canvas.entry-scene'), ship = window.destinationFrame.carrier;
      if (!canvas || !ship || ship.alpha < .9) continue;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0, strength = 0;
      // Independently sample the open space aft of the cropped hull. The white
      // hull and blue planet elsewhere cannot satisfy these plume samples.
      const length = ship.length * ship.scale;
      for (let forward = -.73 * length; forward < -.49 * length; forward += 1) for (let side = -.085 * length; side < .085 * length; side += 1) {
        const x = Math.round(ship.x + Math.cos(ship.angle) * forward - Math.sin(ship.angle) * side);
        const y = Math.round(ship.y + Math.sin(ship.angle) * forward + Math.cos(ship.angle) * side);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
        const offset = (y * canvas.width + x) * 4, red = pixels[offset], green = pixels[offset + 1], blue = pixels[offset + 2];
        if (blue > 100 && blue > red + 25 && blue > green + 8) { count++; strength += blue - red; }
      }
      captures.push({ count, strength });
    }
    return captures;
  });
}

for (const mobile of [false, true]) test(`destination copy commits on arrival and creates the reached world / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  await fixture(browser, mobile, async ({ base, page, context }) => {
    const label = mobile ? 'phone' : 'desktop', body = page.locator('body'), creations = [];
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/campaigns/create') creations.push(request.postDataJSON()); });
    await page.route('**/api/campaigns/enter', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Isolated admission pause.' }) }));
    await page.goto(base + '/campaigns/#view=new&mode=colonization&planet=morrow-v1');
    await ready(page);
    await expect.poll(() => page.evaluate(() => {
      const actual = Math.max(...window.destinationFrame.planets.map(planet => planet.r));
      const expected = parseFloat(getComputedStyle(document.body).getPropertyValue('--entry-planet-r'));
      return Math.abs(actual - expected);
    })).toBeLessThan(1);
    const scale = await page.evaluate(compact => {
      const globe = Math.max(...window.destinationFrame.planets.map(planet => planet.r));
      const previousLength = Math.max(compact ? 150 : 280, Math.min(compact ? 210 : 450, globe * (compact ? 1.04 : 1.18)));
      return { previousLength, renderedLength: window.destinationFrame.carrier.length, ratio: window.destinationFrame.carrier.length / previousLength };
    }, mobile);
    expect(scale.ratio).toBeCloseTo(.8, 3);
    const engines = await enginePixels(page);
    expect(engines.length).toBeGreaterThan(10);
    expect(engines.every(frame => frame.count > (mobile ? 2 : 8))).toBe(true);
    expect(new Set(engines.map(frame => frame.strength)).size).toBeGreaterThan(3);
    await writeFile(info.outputPath(`destination-${label}-carrier.json`), JSON.stringify({ scale, engines }, null, 2));
    await page.screenshot({ path: info.outputPath(`destination-${label}-blue-engines.png`) });

    await page.locator('#select-planet').click();
    await page.locator('#campaign-name').fill('Arrive before creating');
    const before = await destinationCopy(page);
    await page.evaluate(() => document.getElementById('planet-next').click());
    await expect(body).toHaveAttribute('data-entry-planet-pending', 'nacre-v1');
    await expect(body).toHaveAttribute('data-entry-colony-travel', /turn|depart/);
    expect(await destinationCopy(page)).toEqual(before);
    await expect(page.locator('#select-planet')).toBeDisabled();
    await expect(page.locator('#create-submit')).toBeDisabled();
    await expect(page.locator('#campaign-name')).toBeDisabled();
    await page.evaluate(() => document.getElementById('create').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await expect(body).toHaveAttribute('data-entry-colony-travel', 'depart');
    expect(await destinationCopy(page)).toEqual(before);
    expect(creations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`destination-${label}-depart-old-words.png`) });
    await page.evaluate(() => {
      document.getElementById('planet-next').click();
      setTimeout(() => document.getElementById('planet-prev').click(), 100);
    });
    await expect(body).toHaveAttribute('data-entry-planet-pending', 'nacre-v1');
    await expect(body).toHaveAttribute('data-entry-colony-travel', 'arrive');
    expect(await destinationCopy(page)).toEqual(before);
    await settled(page, 'Nacre');
    expect(await destinationCopy(page)).not.toEqual(before);
    await expect(page.locator('#select-planet')).toHaveText('Select Nacre');
    await expect(page.locator('#select-planet')).toBeEnabled();
    await page.screenshot({ path: info.outputPath(`destination-${label}-arrived-new-words.png`) });
    await page.locator('#select-planet').click();
    await page.locator('#campaign-name').fill('Reached Nacre');
    await page.locator('#create-submit').click();
    await expect(page.locator('#message')).toContainText('Isolated admission pause.');
    expect(creations).toHaveLength(1);
    expect(creations[0]).toMatchObject({ template: 'nacre-v1', mode: 'colonization' });
    const listing = await (await context.request.get(base + '/api/campaigns/list')).json();
    expect(listing.campaigns).toHaveLength(1);
    expect(listing.campaigns[0]).toMatchObject({ template: 'nacre-v1', name: 'Reached Nacre' });
  });
});

for (const mobile of [false, true]) test(`Continue keeps its departing save group and unlocks every exit path / ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  await fixture(browser, mobile, async ({ base, page, post }) => {
    const label = mobile ? 'phone' : 'desktop', body = page.locator('body'), mutations = [];
    for (const [name, template] of [['Morrow', 'morrow-v1'], ['Nacre', 'nacre-v1']]) await post('/api/campaigns/create', { name: `${name} garden`, template, mode: 'colonization' });
    page.on('request', request => { if (request.method() === 'POST' && /\/api\/campaigns\/(?:enter|delete)$/.test(new URL(request.url()).pathname)) mutations.push(request.url()); });
    await page.goto(base + '/campaigns/#view=continue&mode=colonization&planet=morrow-v1');
    await ready(page);
    await expect(page.locator('.campaign-card')).toContainText('Morrow garden');
    await page.evaluate(() => document.getElementById('planet-next').click());
    await expect(body).toHaveAttribute('data-entry-planet-pending', 'nacre-v1');
    await expect(body).toHaveAttribute('data-entry-colony-travel', /turn|depart/);
    await expect(page.locator('#planet-heading')).toHaveText('Morrow');
    await expect(page.locator('.campaign-card')).toContainText('Morrow garden');
    await expect(page.getByRole('button', { name: 'Enter Morrow garden', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Delete Morrow garden', exact: true })).toBeDisabled();
    await page.evaluate(() => { document.querySelector('.campaign-actions button').click(); document.querySelector('.delete-campaign').click(); });
    await expect(body).toHaveAttribute('data-entry-colony-travel', 'depart');
    await expect(page.locator('.campaign-card')).toContainText('Morrow garden');
    expect(mutations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`destination-${label}-continue-depart.png`) });
    await settled(page, 'Nacre');
    await expect(page.locator('.campaign-card')).toContainText('Nacre garden');
    await expect(page.getByRole('button', { name: 'Enter Nacre garden', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Delete Nacre garden', exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath(`destination-${label}-continue-arrived.png`) });

    // Keep a same-view history entry, then abandon the pending destination.
    // Its late renderer completion must not lock or overwrite the restored save.
    await page.evaluate(() => history.pushState({ ...history.state }, '', location.href));
    await page.locator('#planet-next').click();
    await expect(body).toHaveAttribute('data-entry-planet-pending', 'aurelia-v1');
    await page.goBack();
    await settled(page, 'Nacre');
    await expect(page.getByRole('button', { name: 'Enter Nacre garden', exact: true })).toBeEnabled();

    await page.locator('#planet-next').click();
    await expect(body).toHaveAttribute('data-entry-planet-pending', 'aurelia-v1');
    await page.locator('#back').click();
    await expect(body).toHaveAttribute('data-entry-view', 'colony');
    await expect.poll(() => body.getAttribute('data-entry-planet-pending')).toBeNull();
    await page.locator('#continue-expedition').click();
    await settled(page, 'Morrow');
    await page.locator('#planet-next').click();
    await expect(body).toHaveAttribute('data-entry-planet-pending', 'nacre-v1');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settled(page, 'Nacre');
    await expect(page.getByRole('button', { name: 'Enter Nacre garden', exact: true })).toBeEnabled();

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function() {
        if (this.canvas.classList.contains('entry-scene')) { CanvasRenderingContext2D.prototype.drawImage = draw; throw new Error('Isolated pending travel failure'); }
        return draw.apply(this, arguments);
      };
      document.getElementById('planet-next').click();
    });
    await expect(body).toHaveAttribute('data-scene-ready', 'fallback');
    await settled(page, 'Aurelia');
    await page.locator('#planet-prev').click();
    await settled(page, 'Nacre');
    await expect(page.getByRole('button', { name: 'Enter Nacre garden', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Delete Nacre garden', exact: true })).toBeEnabled();
    expect(mutations).toEqual([]);
  });
});
