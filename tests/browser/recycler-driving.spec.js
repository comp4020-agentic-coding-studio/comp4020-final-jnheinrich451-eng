import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { makeSite } from '../../public/conquest.js';
import { freshLogistics } from '../../public/logistics.js';
import { freshLife } from '../../public/survival.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`drive, park, reclaim and launch on ${mobile?'phone':'desktop'}`,async({browser})=>{
  test.setTimeout(60000);
  const dir=await mkdtemp(path.join(tmpdir(),'frontier-recycler-browser-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
  await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
  const w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[{...makeSite('alert','ruin',35,42),state:'conquered',hp:0,guardsRemaining:0}]};
  const l=freshLogistics();l.recyclers=[{id:'r',owner:'pilot',x:33.5,y:42.5,remaining:0,angle:Math.PI/2,cargo:0,path:[]}];l.facilities=[{id:'u',owner:'pilot',kind:'uplink',x:33,y:38,remaining:0,cargo:0,launch:0}];l.crates=[{id:'dead',kind:'remains',x:35,y:43.5,amount:8}];
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',32.5,42.5,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));db.close();
  app=createApp({dataDir:dir,logSink:()=>{}});
  try{
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
    context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
    const state=async()=>(await context.request.get(url+'/api/world')).json();
    await expect(page.locator('#recycler-interact')).toBeVisible();if(mobile)await page.locator('#recycler-interact').tap();else{await page.locator('#world-canvas').focus();await page.keyboard.press('e');}
    await expect(page.locator('#recycler-controls')).toBeVisible();await expect(page.locator('#state-banner')).toContainText('RECYCLER');
    const before=(await state()).logistics.recyclers[0].x;
    if(mobile){const b=await page.locator('[data-direction="up"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(700);await page.mouse.up();}
    else{await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');}
    await expect.poll(async()=>(await state()).logistics.recyclers[0].x).toBeGreaterThan(before+.3);
    await expect.poll(async()=>(await state()).logistics.recyclers[0].speed).toBe(0);
    await expect.poll(async()=>(await state()).logistics.facilities[0].cargo,{timeout:15000}).toBe(188);
    await page.screenshot({path:`docs/previews/recycler-driving-${mobile?'mobile':'desktop'}.png`});
    await expect(page.locator('#recycler-uplink')).toContainText('Send to orbit');await page.locator('#recycler-uplink').click();await expect(page.locator('#logistics-dialog')).not.toBeVisible();
    await expect.poll(async()=>(await state()).logistics.shipments,{timeout:7000}).toBe(1);
    await page.reload();await expect(page.locator('#recycler-controls')).toBeVisible();expect((await state()).me.recyclerId).toBe('r');
    await page.locator('#recycler-interact').click();await expect(page.locator('#recycler-controls')).not.toBeVisible();expect((await state()).me.body).toBe('robot');
    expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-recycler-browser-'))throw Error('Unexpected fixture path');await rm(dir,{recursive:true,force:true});}
});
