import { it, expect } from 'vitest';
import { createApp } from '../server.js';
import { createWorld } from '../public/world.js';
import { newAirbase, parkingPoint } from '../public/aircraft.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
async function fixture(landing=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-air-'));let app=createApp({dataDir:dir});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),tokens=[randomUUID(),randomUUID()];
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify({...createWorld(),width:128,height:96,version:2,terrain:Array(128*96).fill(2)}),'world');
 for(const [i,id] of ['a','b'].entries()){db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,54.6,56.5+i,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core'+id,id,75,60+i*16,4.5);}
 if(landing){const b:any=newAirbase('base','a',48,48);Object.assign(b.aircraft,{occupant:'a',state:'flying',y:parkingPoint(b).y+5.1,leftBase:true,speed:6,runs:0});db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));}
 db.close();app=createApp({dataDir:dir});let base='',controllers:AbortController[]=[];
 async function listen(){await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(app.server.address() as any).port}`;}await listen();
 const state=async(i=0)=>(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[i]}})).json();
 const post=async(route:string,data:any={},i=0)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
 const connect=async(i=0)=>{const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body as any){}}catch{}})();};
 const restart=async()=>{controllers.forEach(c=>c.abort());controllers=[];await app.close();app=createApp({dataDir:dir});await listen();};
 return{state,post,connect,restart,close:async()=>{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-air-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}};
}
it('deploys one saved airbase, admits one pilot and preserves flight, seat and spent ammunition across idle restart',async()=>{
 const f=await fixture();try{
  expect((await f.post('airbases',{x:48,y:48})).status).toBe(409);await f.connect();await f.connect(1);
  expect((await f.post('airbases',{x:0,y:0})).status).toBe(409);const built=await f.post('airbases',{x:48,y:48});expect(built.status).toBe(201);const id=built.body.airbase.id;
  expect((await f.post('airbases',{x:48,y:48})).status).toBe(200);expect((await f.post('airbases',{x:80,y:25})).status).toBe(409);
  expect((await f.post('aircraft/board',{id})).status).toBe(200);expect((await f.post('aircraft/board',{id},1)).status).toBe(409);
  expect((await f.state()).me).toMatchObject({body:'aircraft',aircraftId:id+':bomber'});
  for(const route of ['fire','ships/board','tanks/board','artillery/control','airbases','navigate'])expect((await f.post(route,{weapon:'HE',x:70,y:40})).status).toBe(409);
  expect((await f.post('aircraft/bomb')).status).toBe(409);await expect.poll(async()=>(await f.state()).airbases[0].aircraft.state,{timeout:4000}).toBe('flying');
  expect((await f.post('aircraft/bomb',{},1)).status).toBe(409);expect((await f.post('aircraft/bomb',{x:0,y:0,weapon:'GAS'})).status).toBe(200);
  const fired=await f.state();expect(fired.combat.barrages[0]).toMatchObject({kind:'bomber',weapon:'HE'});expect(fired.combat.barrages[0].missiles).toHaveLength(6);
  expect((await f.post('aircraft/bomb')).status).toBe(409);expect((await f.post('aircraft/exit')).status).toBe(409);
  await f.restart();const saved=(await f.state()).airbases[0].aircraft;expect(saved).toMatchObject({occupant:'a',state:'flying',runs:1,releaseRemaining:0});expect((await f.state()).combat.barrages).toHaveLength(0);
  await new Promise(r=>setTimeout(r,250));expect((await f.state()).airbases[0].aircraft.y).toBe(saved.y);
  await f.connect(1);await expect.poll(async()=>(await f.state()).airbases[0].aircraft.y).toBeLessThan(saved.y); // no disconnected-pilot freeze
  expect((await f.state()).me.aircraftId).toBe(id+':bomber');
 }finally{await f.close();}
});
it('lands automatically, persists servicing while idle, allows apron exit and restores a full load',async()=>{
 const f=await fixture(true);try{
  await f.connect();await expect.poll(async()=>(await f.state()).airbases[0].aircraft.state,{timeout:4000}).toBe('parked');
  expect((await f.post('aircraft/launch')).status).toBe(409);expect((await f.post('aircraft/exit')).status).toBe(200);expect((await f.state()).me).toMatchObject({body:'robot',aircraftId:null,x:53.5,y:56.5});
  await f.restart();const wait=(await f.state()).airbases[0].aircraft.rearm;await new Promise(r=>setTimeout(r,200));expect((await f.state()).airbases[0].aircraft.rearm).toBe(wait);
  await f.connect();await expect.poll(async()=>(await f.state()).airbases[0].aircraft.runs,{timeout:11000}).toBe(2);
  expect((await f.post('aircraft/board',{id:'base'})).status).toBe(200);
 }finally{await f.close();}
},20000);
