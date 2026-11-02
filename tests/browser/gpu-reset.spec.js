import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Average brightness of the battlefield, read from the canvas the player sees.
const brightness = page => page.evaluate(() => {
  const probe = document.createElement('canvas'), c = probe.getContext('2d', { willReadFrequently: true });
  probe.width = 192; probe.height = 108; c.drawImage(document.getElementById('world-canvas'), 0, 0, 192, 108);
  const data = c.getImageData(0, 0, 192, 108).data; let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
  return sum / (data.length / 4) / 3;
});

test('a GPU reset brings the battlefield back', async ({ browser }) => {
  test.setTimeout(45000);
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-gpu-reset-')), app = createApp({ dataDir, logSink: () => {} }); let context;
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '/?legacy=1'); await expect(page.locator('#connection')).toContainText('live');
    const landed = await page.evaluate(async () => (await fetch('/api/cores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 60, y: 30 }) })).status);
    expect(landed).toBe(201);
    await expect.poll(async () => (await (await page.request.get(url + '/api/world')).json()).me.deploying, { timeout: 8000, intervals: [100] }).toBe(false);
    await page.waitForTimeout(1000);
    const before = await brightness(page);
    const reloaded = page.waitForEvent('load', { timeout: 15000 });
    await (await browser.newBrowserCDPSession()).send('Browser.crashGpuProcess');
    await reloaded; await expect(page.locator('#connection')).toContainText('live');
    await expect.poll(() => brightness(page), { timeout: 10000, intervals: [250] }).toBeGreaterThan(before * .8);
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-gpu-reset-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
