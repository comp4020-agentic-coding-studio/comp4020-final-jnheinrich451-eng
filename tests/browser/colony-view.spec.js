import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';
import { COLONY_DEPTH, colonyWorldToScreen, colonyScreenDelta } from '../../public/colony-view.js';

test('tilted garden picks and builds after zoom and pan; worker faces all four directions', async ({ browser }, info) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-view-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const post = async (route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const result = await response.json(); expect(response.ok(), JSON.stringify(result)).toBe(true); return result;
    };
    const account = { name: 'Field botanist', email: 'botanist@frontier.test', password: 'a disposable camera test 123!', kind: 'demo' };
    await post('/api/auth/register', account);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post('/api/auth/login', account);
    const saved = await post('/api/campaigns/create', { name: 'White greenhouse', mode: 'colonization' });
    const entered = await post('/api/campaigns/enter', { id: saved.id });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + entered.next);
    await expect(page.locator('#place-bed-gift')).toBeEnabled();
    await page.locator('#place-bed-gift').click();
    await expect(page.locator('[data-plant=sundrop]')).toBeVisible();
    await page.locator('#inspector-close').click();
    const camera = { x: 32.5, y: 31.5 + 1.2 / COLONY_DEPTH, tile: 45 * 1.18 };
    await page.locator('#colony-zoom-in').click();
    await page.mouse.move(650, 730); await page.mouse.down();
    await page.mouse.move(730, 695, { steps: 5 }); await page.mouse.up();
    const delta = colonyScreenDelta(80, -35, camera); camera.x -= delta.x; camera.y -= delta.y;
    await page.locator('#tool-inspect').click();
    await page.locator('#place-sprinkler').click();
    const placement = colonyWorldToScreen({ x: 34.5, y: 32.5 }, camera, 1440, 960);
    await page.mouse.move(placement.x, placement.y);
    await expect(page.locator('#placement-reason')).toContainText('12 materials');
    await page.mouse.click(placement.x, placement.y);
    const world = async () => (await context.request.get(base + `/api/campaign-world/${saved.id}/world`)).json();
    await expect.poll(async () => (await world()).colony.sprinklers.length).toBe(1);
    expect((await world()).colony.sprinklers[0]).toMatchObject({ x: 34, y: 32 });
    await page.locator('#inspector-close').click();
    const bed = colonyWorldToScreen({ x: 32.5, y: 31.5 }, camera, 1440, 960);
    await page.mouse.click(bed.x, bed.y);
    await expect(page.locator('[data-plant=moonberry]')).toBeVisible();
    await page.locator('[data-plant=moonberry]').click();
    await page.locator('#inspector-close').click();
    // This is an actual live scene with the compact HUD and a saved garden.
    await page.screenshot({ path: info.outputPath('colony-white-metal-scene.png'), fullPage: true });
    for (const [key, heading] of [['w', 0], ['d', Math.PI / 2], ['s', Math.PI], ['a', -Math.PI / 2]]) {
      const before = (await world()).me;
      await page.locator('#colony-canvas').focus(); await page.keyboard.down(key);
      await expect.poll(async () => { const after = (await world()).me; return Math.hypot(after.x - before.x, after.y - before.y); }).toBeGreaterThan(.2);
      await page.keyboard.up(key);
      const angle = (await world()).me.angle;
      expect(Math.abs(Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading)))).toBeLessThan(.01);
    }
    // Review plate draws the real runtime worker, not a replacement concept asset.
    await page.evaluate(async () => {
      const { drawColonyRobot } = await import('/colony-robot.js');
      const canvas = document.createElement('canvas'); canvas.id = 'worker-review';
      canvas.width = 1280; canvas.height = 430; canvas.style.cssText = 'position:fixed;inset:0;width:1280px;height:430px;z-index:100;background:#f7f7ef';
      document.body.append(canvas); const c = canvas.getContext('2d'); c.fillStyle = '#f7f7ef'; c.fillRect(0, 0, 1280, 430);
      for (const [i, angle] of [Math.PI, Math.PI / 2, 0, -Math.PI / 2].entries()) {
        c.save(); c.translate(160 + i * 320, 275); c.scale(105, 105);
        drawColonyRobot(c, { x: 0, y: 0, angle, vx: 0, vy: 0, name: 'Botanist' }, 0, true, true); c.restore();
        c.fillStyle = '#3a4547'; c.font = '18px sans-serif'; c.textAlign = 'center'; c.fillText(['Front', 'Right', 'Rear', 'Left'][i], 160 + i * 320, 355);
      }
    });
    await page.locator('#worker-review').screenshot({ path: info.outputPath('agricultural-worker-directions.png') });
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-view-')) throw Error('Unsafe fixture directory');
    await rm(dir, { recursive: true, force: true });
  }
});
