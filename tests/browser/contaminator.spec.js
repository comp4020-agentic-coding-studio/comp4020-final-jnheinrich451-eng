import { artilleryAim } from '../../public/rail.js';
import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';

for (const mobile of [false, true]) test(`contaminator concealment, heavy aim and saved conquest ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(60000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-contaminator-')), contexts = [], logs = [];
  let app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port, base = `http://127.0.0.1:${port}`;
    const owner = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const guest = await browser.newContext(); contexts.push(owner, guest);
    const post = async (c, route, data) => { const r = await c.request.post(base + route, { data, headers: { Origin: base } }); expect(r.status()).toBeLessThan(300); return r.json(); };
    const credentials = { name: 'Modifier tester', email: 'modifier@frontier.test', password: 'unique modifier password 123!', kind: 'demo' };
    await post(owner, '/api/auth/register', credentials);
    const inbox = await (await owner.request.get(base + '/api/auth/inbox')).json();
    await post(owner, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] }); await post(owner, '/api/auth/login', credentials);
    const { id } = await post(owner, '/api/campaigns/create', { name: 'Modifier rehearsal' }); await post(owner, '/api/campaigns/enter', { id });
    const state = async () => (await owner.request.get(base + `/api/campaign-world/${id}/world`)).json();
    const initial = await state(), site = initial.combat.sites.find(s => s.kind === 'contaminator'); expect(site).toBeTruthy();
    await post(owner, '/api/campaigns/leave', {});
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
      world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      // Isolate terrain/conquest visuals; domain checks cover guards and calls.
      // Newer campaigns seed several contaminators and settlements. Conquer every other site so O can only select this one, and list it
      // first: with nothing selected (after a reload) the objective panel falls back to the first site.
      for (const s of saved.sites) { s.guardsRemaining = 0; s.nextCall = 1e9; if(s.kind === 'mortar') s.mortar = { angle: 0, nextShot: 1e9, charge: null }; if(s.kind === 'contaminator') s.hp = 140; if (s.id !== site.id) Object.assign(s, { hp: 0, state: 'conquered', conqueredAt: -100000 }); }
      saved.sites.sort((a, b) => (b.id === site.id) - (a.id === site.id));
      if (saved.director) Object.assign(saved.director, { nextRaid: 1e9, nextPulse: 1e9 });
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
      const tank = { id: 'modifier-tank', owner: initial.me.id, occupant: initial.me.id, health: 200, hurt: 0,
        x: site.x + 1.5, y: site.y - 6.5, podX: 40, podY: 40, elapsed: 99, angle: Math.PI, turret: Math.PI, weapon: 'HE', secondary: 'APCR' };
      db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('test-core', initial.me.id, 10, 10, 99);
      const gun = { id: 'fog-cannon', owner: initial.me.id, x: site.x - 31, y: site.y + 1, shape: 'EW', angle: Math.PI / 2, aim: Math.PI / 2, elevation: 75, target: { x: site.x + 1.5, y: site.y + 1.5 }, move: null, brace: 0, reload: 0, operator: null, lease: 0, input: null, inputTime: 0, ammo: 'HE' };
      Object.assign(gun, artilleryAim(gun, gun.target)); gun.aim = gun.angle;
      db.prepare('INSERT INTO artillery VALUES (?,?)').run(gun.id, JSON.stringify(gun));
      for(let x=gun.x-1;x<=gun.x+1;x++) db.prepare('INSERT INTO rails VALUES (?,?,?,?)').run(x,gun.y,'EW',initial.me.id);
    } finally { db.close(); }
    await post(owner, '/api/campaigns/enter', { id });
    const page = await owner.newPage(), peer = await guest.newPage(), errors = [];
    for (const p of [page, peer]) {
      p.on('pageerror', e => errors.push(e.message));
      await p.addInitScript(() => { const Original = window.EventSource; window.EventSource = class extends Original { constructor(...args) { super(...args); this.addEventListener('message', e => { try { window.lastBattle = JSON.parse(e.data); } catch {} }); } }; });
    }
    await page.goto(base + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    const invite = await post(owner, '/api/campaigns/invite', { id }), admitted = await post(guest, '/api/campaigns/join', { code: invite.code });
    await peer.goto(base + admitted.next); await expect(peer.locator('#connection')).toContainText('live'); await page.bringToFront();
    // Named site locators are gone. O selects the nearest hostile site, and this contaminator is the only one left.
    await page.locator('#world-canvas').focus(); await page.keyboard.press('o');
    await expect(page.locator('#combat-status')).toContainText('Air contaminator');
    await expect(page.locator('#fog-status')).toBeVisible();
    await expect(page.locator('#objective-health')).toContainText('Surveyed center');
    const terrain = (await state()).world.terrain;
    const box = await page.locator('#world-canvas').boundingBox(), target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const pixels = () => page.locator('#world-canvas').evaluate(c => Array.from(c.getContext('2d').getImageData(c.width/2-25,c.height/2-25,50,50).data));
    // Reduced-effects fog must still cover the ground reticle and the emitter.
    if (mobile) await page.touchscreen.tap(target.x + 60, target.y); else await page.mouse.move(target.x + 60, target.y);
    await page.waitForTimeout(250); const withoutAim = await pixels();
    if (mobile) await page.touchscreen.tap(target.x, target.y); else await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(250); expect(await pixels()).toEqual(withoutAim);
    const minimapPixel = () => page.locator('#minimap').evaluate((c, point) => Array.from(c.getContext('2d').getImageData(Math.floor(point.x*c.width/point.w),Math.floor(point.y*c.height/point.h),1,1).data), { x: site.x + 1.5, y: site.y + 1.5, w: initial.world.width, h: initial.world.height });
    expect(await minimapPixel()).toEqual([114, 80, 102, 255]);
    await page.screenshot({ path: info.outputPath('contaminator-ground.png') });
    // The same opaque texture covers every underlying pixel in both effects modes.
    expect(await page.evaluate(async () => {
      const { drawContamination } = await import('/contaminator-effects.js');
      for (const reduced of [true,false]) for(const scale of [2,8,20]) {
        const c = document.createElement('canvas'); c.width=c.height=100; const x=c.getContext('2d');
        const site={ kind:'contaminator',state:'hostile',x:50/scale-1.5,y:50/scale-1.5 };
        const sample=color=>{x.fillStyle=color;x.fillRect(0,0,100,100);drawContamination(x,[site],scale,12345,reduced);return Array.from(x.getImageData(40,40,20,20).data).join(',');};
        if(sample('#ff0000')!==sample('#00ff00')) return false;
      }
      return true;
    })).toBe(true);
    await post(owner, '/api/campaign-world/' + id + '/tanks/exit', {});
    await post(owner, '/api/campaign-world/' + id + '/artillery/control', { id: 'fog-cannon' });
    await expect(page.locator('#facility-controls')).toBeVisible();
    await page.locator('#world-canvas').focus(); await page.keyboard.press('o');
    if (mobile) await page.touchscreen.tap(target.x, target.y); else await page.mouse.move(target.x,target.y);
    await page.waitForTimeout(1300);
    expect(await pixels()).not.toEqual(withoutAim);
    await page.screenshot({ path: info.outputPath('contaminator-heavy-aim.png') });
    await page.locator('#artillery-fire').click();
    // The shell flies for its saved duration (about 7 s at this elevation); wait for that flight plus margin.
    await expect.poll(async () => (await state()).combat.salvos.length).toBe(1);
    const flight = (await state()).combat.salvos[0].duration;
    await expect.poll(async () => (await state()).combat.sites.find(s => s.kind === 'contaminator').state, { timeout: flight * 1000 + 4000 }).toBe('conquered');
    await expect.poll(() => peer.evaluate(() => window.lastBattle?.combat.sites.find(s => s.kind === 'contaminator').state)).toBe('conquered');
    await expect(page.locator('#objective-health')).toContainText('Air clear', { timeout: 10000 });
    await expect(page.locator('#fog-status')).toBeHidden();
    await expect.poll(minimapPixel).not.toEqual([114, 80, 102, 255]);
    await page.screenshot({ path: info.outputPath('contaminator-cleared.png') });
    const completed = (await state()).combat.sites.find(s => s.kind === 'contaminator').conqueredAt;
    expect((await state()).world.terrain).toEqual(terrain);
    expect(logs.some(e => e.event === 'objective.conquered' && e.targetId === site.id && e.saved)).toBe(true);
    await post(owner, '/api/campaigns/leave', {});
    await expect(page).toHaveURL(/\/campaigns\//); await expect(peer).toHaveURL(/\/campaigns\//);
    await Promise.all([page.goto('about:blank'), peer.goto('about:blank')]); await app.close();
    app = createApp({ dataDir: dir, logSink: line => logs.push(JSON.parse(line)) });
    await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    await post(owner, '/api/campaigns/enter', { id }); await page.goto(base + '/?campaign=' + id);
    await expect(page.locator('#connection')).toContainText('live');
    // After a reload nothing is selected, so the panel falls back to the first site, which is this contaminator.
    // (Hostile-only O cannot select a conquered site.)
    await expect(page.locator('#objective-health')).toContainText('Air clear');
    // Campaigns now seed several contaminators, so check this one by id rather than expecting it to be the only one.
    expect((await state()).combat.sites.find(s => s.id === site.id)).toMatchObject({ hp: 0, state: 'conquered', conqueredAt: completed });
    // In a campaign the objective detail (#objective-health) is hidden until a site is selected, and O cannot select a
    // conquered site, so after the reload only the mission bar itself can be checked at laptop size.
    if(!mobile) { await page.setViewportSize({width:1280,height:720}); await expect(page.locator('#mission-bar')).toBeVisible(); const bar = await page.locator('#mission-bar').boundingBox(); expect(bar.x + bar.width).toBeLessThanOrEqual(1280); expect(bar.y + bar.height).toBeLessThanOrEqual(720); }
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(c => c.close())); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-contaminator-')) throw Error('Unexpected test directory');
    await rm(dir, { recursive: true, force: true });
  }
});
