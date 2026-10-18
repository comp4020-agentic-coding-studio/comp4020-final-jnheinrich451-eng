import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { expandWorld } from '../../public/expansion.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`orbital jet delivery, held autocannon and saved flight on ${mobile?'phone':'desktop'}`,async({browser})=>{
 test.setTimeout(40000);
 const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-jet-browser-'));let app=createApp({dataDir,logSink:()=>{}}),context,other;
 await app.close();const db=new DatabaseSync(path.join(dataDir,'world.sqlite')),world=expandWorld(createWorld()),token=randomUUID();world.terrain.fill(2);world.bridges=[];
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',54.6,56.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',63,60,4.5);db.close();app=createApp({dataDir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,url=`http://127.0.0.1:${port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});other=await browser.newContext();await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),peer=await other.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await peer.goto(url+'/?legacy=1');await page.goto(url+'/?legacy=1');await page.bringToFront();
  const state=p=>p.evaluate(async()=>await(await fetch('/api/world')).json()),plane=async()=>(await state(peer)).airbases[0]?.aircraft;
  await expect(page.locator('#connection')).toContainText('live');await page.locator('#build-mode').click();await page.locator('[data-force-tab="air"]').click();await page.locator('#airbase-card').click();
  await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').fill('48');await page.locator('#tile-y').fill('48');await page.locator('#select-tile').click();await expect(page.locator('#place-building')).toBeEnabled();await page.locator('#place-building').click();
  await expect.poll(async()=>Object.keys((await state(page)).logistics.jobs).length,{timeout:15000}).toBe(0);await page.locator('#build-mode').click();await page.locator('[data-force-tab="air"]').click();await page.locator('#attack-jet-card').click();await page.locator('#coordinate-details').evaluate(el=>el.open=true);await page.locator('#tile-x').fill('48');await page.locator('#tile-y').fill('48');await page.locator('#select-tile').click();await expect(page.locator('#place-building')).toBeEnabled();await page.locator('#place-building').click();await expect.poll(plane).toMatchObject({kind:'attack-jet',state:'delivering'});await expect(page.locator('#aircraft-interact')).toBeDisabled();
  await page.waitForTimeout(1600);await page.screenshot({path:`.local/jet-delivery-${mobile?'mobile':'desktop'}.png`});
  await expect.poll(async()=>(await plane()).state,{timeout:20000}).toBe('parked');await page.locator('#aircraft-interact').click();
  await expect(page.locator('#aircraft-controls')).toHaveAttribute('aria-label','Attack jet controls');await expect.poll(async()=>(await plane()).state,{timeout:4000}).toBe('flying');
  if(mobile){const b=await page.locator('#aircraft-bomb').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);}else await page.mouse.move(960,400);
  await page.mouse.down();await expect.poll(async()=>(await plane()).rounds,{timeout:3000,intervals:[80]}).toBeLessThan(87);await page.mouse.up();
  await page.waitForTimeout(300);const released=(await plane()).rounds;await page.waitForTimeout(450);expect((await plane()).rounds).toBe(released);
  expect((await state(peer)).combat.marks.some(m=>m.kind==='crater')).toBe(true);
  await page.screenshot({path:`.local/jet-strafe-${mobile?'mobile':'desktop'}.png`});
  await app.close();app=createApp({dataDir,logSink:()=>{}});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');
  expect(await plane()).toMatchObject({kind:'attack-jet',rounds:released,occupant:'pilot'});expect((await state(page)).me.body).toBe('aircraft');
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context?.close();await other?.close();await app.close();if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-jet-browser-'))throw Error('Bad temp path');await rm(dataDir,{recursive:true,force:true});}
});
