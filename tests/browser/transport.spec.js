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

for(const mobile of [false,true])test(`walk offshore dock, drive recycler onto transport and off on ${mobile?'phone':'desktop'}`,async({browser})=>{
  test.setTimeout(85000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-transport-browser-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
  await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]};
  for(let y=0;y<96;y++)for(let x=21;x<=40;x++)w.terrain[y*128+x]=0;
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Captain',19.6,25.5,0);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',10,18,4.5);const l=freshLogistics();l.recyclers=[{id:'cargo',kind:'recycler',owner:'pilot',x:18.5,y:25.5,remaining:0,cargo:37,path:[],task:null,angle:0}];db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
  db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
  try{
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
    context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
    const state=()=>page.evaluate(async()=>await(await fetch('/api/world')).json());
    await page.locator('#build-mode').click();await page.locator('[data-force-tab="navy"]').click();await page.locator('#transport-card').click();await page.locator('#shipyard-new-dialog').click();
    await page.locator('#coordinate-details').evaluate(el=>el.open=true);await page.locator('#tile-x').fill('23');await page.locator('#tile-y').fill('25');await page.locator('#select-tile').click();
    await expect(page.locator('#place-building')).toBeEnabled();await page.locator('#place-building').click();
    await expect(page.locator('#shipyard-interact')).toBeVisible({timeout:8000});await page.locator('#shipyard-interact').click();await page.locator('#yard-build-transport').click();await expect(page.locator('#yard-board')).toBeEnabled({timeout:15000});await page.locator('#shipyard-close').click();
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
    await drive('d','right',s=>s.me.x>23.3);
    await drive('s','down',s=>!!s.me.shipId);
    await expect(page.locator('#transport-status')).toContainText('CARGO / Recycler');
    await page.screenshot({path:`.local/transport-fix-loaded-${mobile?'mobile':'desktop'}.png`});
    await page.reload();await expect(page.locator('#connection')).toContainText('live');await expect(page.locator('#transport-status')).toContainText('CARGO / Recycler');
    // Actual keyboard/phone helm controls carry the same saved vehicle to the far shore.
    await page.locator('#world-canvas').focus();
    if(mobile){const b=await page.locator('[data-direction="up"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();}
    else await page.keyboard.down('w');
    await expect.poll(async()=>(await state()).ships[0].x,{timeout:12000,intervals:[100]}).toBeGreaterThan(37.5);
    if(mobile)await page.mouse.up();else await page.keyboard.up('w');
    await page.locator('#ship-ramp').click();await expect(page.locator('#transport-action')).toBeEnabled();await page.locator('#transport-action').click();
    await expect.poll(async()=>(await state()).logistics.recyclers.length).toBe(1);expect((await state()).logistics.recyclers[0].x).toBeGreaterThan(40);
    await expect(page.locator('#recycler-cargo')).toContainText('37 / 180');expect((await state()).me.recyclerId).toBe('cargo');
    await drive('d','right',s=>s.me.x>42);
    await page.screenshot({path:`.local/transport-fix-unloaded-${mobile?'mobile':'desktop'}.png`});
    expect(errors).toEqual([]);
  }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-transport-browser-'))throw Error('Unexpected test path');await rm(dir,{recursive:true,force:true});}
});
