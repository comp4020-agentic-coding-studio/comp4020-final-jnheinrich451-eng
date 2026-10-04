import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createWorld, canStand, tileAt, placementError } from '../public/world.js';
import { SHIP, shipSite, hull, hullCells, canSail, sailStep, mooredDock, shipSolution } from '../public/ship.js';
import { railError } from '../public/rail.js';
import { corePlacementError } from '../public/core.js';
import { tankPlacementError } from '../public/tank.js';
import { missilePlacementError } from '../public/missile.js';
import { createApp } from '../server.js';
const coast=()=>({...createWorld(),terrain:Array.from({length:48*36},(_,i)=>i%48<20?0:2 as number),ships:[] as any[],cores:[] as any[],tanks:[] as any[],rails:[] as any[],artillery:[] as any[]});
const vessel=()=>({...shipSite(coast(),[],[],17,12,'a').ship!,id:'ship-a',elapsed:SHIP.duration});
it('requires a complete water cradle near clear shore and never floors the ocean',()=>{
 const w=coast();expect(shipSite(w,[],[],24,12,'a').error).toContain('water');expect(shipSite(w,[],[],5,12,'a').error).toContain('shore');
 expect(shipSite(w,[],[],17,12,'a').ship?.dock).toMatchObject({x:20.5,y:12.5});
 w.terrain[12*48+16]=3;expect(shipSite(w,[],[],17,12,'a').error).toBeTruthy();w.terrain[12*48+16]=0;
 expect(shipSite(w,[{x:20,y:12}],[],17,12,'a').error).toBeTruthy();
 expect(shipSite(w,[],[{x:20.5,y:12.5}],17,12,'a').error).toBeTruthy();
 const s=vessel();w.ships.push(s);expect(shipSite(w,[],[],17,20,'a').error).toContain('One');expect(shipSite(w,[],[],17,12,'b').error).toBeTruthy();
 expect(tileAt(w,17,12)).toBe(0);expect(canStand(w,[],17.5,12.5)).toBe(false);expect(canStand(w,[],20.5,12.5)).toBe(true);
});
it('reserves the shore exit against sentries, rails, cores, tanks and batteries',()=>{
 const w=coast();w.ships.push(vessel());
 expect(placementError(w,[],[],20,12)).toContain('boarding');expect(railError(w,[],20,12,'EW',1,'b')).toContain('dock');
 expect(corePlacementError(w,[],[],20,12,'b')).toContain('dock');expect(tankPlacementError(w,[],[],20,12,'b')).toContain('dock');expect(missilePlacementError(w,[],[],20,12,'b')).toContain('dock');
});
it('sweeps sailing and turning against shore and other hulls, and requires alignment to dock',()=>{
 const w=coast(),s=vessel();w.ships.push(s);expect(canSail(w,s)).toBe(true);expect(mooredDock(w,s)).toBeTruthy();
 const cells=hullCells(hull({...s,angle:Math.PI/4}));expect(cells.length).toBeGreaterThan(8);
 sailStep(w,s,0,-1,4);expect(s.x).toBeLessThanOrEqual(18);expect(canSail(w,s)).toBe(true);
 s.x=12.5;s.y=12.5;expect(mooredDock(w,s)).toBeNull();
 const oldTurret=s.turret,oldAngle=s.angle;sailStep(w,s,1,0,.25);expect(s.angle-oldAngle).toBeCloseTo(SHIP.turnSpeed*.25);expect(s.turret).toBe(oldTurret);s.angle=oldAngle;
 const other={...vessel(),id:'ship-b',x:7.5,y:12.5};w.ships.push(other);sailStep(w,s,0,1,4);expect(s.x).toBeGreaterThanOrEqual(11.5);
 s.x=17.5;s.angle=0;expect(mooredDock(w,s)).toBeNull();s.angle=Math.PI/2;expect(mooredDock(w,s)).toBeTruthy();
});
it('uses current turret bearing with an independent target distance and range bounds',()=>{
 const s={...vessel(),turret:Math.PI/2};expect(shipSolution(s,{x:s.x,y:s.y+10})).toMatchObject({x:s.x+10,y:s.y,range:10,inRange:true});
 expect(shipSolution(s,{x:s.x,y:s.y+41}).inRange).toBe(false);expect(shipSolution(s,s).inRange).toBe(false);
});
async function fixture(ready=false,blocked=false,away=false,submarine=false,wreck=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-ship-'));let app=createApp({dataDir:dir});await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),tokens=[randomUUID(),randomUUID()];
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(coast()),'world');
 for(const[i,id]of['a','b'].entries()){db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,21.5,12.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-'+id,id,30,8+i*16,4.5);}
 if(ready){const s={...vessel(),occupant:'a',...(submarine?{kind:'submarine'}:{}),...(away?{x:17.8,y:20.5,angle:0,turret:0}:{}),...(wreck?{destroyed:true,health:0,occupant:null,replacement:0,reload:10,ramp:{x:20.5,y:12.5}}:{})};db.prepare('INSERT INTO ships VALUES (?,?)').run(s.id,JSON.stringify(s));}
 if(wreck){const gun={...shipSite(coast(),[],[],17,24,'a').ship!,id:'other-gun',elapsed:SHIP.duration};db.prepare('INSERT INTO ships VALUES (?,?)').run(gun.id,JSON.stringify(gun));}
 if(blocked)db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('block',20,12,'a','now');
 db.close();app=createApp({dataDir:dir});let base='',controllers:AbortController[]=[];
 const listen=async()=>{await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(app.server.address() as any).port}`;};await listen();
 const state=async(i=0)=>(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[i]}})).json();
 const post=async(route:string,data:any,i=0)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
 const connect=async(i=0)=>{const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body as any){}}catch{}})();};
 const restart=async()=>{controllers.forEach(c=>c.abort());controllers=[];await app.close();app=createApp({dataDir:dir});await listen();};
 return{state,post,connect,restart,close:async()=>{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-ship-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}};
}
it('authorizes submarine depth changes, blocks underwater operations and saves paused depth across restart',async()=>{
 const f=await fixture(true,false,false,true);try{
  expect((await f.post('ships/depth',{action:'dive'})).status).toBe(409);
  await f.connect();await f.connect(1);
  expect((await f.post('ships/depth',{action:'dive'},1)).status).toBe(409);
  expect((await f.post('ships/depth',{action:'invalid'})).status).toBe(400);
  expect((await f.post('ships/depth',{action:'dive'})).status).toBe(200);
  await expect.poll(async()=>(await f.state()).ships[0].depth,{timeout:4000}).toBe('submerged');
  for(const [route,data] of [['ships/fire',{x:40,y:20}],['ships/ramp',{deployed:true}],['ships/exit',{}],['ships/contact',{}]] as const){expect((await f.post(route,data)).status).toBe(409);}
  await f.restart();const saved=(await f.state()).ships[0];expect(saved.depth).toBe('submerged');expect(saved.diveBattery).toBeLessThan(30);
  await new Promise(r=>setTimeout(r,250));expect((await f.state()).ships[0].diveBattery).toBe(saved.diveBattery);
  // A disconnected pilot does not stop battery drain when another scout watches.
  await f.connect(1);await expect.poll(async()=>(await f.state()).ships[0].diveBattery).toBeLessThan(saved.diveBattery);
  await f.connect();expect((await f.post('ships/depth',{action:'surface'})).status).toBe(200);
  await expect.poll(async()=>(await f.state()).ships[0].depth,{timeout:4000}).toBe('surfaced');
  expect((await f.state()).combat.barrages).toHaveLength(0);expect((await f.post('ships/exit',{})).status).toBe(200);
 }finally{await f.close();}
});
it('saves orbital arrival, exclusive seat, sailing and ammunition; pauses unused worlds and resumes at sea',async()=>{
 const f=await fixture();try{
 await f.connect();await f.connect(1);expect((await f.post('ships',{x:25,y:12})).status).toBe(409);
 const deployed=await f.post('ships',{x:17,y:12});expect(deployed.status).toBe(201);const id=deployed.body.ship.id;
 expect((await f.post('ships',{x:17,y:12})).body.ship.id).toBe(id);expect((await f.post('ships/board',{id})).status).toBe(409);
 await expect.poll(async()=>(await f.state()).ships[0].elapsed).toBeGreaterThan(.2);await f.restart();const paused=(await f.state()).ships[0].elapsed;
 await new Promise(r=>setTimeout(r,250));expect((await f.state()).ships[0].elapsed).toBe(paused);await f.connect();await f.connect(1);
 await expect.poll(async()=>(await f.state()).ships[0].elapsed,{timeout:6500}).toBe(SHIP.duration);
 expect((await f.post('ships/board',{id})).status).toBe(200);expect((await f.post('ships/board',{id},1)).status).toBe(409);
 expect((await f.state()).me).toMatchObject({shipId:id,body:'ship',guarding:false});expect((await f.post('fire',{weapon:'HE',x:30,y:12})).status).toBe(409);
 // Input expires: one packet cannot send a ship sailing indefinitely.
 await f.post('input',{x:0,y:-1,aim:-Math.PI/2});await new Promise(r=>setTimeout(r,550));const stopped=(await f.state()).ships[0].x;
 await new Promise(r=>setTimeout(r,300));expect((await f.state()).ships[0].x).toBe(stopped);
 await f.post('input',{x:0,y:-1,aim:-Math.PI/2});await new Promise(r=>setTimeout(r,260));await f.post('input',{x:0,y:0,aim:-Math.PI/2});
 expect((await f.post('ships/exit',{})).status).toBe(409);await f.post('ships/ammo',{ammo:'GAS'});const before=await f.state();await f.restart();
 const after=await f.state();expect(after.me.shipId).toBe(id);expect(after.me.x).toBe(after.ships[0].x);expect(after.ships[0].x).toBe(before.ships[0].x);expect(after.ships[0].ammo).toBe('GAS');
 await f.connect();await f.connect(1);
 for(let i=0;i<4;i++){await f.post('input',{x:0,y:1,aim:-Math.PI/2});await new Promise(r=>setTimeout(r,150));}
 await f.post('input',{x:0,y:0,aim:-Math.PI/2});expect((await f.post('ships/exit',{})).status).toBe(200);
 expect((await f.state()).me).toMatchObject({body:'robot',shipId:null,x:20.5,y:12.5});
 await f.post('input',{x:1,y:0,aim:0});await new Promise(r=>setTimeout(r,300));await f.post('input',{x:0,y:0,aim:0});
 expect((await f.post('ships/board',{id},1)).status).toBe(200);
 }finally{await f.close();}
},18000);
it('prevents blocked disembarkation and forged ammo',async()=>{const f=await fixture(true,true);try{await f.connect();expect((await f.post('ships/exit',{})).status).toBe(409);expect((await f.state()).me.shipId).toBe('ship-a');expect((await f.post('ships/ammo',{ammo:'MAGNETIC'})).status).toBe(400);}finally{await f.close();}});
it('fires on server turret bearing, locks reload across ammo and restart, then creates fire and gas fields',async()=>{
 const f=await fixture(true);try{await f.connect();
 expect((await f.post('ships/fire',{x:18,y:12})).status).toBe(409);
 // Initial turret points west; cursor east does not snap it around.
 expect((await f.post('ships/fire',{x:27.5,y:12.5,angle:Math.PI/2,mode:'salvo'})).status).toBe(200);
 const flights=(await f.state()).combat.salvos;expect(flights).toHaveLength(4);
 expect(new Set(flights.map((s:any)=>s.owner)).size).toBe(4);
 for(const flight of flights){expect(flight.targetX).toBeLessThan(10);expect(flight.weapon).toBe('HE');}
 expect(flights[0].targetX).toBeCloseTo(6.45);expect(flights[0].targetY).toBeCloseTo(13.05);
 await f.post('ships/ammo',{ammo:'INCENDIARY'});expect((await f.post('ships/fire',{x:27.5,y:12.5})).status).toBe(409);
 await f.restart();expect((await f.state()).ships[0].reload).toBeGreaterThan(5);await f.connect();await f.post('input',{x:0,y:0,aim:Math.PI/2});
 for(const ammo of ['INCENDIARY','GAS']){
   await expect.poll(async()=>(await f.state()).ships[0].reload,{timeout:7000}).toBe(0);await f.post('ships/ammo',{ammo});
   expect((await f.post('ships/fire',{x:27.5,y:12.5})).status).toBe(200);
   await expect.poll(async()=>(await f.state()).combat.fields.some((v:any)=>v.weapon===ammo),{timeout:4000}).toBe(true);
 }
 }finally{await f.close();}
},23000);
it('authorizes side mounts, waits for traverse, fires during main reload and saves mount poses',async()=>{
 const f=await fixture(true);try{await f.connect();await f.connect(1);
 expect((await f.post('ships/secondary',{x:17.5,y:16.5},1)).status).toBe(409);
 expect((await f.post('ships/fire',{x:27.5,y:12.5})).status).toBe(200);
 // Hull initially faces west: port points south. Forged angle and weapon cannot change the mount.
 const shot=await f.post('ships/secondary',{x:17.5,y:16.5,angle:0,weapon:'HE'});
 expect(shot.body.fired).toBe(1);const first=await f.state();
 expect(first.ships[0].reload).toBeGreaterThan(5);expect(first.combat.shots.at(-1)).toMatchObject({owner:'ship-a:port',weapon:'NAVAL_APCR'});
 const target={x:14.5,y:15.5};expect((await f.post('ships/secondary',target)).body.fired).toBe(0);
 await expect.poll(async()=>Math.abs((await f.state()).ships[0].portTurret+Math.PI/2),{timeout:1500}).toBeGreaterThan(.3);
 await expect.poll(async()=>(await f.post('ships/secondary',target)).body.fired,{timeout:1500,interval:100}).toBe(1);
 const accepted=(await f.state()).combat.shots.filter((s:any)=>s.weapon==='NAVAL_APCR').map((s:any)=>s.id);
 await new Promise(r=>setTimeout(r,350));expect((await f.state()).combat.shots.filter((s:any)=>s.weapon==='NAVAL_APCR').map((s:any)=>s.id)).toEqual(accepted);
 await new Promise(r=>setTimeout(r,600));const pose=(await f.state()).ships[0];await f.restart();const saved=(await f.state()).ships[0];
 for(const key of ['turret','aftTurret','portTurret','starboardTurret'])expect(saved[key]).toBeCloseTo(pose[key]);
 expect((await f.post('ships/secondary',target)).status).toBe(409); // disconnected seat cannot fire
 }finally{await f.close();}
},8000);
it('fires alternating turret volleys, persists independent reloads and rejects forged modes',async()=>{
 const f=await fixture(true);try{await f.connect();
 expect((await f.post('ships/fire',{x:27.5,y:12.5,mode:'burst'})).status).toBe(409);
 expect((await f.post('ships/fire',{x:27.5,y:12.5})).status).toBe(200);
 const first=await f.state();expect(first.combat.salvos.map((s:any)=>s.mount)).toEqual(['fore','fore']);expect(first.ships[0].mainReloads.aft).toBe(0);
 await f.restart();const resumed=await f.state();expect(resumed.ships[0].mainReloads.fore).toBeGreaterThan(5);expect(resumed.ships[0].mainReloads.aft).toBe(0);
 await f.connect();await f.post('ships/ammo',{ammo:'INCENDIARY'});
 expect((await f.post('ships/fire',{x:27.5,y:12.5})).status).toBe(200);
 const second=await f.state();expect(second.combat.salvos.map((s:any)=>s.mount)).toEqual(['aft','aft']);
 expect((await f.post('ships/fire',{x:27.5,y:12.5,mode:'salvo'})).status).toBe(409);
 expect((await f.state()).combat.salvos).toHaveLength(2);
 }finally{await f.close();}
},8000);
it('anchors and saves a remote shore ramp, exits, reboards after restart and retracts before sailing',async()=>{
 const f=await fixture(true,false,true);try{await f.connect();await f.connect(1);
 expect((await f.post('ships/ramp',{deployed:true},1)).status).toBe(409);
 expect((await f.post('ships/ramp',{deployed:'yes'})).status).toBe(400);
 const landing=await f.post('ships/ramp',{deployed:true,x:40,y:30});expect(landing.status).toBe(200);
 expect(landing.body.ramp).toMatchObject({x:20.5,y:20.5});
 expect((await f.post('ships/ramp',{deployed:true})).body.ramp).toEqual(landing.body.ramp);
 await f.post('input',{x:1,y:-1,aim:0});await new Promise(r=>setTimeout(r,300));
 expect((await f.state()).ships[0]).toMatchObject({x:17.8,y:20.5,angle:0});
 expect((await f.post('ships/exit',{})).status).toBe(200);expect((await f.state()).me).toMatchObject({body:'robot',x:20.5,y:20.5,shipId:null});
 await f.restart();expect((await f.state()).ships[0].ramp).toEqual(landing.body.ramp);await f.connect();
 expect((await f.post('ships/ramp',{deployed:false})).status).toBe(409);
 expect((await f.post('ships/board',{id:'ship-a'})).status).toBe(200);
 expect((await f.post('ships/ramp',{deployed:false})).status).toBe(200);expect((await f.post('ships/ramp',{deployed:false})).status).toBe(200);
 await f.post('input',{x:0,y:-1,aim:0});await expect.poll(async()=>(await f.state()).ships[0].y).toBeLessThan(20.4);
 expect((await f.state()).ships[0].ramp).toBeNull();
 }finally{await f.close();}
},8000);

it('deploys and restores a submarine beside the same owners gunship without replacing it',async()=>{
 const f=await fixture(true);try{await f.connect();expect((await f.post('ships/exit',{})).status).toBe(200);
 expect((await f.post('ships',{x:17,y:24,kind:'carrier'})).status).toBe(400);
 const drop=await f.post('ships',{x:17,y:24,kind:'submarine'});expect(drop.status).toBe(201);expect(drop.body.ship.kind).toBe('submarine');
 expect((await f.post('ships',{x:17,y:24,kind:'submarine'})).body.ship.id).toBe(drop.body.ship.id);
 expect((await f.post('ships',{x:17,y:30,kind:'submarine'})).status).toBe(409);
 expect((await f.post('ships/board',{id:drop.body.ship.id})).status).toBe(409);
 await f.restart();const ships=(await f.state()).ships;expect(ships).toHaveLength(2);expect(ships.find((s:any)=>s.id===drop.body.ship.id).kind).toBe('submarine');expect(ships.find((s:any)=>s.id==='ship-a').kind).toBe('gunship');
 }finally{await f.close();}
});
it('authorizes submarine missiles, braces briefly, then sails and preserves shared ammo reload across restart',async()=>{
 const f=await fixture(true,false,false,true);try{await f.connect();await f.connect(1);
 expect((await f.post('ships/fire',{x:43,y:12},1)).status).toBe(409);
 expect((await f.post('ships/fire',{x:18,y:12})).status).toBe(409);expect((await f.state()).ships[0].reload).toBe(0);
 expect((await f.post('ships/secondary',{x:20,y:12})).status).toBe(400);
 expect((await f.post('ships/fire',{x:43,y:12,rotated:'yes'})).status).toBe(400);
 expect((await f.post('ships/fire',{x:43,y:12,rotated:true})).status).toBe(200);
 const before=await f.state();expect(before.combat.salvos).toHaveLength(0);expect(before.combat.barrages[0].missiles).toHaveLength(6);expect(before.combat.barrages[0].box).toMatchObject({width:8,height:6});
 await f.post('input',{x:0,y:-1,aim:0});await new Promise(r=>setTimeout(r,250));expect((await f.state()).ships[0].x).toBe(before.ships[0].x);
 await expect.poll(async()=>(await f.state()).ships[0].launchRemaining,{timeout:2500}).toBe(0);
 await f.post('input',{x:0,y:-1,aim:0});await expect.poll(async()=>(await f.state()).ships[0].x).toBeLessThan(before.ships[0].x);
 await f.post('ships/ammo',{ammo:'GAS'});expect((await f.post('ships/fire',{x:43,y:12})).status).toBe(409);
 await f.restart();const saved=await f.state();expect(saved.ships[0]).toMatchObject({kind:'submarine',ammo:'GAS',occupant:'a',launchRemaining:0});expect(saved.ships[0].reload).toBeGreaterThan(15);expect(saved.combat.barrages).toHaveLength(0);
 await f.connect();expect((await f.post('ships/fire',{x:43,y:12})).status).toBe(409);
 }finally{await f.close();}
},8000);

it('replaces the selected submarine in a two-vessel fleet without changing the gunship',async()=>{
 const f=await fixture(true,false,false,true,true);try{await f.connect();await f.connect(1);const before=(await f.state()).ships.find((s:any)=>s.id==='other-gun');
 expect((await f.post('vehicles/replace',{kind:'ship',id:'ship-a'},1)).status).toBe(404);
 const response=await f.post('vehicles/replace',{kind:'ship',id:'ship-a'});expect(response.status).toBe(200);expect(response.body.vehicle).toMatchObject({id:'ship-a',kind:'submarine',health:300,destroyed:false,elapsed:0,ramp:null,reload:0});
 expect((await f.post('vehicles/replace',{kind:'ship',id:'ship-a'})).status).toBe(200);const after=(await f.state()).ships;expect(after).toHaveLength(2);expect(after.find((s:any)=>s.id==='other-gun')).toEqual(before);
 }finally{await f.close();}
});
