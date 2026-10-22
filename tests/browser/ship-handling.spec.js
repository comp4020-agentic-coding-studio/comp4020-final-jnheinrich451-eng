import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { shipSite } from '../../public/ship.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`ship throttle, rudder and coasting on ${mobile?'phone':'desktop'}`,async({browser},info)=>{
 const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-helm-'));
 let app=createApp({dataDir,logSink:()=>{}}),context;
 await app.close();
 const db=new DatabaseSync(path.join(dataDir,'world.sqlite')),token=randomUUID();
 const world={...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128<64?0:2),sites:[],bridges:[]};
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',60.5,48.5,0);
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',80,48,4.5);
 const site=shipSite(world,[],[],60,48,'pilot');if(site.error)throw Error(site.error);
 db.prepare('INSERT INTO ships VALUES (?,?)').run('ship',JSON.stringify({...site.ship,id:'ship',angle:0,turret:0,elapsed:4.5,health:300,occupant:'pilot'}));db.close();
 app=createApp({dataDir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
  await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');
  await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>(await(await fetch('/api/world')).json()).ships[0]);
  await expect(page.locator('#ship-speed')).toContainText('STOPPED');
  await expect(page.locator('#ship-controls')).toBeHidden();
  await expect(page.locator('#ship-helm')).toBeVisible();
  if(mobile){await page.locator('[data-direction="up"]').tap();}
  else{
   await page.locator('#world-canvas').focus();await page.keyboard.down('w');await page.keyboard.down('w');await page.waitForTimeout(250);await page.keyboard.up('w');
  }
  await expect(page.locator('[data-ship-throttle="1"]')).toHaveAttribute('aria-pressed','true');
  await expect.poll(async()=>(await state()).driveSpeed).toBeCloseTo(.625);
  await expect(page.locator('#ship-controls')).toBeHidden();
  expect(await page.locator('#ship-speed-needle').evaluate(e=>parseFloat(e.style.top))).toBeLessThan(80);
  await page.locator('#ship-systems-toggle').click();
  await expect(page.locator('#ship-controls')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ship-controls')).toBeHidden();
  await page.waitForTimeout(350);
  await expect(page.locator('#ship-controls')).toBeHidden();
  await page.keyboard.press('u');
  await expect(page.locator('#ship-controls')).toBeVisible();
  await page.locator('#ship-systems-close').click();
  const before=await state();await page.waitForTimeout(450);expect((await state()).y).toBeLessThan(before.y);expect((await state()).throttle).toBe(1);
  await page.locator('[data-ship-throttle="4"]').click();await expect.poll(async()=>(await state()).speed).toBeGreaterThan(1);
  // Steering remains independent of the persistent engine order.
  await page.locator('#world-canvas').focus();await page.keyboard.down('a');await page.waitForTimeout(400);await page.keyboard.up('a');
  expect((await state()).angle).toBeLessThan(0);expect((await state()).throttle).toBe(4);
  await page.locator('[data-ship-throttle="0"]').click();await expect(page.locator('#ship-throttle-order')).toHaveText('ENGINE / Stop');
  expect((await state()).driveSpeed).toBeGreaterThan(0);
  await expect.poll(async()=>(await state()).speed,{timeout:4000}).toBe(0);await expect(page.locator('#ship-speed')).toContainText('STOPPED');
  await page.locator('[data-ship-throttle="-1"]').click();await expect.poll(async()=>(await state()).driveSpeed).toBeLessThan(-.1);
  await expect(page.locator('#ship-speed')).toContainText('ASTERN');
  await page.locator('[data-ship-throttle="0"]').click();await expect(page.locator('#ship-speed')).toContainText('STOPPED');
  await page.locator('[data-ship-throttle="1"]').click();await expect.poll(async()=>(await state()).speed).toBeGreaterThan(.1);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect.poll(async()=>(await state()).throttle).toBe(0);
  expect((await state()).speed).toBe(0);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  expect(errors).toEqual([]);
  const controls=await page.locator('.ship-helm').boundingBox();expect(controls.x).toBeGreaterThanOrEqual(0);expect(controls.x+controls.width).toBeLessThanOrEqual(mobile?390:1440);
  for(const button of await page.locator('[data-ship-throttle]').all())await expect(button).toBeInViewport();
  await page.screenshot({path:info.outputPath('ship-helm.png')});
  if(mobile){
   await page.setViewportSize({width:844,height:390});
   await expect(page.locator('#ship-systems-toggle')).toBeInViewport();
   await page.screenshot({path:info.outputPath('ship-helm-landscape.png')});
  }
 }finally{
  await context?.close();await app.close();
  if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-helm-'))throw Error('Bad temp path');
  await rm(dataDir,{recursive:true,force:true});
 }
});
