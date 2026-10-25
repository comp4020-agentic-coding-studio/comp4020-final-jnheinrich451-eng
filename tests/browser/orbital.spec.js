import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {isolatedField} from './rover-helper.js';

test('orbital tray remains accessible while driving',async({browser})=>{
 const arena=await isolatedField('orbital-driving',[{x:24.5,y:18.5}]);
 const context=await browser.newContext({viewport:{width:1920,height:1080}});
 try{
  await arena.seat(context);const page=await context.newPage();await page.goto(arena.base+'/?legacy=1');
  await expect(page.locator('#connection')).toContainText('live');await page.keyboard.press('v');
  await expect(page.locator('#deployment-tray')).toBeVisible();await expect(page.locator('#orbital-panel')).toBeVisible();
  await page.locator('[data-orbital-payload="GAS"]').click();await expect(page.locator('#orbital-status')).toContainText('Gas seeding');
  const state=await page.evaluate(async()=>(await fetch('/api/world')).json());expect(state.me.vehicleId).toBeTruthy();expect(state.logistics.orbital?.order).toBeFalsy();
  await page.keyboard.press('Escape');await expect(page.locator('#orbital-panel')).toBeHidden();
 }finally{await context.close();await arena.close();}
});
for(const payload of ['HE','INCENDIARY','GAS','BEAM'])for(const mobile of [false,true])test('orbital '+payload+' / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(55000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-orbital-browser-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]};
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Commander',15,15,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',10,10,99);db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>{const {logistics,combat,me}=await (await fetch('/api/world')).json();return {logistics,combat,me};});
  let calls=0;page.on('request',r=>{if(r.url().endsWith('/api/orbital/strike'))calls++;});
  await page.locator('#build-mode').click();await page.locator('[data-force-tab="strike"]').click();
  await page.locator('[data-orbital-payload="'+payload+'"]').click();await expect(page.locator('#orbital-panel')).toBeVisible();
  await expect(page.locator('#deployment-tray')).toBeHidden();await expect(page.locator('#orbital-bearing')).toHaveCount(0);await expect(page.locator('#orbital-call')).toHaveCount(0);
  const point=await page.evaluate(()=>{const c=document.getElementById('world-canvas').getBoundingClientRect(),top=100,bottom=Math.max(top+120,innerHeight-190);return{x:c.left+c.width/2,y:c.top+(top+bottom)/2,tile:Math.min((c.width-24)/128,(bottom-top)/96)};});
  const click=async(x,y)=>mobile?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  if(mobile&&payload==='HE'){
   const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+25,y:point.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   expect((await state()).logistics.orbital?.order).toBeFalsy();await page.locator('#orbital-reselect').click();await page.locator('[data-orbital-payload="HE"]').click();
  }
  if(!mobile){await page.mouse.move(point.x,point.y);expect((await state()).logistics.orbital?.order).toBeFalsy();}
  if(['HE','INCENDIARY'].includes(payload)){
   if(mobile)await page.locator('#orbital-rotate').click();else await page.keyboard.press('r');
   await expect(page.locator('#orbital-rotate')).toHaveText('R / East');
  }
  if(!mobile&&payload==='HE'){await page.mouse.click(5,100);expect((await state()).logistics.orbital?.order).toBeFalsy();await page.mouse.move(point.x,point.y);}
  if(payload==='BEAM'){
   await click(point.x,point.y);expect((await state()).logistics.orbital?.order).toBeFalsy();await expect(page.locator('#orbital-instructions')).toContainText('endpoint');
   if(!mobile)await page.mouse.move(point.x+8*point.tile,point.y);
  }
  await page.screenshot({path:'.local/orbital-plan-'+payload+'-'+mobile+'.png'});
  if(payload==='HE'&&!mobile)await page.mouse.dblclick(point.x,point.y);else await click(point.x+(payload==='BEAM'?8*point.tile:0),point.y);
  await expect(page.locator('#orbital-live')).toContainText('Commander');expect(calls).toBe(1);
  const committed=(await state()).logistics.orbital.order;expect(committed.payload).toBe(payload);if(['HE','INCENDIARY'].includes(payload))expect(committed.bearing).toBe(1);
  expect((await state()).combat.shells).toHaveLength(0);expect((await state()).logistics.supplies).toBe(payload==='HE'?1080:payload==='BEAM'?1020:1100);
  await click(point.x,point.y);expect(calls).toBe(1);
  await page.locator('#orbital-close').click();await page.reload();await expect(page.locator('#connection')).toContainText('live');await page.locator('#orbital-open').click();
  await expect(page.locator('[data-orbital-payload="'+payload+'"]').first()).toHaveAttribute('aria-pressed','true');
  expect((await state()).logistics.orbital.order.target).toEqual(committed.target);if(payload==='BEAM')expect((await state()).logistics.orbital.order.end).toEqual(committed.end);
  if(['HE','INCENDIARY'].includes(payload))await expect(page.locator('#orbital-rotate')).toBeDisabled();
  await expect.poll(async()=>(await state()).logistics.orbital.order.points.filter(p=>p.landed).length,{timeout:10000,intervals:[250]}).toBeGreaterThan(3);await page.locator('#orbital-close').click();if(payload==='BEAM')await expect.poll(async()=>{const o=(await state()).logistics.orbital.order;return o.age-o.delay;}).toBeGreaterThan(2);
  if(['INCENDIARY','GAS'].includes(payload))await expect.poll(async()=>{const s=(await state()).logistics.orbital;return s.cooldown>0&&s.cooldown<43;}).toBe(true);
  await page.screenshot({path:'.local/orbital-impact-'+payload+'-'+mobile+'.png'});
  await expect.poll(async()=>(await state()).logistics.orbital.order.points.filter(p=>p.landed).length,{timeout:23000}).toBe(payload==='HE'?15:payload==='BEAM'?121:7);await page.locator('#orbital-open').click();await expect(page.locator('#orbital-status')).toContainText('RECOVERY');expect((await state()).me.body).toBe('robot');
  if(['INCENDIARY','GAS'].includes(payload)){const f=(await state()).combat.fields.find(f=>f.orbital);expect(f.weapon).toBe(payload);expect(f.sectors).toHaveLength(7);}
  if(payload==='BEAM')expect((await state()).logistics.orbital.scars).toHaveLength(1);
  if(!mobile){await page.setViewportSize({width:1024,height:768});await expect(page.locator('#orbital-status')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#orbital-panel')).toBeHidden();}
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-orbital-browser-'))throw Error('Bad test path');await rm(dir,{recursive:true,force:true});}
});
