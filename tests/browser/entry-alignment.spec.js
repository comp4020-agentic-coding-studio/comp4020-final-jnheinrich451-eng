import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

// Exercise the real room lifecycle in an isolated save registry. The canvas
// observer records its painted geometry, rather than trusting CSS target data.
async function fixture(browser, viewport, run) {
  const prefix = path.join(tmpdir(), 'frontier-entry-alignment-');
  const dataDir = await mkdtemp(prefix);
  const app = createApp({ dataDir, logSink: () => {} });
  let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const value = await response.json();
      expect(response.ok(), JSON.stringify(value)).toBe(true);
      return value;
    };
    const credentials = { name: 'Alignment Pilot', email: 'alignment@frontier.test', password: 'isolated alignment password 123!', kind: 'demo' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', credentials);
    await context.addInitScript(() => {
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      window.entryAlignmentBodies = [];
      CanvasRenderingContext2D.prototype.fillRect = function(x, y, width, height) {
        if (this.canvas.classList.contains('entry-scene') && x === 0 && y === 0 && width === innerWidth && height === innerHeight) window.entryAlignmentBodies = [];
        return fill.apply(this, arguments);
      };
      CanvasRenderingContext2D.prototype.drawImage = function(source, x, y, width, height) {
        if (this.canvas.classList.contains('entry-scene') && source instanceof HTMLCanvasElement && [128, 256, 320, 448].includes(source.width) && source.width === source.height && arguments.length === 5) {
          const m = this.getTransform(), box = this.canvas.getBoundingClientRect();
          const sx = box.width / this.canvas.width, sy = box.height / this.canvas.height;
          window.entryAlignmentBodies.push({
            x: box.x + (m.a * (x + width / 2) + m.c * (y + height / 2) + m.e) * sx,
            y: box.y + (m.b * (x + width / 2) + m.d * (y + height / 2) + m.f) * sy,
            r: Math.hypot(m.a * width * sx, m.b * width * sy) / 2,
          });
        }
        return draw.apply(this, arguments);
      };
    });
    await run({ base, context, post });
  } finally {
    await context?.close();
    await app.close();
    const resolved = path.resolve(dataDir);
    if (!resolved.startsWith(path.resolve(prefix))) throw new Error('Refusing to remove a directory outside the isolated test prefix.');
    await rm(resolved, { recursive: true, force: true });
  }
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = id => {
      const element = document.getElementById(id);
      if (!element || element.hidden) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      globe: [...window.entryAlignmentBodies].sort((a, b) => b.r - a.r)[0],
      title: rect('planet-heading'), select: rect('select-planet'), active: rect('active'),
      scroll: scrollY, view: document.body.dataset.entryView,
    };
  });
}

async function aligned(page, mobile) {
  await expect.poll(async () => {
    const { globe, title } = await geometry(page);
    return globe && title ? Math.abs(title.x + title.width / 2 - globe.x) : Infinity;
  }, { message: 'The planet name stays centered over the actual painted globe.' }).toBeLessThan(4);
  const { globe, title, select, active, view } = await geometry(page);
  if (view === 'new') {
    const gap = select.y - globe.y - globe.r;
    expect(gap, 'Select remains just below the painted globe, including any room notice.').toBeGreaterThanOrEqual(mobile ? 12 : 14);
    expect(gap, 'Room notices must not be added twice to the Select offset.').toBeLessThanOrEqual(mobile ? 30 : 32);
  }
  if (active) {
    const overlap = active.x < title.x + title.width && active.x + active.width > title.x && active.y < title.y + title.height && active.y + active.height > title.y;
    expect(overlap, 'Current-room controls must remain clear of the planet name.').toBe(false);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function titleOffset(page) {
  const { globe, title } = await geometry(page);
  return title.y - (globe.y - globe.r);
}

for (const viewport of [
  { width: 1280, height: 900, label: 'laptop' },
  { width: 390, height: 844, label: 'phone' },
  { width: 1280, height: 720, label: 'short desktop' },
]) test(`current-room controls stay in Continue and preserve planet alignment on ${viewport.label}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const mobile = viewport.width <= 760;
  await fixture(browser, { width: viewport.width, height: viewport.height }, async ({ base, context, post }) => {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/campaigns/#view=new&planet=caldera-v1');
    await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
    await expect(page.locator('#select-planet')).toBeEnabled();
    await aligned(page, mobile);
    const initialTitleOffset = await titleOffset(page);

    const campaign = await post('/api/campaigns/create', { name: 'Layout room rehearsal', template: 'caldera-v1' });
    await post('/api/campaigns/enter', { id: campaign.id });
    await page.reload();
    await expect(page.locator('#active')).toBeHidden();
    await expect(page.locator('#select-planet')).toBeEnabled();
    await expect(page.locator('#save-limit')).not.toContainText('Save and leave');
    await expect(page.locator('#create-room-help')).toBeHidden();
    await aligned(page, mobile);
    expect(Math.abs(await titleOffset(page) - initialTitleOffset), 'Opening a room does not move the New Game title or globe.').toBeLessThan(3);
    await page.screenshot({ path: info.outputPath('new-game-current-room.png'), fullPage: true });

    await page.locator('#select-planet').click();
    await expect(page.locator('#create-panel')).toBeVisible();
    await expect(page.locator('#create-room-help')).toBeVisible();
    await expect(page.locator('#create-submit')).toBeDisabled();
    await expect(page.locator('#active')).toBeHidden();

    // Scrolling is still supported while decorative animation is paused. Both
    // foreground globe and controls move with the page; the distant sky does not.
    const before = await geometry(page);
    await page.evaluate(() => scrollTo(0, 130));
    await expect.poll(async () => (await geometry(page)).scroll).toBeGreaterThan(0);
    await expect.poll(async () => {
      const after = await geometry(page);
      return Math.abs((after.globe.y - before.globe.y) + after.scroll - before.scroll);
    }).toBeLessThan(3);
    await aligned(page, mobile);
    await page.screenshot({ path: info.outputPath('new-game-current-room-scrolled.png') });
    await page.reload();
    await expect(page.locator('#active')).toBeHidden();
    await expect(page.locator('#create-room-help')).toBeHidden();
    await expect(page.locator('#select-planet')).toBeEnabled();
    await expect(page.locator('body')).toHaveAttribute('data-scene-ready', 'canvas');
    await aligned(page, mobile);
    await page.locator('#planet-next').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-planet', 'vesper-v1');
    await aligned(page, mobile);

    await page.locator('#back').click();
    await expect(page.locator('#active')).toBeHidden();
    await page.locator('#new-game').click();
    await page.locator('#select-planet').click();
    await expect(page.locator('#create-submit')).toBeDisabled();
    await page.locator('#create-room-continue').click();
    await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'continue');
    await expect(page.locator('#active')).toBeVisible();
    await expect(page.locator('#resume')).toHaveAttribute('href', '/?campaign=' + campaign.id);
    await aligned(page, mobile);
    const continueTitleOffset = await titleOffset(page);
    await page.screenshot({ path: info.outputPath('continue-current-room.png'), fullPage: true });
    await page.locator('#leave').click();
    await expect(page.locator('#active')).toBeHidden();
    await expect(page.locator('#message')).toContainText('Progress saved');
    await aligned(page, mobile);
    expect(Math.abs(await titleOffset(page) - continueTitleOffset), 'Replacing the room controls with a saved notice preserves title placement.').toBeLessThan(3);
    await page.screenshot({ path: info.outputPath('continue-room-left.png'), fullPage: true });
    await page.locator('#back').click();
    await page.locator('#new-game').click();
    await expect(page.locator('#select-planet')).toBeEnabled();
    await expect(page.locator('#message')).toBeHidden();
    await aligned(page, mobile);
    await page.locator('#select-planet').click();
    await expect(page.locator('#create-room-help')).toBeHidden();
    await expect(page.locator('#create-submit')).toBeEnabled();
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 100 });
    await aligned(page, mobile);
    expect(errors).toEqual([]);
  });
});
