import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createSirocco } from '../../public/sirocco-world.js';
import { prepareLandingZones } from '../../public/frontier-layout.js';
import { shipyardSite, yardFromShip } from '../../public/shipyard.js';
import { freshLogistics } from '../../public/logistics.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Real generated terrain, masks and full-size berths. Only completed owned
// equipment is preseeded, so this test need not wait for the assembly timer.
for (const mobile of [false,true]) test(`Sirocco skimming, moving depth and remote orders / ${mobile?'phone':'desktop'}`, async ({browser},info) => {
  test.setTimeout(90000);
  const dataDir=await mkdtemp(path.join(tmpdir(),'frontier-sirocco-naval-'));
  const slowTicks=[],recordLog=line=>{const event=typeof line==='string'?JSON.parse(line):line;if(event?.event==='simulation.slow_tick')slowTicks.push({durationMs:event.durationMs,count:event.count});};
  let app=createApp({dataDir,logSink:recordLog}),pilotContext,peerContext;
  await app.close();
  const world={...prepareLandingZones(createSirocco()),ships:[],cores:[],tanks:[],airbases:[],artillery:[],rails:[],sites:[],logistics:freshLogistics()};
  const pilotToken=randomUUID(),peerToken=randomUUID();
  const subSite=shipyardSite(world,[],[],112,172,'pilot',2),gunSite=shipyardSite(world,[],[],400,172,'peer',2);
  expect(subSite.error).toBeNull();expect(gunSite.error).toBeNull();
  const submarine={...subSite.ship,id:'sand-sub',kind:'submarine',elapsed:4.5,dockReady:true,health:300,occupant:'pilot',depth:'surfaced',diveBattery:300,diveCapacity:300};
  const gunship={...gunSite.ship,id:'sand-gun',kind:'gunship',elapsed:4.5,dockReady:true,health:300};
  world.logistics.shipyards=[yardFromShip(submarine),yardFromShip(gunship)];
  const db=new DatabaseSync(path.join(dataDir,'world.sqlite'));
  db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');
  db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('logistics-v1',JSON.stringify(world.logistics));
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(pilotToken,'pilot','Sand pilot',submarine.x,submarine.y,0);
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(peerToken,'peer','Sand dispatcher',400.5,164.5,0);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('pilot-core','pilot',112,128,4.5);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('peer-core','peer',400,128,4.5);
  for(const s of [submarine,gunship])db.prepare('INSERT INTO ships VALUES (?,?)').run(s.id,JSON.stringify(s));
  db.close();app=createApp({dataDir,logSink:recordLog});
  try{
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const url=`http://127.0.0.1:${app.server.address().port}`;
    pilotContext=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
    peerContext=await browser.newContext({viewport:{width:1100,height:800}});
    await pilotContext.addCookies([{name:'frontier',value:pilotToken,url}]);
    await peerContext.addCookies([{name:'frontier',value:peerToken,url}]);
    // Count actual canvas sand-wake fills rather than merely importing an effect.
    await pilotContext.addInitScript(()=>{
      window.sandWakeFills=0;const fill=CanvasRenderingContext2D.prototype.fill;
      CanvasRenderingContext2D.prototype.fill=function(...args){if(['#b48646','#e0bc7b'].includes(this.fillStyle))window.sandWakeFills++;return fill.apply(this,args);};
    });
    const page=await pilotContext.newPage(),peer=await peerContext.newPage(),errors=[];
    for(const p of [page,peer])p.on('pageerror',error=>errors.push(error.message));
    await peer.goto(url+'/?legacy=1');await page.goto(url+'/?legacy=1');await page.bringToFront();
    await expect(page.locator('#connection')).toContainText('live');await expect(peer.locator('#connection')).toContainText('live');
    const snapshot=async p=>(await p.request.get(url+'/api/world')).json();
    const sub=async()=>(await snapshot(page)).ships.find(s=>s.id==='sand-sub');
    const gun=async()=>(await snapshot(peer)).ships.find(s=>s.id==='sand-gun');
    const post=(p,route,body)=>p.evaluate(async({route,body})=>{const response=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,...await response.json()};},{route,body});
    const loaded=(await snapshot(page)).world;
    expect(loaded.template).toBe('sirocco-v1');
    const terrainHash=w=>createHash('sha256').update(JSON.stringify([w.terrain,w.mountains,w.waterKinds])).digest('hex');
    expect(terrainHash(loaded)).toBe(terrainHash(world));
    await expect(page.locator('#ship-helm')).toBeVisible();
    await page.bringToFront();
    expect(await page.evaluate(()=>({visible:document.visibilityState,focus:document.hasFocus()}))).toEqual({visible:'visible',focus:true});
    await page.locator('#world-canvas').focus();for(let i=0;i<(mobile?5:8);i++)await page.keyboard.press('+');
    await page.locator('[data-ship-throttle="4"]').click();
    await expect.poll(async()=>(await sub()).driveSpeed,{timeout:7000}).toBeGreaterThan(1);
    await expect.poll(()=>page.evaluate(()=>window.sandWakeFills)).toBeGreaterThan(0);
    const surface=await sub();expect(surface.y).toBeGreaterThan(submarine.y);
    await page.screenshot({path:info.outputPath('sand-skimming.png')});
    // Normal keyboard and mobile-button inputs share the saved depth action.
    if(!mobile)await page.locator('#ship-systems-toggle').click();
    await expect(page.locator(mobile?'#submarine-helm-dive':'#submarine-dive')).toContainText('Burrow');
    if(mobile)await page.locator('#submarine-helm-dive').click();else{await page.locator('#world-canvas').focus();await page.keyboard.press('ControlLeft');}
    await expect.poll(async()=>(await sub()).depth,{timeout:5000}).toBe('submerged');
    await expect(page.locator(mobile?'#submarine-helm-status':'#submarine-battery')).toContainText('UNDER SAND');
    const buried=await sub();expect(buried.y).toBeGreaterThan(surface.y);expect(buried.driveSpeed).toBeGreaterThan(0);expect(buried.diveBattery).toBeLessThanOrEqual(300);
    await expect.poll(async()=>(await snapshot(peer)).ships.find(s=>s.id==='sand-sub').depth).toBe('submerged');
    await page.screenshot({path:info.outputPath('sand-submerged.png')});
    if(mobile)await page.locator('#submarine-helm-surface').click();else{await page.locator('#world-canvas').focus();await page.keyboard.press('Space');}
    await expect.poll(async()=>(await sub()).depth,{timeout:5000}).toBe('surfaced');
    expect((await sub()).y).toBeGreaterThan(buried.y);
    if(!mobile)await page.locator('#ship-systems-close').click();
    await page.locator('[data-ship-throttle="0"]').click();await expect.poll(async()=>(await sub()).driveSpeed,{timeout:6000}).toBe(0);
    // A separate connected robot sends an actual remote order on another
    // plateau, and both clients observe the same accepted order/advancing hull.
    const remote=await post(peer,'ships/order',{id:'sand-gun',action:'move',target:{x:gunship.x,y:192.5},orderId:randomUUID(),expectedOrderId:null});
    expect(remote.status,remote.error).toBe(201);
    await expect.poll(async()=>(await gun()).y,{timeout:10000}).toBeGreaterThan(gunship.y+1);
    const ordered=await gun();
    await expect.poll(async()=>(await snapshot(page)).ships.find(s=>s.id==='sand-gun').remoteOrder?.id).toBe(remote.order.id);
    await expect(peer.locator('#facility-service h2')).toHaveText('Sandport workshop');
    expect(errors).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.screenshot({path:info.outputPath('sand-surfaced.png')});
    await writeFile(info.outputPath('sirocco-naval.json'),JSON.stringify({viewport:mobile?'390x844':'1920x1080',template:'sirocco-v1',terrainUnmodified:true,terrainHash:terrainHash(loaded),seededCompletedHulls:2,
      surface:{x:surface.x,y:surface.y,speed:surface.driveSpeed},buried:{x:buried.x,y:buried.y,speed:buried.driveSpeed,battery:buried.diveBattery},
      surfaced:{x:(await sub()).x,y:(await sub()).y},sandWakeFills:await page.evaluate(()=>window.sandWakeFills),remote:{status:remote.status,id:remote.order.id,phase:ordered.remoteOrder.phase,x:ordered.x,y:ordered.y},peerObservedDepth:true,peerObservedOrder:true,browserErrors:errors},null,2));
  }finally{
    await writeFile(info.outputPath('slow-ticks.json'),JSON.stringify(slowTicks));
    await pilotContext?.close();await peerContext?.close();await app.close();
    if(!path.resolve(dataDir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-sirocco-naval-'))throw Error('Unexpected test directory');
    await rm(dataDir,{recursive:true,force:true});
  }
});
