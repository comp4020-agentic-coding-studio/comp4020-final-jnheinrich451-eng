import { it, expect } from 'vitest';
import { createApp } from '../server.js';
import { createWorld } from '../public/world.js';
import { newAirbase, parkingPoint } from '../public/aircraft.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
async function fixture(landing=false,visitor=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-air-'));let app=createApp({dataDir:dir});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),tokens=[randomUUID(),randomUUID()];
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify({...createWorld(),width:128,height:96,version:2,terrain:Array(128*96).fill(2)}),'world');
 for(const [i,id] of ['a','b'].entries()){db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,landing||visitor?54.6:55.6,(landing||visitor?56.5:59.5)+i,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core'+id,id,63,60+i*16,4.5);}
 if(landing){const b:any=newAirbase('base','a',48,48);Object.assign(b.aircraft,{occupant:'a',state:'flying',y:parkingPoint(b).y+5.1,leftBase:true,speed:6,runs:0});db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));}
 if(visitor){const source:any=newAirbase('source','a',85,48),destination:any=newAirbase('destination','a',48,48);source.aircraft.baseId=destination.id;Object.assign(source.aircraft,parkingPoint(destination));destination.aircraft.state='vacant';destination.aircraft.health=0;for(const b of [source,destination])db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));}
 db.close();app=createApp({dataDir:dir});let base='',controllers:AbortController[]=[];
 async function listen(){await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(app.server.address() as any).port}`;}await listen();
 const state=async(i=0)=>(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[i]}})).json();
 const post=async(route:string,data:any={},i=0)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
 const connect=async(i=0)=>{const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body as any){}}catch{}})();};
 const restart=async()=>{controllers.forEach(c=>c.abort());controllers=[];await app.close();app=createApp({dataDir:dir});await listen();};
 const approach=async()=>{expect((await post('navigate',{x:54,y:57})).status).toBe(200);await expect.poll(async()=>Math.hypot((await state()).me.x-54.5,(await state()).me.y-57.5),{timeout:5000}).toBeLessThan(.2);};
 return{state,post,connect,restart,approach,close:async()=>{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-air-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}};
}
it('delivers an orbital jet once, resumes delivery after restart and authorizes only its connected pilot to strafe',async()=>{
 const f=await fixture();try{
  await f.connect();await f.connect(1);
  const built=await f.post('airbases',{x:48,y:48,kind:'attack-jet'});expect(built.status).toBe(201);const id=built.body.airbase.id;
  expect(built.body.airbase.aircraft).toMatchObject({state:'delivering',rounds:90,kind:'attack-jet'});
  expect((await f.post('aircraft/board',{id})).status).toBe(409);
  expect((await f.post('aircraft/deliver',{id,kind:'bomber'},1)).status).toBe(409);
  expect((await f.post('aircraft/deliver',{id,kind:'attack-jet'})).status).toBe(200);
  await f.restart();const saved=(await f.state()).airbases[0].aircraft;
  expect(saved.state).toBe('delivering');await new Promise(r=>setTimeout(r,150));expect((await f.state()).airbases[0].aircraft.remaining).toBe(saved.remaining);
  await f.connect();await f.connect(1);await expect.poll(async()=>(await f.state()).airbases[0].aircraft.state,{timeout:19000}).toBe('parked');
  await f.approach();expect((await f.post('aircraft/board',{id})).status).toBe(200);
  expect((await f.post('aircraft/deliver',{id,kind:'bomber'})).status).toBe(409);
  await expect.poll(async()=>(await f.state()).airbases[0].aircraft.state,{timeout:4000}).toBe('flying');
  expect((await f.post('aircraft/strafe',{},1)).status).toBe(409);
  expect((await f.post('aircraft/bomb')).status).toBe(409);
  expect((await f.post('aircraft/strafe',{x:0,y:0,weapon:'GAS'})).status).toBe(400);
  expect((await f.post('aircraft/strafe',{x:0,y:0,weapon:'30mm'})).status).toBe(200);
  const rapid=(await f.state()).combat;expect(rapid.shots.at(-1).mount).toBe('jet-30mm');
  expect(rapid.salvos.every((s:any)=>s.targetY>0&&s.kind==='jet-burst')).toBe(true);
  expect((await f.state()).airbases[0].aircraft.rounds).toBe(90);
  await f.restart();expect((await f.state()).airbases[0].aircraft).toMatchObject({kind:'attack-jet',occupant:'a',rounds:90,state:'flying'});
  expect((await f.post('aircraft/strafe')).status).toBe(409);
 }finally{await f.close();}
},27000);
it('deploys one saved airbase, admits one pilot and preserves flight, seat and spent ammunition across idle restart',async()=>{
 const f=await fixture();try{
  expect((await f.post('airbases',{x:48,y:48})).status).toBe(409);await f.connect();await f.connect(1);
  expect((await f.post('airbases',{x:0,y:0})).status).toBe(409);const built=await f.post('airbases',{x:48,y:48});expect(built.status).toBe(201);const id=built.body.airbase.id;
  expect((await f.post('airbases',{x:48,y:48})).status).toBe(200);expect((await f.post('airbases',{x:80,y:25})).status).toBe(409);
  await expect.poll(async()=>!!(await f.state()).logistics.jobs[id],{timeout:15000}).toBe(false);
  await f.approach();expect((await f.post('aircraft/board',{id})).status).toBe(200);expect((await f.post('aircraft/board',{id},1)).status).toBe(409);
  expect((await f.state()).me).toMatchObject({body:'aircraft',aircraftId:id+':bomber'});
  for(const route of ['fire','ships/board','tanks/board','artillery/control','airbases','navigate'])expect((await f.post(route,{weapon:'HE',x:70,y:40})).status).toBe(409);
  expect((await f.post('aircraft/bomb')).status).toBe(409);await expect.poll(async()=>(await f.state()).airbases[0].aircraft.state,{timeout:4000}).toBe('flying');
  expect((await f.post('aircraft/bomb',{},1)).status).toBe(409);expect((await f.post('aircraft/bomb',{x:0,y:0,weapon:'GAS'})).status).toBe(200);
  const fired=await f.state();expect(fired.combat.barrages[0]).toMatchObject({kind:'bomber',weapon:'HE'});expect(fired.combat.barrages[0].missiles).toHaveLength(12);
  expect((await f.post('aircraft/bomb')).status).toBe(409);expect((await f.post('aircraft/exit')).status).toBe(409);
  await f.restart();const saved=(await f.state()).airbases[0].aircraft;expect(saved).toMatchObject({occupant:'a',state:'flying',runs:2,releaseRemaining:0});expect(saved.bombCooldown).toBeGreaterThan(0);expect((await f.state()).combat.barrages).toHaveLength(0);
  await new Promise(r=>setTimeout(r,250));expect((await f.state()).airbases[0].aircraft.y).toBe(saved.y);
  await f.connect(1);await expect.poll(async()=>(await f.state()).airbases[0].aircraft.y).toBeLessThan(saved.y); // no disconnected-pilot freeze
  expect((await f.state()).me.aircraftId).toBe(id+':bomber');
 }finally{await f.close();}
},25000);
it('lands automatically, allows immediate apron exit and boards without an ammunition refill',async()=>{
 const f=await fixture(true);try{
  await f.connect();await expect.poll(async()=>(await f.state()).airbases[0].aircraft.state,{timeout:4000}).toBe('parked');
  expect((await f.state()).airbases[0].aircraft.rearm).toBe(0);expect((await f.post('aircraft/exit')).status).toBe(200);expect((await f.state()).me).toMatchObject({body:'robot',aircraftId:null,x:53.5,y:56.5});
  await f.restart();const wait=(await f.state()).airbases[0].aircraft.rearm;await new Promise(r=>setTimeout(r,200));expect((await f.state()).airbases[0].aircraft.rearm).toBe(wait);
  await f.connect();expect((await f.state()).airbases[0].aircraft.runs).toBe(0);
  expect((await f.post('aircraft/board',{id:'base'})).status).toBe(200);
 }finally{await f.close();}
},20000);

it('boards visiting aircraft, saves cruise orders and serializes free-runway recalls without duplicating planes',async()=>{
 const f=await fixture(false,true);try{
  await f.connect();await f.connect(1);
  expect((await f.post('aircraft/cruise',{id:'source'})).status).toBe(409);
  expect((await f.post('aircraft/cruise',{id:'destination'})).status).toBe(200);
  await expect.poll(async()=>(await f.state()).airbases.find((b:any)=>b.id==='source').aircraft.mission.phase,{timeout:4000}).toBe('cruise');
  expect((await f.state()).me.body).toBe('robot');await f.restart();
  const get=async()=>(await f.state()).airbases.find((b:any)=>b.id==='source').aircraft;
  expect(await get()).toMatchObject({baseId:'destination',state:'flying',occupant:null,mission:{kind:'cruise',phase:'cruise'}});
  await f.connect();await f.connect(1);
  const second=await f.post('aircraft/deliver',{id:'source',kind:'attack-jet'});expect(second.status).toBe(200);
  expect((await f.post('aircraft/deliver',{id:'destination',kind:'bomber'})).status).toBe(409);
  expect((await f.post('aircraft/recall',{id:'source',landingBaseId:'source'})).status).toBe(409);
  expect((await f.post('aircraft/recall',{id:'source',landingBaseId:'destination'})).status).toBe(200);
  await f.restart();expect(await get()).toMatchObject({baseId:'destination',mission:{phase:'return'}});await f.connect();await f.connect(1);
  await expect.poll(async()=>(await get()).mission.phase,{timeout:24000}).toBe('complete');
  const admissions=await Promise.all([f.post('aircraft/board',{id:'destination'}),f.post('aircraft/board',{id:'destination'},1)]);
  expect(admissions.map(r=>r.status).sort()).toEqual([200,409]);expect((await get()).occupant).toMatch(/^[ab]$/);
  expect((await f.state()).airbases).toHaveLength(2);
 }finally{await f.close();}
},35000);
