import {expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {canStand} from '../../public/world.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

export async function checkAquatic(browser,mobile=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-aquatic-')),app=createApp({dataDir:dir,logSink:()=>{}});let context;
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  const post=(route,data)=>context.request.post(url+route,{data,headers:{Origin:url}}),credentials={name:'Explorer',email:'aquatic@frontier.test',password:'a unique aquatic password 123!',kind:'demo'};
  expect((await post('/api/auth/register',credentials)).status()).toBe(200);const inbox=await(await context.request.get(url+'/api/auth/inbox')).json();await post('/api/auth/verify',{token:inbox.messages[0].href.split('#token=')[1]});await post('/api/auth/login',credentials);
  const id=(await(await post('/api/campaigns/create',{name:'Aquatic trial',template:'vesper-v1'})).json()).id;
  await post('/api/campaigns/enter',{id});const state=async()=>await(await context.request.get(url+'/api/campaign-world/'+id+'/world')).json(),initial=await state(),hive=initial.combat.sites.find(s=>s.kind==='aquatic-hive');expect(hive).toBeTruthy();
  await post('/api/campaigns/leave',{});
  const points=[];for(let y=hive.y-9;y<hive.y+12;y++)for(let x=hive.x-9;x<hive.x+12;x++)if(canStand(initial.world,[],x+.5,y+.5))points.push({x:x+.5,y:y+.5});
  points.sort((a,b)=>Math.hypot(a.x-hive.x-1.5,a.y-hive.y-1.5)-Math.hypot(b.x-hive.x-1.5,b.y-hive.y-1.5));const bank=points[0];expect(Math.hypot(bank.x-hive.x-1.5,bank.y-hive.y-1.5)).toBeLessThan(8);
  const db=new DatabaseSync(path.join(dir,'campaigns',id,'world.sqlite'));
  db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(bank.x,bank.y,initial.me.id);db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(initial.me.id,JSON.stringify({...freshLife(),deployed:true,shield:0}));db.close();
  await post('/api/campaigns/enter',{id});const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/?campaign='+id);await expect(p.locator('#connection')).toContainText('live');
  await expect.poll(async()=>(await state()).combat.aquaticClouds.length).toBeGreaterThan(0);
  await p.screenshot({path:'.local/aquatic-warning-'+mobile+'.png'});
  await expect.poll(async()=>{const s=await state();return s.combat.aquaticClouds.some(f=>s.combat.time>f.activeAt);}).toBe(true);
  await p.screenshot({path:'.local/aquatic-active-'+mobile+'.png'});
  await expect.poll(async()=>(await state()).combat.enemies.some(e=>e.variant==='bile-spitter')).toBe(true);
  await p.locator('#planet-open').click();await p.locator('#planet-fronts').selectOption(hive.id);await p.locator('#planet-visit').click();
  await p.reload();await expect(p.locator('#connection')).toContainText('live');expect((await state()).combat.sites.filter(s=>s.kind==='aquatic-hive')).toHaveLength(1);
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context?.close();await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-aquatic-'))throw Error('Unsafe fixture path');await rm(dir,{recursive:true,force:true});}
}
