import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {createWorld} from '../../public/world.js';

test('orbital panel artwork, impact settings and staged dock opening',async({browser})=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-pod-art-')),app=createApp({dataDir:dir,logSink:()=>{}});let context;
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
  context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/pod-preview.html',route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#172d32}canvas{display:block}</style><canvas id="art" width="1440" height="1000"></canvas>'}));
  await page.goto(url+'/pod-preview.html');
  const result=await page.evaluate(async()=>{
   const {CargoEffects}=await import('/cargo-effects.js'),{CoreEffects}=await import('/core-effects.js'),{ShipEffects,dockPanelPhases}=await import('/ship-effects.js');
   const {drawHelipad}=await import('/helicopter-effects.js'),{drawBattery}=await import('/missile-effects.js');
   const c=document.getElementById('art').getContext('2d'),T=32,fx=new CargoEffects(T),tank=new CoreEffects(T,1),dock=new ShipEffects(T);
   c.fillStyle='#8b9f74';c.fillRect(0,0,1440,1000);
   const label=(text,x,y)=>{c.fillStyle='#193237';c.font='bold 17px monospace';c.fillText(text,x,y);};
   label('TANK / FIVE TILES',25,30);tank.draw(c,{x:3,y:3},4.5,true);
   label('HELIPAD / 45 TILES',350,30);fx.drawCargo(c,{x:14,y:4,w:3,h:3},3.6,1,true);drawHelipad(c,{x:14,y:4},T,1,false,true);
   label('MISSILE BATTERY / 80 TILES',880,30);fx.drawCargo(c,{x:32,y:5,w:4,h:4},3.6,1,true);drawBattery(c,{x:32,y:5,reload:0},T,false);
   label('FALL / IMPACT / WALLS / READY',25,475);
   for(const [i,time] of [.8,1.5,2.2,3.6].entries()){const p={x:2+i*9,y:20,w:2,h:2};fx.drawCargo(c,p,time,1,true);label(time+'s',p.x*T,790);}
   label('DOCK / SHORE - ROOF - SEA',25,850);
   for(const [i,time] of [2.3,2.8,3.5].entries()){
    const s={dockStyle:'unfolding',dock:{x:25+i*6,y:29,angle:0},berthX:28+i*6,berthY:26};dock.unfoldingDock(c,s,1,time);label(time+'s',(s.dock.x-1)*T,990);
   }
   const p={x:0,y:0,w:3,h:3},camera={x:48,y:48,zoom:1};
   return {shake:fx.cargoShake(p,2.65,camera,false,true),reduced:fx.cargoShake(p,2.65,camera,true,true),disabled:fx.cargoShake(p,2.65,camera,false,false),dockRows:dockPanelPhases.reduce((n,p)=>n+p.rows,0)};
  });
  expect(Math.hypot(result.shake.x,result.shake.y)).toBeGreaterThan(0);expect(result.reduced).toEqual({x:0,y:0});expect(result.disabled).toEqual({x:0,y:0});expect(result.dockRows).toBe(5);expect(errors).toEqual([]);
  await page.screenshot({path:'.local/orbital-panels.png'});
 }finally{
  await context?.close();await app.close();
  if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-pod-art-'))throw Error('Unexpected test path');
  await rm(dir,{recursive:true,force:true});
 }
});

for(const mobile of [false,true])test(`full helipad preview and saved orbital flooring on ${mobile?'phone':'desktop'}`,async({browser})=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-pod-ui-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
 await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify({...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2)}));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',44.5,35.5,0);
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',36,28,4.5);
 db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('obstruction',70,38,'pilot','now');db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>await(await fetch('/api/world')).json());
  const choose=async(x,y)=>{await page.locator('#coordinate-details').evaluate(el=>el.open=true);await page.locator('#tile-x').fill(String(x));await page.locator('#tile-y').fill(String(y));await page.locator('#select-tile').click();};
  await page.locator('#build-mode').click();await page.locator('#tab-air').click();await page.locator('#helipad-card').click();
  await choose(70,40);await expect(page.locator('#site-reason')).toContainText('Pod wall');await expect(page.locator('#place-building')).toBeDisabled();
  await choose(70,50);await expect(page.locator('#site-reason')).toContainText('45 tiles');await expect(page.locator('#place-building')).toBeEnabled();
  await expect(page.locator('#construction-availability')).toContainText('ORB delivery needs no blue circle');
  await expect(page.locator('#delivery-ground')).toBeHidden();await expect(page.locator('#delivery-orbital')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:`.local/orbital-preview-${mobile?'mobile':'desktop'}.png`});
  await page.locator('#place-building').click();await expect.poll(async()=>(await state()).logistics.cargoPods[0]?.remaining,{timeout:8000}).toBe(0);
  const saved=await state();expect(saved.logistics.floors).toHaveLength(45);expect(saved.airbases).toHaveLength(1);
  await page.reload();await expect(page.locator('#connection')).toContainText('live');expect((await state()).logistics.floors).toHaveLength(45);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{
  await context?.close();await app.close();
  if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-pod-ui-'))throw Error('Unexpected test path');
  await rm(dir,{recursive:true,force:true});
 }
});
