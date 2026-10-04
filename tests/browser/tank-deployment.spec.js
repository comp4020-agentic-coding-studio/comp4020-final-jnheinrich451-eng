import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const mobile of [false,true]) test(`orbital tank deployment, boarding and saved exit on ${mobile?'phone':'desktop'}`, async({browser})=>{
  test.setTimeout(60000);
  const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-tank-browser-'));let app=createApp({dataDir}),context,other;
  await app.close();const db=new DatabaseSync(path.join(dataDir,'world.sqlite')),world=createWorld();world.terrain.fill(2);
  db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');db.close();app=createApp({dataDir});
  try{
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,url=`http://127.0.0.1:${port}`;
    context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});other=await browser.newContext();
    const page=await context.newPage(),peer=await other.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await peer.goto(url);await page.goto(url);await page.bringToFront();
    const state=p=>p.evaluate(async()=>await(await fetch('/api/world')).json());
    const post=(route,data)=>page.evaluate(async({route,data})=>{const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,data:await r.json()};},{route,data});
    await expect(page.locator('#connection')).toContainText('live');
    expect((await post('cores',{x:18,y:24})).status).toBe(201);
    await expect.poll(async()=>(await state(page)).me.deploying,{timeout:7000}).toBe(false);
    await page.locator('#build-mode').click();await expect(page.locator('#tank-card')).toBeEnabled();await page.locator('#tank-card').click();
    await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').fill('30');await page.locator('#tile-y').fill('19');await page.locator('#select-tile').click();
    await expect(page.locator('#site-title')).toHaveText('Tank drop site');await expect(page.locator('#place-building')).toBeEnabled();
    await page.screenshot({path:`docs/previews/tank-survey-${mobile?'mobile':'desktop'}.png`});await page.locator('#place-building').click();
    await expect.poll(async()=>(await state(peer)).tanks[0]?.elapsed).toBeGreaterThan(2.3);
    await page.screenshot({path:`docs/previews/tank-unfolding-${mobile?'mobile':'desktop'}.png`});
    await expect.poll(async()=>(await state(page)).tanks[0]?.elapsed,{timeout:6000}).toBe(4.5);
    const owner=(await state(page)).me.id;
    await page.locator('#world-canvas').focus();await page.keyboard.down('d');
    await expect.poll(async()=>(await state(page)).me.x,{timeout:10000,intervals:[50]}).toBeGreaterThan(31.5);await page.keyboard.up('d');
    await page.keyboard.down('w');await expect.poll(async()=>(await state(page)).me.y,{timeout:6000,intervals:[50]}).toBeLessThan(20.5);await page.keyboard.up('w');
    await expect(page.locator('#tank-interact')).toHaveText('Board tank / E',{timeout:10000});
    await expect(page.locator('#tank-interact')).toBeVisible();
    if(mobile)await page.locator('#tank-interact').click();else{await page.locator('#world-canvas').focus();await page.keyboard.press('e');}
    await expect.poll(async()=>(await state(peer)).players.find(p=>p.id===owner)?.vehicleId).toBeTruthy();
    await expect(page.locator('#tank-primary')).toBeVisible();await page.locator('#tank-primary').selectOption('MAGNETIC');await page.locator('#tank-secondary').selectOption('HEAVY_FLAME');
    const before=(await state(page)).me;
    if(mobile){const button=page.locator('[data-direction="right"]'),b=await button.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();}
    else{await page.locator('#world-canvas').focus();await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');}
    await expect.poll(async()=>(await state(peer)).tanks[0].x).toBeGreaterThan(before.x+.1);
    const viewport=page.viewportSize(),aim={x:viewport.width/2+70,y:viewport.height/2-50};
    if(mobile){await page.touchscreen.tap(aim.x,aim.y);await page.locator('#fire-button').click();}else await page.mouse.click(aim.x,aim.y);
    await expect.poll(async()=>(await state(peer)).combat.charges.some(c=>c.owner===owner),{intervals:[50]}).toBe(true);
    await expect.poll(async()=>(await state(peer)).combat.shots.some(s=>s.owner===owner&&s.weapon==='MAGNETIC'),{intervals:[50]}).toBe(true);
    await page.screenshot({path:`docs/previews/tank-boarded-${mobile?'mobile':'desktop'}.png`});
    await app.close();app=createApp({dataDir});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');
    const resumed=await state(page);expect(resumed.me.vehicleId).toBe(resumed.tanks[0].id);expect(resumed.me.tankWeapon).toBe('MAGNETIC');expect(resumed.me.tankSecondary).toBe('HEAVY_FLAME');
    await page.locator('#tank-interact').click();await expect.poll(async()=>(await state(page)).me.body).toBe('robot');
    expect((await state(page)).tanks[0].occupant).toBeNull();await expect(page.locator('#tank-loadout')).toBeHidden();
    await page.screenshot({path:`docs/previews/tank-parked-${mobile?'mobile':'desktop'}.png`});
    expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  }finally{await context?.close();await other?.close();await app.close();if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-tank-browser-'))throw Error('Unexpected temporary directory');await rm(dataDir,{recursive:true,force:true});}
});
