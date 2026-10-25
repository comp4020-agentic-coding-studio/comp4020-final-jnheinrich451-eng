import {it,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server.js';
import {createWorld} from '../public/world.js';
import {freshLogistics} from '../public/logistics.js';
import {freshLife} from '../public/survival.js';
import {shipSite,SHIP} from '../public/ship.js';
import {shipyardSite,yardFromShip,dockRecords,yardBuildError} from '../public/shipyard.js';

function setup(kind='gunship'){
 const world:any={...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128>=21&&i%128<60?0:2),sites:[],cores:[],ships:[],tanks:[],airbases:[],artillery:[],rails:[],logistics:{...freshLogistics(),groundSupplies:1000}};
 const ship:any={...shipSite(world,[],[],23,25,'a',kind,'unfolding').ship,id:'survivor',elapsed:SHIP.duration,health:200,ammo:'GAS',reload:2,occupant:null};
 const yard:any={...yardFromShip(ship),dockDestroyed:true};ship.yardId=yard.id;ship.dockDestroyed=true;
 world.ships=[ship];world.logistics.shipyards=[yard];return{world,ship,yard};
}
it.each(['gunship','submarine','transport','carrier'])('reuses the ruined dock site beside a surviving %s without hiding physical obstructions',kind=>{
 const {world,ship,yard}=setup(kind);
 let site=shipyardSite(world,[],[],23,25,'a');expect(site.error).toBeNull();
 expect(site.ship).toMatchObject({replacesYardId:yard.id,survivingShipId:ship.id,berthX:ship.berthX,berthY:ship.berthY});
 expect(yard.supersededBy).toBeUndefined();expect(ship.yardId).toBe(yard.id);
 ship.x=48;ship.y=60;expect(shipyardSite(world,[],[],23,25,'a').error).toBeNull();
 // A visitor in the berth or an actual hull on the pier is still an obstruction.
 world.ships.push({...ship,id:'visitor',x:ship.berthX,y:ship.berthY});expect(shipyardSite(world,[],[],23,25,'a').error).toBeTruthy();world.ships.pop();
 ship.x=23.5;ship.y=25.5;expect(shipyardSite(world,[],[],23,25,'a').error).toBeTruthy();
 expect(shipyardSite(world,[],[],23,25,'b').error).toBeTruthy();
});

async function fixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-dock-replace-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const {world,ship,yard}=setup();ship.x=48;ship.y=60;
 const token=randomUUID(),db=new DatabaseSync(path.join(dir,'world.sqlite'));
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(world.logistics));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'a','Pilot',18.5,28.5,0);
 db.prepare('INSERT INTO robot_states VALUES (?,?)').run('a',JSON.stringify({...freshLife(),deployed:true}));db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','a',8,25,99);
 db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));db.close();
 let url='',controller:AbortController;
 async function open(){app=createApp({dataDir:dir,logSink:()=>{}});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+(app.server.address() as any).port;}await open();
 const state=async()=>(await fetch(url+'/api/world',{headers:{Cookie:'frontier='+token}})).json();
 const post=async(route:string,data:any)=>{const r=await fetch(url+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+token,'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
 const connect=async()=>{controller=new AbortController();const r=await fetch(url+'/api/events',{headers:{Cookie:'frontier='+token},signal:controller.signal});void(async()=>{try{for await(const c of r.body as any){}}catch{}})();};
 const restart=async(change?:(db:DatabaseSync)=>void)=>{controller?.abort();await app.close();if(change){const db=new DatabaseSync(path.join(dir,'world.sqlite'));change(db);db.close();}await open();};
 return{state,post,connect,restart,yard,close:async()=>{controller?.abort();await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-dock-replace-'))throw Error('Unsafe test path');await rm(dir,{recursive:true,force:true});}};
}
it.each(['orbital','factory'])('buys a new dock using %s, reserves the surviving ship and persists the association',async method=>{
 const f=await fixture();try{
  await f.connect();const request={x:23,y:25,method,factoryId:'core'};
  const r=await f.post('shipyards',request);expect(r.status,JSON.stringify(r.body)).toBe(201);const id=r.body.yard.id;expect(id).not.toBe(f.yard.id);
  let s=await f.state();expect(s.ships).toHaveLength(1);expect(s.ships[0]).toMatchObject({id:'survivor',x:48,y:60,health:200,ammo:'GAS',yardId:id,dockDestroyed:false});
  expect(s.logistics.supplies).toBe(method==='orbital'?1080:1200);expect(s.logistics.groundSupplies).toBe(method==='factory'?970:1000);
  expect(dockRecords(s)).toHaveLength(1);expect((await f.post('shipyards',request)).status).toBe(200);
  expect((await f.post('ships',{yardId:id,kind:'transport'})).status).toBe(409);
  await f.restart();s=await f.state();expect(s.ships[0].yardId).toBe(id);expect(s.logistics.shipyards.find((y:any)=>y.id===f.yard.id).supersededBy).toBe(id);
  await f.restart(db=>{const l=JSON.parse((db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get() as any).value);if(l.jobs[id])l.jobs[id].remaining=.01;else l.shipyards.find((y:any)=>y.id===id).elapsed=SHIP.duration-.01;db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));});await f.connect();
  await expect.poll(async()=>(await f.state()).logistics.shipyards.find((y:any)=>y.id===id).dockReady).toBe(true);
  s=await f.state();expect(yardBuildError(s,s.logistics.shipyards.find((y:any)=>y.id===id),'a','transport')).toContain('already supports');
 }finally{await f.close();}
});
it('leaves the old assignment on failed payment and restores it when new construction is cancelled',async()=>{
 const f=await fixture();try{
  await f.restart(db=>{const l=JSON.parse((db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get() as any).value);l.supplies=0;db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));});await f.connect();
  expect((await f.post('shipyards',{x:23,y:25})).status).toBe(409);let s=await f.state();expect(s.ships[0].yardId).toBe(f.yard.id);expect(dockRecords(s)).toHaveLength(1);
  const order=await f.post('shipyards',{x:23,y:25,method:'factory',factoryId:'core'});expect(order.status).toBe(201);
  expect((await f.post('logistics/cancel',{id:order.body.yard.id})).status).toBe(200);
  await f.restart();s=await f.state();expect(s.ships[0]).toMatchObject({id:'survivor',health:200,yardId:f.yard.id,dockDestroyed:true});expect(dockRecords(s)).toHaveLength(1);expect(s.logistics.groundSupplies).toBe(985);
 }finally{await f.close();}
});
