import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { expandWorld } from '../../public/expansion.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`airbase, forward flight, HE run and return on ${mobile?'phone':'desktop'}`,async({browser})=>{
 test.setTimeout(80000);
 const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-air-browser-'));let app=createApp({dataDir}),context,other;
 await app.close();const db=new DatabaseSync(path.join(dataDir,'world.sqlite')),world=expandWorld(createWorld()),token=randomUUID();world.terrain.fill(2);world.bridges=[];
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',54.6,56.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',75,60,4.5);db.close();app=createApp({dataDir});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,url=`http://127.0.0.1:${port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});other=await browser.newContext();await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),peer=await other.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await peer.goto(url);await page.goto(url);await page.bringToFront();
  const state=p=>p.evaluate(async()=>await(await fetch('/api/world')).json()),plane=async()=>(await state(peer)).airbases[0]?.aircraft;
  await expect(page.locator('#connection')).toContainText('live');await page.locator('#build-mode').click();await page.locator('#force-category').selectOption('Air force');await expect(page.locator('#airbase-card')).toBeVisible();await expect(page.locator('#ship-card')).toBeHidden();
  await page.locator('#airbase-card').click();await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').fill('48');await page.locator('#tile-y').fill('48');await page.locator('#select-tile').click();await expect(page.locator('#place-building')).toBeEnabled();
  await page.screenshot({path:`docs/previews/airbase-site-${mobile?'mobile':'desktop'}.png`});await page.locator('#place-building').click();await expect.poll(plane).toMatchObject({state:'parked',runs:2});
  await page.screenshot({path:`docs/previews/airbase-ready-${mobile?'mobile':'desktop'}.png`});await expect(page.locator('#aircraft-interact')).toBeEnabled();await page.locator('#aircraft-interact').click();await expect(page.locator('#aircraft-controls')).toBeVisible();
  await expect.poll(async()=>(await plane()).state,{timeout:5000}).toBe('flying');await page.locator('#world-canvas').focus();
  if(mobile){const box=await page.locator('[data-direction="up"]').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();}
  else{await page.keyboard.down('w');await page.waitForTimeout(450);await page.keyboard.up('w');}
  await expect.poll(async()=>(await plane()).speed).toBeGreaterThan(6);await page.keyboard.down('s');await page.waitForTimeout(550);await page.keyboard.up('s');await expect.poll(async()=>(await plane()).speed).toBe(6);
  const before=await plane();await page.mouse.move(100,150);await page.waitForTimeout(100);expect((await plane()).angle).toBe(before.angle);
  await page.screenshot({path:`docs/previews/bomber-aim-${mobile?'mobile':'desktop'}.png`});await expect(page.locator('#aircraft-bomb')).toBeEnabled();
  if(mobile)await page.locator('#aircraft-bomb').click();else await page.mouse.click(960,540);
  await expect.poll(async()=>(await state(peer)).combat.barrages.length).toBe(1);expect((await plane()).runs).toBe(1);const run=(await state(peer)).combat.barrages[0];expect(run.kind).toBe('bomber');expect(run.missiles).toHaveLength(6);
  await page.screenshot({path:`docs/previews/bomber-release-${mobile?'mobile':'desktop'}.png`});await expect.poll(async()=>(await state(peer)).combat.marks.filter(m=>m.kind==='crater').length,{timeout:6000}).toBeGreaterThan(0);
  await app.close();app=createApp({dataDir});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');expect((await plane()).runs).toBe(1);expect((await state(page)).me.body).toBe('aircraft');
  await page.locator('#world-canvas').focus();const deadline=Date.now()+18000;let held='';
  // Fly home using the same physical steering keys, not a teleport or landing API.
  await page.keyboard.down('s');
  while(Date.now()<deadline){const p=await plane();if(p.state!=='flying')break;const target=Math.atan2(50-p.x,-(55.5-p.y)),delta=Math.atan2(Math.sin(target-p.angle),Math.cos(target-p.angle)),next=Math.abs(delta)<.08?'':delta>0?'d':'a';if(held!==next){if(held)await page.keyboard.up(held);if(next)await page.keyboard.down(next);held=next;}await page.waitForTimeout(100);}
  if(held)await page.keyboard.up(held);await page.keyboard.up('s');await expect.poll(async()=>(await plane()).state,{timeout:5000}).toBe('parked');
  await expect(page.locator('#aircraft-launch')).toBeDisabled();await page.screenshot({path:`docs/previews/bomber-rearm-${mobile?'mobile':'desktop'}.png`});await page.locator('#aircraft-interact').click();await expect.poll(async()=>(await state(page)).me.body).toBe('robot');
  await expect.poll(async()=>(await plane()).runs,{timeout:11000}).toBe(2);await expect(page.locator('#aircraft-interact')).toBeEnabled();
  await page.locator('#build-mode').click();await page.locator('#force-category').selectOption('Navy');await expect(page.locator('#ship-card')).toBeVisible();await expect(page.locator('#airbase-card')).toBeHidden();
  if(!mobile){await page.setViewportSize({width:900,height:700});await page.waitForTimeout(100);}
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context?.close();await other?.close();await app.close();if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-air-browser-'))throw Error('Bad temp path');await rm(dataDir,{recursive:true,force:true});}
});
