import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { shipSite } from '../../public/ship.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`recall legacy dock and redeploy unfolding dock on ${mobile?'phone':'desktop'}`,async({browser})=>{
 test.setTimeout(40000);
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-recall-browser-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context,peerContext;await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),world=createWorld(),token=randomUUID();world.terrain=world.terrain.map((_,i)=>i%48<20?0:2);
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'owner','Owner',21.5,12.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','owner',30,24,4.5);
 const ship={...shipSite(world,[],[],17,12,'owner').ship,id:'legacy-ship',elapsed:4.5};db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});peerContext=await browser.newContext();await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),peer=await peerContext.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await peer.goto(url+'/?legacy=1');await page.goto(url+'/?legacy=1');await page.bringToFront();
  const state=async()=>(await peer.request.get(url+'/api/world')).json();
  await expect(page.locator('#connection')).toContainText('live');await page.locator('#build-mode').click();await page.locator('[data-force-tab="navy"]').click();await page.locator('#ship-card').click();await expect(page.locator('#ship-recall')).toBeEnabled();
  await page.screenshot({path:`docs/previews/navy-recall-${mobile?'mobile':'desktop'}.png`});
  page.once('dialog',d=>d.dismiss());await page.locator('#ship-recall').click();expect((await state()).ships).toHaveLength(1);
  page.once('dialog',d=>d.accept());await page.locator('#ship-recall').click();await expect.poll(async()=>(await state()).ships.length).toBe(0);
  expect((await state()).logistics.shipyards).toHaveLength(1);
  await expect(page.locator('#shipyard-retire')).toBeEnabled();page.once('dialog',d=>d.accept());await page.locator('#shipyard-retire').click();await expect.poll(async()=>(await state()).logistics.shipyards.length).toBe(0);
  await page.locator('#shipyard-new-dialog').click();await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').fill('17');await page.locator('#tile-y').fill('12');await page.locator('#select-tile').click();await expect(page.locator('#place-building')).toBeEnabled();await page.locator('#place-building').click();
  await expect.poll(async()=>(await state()).logistics.shipyards[0]?.dockStyle).toBe('unfolding');await expect(page.locator('#shipyard-interact')).toBeVisible({timeout:6500});await page.locator('#shipyard-interact').click();await page.locator('#yard-build-gunship').click();await expect(page.locator('#yard-board')).toBeEnabled({timeout:15000});
  await page.screenshot({path:`docs/previews/navy-recalled-rebuilt-${mobile?'mobile':'desktop'}.png`});
  if(!mobile)await page.setViewportSize({width:900,height:700});expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context?.close();await peerContext?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-recall-browser-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}
});
