import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { shipSite } from '../../public/ship.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
for(const mobile of [false,true])test(`remote shore landing, return and saved ramp on ${mobile?'phone':'desktop'}`,async({browser})=>{
 test.setTimeout(25000);
 const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-ramp-'));let app=createApp({dataDir}),context,other;
 await app.close();const db=new DatabaseSync(path.join(dataDir,'world.sqlite')),world=createWorld(),token=randomUUID();world.terrain=world.terrain.map((_,i)=>i%48<20?0:2);
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',17.8,24.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',30,24,4.5);
 const ship={...shipSite(world,[],[],17,12,'pilot').ship,id:'ship',x:17.8,y:24.5,angle:0,turret:0,elapsed:4.5,health:300,occupant:'pilot'};db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));db.close();app=createApp({dataDir});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,url=`http://127.0.0.1:${port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});other=await browser.newContext();await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),peer=await other.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await peer.goto(url);await page.goto(url);await page.bringToFront();
  const state=p=>p.evaluate(async()=>await(await fetch('/api/world')).json());
  await expect(page.locator('#connection')).toContainText('live');await expect(page.locator('#ship-manual')).toContainText('SHORE IN REACH');
  if(mobile)await page.locator('#ship-ramp').tap();else{await page.locator('#world-canvas').focus();await page.keyboard.press('g');}
  await expect(page.locator('#ship-ramp')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#ship-manual')).toContainText('ANCHORED');
  expect((await state(peer)).ships[0].ramp).toMatchObject({x:20.5,y:24.5});
  await page.locator('#world-canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(450);await page.keyboard.up('w');expect((await state(peer)).ships[0].y).toBe(24.5);
  await page.screenshot({path:`docs/previews/ship-ramp-${mobile?'mobile':'desktop'}.png`});
  if(mobile)await page.locator('#ship-interact').tap();else await page.keyboard.press('e');
  await expect.poll(async()=>(await state(page)).me.body).toBe('robot');expect((await state(peer)).ships[0].occupant).toBeNull();
  await expect(page.locator('#ship-interact')).toHaveText('Board ship / E');await page.screenshot({path:`docs/previews/ship-shore-${mobile?'mobile':'desktop'}.png`});
  await app.close();app=createApp({dataDir});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');
  expect((await state(page)).me).toMatchObject({x:20.5,y:24.5,body:'robot'});await page.locator('#ship-interact').click();await expect(page.locator('#ship-ramp')).toHaveAttribute('aria-pressed','true');
  await page.locator('#ship-ramp').click();await expect(page.locator('#ship-ramp')).toHaveAttribute('aria-pressed','false');
  await page.locator('#world-canvas').focus();await page.keyboard.down('w');await expect.poll(async()=>(await state(peer)).ships[0].y).toBeLessThan(24.2);await page.keyboard.up('w');
  if(!mobile){await page.setViewportSize({width:900,height:700});await page.waitForTimeout(150);}
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context?.close();await other?.close();await app.close();if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-ramp-'))throw Error('Bad temp path');await rm(dataDir,{recursive:true,force:true});}
});
