import { bridgeReady } from '../public/bridge-geometry.js';
import { RECYCLER, recyclerStep, recyclerExit, parkedTask } from '../public/recycler.js';
import { addRemains } from '../public/logistics.js';
import { expect, it } from 'vitest';
import { createApp } from '../server.js';
import { createWorld, canStand } from '../public/world.js';
import { constructionError } from '../public/construction.js';
import { freshLogistics, ECONOMY, collectSalvage, tickLaunch, tickSupplies, facilityTargets, hurtFacility, emergencyTankError } from '../public/logistics.js';
import { createCombat } from '../public/combat.js';
import { makeSite } from '../public/conquest.js';
import { newAirbase, tickAircraft } from '../public/aircraft.js';
import { freshLife } from '../public/survival.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const flat=():any=>({...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),cores:[],tanks:[],ships:[],artillery:[],airbases:[],rails:[],sites:[],logistics:freshLogistics()});
const core={id:'friendly',owner:'b',x:36,y:28,elapsed:4.5};

import { migrateLogistics, unloadSalvage, salvageReceivers, poolFor } from '../public/logistics.js';
import { recoveryCores, beginRecovery, tickLife } from '../public/survival.js';
import { tickAirRepair } from '../public/aircraft.js';
async function fixture(seed:(db:DatabaseSync,w:any,l:any)=>void=()=>{}){
  const dir=await mkdtemp(path.join(tmpdir(),'frontier-logistics-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
  const db=new DatabaseSync(path.join(dir,'world.sqlite')),w=flat(),l:any=freshLogistics(),tokens=[randomUUID(),randomUUID()];
  for(const [i,id] of ['a','b'].entries())db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,32.5,42.5+i,0);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run(core.id,core.owner,core.x,core.y,core.elapsed);
  for(const id of ['a','b'])db.prepare('INSERT INTO robot_states VALUES (?,?)').run(id,JSON.stringify({...freshLife(),deployed:true}));
  l.groundSupplies=1200;seed(db,w,l);db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));db.close();
  let base='',controllers:AbortController[]=[];
  async function open(){app=createApp({dataDir:dir,logSink:()=>{}});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(app.server.address() as any).port}`;}await open();
  const state=async(i=0)=>(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[i]}})).json();
  const post=async(route:string,data:any={},i=0)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,data:await r.json()};};
  const connect=async(i=0)=>{const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body as any){}}catch{}})();return c;};
  return{state,post,connect,restart:async()=>{controllers.forEach(c=>c.abort());controllers=[];await app.close();await open();},close:async()=>{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-logistics-'))throw Error('Unexpected test path');await rm(dir,{recursive:true,force:true});}};
}
it('migrates orbital funds once without duplicating ground funds or changing old refund currency',()=>{
 const l:any={...freshLogistics(),version:1,supplies:423,jobs:{old:{cost:132,remaining:12}}};delete l.groundSupplies;
 migrateLogistics(l);expect(l).toMatchObject({version:2,supplies:423,groundSupplies:0,jobs:{old:{pool:'supplies'}}});
 l.groundSupplies=18;migrateLogistics(l);expect(l.groundSupplies).toBe(18);
 expect(()=>migrateLogistics({...l,version:99})).toThrow('Unsupported');
 expect(poolFor('missile',true)).toBe('groundSupplies');expect(poolFor('dockRepair')).toBe('groundSupplies');expect(poolFor('tank')).toBe('supplies');
});
it('shares local processing through different cores and outposts without overfilling or minting orbital supplies',()=>{
 const w=flat();w.cores=[core,{...core,id:'other',x:60}];w.logistics.facilities=[{id:'outpost',kind:'outpost',x:80,y:30,remaining:0}];
 const truck:any={x:41,y:29.5,cargo:100};expect(unloadSalvage(w,truck,'friendly',1)).toBe(30);
 truck.x=64;expect(unloadSalvage(w,truck,'other',1)).toBe(30);
 truck.x=83;truck.y=31;expect(unloadSalvage(w,truck,'outpost',1)).toBe(30);
 expect(w.logistics.groundSupplies).toBe(90);expect(w.logistics.supplies).toBe(1200);expect(truck.cargo).toBe(10);
 w.logistics.groundSupplies=1998;expect(unloadSalvage(w,truck,'outpost',1)).toBe(2);expect(truck.cargo).toBe(8);
 w.logistics.jobs.outpost={remaining:1};expect(salvageReceivers(w).some(r=>r.id==='outpost')).toBe(false);
});
it('uses a completed outpost for shared safe recovery and rejects a destroyed outpost during arrival',()=>{
 const w=flat();w.logistics.facilities=[{id:'outpost',owner:'b',kind:'outpost',x:30,y:30,remaining:0}];
 const p:any={id:'a',...freshLife(),life:'disabled',health:0};
 expect(beginRecovery(p,w,[],[],'outpost')).toBeNull();expect(p.life).toBe('arriving');expect(canStand(w,[],p.x,p.y)).toBe(true);
 w.logistics.facilities=[];tickLife(p,2,w,[],[]);expect(p.life).toBe('disabled');expect(recoveryCores(w)).toHaveLength(0);
});
it('separates rocket cargo from new unloading and persists cooldown after once-only credit',()=>{
 const l:any=freshLogistics(),r:any={launch:5,cooldown:120,inFlight:180,cargo:30};
 tickLaunch(l,r,5);expect(l.supplies).toBe(1380);expect(r).toMatchObject({launch:0,cooldown:115,inFlight:0,cargo:30});
 const saved=JSON.parse(JSON.stringify({l,r}));tickLaunch(saved.l,saved.r,107);expect(saved.l.shipments).toBe(1);expect(saved.r.cooldown).toBe(8);
 tickLaunch(saved.l,saved.r,8);expect(saved.r.cooldown).toBe(0);expect(saved.l.supplies).toBe(1380);
});
it('airbase repairs consume only ground supplies for actual health restored',()=>{
 const w=flat(),base:any=newAirbase('base','a',48,48);base.aircraft.health=170;w.logistics.groundSupplies=1;
 expect(tickAirRepair(w,base,2)).toBe(true);expect(base.aircraft.health).toBe(175);expect(w.logistics.groundSupplies).toBe(0);expect(w.logistics.supplies).toBe(1200);
 tickAirRepair(w,base,2);expect(base.aircraft.health).toBe(175);
 base.destroyed=true;w.logistics.groundSupplies=10;tickAirRepair(w,base,2);expect(base.aircraft.health).toBe(175);
});
it('admits global orbital placement and preserves migrated budgets across restart',async()=>{
 const f=await fixture((_db,_w,l)=>{l.version=1;l.supplies=423;delete l.groundSupplies;});try{
  expect((await f.state()).logistics).toMatchObject({version:2,supplies:423,groundSupplies:0});await f.connect();
  const r=await f.post('missiles',{x:90,y:60});expect(r.status).toBe(201);
  expect((await f.state()).logistics.supplies).toBe(203);expect((await f.post('artillery/control',{id:r.data.gun.id})).status).toBe(409);
  await f.restart();expect((await f.state()).logistics.groundSupplies).toBe(0);expect((await f.state()).logistics.supplies).toBeGreaterThanOrEqual(203);
 }finally{await f.close();}
});
it('serializes competing local purchases across teammates and refunds to ground only',async()=>{
 const f=await fixture((_db,_w,l)=>l.groundSupplies=7);try{
  await f.connect();await f.connect(1);
  const results=await Promise.all([f.post('buildings',{x:44,y:40,method:'factory',factoryId:'friendly'}),f.post('buildings',{x:46,y:40,method:'factory',factoryId:'friendly'},1)]);
  expect(results.map(r=>r.status).sort()).toEqual([201,409]);const s=await f.state();expect(s.logistics).toMatchObject({groundSupplies:0,supplies:1200});
  const i=results.findIndex(r=>r.status===201),id=results[i].data.building.id;
  expect(s.logistics.jobs[id]).toMatchObject({pool:'groundSupplies',cost:7,method:'factory'});expect(s.logistics.jobs[id].remaining).toBeGreaterThan(58);
  expect((await f.state(1)).logistics.groundSupplies).toBe(0);
  expect((await f.post('logistics/cancel',{id},i)).status).toBe(200);
  await f.restart();expect((await f.state()).logistics).toMatchObject({groundSupplies:3,supplies:1200});
 }finally{await f.close();}
});
it('saves a rocket delivery and return cycle while permitting new cargo storage',async()=>{
 const f=await fixture((_db,_w,l)=>{l.facilities=[{id:'rocket',kind:'uplink',owner:'a',x:50,y:40,remaining:0,cargo:180,launch:0}];});try{
  await f.connect();expect((await f.post('logistics/launch',{id:'rocket'})).status).toBe(200);
  await f.restart();const before=(await f.state()).logistics.facilities[0];expect(before.inFlight).toBe(180);
  await new Promise(r=>setTimeout(r,100));expect((await f.state()).logistics.facilities[0].cooldown).toBe(before.cooldown);
  await f.connect();await expect.poll(async()=>(await f.state()).logistics.shipments,{timeout:7000}).toBe(1);
  const s=await f.state();expect(s.logistics.supplies).toBe(1380);expect(s.logistics.facilities[0].cooldown).toBeGreaterThan(110);
  await f.restart();expect((await f.state()).logistics.supplies).toBe(1380);
 }finally{await f.close();}
},12000);
it('remembers one free bomber delivery across pilots and restart',async()=>{
 const f=await fixture((db)=>{for(const [id,owner,x]of [['a-base','a',48],['b-base','b',70]]as const){const b=newAirbase(id,owner,x,48);db.prepare('INSERT INTO airbases VALUES (?,?)').run(id,JSON.stringify(b));}});try{
  await f.connect();await f.connect(1);
  expect((await f.post('aircraft/deliver',{id:'a-base',kind:'bomber'})).status).toBe(200);
  expect((await f.state()).logistics).toMatchObject({supplies:1200,freeBomberUsed:true});
  expect((await f.post('aircraft/deliver',{id:'b-base',kind:'bomber'},1)).status).toBe(200);expect((await f.state()).logistics.supplies).toBe(1100);
  await f.restart();expect((await f.state()).logistics.freeBomberUsed).toBe(true);
 }finally{await f.close();}
});
it('reclaims only undelivered cargo when a rocket station is lost',async()=>{
 const f=await fixture((_db,_w,l)=>{l.facilities=[{id:'rocket',kind:'uplink',owner:'a',x:50,y:40,remaining:0,cargo:30,inFlight:70,launch:3,cooldown:119}];l.durability['uplink:rocket']={health:0,max:300,armor:2};});try{
  await f.connect();await expect.poll(async()=>(await f.state()).logistics.facilities.length).toBe(0);
  const s=await f.state();expect(s.logistics.crates.reduce((n:number,c:any)=>n+c.amount,0)).toBe(100);expect(s.logistics.supplies).toBe(1200);expect(s.logistics.shipments).toBe(0);
  await f.restart();expect((await f.state()).logistics.supplies).toBe(1200);
 }finally{await f.close();}
});
it('finishes a saved local outpost before accepting a teammate respawn',async()=>{
 const f=await fixture((db,_w,l)=>{
  l.facilities=[{id:'outpost',kind:'outpost',owner:'b',x:50,y:40,remaining:60,cargo:0}];l.jobs.outpost={kind:'outpost',method:'factory',factoryId:'friendly',duration:60,remaining:.5,cost:20,pool:'groundSupplies'};
  db.prepare('UPDATE robot_states SET value=? WHERE scout_id=?').run(JSON.stringify({...freshLife(),life:'disabled',health:0,deployed:true}),'a');
 });try{
  await f.connect();expect((await f.post('revive',{coreId:'outpost'})).status).toBe(409);
  await expect.poll(async()=>(await f.state()).logistics.facilities[0].remaining).toBe(0);
  expect((await f.post('revive',{coreId:'outpost'})).status).toBe(200);
  await expect.poll(async()=>(await f.state()).me.life,{timeout:3000}).toBe('active');
  await f.restart();expect((await f.state()).me.life).toBe('active');
 }finally{await f.close();}
});

it('matches client tile coordinates at the local support boundary for tanks and recyclers',async()=>{
 for(const [kind,x,y,route] of [['tank',56,29,'tanks'],['recycler',60,33,'logistics/deploy']] as const){
  const f=await fixture();try{
   await f.connect();
   expect(constructionError({...flat(),cores:[core]},kind,x,y)).toBeNull();
   const result=await f.post(route,{kind,x,y,method:'factory',factoryId:'friendly'});
   expect(result.status,JSON.stringify(result.data)).toBe(201);
  }finally{await f.close();}
 }
});
