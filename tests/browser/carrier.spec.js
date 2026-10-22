import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { freshLife } from '../../public/survival.js';
import { freshLogistics } from '../../public/logistics.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {shipSite,SHIP} from '../../public/ship.js';
import {CARRIER,prepareCarrier} from '../../public/carrier.js';
for(const mobile of [false,true])test('carrier deck operations / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(55000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-carrier-browser-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),w={...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128>=21&&i%128<70?0:2),ships:[],sites:[]};
 const ship={...shipSite(w,[],[],23,35,'pilot','carrier','unfolding').ship,id:'carrier',elapsed:SHIP.duration,health:CARRIER.health,occupant:'pilot'};prepareCarrier(ship);
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify({...freshLogistics(),groundSupplies:200}));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Captain',ship.x,ship.y,ship.angle);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',10,28,4.5);db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>await(await fetch('/api/world')).json());await expect(page.locator('#ship-title')).toHaveText('AIRCRAFT CARRIER');await expect(page.locator('#ship-fire')).toBeHidden();await expect(page.locator('#ship-controls')).toBeHidden();await page.locator('#ship-systems-toggle').click();await expect(page.locator('#carrier-deliver')).toBeEnabled();await page.locator('#carrier-deliver').click();
  await expect(page.locator('#carrier-cruise')).toBeEnabled({timeout:7000});const startX=(await state()).ships[0].x;
  if(mobile){const box=await page.locator('[data-direction="up"]').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();}else await page.keyboard.down('w');
  try{await expect.poll(async()=>(await state()).ships[0].x,{timeout:4000}).toBeGreaterThan(startX+.3);}finally{if(mobile)await page.mouse.up();else await page.keyboard.up('w');}
  await page.keyboard.press('s');await expect(page.locator('#carrier-cruise')).toBeEnabled();await page.screenshot({path:'.local/carrier-deck-'+mobile+'.png'});await page.locator('#carrier-cruise').click();await expect.poll(async()=>(await state()).ships[0].aircraft.mission?.phase,{timeout:5000}).toBe('cruise');expect((await state()).me.body).toBe('ship');
  await page.reload();await expect(page.locator('#connection')).toContainText('live');await page.locator('#ship-systems-toggle').click();await page.locator('#carrier-support').click();await expect(page.locator('#bomber-status')).toContainText('CRUISE');await page.locator('#bomber-landing-base').selectOption('carrier');await page.locator('#bomber-recall').click();await page.keyboard.press('Escape');await expect(page.locator('#ship-status')).toContainText('RESERVED');
  await page.screenshot({path:'.local/carrier-recover-'+mobile+'.png'});await expect(page.locator('#carrier-board')).toBeEnabled({timeout:25000});await page.locator('#carrier-board').click();await expect(page.locator('#flight-meter')).toBeVisible();expect((await state()).ships[0].occupant).toBeNull();
  if(!mobile){await page.setViewportSize({width:1024,height:768});await expect(page.locator('#flight-meter')).toBeVisible();}
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-carrier-browser-'))throw Error('Bad test path');await rm(dir,{recursive:true,force:true});}
});
