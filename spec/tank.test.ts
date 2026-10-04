import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createWorld, canStand, tileAt, placementError } from '../public/world.js';
import { TANK, tankPodCells, tankPodCell, tankPlacementError } from '../public/tank.js';
import { corePlacementError } from '../public/core.js';
import { railError } from '../public/rail.js';
import { missilePlacementError } from '../public/missile.js';
import { createApp } from '../server.js';

const flat = () => ({ ...createWorld(), terrain:Array(48*36).fill(2), tanks:[] as any[], cores:[] as any[] });
const tank = () => ({id:'tank',owner:'a',podX:30,podY:19,x:32.5,y:19.5,elapsed:TANK.duration,angle:Math.PI/2,turret:Math.PI/2,occupant:null as string|null,weapon:'HE',secondary:'APCR'});
it('shares pod timing with a 17-cell cross, reserves panels and preserves terrain beneath flooring', () => {
  const w=flat(),t={...tank(),elapsed:0};w.tanks.push(t);w.terrain[18*48+30]=3;
  expect(tankPodCells(30,19)).toHaveLength(17);expect(tankPodCell(t,26,15)).toBeNull();
  expect(canStand(w,[],30.5,18.5)).toBe(false);expect(tileAt(w,30,18)).toBe(3);
  t.elapsed=TANK.duration;
  expect(tileAt(w,30,18)).toBe(4);expect(w.terrain[18*48+30]).toBe(3);expect(canStand(w,[],30.5,18.5)).toBe(true);
  expect(canStand(w,[],32.5,19.5)).toBe(false);expect(canStand(w,[],32.5,19.5,t.id,TANK.radius)).toBe(true);
});
it('rejects ocean, edges, overlapping pods, units and parked tanks while allowing rock conversion', () => {
  const w=flat();w.terrain[18*48+30]=3;
  expect(tankPlacementError(w,[],[],30,19,'a')).toBeNull();
  expect(tankPlacementError(w,[],[],1,1,'a')).toBeTruthy();
  w.terrain[18*48+30]=0;expect(tankPlacementError(w,[],[],30,19,'a')).toContain('Ocean');w.terrain[18*48+30]=2;
  expect(tankPlacementError(w,[],[{x:30.5,y:15.5}],30,19,'a')).toContain('unit');
  w.tanks.push(tank());expect(tankPlacementError(w,[],[],35,20,'a')).toContain('already');
  expect(tankPlacementError(w,[],[],30,19,'b')).toContain('pod');
});
it('reserves incoming pods against every construction type and parked tanks against rails and sentries', () => {
  const w=flat();w.tanks.push({...tank(),elapsed:0});
  expect(placementError(w,[],[],30,18)).toContain('pod');
  expect(railError(w,[],30,18,'EW',1,'b')).toContain('pod');
  expect(corePlacementError(w,[],[],29,15,'b')).toContain('tank');
  expect(missilePlacementError(w,[],[],30,18,'b')).toContain('tank');
  w.tanks[0].elapsed=TANK.duration;
  expect(placementError(w,[],[],32,19)).toContain('tank');
  expect(railError(w,[],32,19,'EW',1,'b')).toContain('tank');
});

async function fixture(occupied=false, blocked=false) {
  const dir=await mkdtemp(path.join(tmpdir(),'frontier-tank-'));let app=createApp({dataDir:dir});await app.close();
  const db=new DatabaseSync(path.join(dir,'world.sqlite')),tokens=[randomUUID(),randomUUID()];
  db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(flat()),'world');
  for(const [i,id] of ['a','b'].entries()){
    db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,occupied?32.5:24.5,occupied?19.5:18.5,0);
  }
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-a','a',10,10,4.5);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-b','b',10,25,4.5);
  if(occupied){const t={...tank(),occupant:'a'};db.prepare('INSERT INTO tanks VALUES (?,?)').run(t.id,JSON.stringify(t));}
  if(blocked) for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run(`${dx},${dy}`,32+dx,19+dy,'a','now');
  db.close();app=createApp({dataDir:dir});let base='',controllers:AbortController[]=[];
  async function listen(){await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(app.server.address() as any).port}`;}
  await listen();
  const state=async(i=0)=>(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[i]}})).json();
  const post=async(route:string,data:any,i=0)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
  const connect=async(i=0)=>{const controller=new AbortController();controllers.push(controller);const res=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:controller.signal});void (async()=>{try{for await(const chunk of res.body as any){} }catch{}})();};
  const restart=async()=>{controllers.forEach(c=>c.abort());controllers=[];await app.close();app=createApp({dataDir:dir});await listen();};
  return{dir,state,post,connect,restart,close:async()=>{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-tank-'))throw Error('Invalid temporary directory');await rm(dir,{recursive:true,force:true});}};
}
it('saves a resumable drop, pauses unused worlds, boards exclusively, drives, saves loadout and exits without duplicating robots', async()=>{
  const f=await fixture();try{
    await f.connect();await f.connect(1);
    const deployed=await f.post('tanks',{x:30,y:19});expect(deployed.status).toBe(201);const id=deployed.body.tank.id;
    expect((await f.post('tanks',{x:30,y:19})).body.tank.id).toBe(id);expect((await f.post('tanks',{x:38,y:22})).status).toBe(409);
    expect((await f.post('tanks/board',{id})).status).toBe(409);
    await expect.poll(async()=>(await f.state()).tanks[0].elapsed).toBeGreaterThan(.3);
    await f.restart();const paused=(await f.state()).tanks[0].elapsed;await new Promise(r=>setTimeout(r,250));expect((await f.state()).tanks[0].elapsed).toBe(paused);
    await f.connect();await expect.poll(async()=>(await f.state()).tanks[0].elapsed,{timeout:6500}).toBe(TANK.duration);
    expect((await f.post('tanks/board',{id})).status).toBe(409);
    expect((await f.post('navigate',{x:31,y:19})).status).toBe(200);
    await expect.poll(async()=>Math.hypot((await f.state()).me.x-32.5,(await f.state()).me.y-19.5),{timeout:6000}).toBeLessThan(1.8);
    expect((await f.post('tanks/board',{id})).status).toBe(200);
    await f.connect(1);expect((await f.post('tanks/board',{id},1)).status).toBe(409);
    expect((await f.state()).me).toMatchObject({body:'rover',vehicleId:id,guarding:false});
    expect((await f.post('tank-weapon',{weapon:'MAGNETIC'})).status).toBe(200);
    expect((await f.post('tank-weapon',{slot:'secondary',weapon:'HEAVY_FLAME'})).status).toBe(200);
    expect((await f.post('input',{x:1,y:0,aim:Math.PI/2})).status).toBe(200);
    await expect.poll(async()=>(await f.state()).tanks[0].x).toBeGreaterThan(32.7);
    await f.post('input',{x:0,y:0,aim:Math.PI/2});await f.restart();const resumed=await f.state();
    expect(resumed.me).toMatchObject({vehicleId:id,body:'rover',tankWeapon:'MAGNETIC',tankSecondary:'HEAVY_FLAME'});expect(resumed.me.x).toBe(resumed.tanks[0].x);
    await f.connect();expect((await f.post('fire',{weapon:'MAGNETIC',x:resumed.me.x+5,y:resumed.me.y})).status).toBe(200);
    expect((await f.post('tanks/exit',{})).status).toBe(200);const exited=await f.state();
    expect(exited.me).toMatchObject({vehicleId:null,body:'robot',health:100});expect(exited.tanks[0].occupant).toBeNull();expect(exited.combat.charges).toHaveLength(0);
    expect(Math.hypot(exited.me.x-exited.tanks[0].x,exited.me.y-exited.tanks[0].y)).toBeGreaterThan(.8);
  }finally{await f.close();}
},20000);
it('keeps the robot aboard when every adjacent exit is obstructed',async()=>{
  const f=await fixture(true,true);try{await f.connect();expect((await f.post('tanks/exit',{})).status).toBe(409);expect((await f.state()).me.vehicleId).toBe('tank');}finally{await f.close();}
});
