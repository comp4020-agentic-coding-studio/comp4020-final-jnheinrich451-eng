import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {newAirbase} from '../../public/aircraft.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])for(const kind of ['bomber','attack-jet'])test(`session expiry restores ${kind} controls on ${mobile?'phone':'desktop'}`,async({browser},info)=>{
 test.setTimeout(60000);
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-flight-rejoin-')),app=createApp({dataDir:dir,logSink:()=>{}});
 let context;
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
  const post=(route,data={})=>context.request.post(url+route,{data,headers:{Origin:url}});
  const credentials={name:'Pilot',email:'pilot@frontier.test',password:'a unique flying password 123!',kind:'demo'};
  expect((await post('/api/auth/register',credentials)).status()).toBe(200);
  const inbox=await(await context.request.get(url+'/api/auth/inbox')).json();await post('/api/auth/verify',{token:inbox.messages[0].href.split('#token=')[1]});await post('/api/auth/login',credentials);
  const created=await(await post('/api/campaigns/create',{name:'Flight reconnect'})).json();const id=created.id;
  await post('/api/campaigns/enter',{id});const route='/api/campaign-world/'+id+'/';
  const state=async()=>await(await context.request.get(url+route+'world')).json();const pilot=(await state()).me.id;
  await post('/api/campaigns/leave');
  const db=new DatabaseSync(path.join(dir,'campaigns',id,'world.sqlite'));
  const w={...createWorld(),version:3,width:512,height:512,terrain:Array(512*512).fill(2),sites:[]};
  db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(w),'world');
  const b=newAirbase('test-base',pilot,244,244,kind);Object.assign(b.aircraft,{state:'flying',x:256,y:256,angle:0,speed:8,occupant:pilot,leftBase:true});
  db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));db.close();
  await post('/api/campaigns/enter',{id});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/?campaign='+id);await expect(page.locator('#connection')).toContainText('live');
  // Force the real session-expiry route, without waiting for its wall-clock TTL.
  const authDB=new DatabaseSync(path.join(dir,'world.sqlite'));
  authDB.prepare('UPDATE account_sessions SET expires_at=0').run();
  authDB.close();
  await expect(page).toHaveURL(/campaigns|login/,{timeout:20000});
  await post('/api/auth/login',credentials);await post('/api/campaigns/enter',{id});await page.goto(url+'/?campaign='+id);await expect(page.locator('#connection')).toContainText('live');
  const plane=async()=>(await state()).airbases.find(b=>b.id==='test-base').aircraft;
  await expect.poll(async()=>(await plane()).mission?.phase).toBe('complete');
  await page.locator('#world-canvas').focus();await page.keyboard.down('w');await expect.poll(async()=>(await plane()).speed).toBeGreaterThan(9);await page.keyboard.up('w');
  await page.keyboard.down('d');await expect.poll(async()=>(await plane()).bank).toBeGreaterThan(.2);await page.keyboard.up('d');
  await page.locator('#flight-fire').click();await expect.poll(async()=>kind==='attack-jet'?(await state()).combat.shots.some(s=>s.mount==='jet-cannon'):(await plane()).bombCooldown>0).toBe(true);
  await page.screenshot({path:info.outputPath('rejoined-flight.png')});
  await page.locator('#room-button').click();await expect.poll(async()=>(await state()).room.soloPaused).toBe(true);
  await page.reload();await expect(page.locator('#connection')).toContainText('live');
  await expect(page.locator('#room-dialog')).toBeVisible();await page.screenshot({path:info.outputPath('restored-pause.png')});await page.locator('#room-resume').click();
  await expect.poll(async()=>(await state()).room.paused).toBe(false);
  await page.locator('#world-canvas').focus();await page.keyboard.down('s');await expect.poll(async()=>(await plane()).speed).toBeLessThan(8);await page.keyboard.up('s');
  await page.locator('#room-button').click();await page.locator('#room-leave').click();await expect(page).toHaveURL(/campaigns/);
  await post('/api/campaigns/enter',{id});await page.goto(url+'/?campaign='+id);await expect(page.locator('#connection')).toContainText('live');
  await expect(page.locator('#room-dialog')).toBeHidden();await expect.poll(async()=>(await plane()).mission.phase).toBe('complete');
  await page.locator('#world-canvas').focus();await page.keyboard.down('a');await expect.poll(async()=>(await plane()).bank).toBeLessThan(-.2);await page.keyboard.up('a');
  if(mobile){await page.setViewportSize({width:844,height:390});await expect(page.locator('#flight-fire')).toBeInViewport();await page.screenshot({path:info.outputPath('rejoined-landscape.png')});}
  expect(errors).toEqual([]);
 }finally{await context?.close();await app.close();if(path.dirname(dir)!==tmpdir()||!path.basename(dir).startsWith('frontier-flight-rejoin-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}
});
