import { it, expect } from 'vitest';
import { shipSite, recallShipError, SHIP, dockAt } from '../public/ship.js';
import { createApp } from '../server.js';
import { createWorld } from '../public/world.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const coast=()=>({...createWorld(),terrain:Array.from({length:48*36},(_,i)=>i%48<20?0:2),ships:[] as any[]});
it('protects incoming, occupied, away, submerged and shared berths while allowing an empty wreck to be cleared',()=>{
 const w=coast(),s:any={...shipSite(w,[],[],17,12,'a').ship,id:'s',elapsed:SHIP.duration};w.ships=[s];
 expect(recallShipError(w,s)).toBeNull();s.elapsed=1;expect(recallShipError(w,s)).toContain('deployment');s.elapsed=SHIP.duration;
 s.occupant='friend';expect(recallShipError(w,s)).toContain('Disembark');s.occupant=null;
 s.x-=4;expect(recallShipError(w,s)).toContain('original dock');s.destroyed=true;expect(recallShipError(w,s)).toBeNull();s.destroyed=false;s.x=s.berthX;
 s.kind='submarine';s.depth='submerged';expect(recallShipError(w,s)).toContain('surface');s.depth='surfaced';
 s.launchRemaining=1;expect(recallShipError(w,s)).toContain('launch');s.launchRemaining=0;
 w.ships.push({...s,id:'other'});expect(recallShipError(w,s)).toContain('Another ship');
});

it('recalls only the owner’s empty deployment, saves removal and permits the new dock at the old site',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-recall-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),w=coast(),tokens=[randomUUID(),randomUUID()];
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(w),'world');
 for(const[i,id]of['a','b'].entries()){db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,21.5,12.5+i*2,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-'+id,id,30,8+i*16,4.5);}
 const s={...shipSite(w,[],[],17,12,'a').ship,id:'old',elapsed:4.5};db.prepare('INSERT INTO ships VALUES (?,?)').run(s.id,JSON.stringify(s));db.close();
 const controllers:AbortController[]=[];let base='';
 const start=async()=>{app=createApp({dataDir:dir,logSink:()=>{}});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(app.server.address() as any).port}`;};
 const post=async(route:string,data:any,i=0)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
 const state=async(i=0)=>(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[i]}})).json();
 const connect=async(i=0)=>{const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body as any){}}catch{}})();};
 try{
  await start();expect((await post('ships/recall',{id:'old'})).status).toBe(409);await connect();await connect(1);
  expect((await post('ships/recall',{id:'old'},1)).status).toBe(403);expect((await post('ships/board',{id:'old'})).status).toBe(200);
  expect((await post('ships/recall',{id:'old'})).status).toBe(409);expect((await post('ships/exit',{})).status).toBe(200);
  expect((await post('ships/recall',{id:'old'})).status).toBe(200);expect((await state(1)).ships).toEqual([]);
  controllers.forEach(c=>c.abort());await app.close();await start();expect((await state()).ships).toEqual([]);
  expect(dockAt({...w,ships:(await state()).ships},20,12)).toBe(false);
  // The owner stepped off onto the old dock; move clear before redeploying over it.
  await connect();expect((await post('input',{x:1,y:0})).status).toBe(200);
  await expect.poll(async()=>(await state()).me.x).toBeGreaterThan(21.3);await post('input',{x:0,y:0});
  const replacement=await post('ships',{x:17,y:12,dockStyle:'unfolding'});expect(replacement.status).toBe(201);expect(replacement.body.ship.dockStyle).toBe('unfolding');
 }finally{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-recall-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}
});
