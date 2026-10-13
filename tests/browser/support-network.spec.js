import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLogistics} from '../../public/logistics.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
for(const mobile of [false,true])test('shared supply network and deployment effects / '+(mobile?'phone':'desktop'),async({browser})=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-network-browser-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
 await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 const w={...createWorld(),width:128,height:96,version:2,terrain:Array(128*96).fill(2),sites:[]};
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',44.5,35.5,0);
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',36,28,4.5);
 db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));
 const l=freshLogistics();l.groundSupplies=120;l.facilities=[{id:'rocket',kind:'uplink',owner:'pilot',x:48,y:26,remaining:0,launch:0,cargo:40},{id:'outpost',kind:'outpost',owner:'pilot',x:45,y:31,remaining:0,cargo:0}];
 db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await expect(page.locator('#supplies-button')).toContainText('GND 120 / ORB 1200');
  const state=()=>page.evaluate(async()=>(await fetch('/api/world')).json());
  await page.keyboard.press('e');await expect(page.locator('#logistics-dialog')).toBeVisible();await expect(page.locator('#uplink-select')).toHaveValue('outpost');await expect(page.locator('#cargo-launch')).toBeDisabled();await page.keyboard.press('Escape');
  await page.locator('#build-mode').click();await page.locator('[data-force-tab="logistics"]').click();await page.locator('#outpost-card').click();
  await page.locator('#construction-method').selectOption('core');
  await page.locator('#coordinate-details').evaluate(el=>el.open=true);await page.locator('#tile-x').fill('48');await page.locator('#tile-y').fill('38');await page.locator('#select-tile').click();
  await expect(page.locator('#deployment-cost')).toContainText('20 GND');await expect(page.locator('#place-building')).toBeEnabled();await page.locator('#place-building').click();
  await expect.poll(async()=>(await state()).logistics.groundSupplies).toBe(100);
  await page.screenshot({path:'.local/network-local-'+(mobile?'phone':'desktop')+'.png'});
  await page.locator('#supplies-button').focus();await page.keyboard.press('Enter');await expect(page.locator('#logistics-dialog')).toBeVisible();
  await expect(page.locator('#logistics-balance')).toContainText('Both pools shared');
  await page.locator('#uplink-select').selectOption('core');await expect(page.locator('#cargo-launch')).toBeDisabled();
  await page.locator('#uplink-select').selectOption('rocket');await expect(page.locator('#cargo-launch')).toBeEnabled();await page.locator('#cargo-launch').click();
  await expect.poll(async()=>(await state()).logistics.shipments,{timeout:7000}).toBe(1);
  await page.locator('#supplies-button').click();await page.locator('#uplink-select').selectOption('rocket');await expect(page.locator('#cargo-launch')).toBeDisabled();await expect(page.locator('#cargo-launch')).toContainText('returns');
  await page.screenshot({path:'.local/network-menu-'+(mobile?'phone':'desktop')+'.png'});await page.keyboard.press('Escape');
  // Inspect deterministic capsule, drone-store and returning-rocket stages without racing short animations.
  await page.evaluate(async()=>{
   const {ConstructionEffects}=await import('/construction-effects.js'),{drawLogistics}=await import('/logistics-effects.js');
   const canvas=document.createElement('canvas');canvas.id='network-phases';canvas.width=1000;canvas.height=550;Object.assign(canvas.style,{position:'fixed',inset:'0',zIndex:'100',width:'100vw',height:'auto'});document.body.append(canvas);
   const c=canvas.getContext('2d'),T=40,world={width:25,height:13,cores:[],tanks:[],ships:[],airbases:[],artillery:[],sites:[],logistics:{facilities:[],recyclers:[],jobs:{},durability:{},salvage:{},crates:[]}};
   for(const [i,remaining]of [7.8,4,0].entries())world.logistics.facilities.push({id:'pod'+i,kind:'outpost',x:2+i*8,y:6,remaining,cargo:0});
   world.logistics.facilities.push({id:'local',kind:'outpost',x:10,y:10,remaining:30,cargo:0},{id:'return',kind:'uplink',x:20,y:10,remaining:0,cargo:20,launch:0,cooldown:3});
   world.logistics.jobs.local={kind:'outpost',method:'factory',remaining:30,duration:60,droneBay:{x:10,y:10}};
   c.fillStyle='#365954';c.fillRect(0,0,1000,550);drawLogistics(c,world,[],T,1,false,'pilot',new ConstructionEffects(T));
  });
  await page.locator('#network-phases').screenshot({path:'.local/network-phases-'+(mobile?'phone':'desktop')+'.png'});await page.locator('#network-phases').evaluate(el=>el.remove());
  await page.reload();await expect(page.locator('#connection')).toContainText('live');expect((await state()).logistics.groundSupplies).toBe(100);expect((await state()).logistics.supplies).toBe(1240);
  if(!mobile)await page.setViewportSize({width:900,height:700});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-network-browser-'))throw Error('Unexpected test path');await rm(dir,{recursive:true,force:true});}
});
