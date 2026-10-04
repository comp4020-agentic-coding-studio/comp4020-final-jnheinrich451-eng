import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for(const mobile of [false,true]) test(`sentry modes and tank weapons on ${mobile?'phone':'desktop'}`,async({browser})=>{
  test.setTimeout(45000);const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-ground-weapons-'));let app=createApp({dataDir}),context,other;
  try{
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,url=`http://127.0.0.1:${port}`;
    context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});other=await browser.newContext();
    const page=await context.newPage(),peer=await other.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await peer.goto(url);await page.goto(url);await page.bringToFront();await expect(page.locator('#connection')).toContainText('live');
    const state=p=>p.evaluate(async()=>await(await fetch('/api/world')).json());
    const post=(p,route,data)=>p.evaluate(async({route,data})=>{const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,data:await r.json()};},{route,data});
    await expect(page.locator('#tank-secondary')).toHaveValue('APCR');await page.locator('#tank-primary').selectOption('MAGNETIC');await page.locator('#tank-secondary').selectOption('HEAVY_FLAME');
    await expect.poll(async()=>(await state(page)).me.tankSecondary).toBe('HEAVY_FLAME');
    await page.locator('#build-mode').click();await page.locator('#sentry-card').click();await page.locator('#site-button').click();await page.locator('#coordinate-details summary').click();
    await page.locator('#tile-x').fill('27');await page.locator('#tile-y').fill('17');await page.locator('#select-tile').click();await page.locator('#place-building').click();
    const built=await state(page),b=built.buildings.find(b=>b.owner===built.me.id);expect(b).toBeTruthy();
    // Inspect the saved sentry through the normal site controls.
    if(await page.locator('#site-panel').isHidden())await page.locator('#site-button').click();
    await expect(page.locator('#sentry-weapon')).toBeVisible();await page.locator('#sentry-weapon').selectOption('HEAVY_FLAME');
    await expect.poll(async()=>(await state(peer)).buildings.find(s=>s.id===b.id).weapon).toBe('HEAVY_FLAME');
    expect((await post(peer,'sentry-mode',{id:b.id,weapon:'APCR'})).status).toBe(403);
    await page.screenshot({path:`docs/previews/sentry-modes-${mobile?'mobile':'desktop'}.png`});
    await page.locator('#close-site').click();await page.locator('#explore-mode').click();
    await page.locator('#center').click();
    const viewport=page.viewportSize(),point={x:viewport.width/2+70,y:viewport.height/2-20};
    if(mobile){await page.touchscreen.tap(point.x,point.y);await page.locator('#fire-button').click();}else await page.mouse.click(point.x,point.y);
    await expect.poll(async()=>(await state(peer)).combat.charges.length).toBe(1);
    await page.screenshot({path:`docs/previews/tank-magnetic-charge-${mobile?'mobile':'desktop'}.png`});
    await expect.poll(async()=>(await state(peer)).combat.shots.some(s=>s.weapon==='MAGNETIC'),{intervals:[40],timeout:2500}).toBe(true);
    expect((await state(page)).combat.marks.some(m=>m.kind==='crater')).toBe(false);
    // Held secondary creates the same heavy-fuel packets as sentries.
    if(mobile) {const box=await page.locator('#machine-gun-button').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();}
    else await page.mouse.down({button:'right'});
    await expect.poll(async()=>(await state(peer)).combat.jets.some(j=>j.weapon==='HEAVY_FLAME')).toBe(true);
    if(mobile)await page.mouse.up();else await page.mouse.up({button:'right'});
    await app.close();app=createApp({dataDir});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));await page.reload();await expect(page.locator('#connection')).toContainText('live');
    const resumed=await state(page);expect(resumed.me.tankWeapon).toBe('MAGNETIC');expect(resumed.me.tankSecondary).toBe('HEAVY_FLAME');expect(resumed.buildings.find(s=>s.id===b.id).weapon).toBe('HEAVY_FLAME');expect(resumed.combat.charges).toHaveLength(0);
    await page.locator('#tank-secondary').selectOption('APCR');await expect.poll(async()=>(await state(page)).me.tankSecondary).toBe('APCR');
    expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  }finally{await context?.close();await other?.close();await app.close();if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-ground-weapons-'))throw Error('Unexpected test directory');await rm(dataDir,{recursive:true,force:true});}
});
