import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { expandWorld } from '../../public/expansion.js';
import { shipSite } from '../../public/ship.js';
import { shipStopped } from '../../public/ship-motion.js';
import { freshLogistics } from '../../public/logistics.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
for(const mobile of [false,true])test(`surface submarine deployment, missiles and saved fleet on ${mobile?'phone':'desktop'}`,async({browser})=>{
 test.setTimeout(170000);
 const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-sub-browser-'));let app=createApp({dataDir}),context,other;
 await app.close();const db=new DatabaseSync(path.join(dataDir,'world.sqlite')),world=expandWorld(createWorld()),token=randomUUID();world.terrain=world.terrain.map((_,i)=>i%world.width<64?0:2);world.bridges=[];
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',65.5,48.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',75,48,4.5);
 const gun={...shipSite(world,[],[],60,20,'pilot').ship,id:'gun',elapsed:4.5,health:300};db.prepare('INSERT INTO ships VALUES (?,?)').run(gun.id,JSON.stringify(gun));{const l=freshLogistics();l.groundSupplies=200;db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));}db.close();app=createApp({dataDir});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,url=`http://127.0.0.1:${port}`,viewport=mobile?{width:390,height:844}:{width:1920,height:1080};
  context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});other=await browser.newContext();await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),peer=await other.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await peer.goto(url + '/?legacy=1');await page.goto(url + '/?legacy=1');await page.bringToFront();
  const state=p=>p.evaluate(async()=>(await fetch('/api/world')).text()).then(JSON.parse),sub=async()=>(await state(peer)).ships.find(s=>s.kind==='submarine');
  await expect(page.locator('#connection')).toContainText('live');await page.locator('#build-mode').click();await page.locator('[data-force-tab="navy"]').click();
  await expect(page.locator('#ship-card')).toBeEnabled();await expect(page.locator('#submarine-card')).toBeEnabled();await page.locator('#dock-card').click();
  // Unfolding docks (12 Oct) need the selected water tile three tiles from shore.
  await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').fill('61');await page.locator('#tile-y').fill('48');await page.locator('#select-tile').click();await expect(page.locator('#place-building')).toBeEnabled();
  await page.screenshot({path:`docs/previews/submarine-site-${mobile?'mobile':'desktop'}.png`});await page.locator('#place-building').click();await expect(page.locator('#shipyard-interact')).toBeVisible({timeout:7000});await page.locator('#shipyard-interact').click();await page.locator('#yard-build-submarine').click();
  await expect.poll(async()=>(await sub())?.elapsed,{timeout:75000}).toBe(4.5);
  await expect(page.locator('#yard-board')).toBeEnabled();await page.locator('#yard-board').click();await expect(page.locator('#ship-title')).toHaveText('MISSILE SUBMARINE');await expect(page.locator('#ship-secondary')).toBeHidden();
  await page.locator('#world-canvas').focus();for(let i=0;i<12;i++)await page.keyboard.press('+');await page.screenshot({path:`docs/previews/submarine-hull-${mobile?'mobile':'desktop'}.png`});for(let i=0;i<12;i++)await page.keyboard.press('-');
  await page.locator('#ship-systems-toggle').click();await page.locator('#ship-contact').click();await page.locator('#world-canvas').focus();
  if(mobile)await page.locator('#submarine-dive').click();else await page.keyboard.press('ControlLeft');
  await expect.poll(async()=>(await sub()).depth,{timeout:4500}).toBe('submerged');
  await expect(page.locator('#submarine-battery')).toContainText('SUBMERGED');await expect(page.locator('#ship-ramp')).toBeDisabled();
  const submergedId=(await sub()).id;expect((await state(peer)).combat.enemies.every(e=>e.targetId!==submergedId&&!e.attack)).toBeTruthy();
  await page.locator('#world-canvas').focus();for(let i=0;i<10;i++)await page.keyboard.press('+');
  await page.screenshot({path:`docs/previews/submarine-submerged-${mobile?'mobile':'desktop'}.png`});
  await app.close();app=createApp({dataDir});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');
  await page.locator('#ship-systems-toggle').click();expect((await sub()).depth).toBe('submerged');expect((await sub()).diveBattery).toBeLessThan(300);
  await page.locator('#world-canvas').focus();if(mobile)await page.locator('#submarine-surface').click();else await page.keyboard.press('Space');
  await expect.poll(async()=>(await sub()).depth,{timeout:4500}).toBe('surfaced');expect((await state(peer)).combat.barrages).toHaveLength(0);
  // Restore the same orbital aiming scale after page reload.
  await page.locator('#world-canvas').focus();
  const scale=48*(mobile?.12:.3),point={x:viewport.width/2+20*scale,y:viewport.height/2-15*scale};
  if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.move(point.x,point.y);
  await page.locator('#world-canvas').focus();await page.keyboard.press(mobile?'2':'3');await page.keyboard.press('r');await expect(page.locator('#submarine-rotate')).toHaveText('R / 8 x 6');await expect(page.locator('#ship-fire')).toBeEnabled();
  await page.screenshot({path:`docs/previews/submarine-aim-${mobile?'mobile':'desktop'}.png`});await page.locator('#ship-fire').click();
  await expect.poll(async()=>(await state(peer)).combat.barrages.length,{intervals:[50]}).toBe(1);const salvo=(await state(peer)).combat.barrages[0];expect(salvo.missiles).toHaveLength(6);expect(salvo.weapon).toBe(mobile?'INCENDIARY':'GAS');expect(salvo.box).toMatchObject({width:8,height:6});
  await page.screenshot({path:`docs/previews/submarine-launch-${mobile?'mobile':'desktop'}.png`});
  await page.locator('#world-canvas').focus();// W/S select a persistent throttle step (tap); the opposite tap returns to Stop.
  const x0=(await sub()).x;await page.keyboard.press('w');await expect.poll(async()=>(await sub()).x,{timeout:6000}).toBeLessThan(x0-.3);
  await expect.poll(async()=>(await sub()).x,{timeout:8000,intervals:[100]}).toBeLessThan(x0-2.5);await page.keyboard.press('s');await page.screenshot({path:`docs/previews/submarine-flight-${mobile?'mobile':'desktop'}.png`});
  await expect.poll(async()=>(await state(peer)).combat.fields[0]?.sectors.length,{timeout:12000,intervals:[100]}).toBe(6);await page.waitForTimeout(1000);
  await expect.poll(async()=>Math.max(...((await sub()).siloReloads||[0]))).toBeGreaterThan(0);await page.screenshot({path:`docs/previews/submarine-field-${mobile?'mobile':'desktop'}.png`});
  await app.close();app=createApp({dataDir});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');
  const resumed=await state(page);expect(resumed.ships).toHaveLength(2);expect(resumed.me.shipId).toBe((await sub()).id);expect(Math.max(...(await sub()).siloReloads)).toBeGreaterThan(0);expect((await sub()).ammo).toBe(mobile?'INCENDIARY':'GAS');expect(resumed.combat.barrages).toHaveLength(0);
  await page.locator('#world-canvas').focus();await page.keyboard.press('s');await expect.poll(async()=>{const q=await sub();return q.x+1.5*Math.abs(q.speed);},{timeout:15000,intervals:[30]}).toBeGreaterThan(x0);await page.keyboard.press('w');await expect.poll(async()=>shipStopped((await state(page)).ships.find(s=>s.kind==='submarine')),{timeout:10000}).toBe(true);await page.locator('#ship-interact').click();await expect.poll(async()=>(await state(page)).me.body).toBe('robot');
  await expect(page.locator('#shipyard-interact')).toBeVisible();await page.locator('#shipyard-interact').click();await expect(page.locator('#shipyard-select option')).toHaveCount(2);await page.locator('#shipyard-select').selectOption((await sub()).yardId);await expect(page.locator('#shipyard-status')).toContainText('Missile submarine');await page.locator('#shipyard-close').click();await page.locator('#build-mode').click();await page.locator('[data-force-tab="navy"]').click();await expect(page.locator('#submarine-card')).toBeEnabled();await page.screenshot({path:`docs/previews/submarine-fleet-${mobile?'mobile':'desktop'}.png`});
  if(!mobile){await page.setViewportSize({width:900,height:700});await page.waitForTimeout(100);}
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context?.close();await other?.close();await app.close();if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-sub-browser-'))throw Error('Bad temp path');await rm(dataDir,{recursive:true,force:true});}
});
