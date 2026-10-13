import { expect, it } from 'vitest';
import { createApp } from '../server.js';
import { createWorld, tileAt, canStand } from '../public/world.js';
import { freshLogistics } from '../public/logistics.js';
import { freshLife } from '../public/survival.js';
import { mainMounts, mainSalvo, tickMainReloads } from '../public/ship-armament.js';
import { shipName, recallShipError, shipSite, replacementShipError, boardingPoint } from '../public/ship.js';
import { loadError, unloadPoint, driveGate, driveOnError } from '../public/transport.js';
import { tankPlacementError } from '../public/tank.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const flat=():any=>({...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),cores:[],tanks:[],ships:[],artillery:[],airbases:[],rails:[],sites:[],logistics:freshLogistics()});
const core={id:'friendly',owner:'b',x:10,y:28,elapsed:4.5};
const vessel=():any=>({id:'transport',kind:'transport',owner:'a',x:24.5,y:20.5,berthX:24.5,berthY:20.5,dock:{x:20.5,y:20.5,angle:Math.PI/2},angle:Math.PI/2,turret:Math.PI/2,elapsed:4.5,health:300,ammo:'HE',reload:0,occupant:null});
function river(w:any){for(let y=0;y<w.height;y++)for(let x=21;x<=40;x++)w.terrain[y*w.width+x]=0;return w;}
const vehicle=(kind:string):any=>({id:'cargo',kind,owner:'a',x:18.5,y:20.5,podX:12,podY:18,angle:0,turret:0,elapsed:4.5,remaining:0,health:147,weapon:'MAGNETIC',secondary:'HEAVY_FLAME',cargo:37,path:[],task:null,speed:0,occupant:null});
async function fixture(seed:(db:DatabaseSync,w:any,l:any)=>void=()=>{}){
  const dir=await mkdtemp(path.join(tmpdir(),'frontier-transport-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
  const db=new DatabaseSync(path.join(dir,'world.sqlite')),w=flat(),l:any=freshLogistics(),tokens=[randomUUID(),randomUUID()];
  for(const [i,id] of ['a','b'].entries())db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,32.5,42.5+i,0);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run(core.id,core.owner,core.x,core.y,core.elapsed);
  for(const id of ['a','b'])db.prepare('INSERT INTO robot_states VALUES (?,?)').run(id,JSON.stringify({...freshLife(),deployed:true}));
  seed(db,w,l);db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));db.close();
  let base='',controllers:AbortController[]=[];
  async function open(){app=createApp({dataDir:dir,logSink:()=>{}});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(app.server.address() as any).port}`;}await open();
  const state=async(i=0)=>(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[i]}})).json();
  const post=async(route:string,data:any={},i=0)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,data:await r.json()};};
  const connect=async(i=0)=>{const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body as any){}}catch{}})();return c;};
  return{state,post,connect,restart:async(change:((db:DatabaseSync)=>void)|null=null)=>{controllers.forEach(c=>c.abort());controllers=[];await app.close();if(change){const db=new DatabaseSync(path.join(dir,'world.sqlite'));change(db);db.close();}await open();},close:async()=>{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-transport-'))throw Error('Unexpected test path');await rm(dir,{recursive:true,force:true});}};
}

it('uses one bow turret with two barrels and preserves the gunship twin-turret layout',()=>{
  const s=vessel();expect(shipName(s)).toBe('Armored transport');expect(mainMounts(s)).toHaveLength(1);expect(mainSalvo(s,{x:35,y:20})).toHaveLength(2);
  expect(mainMounts({...s,kind:'gunship'})).toHaveLength(2);expect(mainSalvo({...s,kind:'gunship'},{x:35,y:20})).toHaveLength(4);
  s.mainReloads={fore:4,aft:99};tickMainReloads(s,1);expect(s.reload).toBe(3);expect(s.mainReloads).toEqual({fore:3});
});
it('requires stopped, empty, reachable cargo and clear landing space',()=>{
  const w=river(flat()),s=vessel(),v=vehicle('recycler');w.ships=[s];w.logistics.recyclers=[v];
  const cargo={kind:'utility',vehicle:v};expect(loadError(w,[],[],s,cargo)).toBeNull();v.occupant='b';expect(loadError(w,[],[],s,cargo)).toContain('Exit');v.occupant=null;
  w.logistics.bridges=[{builderId:v.id,from:{x:2,y:2},to:{x:4,y:2},elapsed:0}];expect(loadError(w,[],[],s,cargo)).toContain('Finish');w.logistics.bridges=[];
  const wall=Array.from({length:17},(_,i)=>({id:String(i),x:19,y:12+i}));expect(loadError(w,wall,[],s,cargo)).toContain('route');
  s.cargo=cargo;w.logistics.recyclers=[];expect(unloadPoint(w,[],[],s)).not.toBeNull();expect(recallShipError(w,s)).toContain('Unload');
  expect(unloadPoint(w,Array.from({length:49},(_,i)=>({x:17+i%7,y:17+Math.floor(i/7)})),[],s)).toBeNull();
});
for(const kind of ['tank','recycler','builder'])it('carries '+kind+' across water, retains its identity after restart and unloads once',async()=>{
  const f=await fixture((db,w,l)=>{
    river(w);db.prepare('UPDATE scouts SET x=20.5,y=20.5 WHERE id=?').run('a');db.prepare('INSERT INTO ships VALUES (?,?)').run('transport',JSON.stringify(vessel()));
    const v=vehicle(kind);if(kind==='tank')db.prepare('INSERT INTO tanks VALUES (?,?)').run(v.id,JSON.stringify(v));else {l.recyclers=[v];l.durability['recycler:cargo']={health:123,max:160,armor:1};}
  });try{
    await f.connect();expect((await f.post('ships/board',{id:'transport'})).status).toBe(200);
    expect((await f.post('ships/cargo',{action:'load',vehicleId:'cargo'})).status).toBe(200);expect((await f.post('ships/cargo',{action:'load',vehicleId:'cargo'})).status).toBe(200);
    let s=await f.state();expect(s.ships[0].cargo.vehicle.id).toBe('cargo');expect(kind==='tank'?s.tanks:s.logistics.recyclers).toHaveLength(0);
    if(kind==='tank')expect(tankPlacementError(s,[],[],5,5,'a')).toContain('aboard');
    expect((await f.post('ships/exit')).status).toBe(200);
    expect((await f.post(kind==='tank'?'tanks':'logistics/deploy',{kind,x:5,y:5})).status).toBe(409);
    expect((await f.post('ships/board',{id:'transport'})).status).toBe(200);
    await f.restart();await f.connect();s=await f.state();expect(s.ships[0].cargo.vehicle.id).toBe('cargo');expect(kind==='tank'?s.tanks:s.logistics.recyclers).toHaveLength(0);
    await expect.poll(async()=>{await f.post('input',{x:0,y:-1});return (await f.state()).ships[0].x;},{timeout:12000,interval:200}).toBeGreaterThan(37.5);
    await f.post('input',{x:0,y:0});await new Promise(r=>setTimeout(r,150));expect((await f.post('ships/ramp',{deployed:true})).status).toBe(200);
    expect((await f.post('ships/cargo',{action:'unload',vehicleId:'cargo'})).status).toBe(200);expect((await f.post('ships/cargo',{action:'unload',vehicleId:'cargo'})).status).toBe(200);
    await f.restart();s=await f.state();const list=kind==='tank'?s.tanks:s.logistics.recyclers;expect(list).toHaveLength(1);expect(list[0].id).toBe('cargo');expect(list[0].x).toBeGreaterThan(40);expect(s.ships[0].cargo).toBeNull();expect(list[0].weapon).toBe('MAGNETIC');
    if(kind!=='tank'){expect(list[0].cargo).toBe(37);expect(s.logistics.durability['recycler:cargo'].health).toBe(123);}else expect(list[0].health).toBe(147);
  }finally{await f.close();}
},22000);
it('retains cargo ownership limits and rejects another players vehicle',async()=>{
  const f=await fixture((db,w,l)=>{river(w);db.prepare('UPDATE scouts SET x=20.5,y=20.5 WHERE id=?').run('a');db.prepare('INSERT INTO ships VALUES (?,?)').run('transport',JSON.stringify(vessel()));l.recyclers=[{...vehicle('recycler'),owner:'b'}];});try{
    await f.connect();await f.post('ships/board',{id:'transport'});expect((await f.post('ships/cargo',{action:'load',vehicleId:'cargo'})).status).toBe(403);
  }finally{await f.close();}
});
it.each(['tank','recycler'])('loses %s cargo with its transport without duplication after restart',async kind=>{
  const f=await fixture((db,w,l)=>{river(w);const s=vessel();s.cargo={kind:kind==='tank'?'tank':'utility',vehicle:vehicle(kind)};s.health=1;db.prepare('INSERT INTO ships VALUES (?,?)').run(s.id,JSON.stringify(s));});try{
    // Seed the durable pending loss that the simulation processes on its next tick.
    await f.restart(db=>{const s=JSON.parse(db.prepare('SELECT value FROM ships WHERE id=?').get('transport')!.value as string);s.destroyed=true;s.damageDirty=true;s.health=0;db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(s),'transport');});await f.connect();
    await expect.poll(async()=>(await f.state()).ships[0].cargo).toBeNull();await f.restart();const s=await f.state();expect(s.ships[0].cargo).toBeNull();
    if(kind==='tank'){expect(s.tanks).toHaveLength(1);expect(s.tanks[0].destroyed).toBe(true);}else expect(s.logistics.recyclers).toHaveLength(0);
  }finally{await f.close();}
});

it.each(['gunship','submarine','transport'])('rebuilds a destroyed %s at its saved dock even with its owner on the shore platform',async kind=>{
  let original:any;
  const f=await fixture((db,w)=>{river(w);original={...shipSite(w,[],[],23,25,'a',kind,'unfolding').ship,id:'wreck',elapsed:4.5,destroyed:true,health:0,replacement:0};db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(original.dock.x,original.dock.y,'a');db.prepare('INSERT INTO ships VALUES (?,?)').run(original.id,JSON.stringify(original));});try{
    await f.connect();const before=(await f.state()).logistics.supplies;
    const r=await f.post('vehicles/replace',{kind:'ship',id:'wreck'});expect(r.status).toBe(200);expect(r.data.vehicle).toMatchObject({id:'wreck',kind,destroyed:false,health:300,elapsed:0,dock:original.dock,berthX:original.berthX,berthY:original.berthY});
    const cost=kind==='gunship'?240:kind==='submarine'?280:200;expect((await f.state()).logistics.supplies).toBe(before-cost);
    expect((await f.post('vehicles/replace',{kind:'ship',id:'wreck'})).status).toBe(200);expect((await f.state()).logistics.supplies).toBe(before-cost);
    await f.restart();await f.connect();await expect.poll(async()=>(await f.state()).ships[0].elapsed,{timeout:16000}).toBe(4.5);
    expect((await f.post('ships/board',{id:'wreck'})).status).toBe(200);
  }finally{await f.close();}
},20000);
it('explains damaged docks, repairs, timers and occupied berths before rebuilding',()=>{
  const w=river(flat()),s={...vessel(),destroyed:true,health:0,replacement:0};w.ships=[s];
  expect(replacementShipError(w,[{...s.dock,body:'robot'}],s)).toBeNull();
  s.dockDestroyed=true;expect(replacementShipError(w,[],s)).toContain('Repair');s.dockDestroyed=false;
  w.logistics.jobs[s.id]={repair:'dock',remaining:8};expect(replacementShipError(w,[],s)).toContain('repairs');w.logistics.jobs={};
  s.replacement=5;expect(replacementShipError(w,[],s)).toContain('5s');s.replacement=0;
  expect(replacementShipError(w,[{x:s.berthX,y:s.berthY}],s)).toContain('unit');
  expect(replacementShipError(w,[{x:s.berthX,y:s.berthY,body:'aircraft'}],s)).toBeNull();
  w.ships.push({...vessel(),id:'blocker'});expect(replacementShipError(w,[],s)).toContain('berth');
});

it('opens completed dock decks to ground units and keeps them during hull replacement or dock damage',()=>{
  const w=river(flat()),s:any={...shipSite(w,[],[],23,25,'a','transport','unfolding').ship,elapsed:0};w.ships=[s];
  expect(tileAt(w,23,25)).toBe(0);expect(canStand(w,[],23.5,25.5)).toBe(false);
  s.elapsed=4.5;expect(tileAt(w,23,25)).toBe(4);expect(canStand(w,[],23.5,25.5,null,.42)).toBe(true);
  const p={x:25.5,y:25.5};expect(boardingPoint(w,s,[],p)).toMatchObject(p);
  expect(recallShipError(w,s,[p])).toContain('Clear all units');
  s.dockReady=true;s.elapsed=0;s.dockDestroyed=true;expect(tileAt(w,23,25)).toBe(4);expect(canStand(w,[],23.5,25.5,null,.42)).toBe(true);
  expect(boardingPoint(w,s,[],p)).toBeNull();expect(tileAt(w,29,25)).toBe(0);
});
it('requires a free transport, deliberate drive-on input and a clear loading gate',()=>{
  const w=river(flat()),s:any={...shipSite(w,[],[],23,25,'a','transport','unfolding').ship,id:'t',elapsed:4.5};w.ships=[s];
  const gate=driveGate(w,[],s)!,v={...vehicle('recycler'),...gate,occupant:'a'},c={kind:'utility',vehicle:v};w.logistics.recyclers=[v];
  const input={x:s.x-gate.x,y:s.y-gate.y};expect(driveOnError(w,[],[],s,c,'a',input)).toBeNull();
  expect(driveOnError(w,[],[],s,c,'a',{x:-input.x,y:-input.y})).toContain('toward');
  s.occupant='b';expect(driveOnError(w,[],[],s,c,'a',input)).toContain('empty');s.occupant=null;
  expect(driveOnError(w,[],[{x:gate.x,y:gate.y,life:'active'}],s,c,'a',input)).toContain('Clear');
  w.logistics.bridges=[{builderId:v.id,from:{x:2,y:2},to:{x:4,y:2},elapsed:0}];expect(driveOnError(w,[],[],s,c,'a',input)).toContain('Finish');
});
for(const kind of ['tank','recycler','builder'])it('drives '+kind+' onto the pier transport and off with one persistent driver',async()=>{
  let gate:any,ship:any;
  const f=await fixture((db,w,l)=>{
    river(w);ship={...shipSite(w,[],[],23,25,'a','transport','unfolding').ship,id:'transport',elapsed:4.5,health:300};w.ships=[ship];gate=driveGate(w,[],ship);
    const v={...vehicle(kind),x:gate.x-1,y:gate.y,occupant:'a'};
    db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(v.x,v.y,'a');db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));
    if(kind==='tank')db.prepare('INSERT INTO tanks VALUES (?,?)').run(v.id,JSON.stringify(v));else l.recyclers=[v];
  });try{
    await f.connect();
    await expect.poll(async()=>{await f.post('input',{x:1,y:0});return (await f.state()).me.x;},{timeout:3000,interval:100}).toBeGreaterThan(gate.x-.15);
    await f.post('input',{x:0,y:0});let state=await f.state();expect(state.me.shipId).toBeFalsy();
    const input={x:Math.sign(ship.x-gate.x),y:Math.sign(ship.y-gate.y)};
    await expect.poll(async()=>{await f.post('input',input);return (await f.state()).me.shipId;},{timeout:3000,interval:100}).toBe('transport');
    state=await f.state();expect(state.ships[0].cargo.vehicle.occupant).toBeNull();expect(kind==='tank'?state.tanks:state.logistics.recyclers).toHaveLength(0);
    await f.restart();await f.connect();state=await f.state();expect(state.me.shipId).toBe('transport');expect(state.ships[0].cargo.vehicle.id).toBe('cargo');
    expect((await f.post('ships/cargo',{action:'drive-off',vehicleId:'cargo'})).status).toBe(200);
    expect((await f.post('ships/cargo',{action:'drive-off',vehicleId:'cargo'})).status).toBe(200);
    await f.restart();await f.connect();state=await f.state();const list=kind==='tank'?state.tanks:state.logistics.recyclers;
    expect(list).toHaveLength(1);expect(list[0]).toMatchObject({id:'cargo',occupant:'a',health:147,weapon:'MAGNETIC'});expect(state.ships[0].occupant).toBeNull();expect(state.ships[0].cargo).toBeNull();
    expect(state.me.shipId).toBeFalsy();expect(kind==='tank'?state.me.vehicleId:state.me.recyclerId).toBe('cargo');
    await f.post('input',{x:-input.x,y:-input.y});await new Promise(r=>setTimeout(r,250));expect((await f.state()).me.shipId).toBeFalsy();
  }finally{await f.close();}
},12000);
