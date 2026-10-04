import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
for(const mobile of [false,true])test(`coastal ship delivery, sailing, cannon and saved docking on ${mobile?'phone':'desktop'}`,async({browser})=>{
 test.setTimeout(60000);
 const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-navy-browser-'));let app=createApp({dataDir}),context,other;
 await app.close();const db=new DatabaseSync(path.join(dataDir,'world.sqlite')),world=createWorld(),token=randomUUID();
 world.terrain=world.terrain.map((_,i)=>i%48<20?0:2);
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'navy-player','Naval Scout',21.5,12.5,0);
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-navy','navy-player',30,24,4.5);db.close();app=createApp({dataDir});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,url=`http://127.0.0.1:${port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});other=await browser.newContext();
  await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),peer=await other.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await peer.goto(url);await page.goto(url);await page.bringToFront();
  const state=p=>p.evaluate(async()=>await(await fetch('/api/world')).json());
  await expect(page.locator('#connection')).toContainText('live');await page.locator('#build-mode').click();await page.locator('#force-category').selectOption('Navy');
  await expect(page.locator('#ship-card')).toBeVisible();await page.locator('#ship-card').click();
  await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').fill('17');await page.locator('#tile-y').fill('12');await page.locator('#select-tile').click();
  await expect(page.locator('#place-building')).toBeEnabled();await page.screenshot({path:`docs/previews/navy-survey-${mobile?'mobile':'desktop'}.png`});
  await page.locator('#place-building').click();await expect.poll(async()=>(await state(peer)).ships[0]?.elapsed,{intervals:[50]}).toBeGreaterThan(1.5);
  await page.screenshot({path:`docs/previews/navy-arrival-${mobile?'mobile':'desktop'}.png`});
  await expect.poll(async()=>(await state(page)).ships[0]?.elapsed,{timeout:6000}).toBe(4.5);
  await expect(page.locator('#ship-interact')).toBeVisible();if(mobile)await page.locator('#ship-interact').tap();else{await page.locator('#world-canvas').focus();await page.keyboard.press('e');}
  await expect(page.locator('#ship-controls')).toBeVisible();expect((await state(page)).me.body).toBe('ship');
  await page.locator('#world-canvas').focus();await page.keyboard.down('w');await expect.poll(async()=>(await state(page)).ships[0].x,{intervals:[50]}).toBeLessThan(16);await page.keyboard.up('w');
  const before=await state(peer);expect(before.ships[0].occupant).toBe('navy-player');
  await page.locator('#ship-interact').click();await expect(page.locator('#toast')).toContainText('Return to a dock');expect((await state(page)).me.body).toBe('ship');
  await page.locator('#world-canvas').focus();await page.keyboard.press('2');await expect(page.locator('[data-ship-shell="INCENDIARY"]')).toHaveAttribute('aria-pressed','true');
  // Keyboard zoom is shared with the other vehicles; aim six or more tiles away.
  await page.keyboard.press('-');await page.keyboard.press('-');await page.keyboard.press('-');await page.keyboard.press('-');
  const viewport=page.viewportSize(),point={x:viewport.width*.8,y:viewport.height*.28};
  if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.move(point.x,point.y);
  await expect(page.locator('#ship-fire')).toBeEnabled();await page.waitForTimeout(3200);await page.locator('#ship-fire').click();
  await expect.poll(async()=>(await state(peer)).ships[0].reload).toBeGreaterThan(0);
  await expect.poll(async()=>(await state(peer)).combat.fields.some(f=>f.weapon==='INCENDIARY'),{timeout:5000}).toBe(true);
  await page.screenshot({path:`docs/previews/navy-sailing-${mobile?'mobile':'desktop'}.png`});
  await app.close();app=createApp({dataDir});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');
  const resumed=await state(page);expect(resumed.me.shipId).toBe(resumed.ships[0].id);expect(resumed.ships[0].ammo).toBe('INCENDIARY');
  // Return in reverse without changing the heading: no automatic teleport to land.
  await page.locator('#world-canvas').focus();await page.keyboard.down('s');await expect.poll(async()=>(await state(page)).ships[0].x,{intervals:[50]}).toBeGreaterThan(17);await page.keyboard.up('s');
  await page.locator('#ship-interact').click();await expect.poll(async()=>(await state(page)).me.body).toBe('robot');expect((await state(page)).ships[0].occupant).toBeNull();
  await page.screenshot({path:`docs/previews/navy-docked-${mobile?'mobile':'desktop'}.png`});
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context?.close();await other?.close();await app.close();if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-navy-browser-'))throw Error('Bad temp path');await rm(dataDir,{recursive:true,force:true});}
});
