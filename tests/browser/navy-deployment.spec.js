import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { freshLogistics } from '../../public/logistics.js';
import { shipStopped } from '../../public/ship-motion.js';
import { serverState } from './drive-helper.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
for(const mobile of [false,true])test(`coastal ship delivery, sailing, cannon and saved docking on ${mobile?'phone':'desktop'}`,async({browser})=>{
 test.setTimeout(150000);
 const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-navy-browser-'));let app=createApp({dataDir}),context,other;
 await app.close();const db=new DatabaseSync(path.join(dataDir,'world.sqlite')),world=createWorld(),token=randomUUID();
 world.terrain=world.terrain.map((_,i)=>i%48<32?0:2);
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'navy-player','Naval Scout',33.5,12.5,0);
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-navy','navy-player',42,24,4.5);{const l=freshLogistics();l.groundSupplies=100;db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));}db.close();app=createApp({dataDir});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,url=`http://127.0.0.1:${port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});other=await browser.newContext();
  await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),peer=await other.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await peer.goto(url + '/?legacy=1');await page.goto(url + '/?legacy=1');await page.bringToFront();
  const state=p=>p.evaluate(async()=>(await fetch('/api/world')).text()).then(JSON.parse),fast=()=>serverState(page,url);
  await expect(page.locator('#connection')).toContainText('live');await page.locator('#build-mode').click();await page.locator('[data-force-tab="navy"]').click();
  await expect(page.locator('#ship-card')).toBeVisible();await page.locator('#dock-card').click();
  await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').fill('29');await page.locator('#tile-y').fill('12');await page.locator('#select-tile').click();
  await expect(page.locator('#place-building')).toBeEnabled();await page.screenshot({path:`.local/navy-survey-${mobile?'mobile':'desktop'}.png`});
  await page.locator('#place-building').click();await expect(page.locator('#shipyard-interact')).toBeVisible({timeout:7000});await page.locator('#shipyard-interact').click();await page.locator('#yard-build-gunship').click();await expect.poll(async()=>(await state(peer)).ships[0]?.elapsed,{timeout:40000,intervals:[50]}).toBeGreaterThan(1.5);
  await page.screenshot({path:`.local/navy-arrival-${mobile?'mobile':'desktop'}.png`});
  await expect.poll(async()=>(await state(page)).ships[0]?.elapsed,{timeout:75000}).toBe(4.5);
  await expect(page.locator('#yard-board')).toBeEnabled();await page.locator('#yard-board').click();const x0=(await state(page)).ships[0].x;
  await page.locator('#ship-systems-toggle').click();await expect(page.locator('#ship-controls')).toBeVisible();expect((await state(page)).me.body).toBe('ship');
  await page.locator('#world-canvas').focus();// W/S select a persistent throttle step (tap); the opposite tap returns to Stop.
  await page.keyboard.press('w');await expect.poll(async()=>(await fast()).ships[0].x,{timeout:12000,intervals:[50]}).toBeLessThan(x0-1.5);await page.keyboard.press('s');
  const before=await state(peer);expect(before.ships[0].occupant).toBe('navy-player');
  await page.locator('#ship-interact').click();await expect(page.locator('#toast')).toContainText('Stop and align alongside the dock berth');expect((await state(page)).me.body).toBe('ship');
  await page.locator('#world-canvas').focus();await page.keyboard.press('2');await expect(page.locator('[data-ship-shell="INCENDIARY"]')).toHaveAttribute('aria-pressed','true');
  // Keyboard zoom is shared with the other vehicles; aim six or more tiles away.
  await page.keyboard.press('-');await page.keyboard.press('-');await page.keyboard.press('-');await page.keyboard.press('-');
  const viewport=page.viewportSize(),point={x:viewport.width*.5-100,y:viewport.height*.5+50};
  if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.move(point.x,point.y);
  await expect(page.locator('#ship-fire')).toBeEnabled();await page.waitForTimeout(3200);if(mobile)await page.locator('#ship-fire').click();else await page.mouse.click(point.x,point.y);
  await expect.poll(async()=>Math.max(...Object.values((await state(peer)).ships[0].mainReloads))).toBeGreaterThan(0);
  await expect.poll(async()=>(await state(peer)).combat.fields.some(f=>f.weapon==='INCENDIARY'),{timeout:5000}).toBe(true);
  await page.screenshot({path:`.local/navy-sailing-${mobile?'mobile':'desktop'}.png`});
  await app.close();app=createApp({dataDir});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');
  const resumed=await state(page);expect(resumed.me.shipId).toBe(resumed.ships[0].id);expect(resumed.ships[0].ammo).toBe('INCENDIARY');
  // Return in reverse without changing the heading: no automatic teleport to land.
  await page.locator('#world-canvas').focus();await page.keyboard.press('s');await expect.poll(async()=>{const q=(await fast()).ships[0];return q.x+1.5*Math.abs(q.speed);},{timeout:15000,intervals:[30]}).toBeGreaterThan(x0);await page.keyboard.press('w');
  // Disembarking needs a stopped hull: no speed, turn or throttle lease left, as the game's own shipStopped says.
  await expect.poll(async()=>shipStopped((await state(page)).ships[0])).toBe(true);await page.locator('#ship-interact').click();await expect.poll(async()=>(await state(page)).me.body).toBe('robot');expect((await state(page)).ships[0].occupant).toBeNull();
  await page.screenshot({path:`.local/navy-docked-${mobile?'mobile':'desktop'}.png`});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context?.close();await other?.close();await app.close();if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-navy-browser-'))throw Error('Bad temp path');await rm(dataDir,{recursive:true,force:true});}
});
