import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { freshLogistics } from '../../public/logistics.js';
import { freshLife } from '../../public/survival.js';
import { bridgeReady } from '../../public/bridge-geometry.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for(const [mobile,ground] of [[false,1200],[true,1200],[false,19.53]])test(`bridge workflow on ${mobile?'phone':'desktop'} / GND ${ground}`,async({browser})=>{
  test.setTimeout(70000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-bridge-browser-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
  await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]};
  for(let y=0;y<96;y++)for(let x=35;x<=40;x++)w.terrain[y*128+x]=0;
  w.terrain[41*128+35]=1;w.terrain[41*128+36]=1;w.terrain[43*128+40]=2;
  db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify({...freshLogistics(),groundSupplies:ground}));
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Engineer',32.5,42.5,0);
  db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
  try{
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
    context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
    const state=()=>page.evaluate(async()=>await(await fetch('/api/world')).json());
    await page.locator('#build-mode').click();await page.locator('[data-force-tab="logistics"]').click();await page.locator('#builder-card').click();
    await page.locator('#coordinate-details').evaluate(el=>el.open=true);await page.locator('#tile-x').fill('33');await page.locator('#tile-y').fill('42');await page.locator('#select-tile').click();await page.locator('#place-building').click();
    await expect(page.locator('#recycler-interact')).toBeVisible({timeout:8000});await page.locator('#recycler-interact').click();await expect(page.locator('#state-banner')).toContainText('BRIDGE BUILDER');
    await page.locator('#builder-plan').click();await expect(page.locator('#bridge-method')).toHaveValue('ahead');await expect(page.locator('#bridge-coordinates')).toBeHidden();await page.locator('#bridge-method').selectOption('manual');await page.locator('#bridge-from-x').fill('34');await page.locator('#bridge-from-y').fill('42');await page.locator('#bridge-to-x').fill('42');await page.locator('#bridge-to-y').fill('43');
    await expect(page.locator('#bridge-confirm')).toBeDisabled();await expect(page.locator('#bridge-message')).toContainText('Align');
    await page.locator('#bridge-to-y').fill('42');if(ground>=72)await expect(page.locator('#bridge-message')).toContainText('72 ground SUP');
    await page.locator('#bridge-from-x').fill('42');await page.locator('#bridge-to-x').fill('34');
    await expect(page.locator('#bridge-route')).toContainText('Build from (34, 42) to (42, 42)');
    if(ground>=72)await expect(page.locator('#bridge-confirm')).toBeEnabled();
    await page.locator('#bridge-method').selectOption('ahead');await page.locator('#bridge-direction').selectOption('3');await expect(page.locator('#bridge-confirm')).toBeDisabled();
    await page.locator('#bridge-direction').selectOption('1');
    if(ground<66){await expect(page.locator('#bridge-confirm')).toBeDisabled();await expect(page.locator('#bridge-budget')).toContainText('Shared GND: 19 / ORB: 1120');await expect(page.locator('#bridge-message')).toContainText('short 47');await expect(page.locator('#bridge-message')).toContainText('core or outpost');await page.screenshot({path:'.local/bridge-budget-shortfall.png'});expect((await state()).logistics.bridges).toHaveLength(0);return;}
    await expect(page.locator('#bridge-message')).toContainText('66 ground SUP');await expect(page.locator('#bridge-route')).toContainText('(34, 42) to (41, 42)');
    if(!mobile){
      await page.locator('#bridge-method').selectOption('manual');
      await page.locator('#bridge-from-x').fill('41');await page.locator('#bridge-to-x').fill('34');
      await expect(page.locator('#bridge-route')).toContainText('Build from (34, 42) to (41, 42)');
    }
    await page.screenshot({path:`.local/bridge-ahead-plan-${mobile?'mobile':'desktop'}.png`});await page.locator('#bridge-confirm').click();
    await expect.poll(async()=>(await state()).logistics.bridges.length).toBe(1);await page.screenshot({path:`.local/bridge-ahead-cables-${mobile?'mobile':'desktop'}.png`});
    await expect.poll(async()=>(await state()).logistics.bridges[0].elapsed,{timeout:4000}).toBeGreaterThan(3);
    await page.screenshot({path:`.local/bridge-ahead-unfolding-${mobile?'mobile':'desktop'}.png`});
    await expect.poll(async()=>bridgeReady((await state()).logistics.bridges[0]),{timeout:9000}).toBe(true);
    await page.locator('#world-canvas').focus();
    if(mobile){const b=await page.locator('[data-direction="right"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await expect.poll(async()=>(await state()).me.x,{timeout:8000}).toBeGreaterThan(42.8);await page.mouse.up();}
    else{await page.keyboard.down('d');await expect.poll(async()=>(await state()).me.x,{timeout:8000}).toBeGreaterThan(42.8);await page.keyboard.up('d');}
    await expect.poll(async()=>(await state()).me.x).toBeGreaterThan(42.8);expect((await state()).logistics.supplies).toBe(1120);expect((await state()).logistics.groundSupplies).toBe(1134);
    await page.reload();await expect(page.locator('#connection')).toContainText('live');expect(bridgeReady((await state()).logistics.bridges[0])).toBe(true);expect((await state()).me.x).toBeGreaterThan(42.8);
    if(!mobile)await page.setViewportSize({width:1024,height:768});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-bridge-browser-'))throw Error('Unexpected test path');await rm(dir,{recursive:true,force:true});}
});
