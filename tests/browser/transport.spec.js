import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { freshLife } from '../../public/survival.js';
import { freshLogistics } from '../../public/logistics.js';
import { driveTo, serverState } from './drive-helper.js';
import { driveGate } from '../../public/transport.js';
import { shipStopped } from '../../public/ship-motion.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`walk offshore dock, drive recycler onto transport and off on ${mobile?'phone':'desktop'}`,async({browser})=>{
  test.setTimeout(170000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-transport-browser-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
  await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]};
  for(let y=0;y<96;y++)for(let x=21;x<=54;x++)w.terrain[y*128+x]=0;
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Captain',19.6,25.5,0);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',10,18,4.5);const l=freshLogistics();l.groundSupplies=200;l.recyclers=[{id:'cargo',kind:'recycler',owner:'pilot',x:18.5,y:25.5,remaining:0,cargo:37,path:[],task:null,angle:0}];db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
  db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
  try{
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
    context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
    const state=()=>page.evaluate(async()=>(await fetch('/api/world')).text()).then(JSON.parse);
    await page.locator('#build-mode').click();await page.locator('[data-force-tab="navy"]').click();await page.locator('#dock-card').click();
    await page.locator('#coordinate-details').evaluate(el=>el.open=true);await page.locator('#tile-x').fill('23');await page.locator('#tile-y').fill('25');await page.locator('#select-tile').click();
    await expect(page.locator('#place-building')).toBeEnabled();await page.locator('#place-building').click();
    await expect(page.locator('#shipyard-interact')).toBeVisible({timeout:8000});await page.locator('#shipyard-interact').click();await page.locator('#yard-build-transport').click();await expect(page.locator('#yard-board')).toBeEnabled({timeout:75000});await page.locator('#shipyard-close').click();
    const drive=async(key,direction,predicate)=>{
      await page.locator('#world-canvas').focus();
      if(mobile){const b=await page.locator('[data-direction="'+direction+'"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();}else await page.keyboard.down(key);
      try{await expect.poll(async()=>predicate(await state()),{timeout:6000,intervals:[80]}).toBe(true);}finally{if(mobile)await page.mouse.up();else await page.keyboard.up(key);}
    };
    // Walk out onto the formerly impassable offshore platform and board there.
    await drive('d','right',s=>s.me.x>23);
    if(mobile)await page.locator('#shipyard-interact').click();else{await page.locator('#world-canvas').focus();await page.keyboard.press('e');}await page.locator('#yard-board').click();await expect(page.locator('#ship-title')).toHaveText('ARMORED TRANSPORT');
    await page.locator('#ship-interact').click();
    await drive('a','left',s=>s.me.x<19.6);
    await page.locator('#recycler-interact').click();
    // Vehicles drive along their hull heading (W/S) and steer with A/D; phones hold the D-pad for W.
    const press=key=>key==='w'&&mobile?page.locator('[data-direction="up"]').boundingBox().then(b=>page.mouse.move(b.x+b.width/2,b.y+b.height/2)).then(()=>page.mouse.down()):page.keyboard.down(key),release=key=>key==='w'&&mobile?page.mouse.up():page.keyboard.up(key);
    await page.locator('#world-canvas').focus();
    const world0=await serverState(page,url),ship0=world0.ships[0],gate=driveGate({...w,...world0},[],ship0);expect(gate).toBeTruthy();
    // Boarding can happen before the gate, and it arrives at either goal.
    const cargo=goal=>async()=>{const w=await serverState(page,url),r=w.logistics.recyclers.find(v=>v.id==='cargo');return r&&!w.me.shipId?{x:r.x,y:r.y,angle:r.angle,speed:r.speed}:{...goal,angle:0};};
    await driveTo(page,cargo(gate),gate,{reach:.45,press,release,timeout:25000});
    // Face the hull from the pier gate and drive aboard.
    const hull={x:ship0.x,y:ship0.y};await driveTo(page,cargo(hull),hull,{reach:.45,press,release,timeout:25000});
    await expect.poll(async()=>(await serverState(page,url)).me.shipId,{timeout:10000}).toBeTruthy();
    await expect(page.locator('#transport-status')).toContainText('CARGO / Recycler');
    await page.screenshot({path:`.local/transport-fix-loaded-${mobile?'mobile':'desktop'}.png`});
    await page.reload();await expect(page.locator('#connection')).toContainText('live');await expect(page.locator('#transport-status')).toContainText('CARGO / Recycler');
    // Actual keyboard/phone helm controls carry the same saved vehicle to the far shore.
    await page.locator('#world-canvas').focus();
    // W/S select a persistent throttle step (tap); the opposite tap returns to Stop. The bow must reach the far shore ramp range.
    await page.keyboard.press('w');await expect.poll(async()=>{const q=(await serverState(page,url)).ships[0];return q.x+1.5*Math.abs(q.speed);},{timeout:40000,intervals:[50]}).toBeGreaterThan(48);await page.keyboard.press('s');
    await expect.poll(async()=>shipStopped((await state()).ships[0]),{timeout:15000}).toBe(true);
    await page.locator('#ship-systems-toggle').click();await page.locator('#ship-ramp').click();await expect(page.locator('#transport-action')).toBeEnabled();await page.locator('#transport-action').click();
    await expect.poll(async()=>(await state()).logistics.recyclers.length).toBe(1);expect((await state()).logistics.recyclers[0].x).toBeGreaterThan(54);
    await expect(page.locator('#recycler-status')).toContainText('37 / 180');expect((await state()).me.recyclerId).toBe('cargo');
    const rec0=(await serverState(page,url)).logistics.recyclers[0],recRead=async()=>{const r=(await serverState(page,url)).logistics.recyclers[0];return {x:r.x,y:r.y,angle:r.angle,speed:r.speed};};
    await driveTo(page,recRead,{x:rec0.x+3,y:rec0.y},{reach:.6,press,release,timeout:20000});
    await page.screenshot({path:`.local/transport-fix-unloaded-${mobile?'mobile':'desktop'}.png`});
    expect(errors).toEqual([]);
  }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-transport-browser-'))throw Error('Unexpected test path');await rm(dir,{recursive:true,force:true});}
});
