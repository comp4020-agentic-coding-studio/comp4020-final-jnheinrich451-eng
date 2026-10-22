import {randomUUID} from 'node:crypto';
import {it,expect} from 'vitest';
import {createApp} from '../server.js';
import {createWorld} from '../public/world.js';
import {shipSite,SHIP} from '../public/ship.js';
import {prepareCarrier,CARRIER} from '../public/carrier.js';
import {newAirbase} from '../public/aircraft.js';
import {airRecords} from '../public/air-traffic.js';
import {freshLife} from '../public/survival.js';
import {freshLogistics} from '../public/logistics.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
async function fixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-carrier-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const tokens:any={a:randomUUID(),b:randomUUID()};
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),w:any={...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128>=21&&i%128<70?0:2),ships:[],sites:[]};
 const s:any={...shipSite(w,[],[],23,35,'a','carrier','unfolding').ship,id:'carrier',elapsed:SHIP.duration,health:CARRIER.health,occupant:'a'};prepareCarrier(s);
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify({...freshLogistics(),groundSupplies:200}));
 for(const id of ['a','b']){db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[id],id,id,id==='a'?s.x:19.5,id==='a'?s.y:35.5,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run(id,JSON.stringify({...freshLife(),deployed:true}));}
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','a',10,28,4.5);db.prepare('INSERT INTO ships VALUES (?,?)').run(s.id,JSON.stringify(s));db.close();
 let url='',controllers:AbortController[]=[];
 const open=async()=>{app=createApp({dataDir:dir,logSink:()=>{}});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+(app.server.address() as any).port;};await open();
 const state=async(id='a')=>(await fetch(url+'/api/world',{headers:{Cookie:'frontier='+tokens[id]}})).json();
 const post=async(route:string,data:any={},id='a')=>{const r=await fetch(url+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[id],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
 const connect=async(id='a')=>{const c=new AbortController();controllers.push(c);const r=await fetch(url+'/api/events',{headers:{Cookie:'frontier='+tokens[id]},signal:c.signal});void(async()=>{try{for await(const v of r.body as any){}}catch{}})();};
 const restart=async(change?:(db:DatabaseSync)=>void)=>{controllers.forEach(c=>c.abort());controllers=[];await app.close();if(change){const db=new DatabaseSync(path.join(dir,'world.sqlite'));change(db);db.close();}await open();};
 return{state,post,connect,restart,close:async()=>{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-carrier-'))throw Error('Bad test path');await rm(dir,{recursive:true,force:true});}};
}
it('delivers once onto a carrier, launches cruise from the helm, reserves recovery and saves pilot transfers',async()=>{
 const f=await fixture();try{
  await f.connect();await f.connect('b');expect((await f.state()).me.body).toBe('ship');
  expect((await f.post('aircraft/deliver',{id:'carrier',kind:'bomber'})).status).toBe(200);expect((await f.post('aircraft/deliver',{id:'carrier',kind:'bomber'})).status).toBe(200);
  expect((await f.state()).logistics.supplies).toBe(1200);const position=(await f.state()).ships[0];expect((await f.post('input',{x:1,y:0,shipId:'carrier',throttle:4})).status).toBe(409);await new Promise(r=>setTimeout(r,150));expect((await f.state()).ships[0]).toMatchObject({x:position.x,y:position.y,angle:position.angle});await f.post('input',{x:0,y:0});
  await expect.poll(async()=>(await f.state()).ships[0].aircraft.state,{timeout:6000}).toBe('parked');
  expect((await f.post('aircraft/cruise',{id:'carrier'})).status).toBe(200);await expect.poll(async()=>(await f.state()).ships[0].aircraft.mission.phase,{timeout:4000}).toBe('cruise');
  expect((await f.state()).me.body).toBe('ship');expect((await f.post('aircraft/deliver',{id:'carrier',kind:'attack-jet'})).status).toBe(409);
  await f.restart();expect((await f.state()).ships[0].aircraft.mission.phase).toBe('cruise');await f.connect();await f.connect('b');
  expect((await f.post('aircraft/recall',{id:'carrier',landingBaseId:'carrier'})).status).toBe(200);expect((await f.post('input',{x:1,y:0,shipId:'carrier',throttle:4})).status).toBe(409);await new Promise(r=>setTimeout(r,150));expect((await f.state()).ships[0]).toMatchObject({x:position.x,y:position.y,angle:position.angle});await f.post('input',{x:0,y:0});
  await expect.poll(async()=>(await f.state()).ships[0].aircraft.mission.phase,{timeout:25000}).toBe('complete');
  expect((await f.post('aircraft/board',{id:'carrier'})).status).toBe(200);let state=await f.state();expect(state.me.body).toBe('aircraft');expect(state.ships[0].occupant).toBeNull();expect(state.ships[0].aircraft.occupant).toBe('a');
  await f.restart(db=>{const s:any=JSON.parse((db.prepare('SELECT value FROM ships WHERE id=?').get('carrier') as any).value);Object.assign(s.aircraft,{state:'parked',x:s.x,y:s.y,angle:s.angle,speed:0,mission:{phase:'complete'}});db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(s),s.id);});
  await f.connect();expect((await f.post('aircraft/exit')).status).toBe(200);state=await f.state();expect(state.me.body).toBe('ship');expect(state.ships[0].aircraft.occupant).toBeNull();expect(state.ships[0].occupant).toBe('a');await f.restart();expect((await f.state()).me.body).toBe('ship');
 }finally{await f.close();}
},45000);
it('keeps airborne aircraft after sinking and diverts saved cruise to a free land runway',async()=>{
 const f=await fixture();try{
  await f.restart(db=>{const s:any=JSON.parse((db.prepare('SELECT value FROM ships WHERE id=?').get('carrier') as any).value),b:any=newAirbase('land','a',85,40);b.aircraft.state='vacant';b.aircraft.health=0;db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));
   s.destroyed=true;s.health=0;s.occupant=null;s.replacement=0;s.deckSupplies=70;s.aircraft={...newAirbase(s.id,'a',0,0).aircraft,state:'flying',x:60,y:45,speed:6,leftBase:true,mission:{id:'patrol',kind:'cruise',phase:'cruise',elapsed:5,cruiseCenter:{x:50,y:40},cruiseIndex:0,target:{x:50,y:40},entry:{x:50,y:40},points:[]}};db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(s),s.id);
   db.prepare('UPDATE scouts SET x=19.5,y=35.5 WHERE id=?').run('a');});await f.connect();
  await expect.poll(async()=>(await f.state()).ships[0].aircraft.baseId,{timeout:3000}).toBe('land');
  expect((await f.state()).ships[0].aircraft.state).toBe('flying');expect((await f.post('ships/recall',{id:'carrier',keepYard:true})).status).toBe(409);
  expect((await f.post('vehicles/replace',{kind:'ship',id:'carrier',vesselKind:'gunship'})).status).toBe(409);
  expect((await f.post('vehicles/replace',{kind:'ship',id:'carrier',vesselKind:'carrier'})).status).toBe(200);
  await f.restart();let state=await f.state();expect(state.ships[0].deckSupplies).toBe(0);expect(airRecords(state).filter(b=>!['destroyed','vacant'].includes(b.aircraft.state))).toHaveLength(1);await f.connect();
  await expect.poll(async()=>(await f.state()).ships[0].aircraft.state,{timeout:23000}).toBe('parked');state=await f.state();expect(state.ships[0].aircraft).toMatchObject({baseId:'land',x:87,y:47.5});
 }finally{await f.close();}
},35000);

it('builds one empty carrier per shipyard for GND and persists assembly without granting an aircraft',async()=>{
 const f=await fixture();try{
  await f.restart(db=>{db.prepare('DELETE FROM ships WHERE id=?').run('carrier');db.prepare('UPDATE scouts SET x=19.5,y=35.5 WHERE id=?').run('a');});await f.connect();
  const order=await f.post('ships',{yardId:'carrier',kind:'carrier'});expect(order.status).toBe(201);expect(order.body.ship).toMatchObject({kind:'carrier',health:600,assemblyDuration:60,deckSupplies:0,aircraft:{state:'vacant'}});
  expect((await f.state()).logistics.groundSupplies).toBe(100);expect((await f.post('ships',{yardId:'carrier',kind:'carrier'})).status).toBe(200);expect((await f.state()).logistics.groundSupplies).toBe(100);
  expect((await f.post('aircraft/deliver',{id:order.body.ship.id,kind:'bomber'})).status).toBe(409);
  await f.restart();const state=await f.state();expect(state.ships).toHaveLength(1);expect(state.ships[0].assemblyRemaining).toBeGreaterThan(59);expect(state.ships[0].aircraft.state).toBe('vacant');
 }finally{await f.close();}
},8000);
