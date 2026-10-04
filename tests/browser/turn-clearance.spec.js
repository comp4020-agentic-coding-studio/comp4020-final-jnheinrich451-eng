import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false, true]) test(`south turn clears the nearby scout on ${mobile ? 'phone' : 'desktop'}`, async ({ browser }) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-clearance-')); let app = createApp({ dataDir }), context, other;
  try {
    // Isolated reproduction of the reported positions, never the user's database.
    await app.close();
    const owner = randomUUID(), peerId = randomUUID(), token = randomUUID(), peerToken = randomUUID(), id = randomUUID();
    const db = new DatabaseSync(path.join(dataDir, 'world.sqlite'));
    db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token, owner, 'Scout 01', 22.328, 17.98, 0);
    db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(peerToken, peerId, 'Scout 02', 27.827, 16.5, 0);
    for (let x = 19; x <= 24; x++) db.prepare('INSERT INTO rails VALUES (?,?,?,?)').run(x, 13, 'EW', owner);
    db.prepare('INSERT INTO rails VALUES (?,?,?,?)').run(25, 13, 'CSW', owner);
    for (let y = 14; y <= 18; y++) db.prepare('INSERT INTO rails VALUES (?,?,?,?)').run(25, y, 'NS', owner);
    db.prepare('INSERT INTO artillery VALUES (?,?)').run(id, JSON.stringify({ id, owner, x: 25, y: 13, shape: 'EW', heading: 1, angle: Math.PI / 2, aim: Math.PI / 2, brace: 0, reload: 0, move: null }));
    db.close(); app = createApp({ dataDir }); await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    other = await browser.newContext(); await context.addCookies([{ name: 'frontier', value: token, url }]); await other.addCookies([{ name: 'frontier', value: peerToken, url }]);
    const peer = await other.newPage(), page = await context.newPage(), errors = [];
    for (const p of [page, peer]) p.on('pageerror', e => errors.push(e.message));
    await peer.goto(url); await page.goto(url); await page.bringToFront(); await expect(page.locator('#connection')).toContainText('live');
    const state = p => p.evaluate(async () => (await (await fetch('/api/world')).json()));
    const status = await page.evaluate(async id => (await fetch('/api/artillery/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })).status, id);
    expect(status).toBe(200); await expect(page.locator('#facility-controls')).toBeVisible();
    if (mobile) { const r = await page.locator('[data-direction="down"]').boundingBox(); await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); }
    else { await page.locator('#world-canvas').focus(); await page.keyboard.down('s'); }
    await expect.poll(async () => (await state(peer)).artillery[0].y, { intervals: [50] }).toBe(14);
    if (mobile) await page.mouse.up(); else await page.keyboard.up('s');
    const during = await state(peer); expect(during.artillery[0].move.fromShape).toBe('EW');
    expect(during.me.x).toBeCloseTo(27.827, 3); expect(during.me.y).toBe(16.5);
    await expect.poll(async () => (await state(peer)).artillery[0].move).toBeNull();
    await peer.reload(); const after = await state(peer); expect(after.me.x).toBeCloseTo(27.827, 3); expect(after.me.y).toBe(16.5);
    expect(after.artillery[0].shape).toBe('NS'); expect(after.artillery[0].driveBlocked).toBeFalsy();
    await page.screenshot({ path: `docs/previews/turn-clearance-${mobile ? 'mobile' : 'desktop'}.png` });
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await other?.close(); await app.close();
    if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-clearance-')) throw new Error('Unexpected test directory');
    await rm(dataDir, { recursive: true, force: true });
  }
});
