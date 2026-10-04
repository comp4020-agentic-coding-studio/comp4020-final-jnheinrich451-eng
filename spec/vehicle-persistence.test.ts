import { expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.js';
import { createWorld } from '../public/world.js';
import { shipSite } from '../public/ship.js';
import { VEHICLE } from '../public/vehicle.js';
async function fixture(kind='ship',health=35){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-loss-'));let app=createApp({dataDir:dir});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),tokens=[randomUUID(),randomUUID()],world={...createWorld(),terrain:Array.from({length:48*36},(_,i)=>i%48<20?0:2)};
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');
 for(const[i,id]of['a','b'].entries()){db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,21.5,12.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-'+id,id,30,8+i*16,4.5);}
 const v=kind==='ship'?{...shipSite(world,[],[],17,12,'a').ship!,id:'ship'}:{id:'tank',owner:'a',x:26.5,y:11.5,podX:24,podY:11,angle:0,turret:0,weapon:'HE',secondary:'APCR'};
 Object.assign(v,{elapsed:4.5,health,occupant:'a'});db.prepare('INSERT INTO '+(kind==='ship'?'ships':'tanks')+' VALUES (?,?)').run(v.id,JSON.stringify(v));db.close();app=createApp({dataDir:dir});
 let base='';const controllers=new Map<number,AbortController>();const listen=async()=>{await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(app.server.address() as any).port}`;};await listen();
 const state=async(i=0)=>(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[i]}})).json();
 const post=async(route:string,data:any={},i=0)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
 const connect=async(i=0)=>{const c=new AbortController();controllers.set(i,c);const r=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body as any){}}catch{}})();};
 const disconnect=(i=0)=>{controllers.get(i)?.abort();controllers.delete(i);};
 const restart=async()=>{for(const c of controllers.values())c.abort();controllers.clear();await app.close();app=createApp({dataDir:dir});await listen();};
 return{state,post,connect,disconnect,restart,close:async()=>{for(const c of controllers.values())c.abort();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-loss-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}};
}
for(const kind of ['ship','tank'] as const)it(`persists ${kind} destruction and pilot recovery across restart, then replaces without duplicating saved vehicles`,async()=>{
 const f=await fixture(kind);try{
 await f.connect();await f.connect(1);const action=kind==='ship'?'ships/contact':'drill';expect((await f.post(action)).status).toBe(200);
 if(kind==='ship')f.disconnect(); // Another viewer keeps the battle running; the pilot cannot avoid damage by disconnecting.
 const list=kind==='ship'?'ships':'tanks';
 await expect.poll(async()=>(await f.state(1))[list][0].destroyed,{timeout:18000,interval:100}).toBe(true);
 let s=await f.state();expect(s.me).toMatchObject({life:'disabled',health:0,lostVehicle:kind,vehicleId:null,shipId:null});expect(s[list][0].occupant).toBeNull();
 await f.restart();s=await f.state();expect(s[list][0].health).toBe(0);expect(s.me.life).toBe('disabled');const remaining=s[list][0].replacement;
 await new Promise(r=>setTimeout(r,220));expect((await f.state())[list][0].replacement).toBe(remaining);
 await f.connect();await f.connect(1);expect((await f.post(kind==='ship'?'ships/board':'tanks/board',{id:kind})).status).toBe(409);
 await expect.poll(async()=>(await f.state()).me.recovery,{timeout:4000}).toBe(0);expect((await f.post('revive',{coreId:'core-a'})).status).toBe(200);
 await expect.poll(async()=>(await f.state()).me.life,{timeout:3000}).toBe('active');expect((await f.state()).me.body).toBe('robot');
 expect((await f.post('vehicles/replace',{kind,id:kind},1)).status).toBe(404);expect((await f.post('vehicles/replace',{kind,id:kind})).status).toBe(409);
 await expect.poll(async()=>(await f.state())[list][0].replacement,{timeout:13000}).toBe(0);
 const replaced=await f.post('vehicles/replace',{kind,id:kind});expect(replaced.status).toBe(200);expect(replaced.body.vehicle.health).toBe(VEHICLE[kind]);expect(replaced.body.vehicle.elapsed).toBe(0);
 expect((await f.post('vehicles/replace',{kind,id:kind})).status).toBe(200);expect((await f.state())[list]).toHaveLength(1);
 await f.restart();expect((await f.state())[list][0]).toMatchObject({destroyed:false,health:VEHICLE[kind],occupant:null});
 }finally{await f.close();}
},40000);
it('persists nonlethal hull damage, rejects forged repair and keeps ownership through boarding',async()=>{
 const f=await fixture('ship',300);try{await f.connect();await f.post('ships/contact');await expect.poll(async()=>(await f.state()).ships[0].health,{timeout:18000}).toBeLessThan(300);
 await f.restart();const s=await f.state();expect(s.ships[0].health).toBeLessThan(300);expect(s.me.shipId).toBe('ship');await f.connect();
 expect((await f.post('ships/ammo',{ammo:'GAS',health:300})).status).toBe(200);expect((await f.state()).ships[0].health).toBe(s.ships[0].health);
 expect((await f.post('vehicles/replace',{id:'ship',kind:'ship'})).status).toBe(409);
 }finally{await f.close();}
},23000);
