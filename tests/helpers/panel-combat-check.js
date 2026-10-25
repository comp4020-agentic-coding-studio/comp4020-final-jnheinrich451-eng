import {expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLogistics} from '../../public/logistics.js';
import {freshLife} from '../../public/survival.js';
import {shipSite,SHIP} from '../../public/ship.js';
import {yardFromShip} from '../../public/shipyard.js';
import {prepareCarrier} from '../../public/carrier.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

export async function checkPanelCombat(browser,mobile=false,exchange=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-panel-combat-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context,db;
 try{
  await app.close();db=new DatabaseSync(path.join(dir,'world.sqlite'));const token=randomUUID();
  const w={...createWorld(),version:3,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128<30?0:2),sites:[],ships:[],cores:[],tanks:[],rails:[],artillery:[],airbases:[],logistics:freshLogistics()};
  const ship={...shipSite(w,[],[],27,40,'pilot','carrier','unfolding').ship,id:'carrier',kind:'carrier',elapsed:SHIP.duration,health:600,purchase:{id:'paid',paid:100,pool:'groundSupplies'}};
  prepareCarrier(ship);ship.deckSupplies=120;for(const [i,p] of [ship.aircraft,ship.wing.aircraft].entries())Object.assign(p,{state:'parked',health:180,purchase:{id:'air-paid-'+i,paid:i?100:25,pool:i?'supplies':'groundSupplies'}});ship.wing.aircraft.kind='attack-jet';
  const l={...freshLogistics(),groundSupplies:500,shipyards:[yardFromShip(ship)],wrecks:[{id:'old',kind:'carrier',x:ship.x,y:ship.y,angle:ship.angle}],recovery:{old:{id:'old',sourceId:'old',medium:'sea',x:ship.x,y:ship.y,amount:50}}};
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',ship.dock.x,ship.dock.y,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',42,47,99);
  db.close();db=null;app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  const p=await context.newPage(),errors=[],shots=[],inputs=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().endsWith('/api/fire'))shots.push(r.status());});p.on('request',r=>{if(r.url().endsWith('/api/input'))inputs.push(r.postDataJSON());});
  await p.goto(url+'/?legacy=1');await expect(p.locator('#connection')).toContainText('live');
  const panel=p.locator('#facility-service');await expect(panel).toBeVisible();await expect(panel.locator('.service-status')).toContainText('active / 600/600 HP');await expect(panel.locator('.service-help')).toContainText('automatically recycle');await expect(panel.locator('[data-kind="gunship"]')).toBeEnabled();await expect(panel.locator('[data-kind="gunship"]')).toContainText('+12.5 GND / +50 ORB');
  if(exchange){
   const kind=typeof exchange==='string'?exchange:'carrier',dialogs=[];p.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
   await p.screenshot({path:'.local/carrier-recycling-'+mobile+'.png'});
   await expect(panel.locator('[data-kind="'+kind+'"]')).toBeEnabled();await panel.locator('[data-kind="'+kind+'"]').click();
   await expect(panel.locator('.service-status')).toContainText('assembling');
   const state=await(await context.request.get(url+'/api/world')).json();expect(state.ships).toHaveLength(1);expect(state.ships[0].kind).toBe(kind);expect(state.logistics.recovery.old.amount).toBe(50);
   if(kind==='carrier'){expect(state.ships[0].aircraft.state).toBe('parked');expect(state.ships[0].wing.aircraft.state).toBe('parked');}
   else{expect(state.ships[0].aircraft).toBeUndefined();expect(state.ships[0].wing).toBeUndefined();expect(state.logistics.groundSupplies).toBe(512.5);expect(state.logistics.supplies).toBe(1250);}
   await p.reload();await expect(p.locator('#connection')).toContainText('live');await expect(panel.locator('.service-status')).toContainText('assembling');expect(errors).toEqual([]);expect(dialogs).toEqual([]);return;
  }
  let point;
  const check=async locator=>{
   point=await p.evaluate(()=>{for(let y=350;y<innerHeight-100;y+=20)for(let x=20;x<innerWidth-20;x+=20)if(document.elementFromPoint(x,y)?.id==='world-canvas')return{x,y};throw Error('No exposed battlefield');});await p.mouse.move(point.x,point.y);await expect.poll(()=>inputs.filter(i=>'aim' in i).length).toBeGreaterThan(0);
   const count=shots.length;await p.mouse.down();await expect.poll(()=>shots.length).toBeGreaterThan(count);await p.mouse.up();expect(shots.at(-1)).toBe(200);
   // Crossing into the panel while firing stops the held action, and panel clicks never leak.
   await p.mouse.down();const box=await locator.boundingBox();await p.mouse.move(box.x+12,box.y+16);await p.waitForTimeout(300);const stopped=shots.length,aimCount=inputs.filter(i=>'aim' in i).length;
   await p.waitForTimeout(420);expect(shots.length).toBe(stopped);expect(inputs.filter(i=>'aim' in i).length).toBe(aimCount);await p.mouse.up();await p.mouse.click(box.x+12,box.y+16);await p.waitForTimeout(200);expect(shots.length).toBe(stopped);
   // Moving out with the button still held does not restart fire.
   await p.mouse.down();await p.mouse.move(point.x,point.y);await p.waitForTimeout(250);expect(shots.length).toBe(stopped);await p.mouse.up();
   await p.mouse.click(point.x,point.y,{button:'right'});await expect.poll(()=>shots.length).toBeGreaterThan(stopped);expect(shots.at(-1)).toBe(200);
  };
  await check(panel);
  await p.locator('#build-mode').click();const tray=p.locator('#deployment-tray');await expect(tray).toBeVisible();await check(tray);
  // Once a deployment is selected, map clicks remain placement rather than fire.
  await p.locator('#tab-ground').click();await p.locator('#tank-card').click();await expect(p.locator('#site-panel')).toBeVisible();const before=shots.length;await p.mouse.click(point.x,point.y);await p.waitForTimeout(250);expect(shots.length).toBe(before);
  await p.screenshot({path:'.local/panel-combat-'+mobile+'.png'});expect(errors).toEqual([]);
 }finally{db?.close();await context?.close();await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-panel-combat-'))throw Error('Unsafe fixture path');await rm(dir,{recursive:true,force:true});}
}
