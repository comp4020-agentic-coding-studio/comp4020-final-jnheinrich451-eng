import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {shipSite,SHIP} from '../../public/ship.js';
import {yardFromShip} from '../../public/shipyard.js';
import {freshLogistics} from '../../public/logistics.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`replace ruined dock and detect the surviving ship on ${mobile?'phone':'desktop'}`,async({browser})=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-dock-ui-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 const world={...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128>=21&&i%128<60?0:2),sites:[],ships:[],logistics:freshLogistics()};
 const ship={...shipSite(world,[],[],23,25,'pilot','gunship','unfolding').ship,id:'survivor',elapsed:SHIP.duration,health:300};
 const yard={...yardFromShip(ship),dockDestroyed:true};ship.yardId=yard.id;ship.dockDestroyed=true;world.logistics.shipyards=[yard];
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(world.logistics));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',18.5,28.5,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',8,25,99);db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));db.close();
 app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080}});await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>await(await fetch('/api/world')).json());
  await page.locator('#build-mode').click();await page.locator('#tab-navy').click();await page.locator('#dock-card').click();
  await page.locator('#coordinate-details').evaluate(e=>e.open=true);await page.locator('#tile-x').fill('23');await page.locator('#tile-y').fill('25');await page.locator('#select-tile').click();
  await expect(page.locator('#site-reason')).toContainText('surviving ship');await expect(page.locator('#place-building')).toBeEnabled();
  await page.screenshot({path:'.local/dock-replacement-preview-'+(mobile?'phone':'desktop')+'.png'});
  await page.locator('#delivery-orbital').click();await page.locator('#place-building').click();await expect.poll(async()=>(await state()).logistics.shipyards.find(y=>!y.dockDestroyed)?.dockReady,{timeout:9000}).toBe(true).catch(async e=>{const s=await state();console.log(JSON.stringify({yards:s.logistics.shipyards,jobs:s.logistics.jobs,me:s.me,ships:s.ships,errors}));throw e;});
  let s=await state();expect(s.ships).toHaveLength(1);expect(s.ships[0].id).toBe('survivor');expect(s.ships[0].yardId).not.toBe(yard.id);expect(s.logistics.supplies).toBe(1080);
  await page.locator('#world-canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(950);await page.keyboard.up('w');await page.keyboard.down('d');await page.waitForTimeout(650);await page.keyboard.up('d');await page.keyboard.press('e');
  await expect(page.locator('#shipyard-dialog')).toBeVisible();await expect(page.locator('#shipyard-status')).toContainText('Coastal gunship');await expect(page.locator('#yard-board')).toBeEnabled();
  await page.screenshot({path:'.local/dock-replacement-service-'+(mobile?'phone':'desktop')+'.png'});await page.keyboard.press('Escape');await expect(page.locator('#shipyard-dialog')).toBeHidden();
  await page.setViewportSize(mobile?{width:844,height:390}:{width:1440,height:900});await page.reload();await expect(page.locator('#connection')).toContainText('live');s=await state();expect(s.ships[0].yardId).not.toBe(yard.id);expect(s.ships).toHaveLength(1);expect(errors).toEqual([]);
 }finally{
  await context?.close();await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-dock-ui-'))throw Error('Unexpected test path');await rm(dir,{recursive:true,force:true});
 }
});
