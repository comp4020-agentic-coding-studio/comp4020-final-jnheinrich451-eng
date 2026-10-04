import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { shipSite } from '../../public/ship.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
for(const mobile of [false,true])test(`swimmers, ship loss, core recovery and replacement on ${mobile?'phone':'desktop'}`,async({browser})=>{
 test.setTimeout(65000);
 const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-sea-loss-'));let app=createApp({dataDir}),context,other;
 await app.close();const db=new DatabaseSync(path.join(dataDir,'world.sqlite')),world=createWorld(),token=randomUUID();world.terrain=world.terrain.map((_,i)=>i%48<20?0:2);
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',17.5,12.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',30,24,4.5);
 const ship={...shipSite(world,[],[],17,12,'pilot').ship,id:'ship',elapsed:4.5,health:105,hurt:0,occupant:'pilot'};db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));db.close();app=createApp({dataDir});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,url=`http://127.0.0.1:${port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});other=await browser.newContext();
  await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),peer=await other.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await peer.goto(url);await page.goto(url);await page.bringToFront();const state=p=>p.evaluate(async()=>await(await fetch('/api/world')).json());
  await expect(page.locator('#connection')).toContainText('live');await expect(page.locator('#health-label')).toHaveText('SHIP HULL');await expect(page.locator('#health-value')).toContainText('105 / 300');
  await page.locator('#world-canvas').focus();for(let i=0;i<3;i++)await page.keyboard.press('-');
  await page.locator('#ship-contact').click();await expect.poll(async()=>(await state(peer)).combat.naval.count).toBe(3);
  await expect(page.locator('#toast')).toContainText('SONAR');await page.screenshot({path:`docs/previews/naval-contact-${mobile?'mobile':'desktop'}.png`});
  await expect.poll(async()=>(await state(peer)).combat.enemies.some(e=>e.attack),{timeout:15000,intervals:[50]}).toBe(true);
  await page.screenshot({path:`docs/previews/naval-strike-${mobile?'mobile':'desktop'}.png`});
  await expect.poll(async()=>(await state(peer)).ships[0].destroyed,{timeout:12000,intervals:[100]}).toBe(true);
  await expect(page.locator('#recovery-title')).toHaveText('Ship destroyed');expect((await state(page)).me.shipId).toBeNull();
  await page.screenshot({path:`docs/previews/naval-loss-${mobile?'mobile':'desktop'}.png`});
  await app.close();app=createApp({dataDir});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');
  expect((await state(page)).ships[0].health).toBe(0);await expect(page.locator('#recovery-title')).toHaveText('Ship destroyed');
  await expect(page.locator('#revive-button')).toBeEnabled({timeout:5000});await page.locator('#revive-button').click();await expect.poll(async()=>(await state(page)).me.life).toBe('active');
  await page.locator('#build-mode').click();await page.locator('#force-category').selectOption('Navy');await expect(page.locator('#ship-replace')).toBeVisible();await expect(page.locator('#ship-replace')).toBeEnabled({timeout:15000});
  await page.locator('#ship-replace').click();await expect.poll(async()=>(await state(peer)).ships[0].elapsed,{timeout:7000}).toBe(4.5);
  expect((await state(page)).ships).toHaveLength(1);expect((await state(page)).ships[0]).toMatchObject({health:300,destroyed:false,occupant:null});
  await page.screenshot({path:`docs/previews/naval-replacement-${mobile?'mobile':'desktop'}.png`});
  if(!mobile){await page.setViewportSize({width:900,height:700});await page.waitForTimeout(100);}
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context?.close();await other?.close();await app.close();if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-sea-loss-'))throw Error('Bad temp path');await rm(dataDir,{recursive:true,force:true});}
});
