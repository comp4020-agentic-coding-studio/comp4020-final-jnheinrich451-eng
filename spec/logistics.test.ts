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
it('requires a whole land footprint within completed friendly support and allows extending it with a ready factory',()=>{
  const w=flat();w.cores=[core];
  expect(constructionError(w,'airbase',48,32)).toBeNull();
  expect(constructionError(w,'airbase',58,28)).toContain('whole facility');
  expect(constructionError(w,'airbase',88,60)).toBeTruthy();
  w.cores=[{...core,elapsed:4}];expect(constructionError(w,'missile',42,38)).toBeTruthy();
  w.cores=[];w.logistics.facilities=[{id:'f',kind:'factory',x:65,y:40,remaining:1}];
  expect(constructionError(w,'airbase',70,45)).toBeTruthy();w.logistics.facilities[0].remaining=0;
  expect(constructionError(w,'airbase',70,45)).toBeNull();
  expect(constructionError(w,'tank',110,70)).toBeTruthy();expect(constructionError(w,'sentry',110,70)).toBeTruthy();
  expect(canStand(w,[],65.5,40.5)).toBe(false);
});
it('checks the shore platform rather than the sea end of a dock',()=>{
  const w=flat();w.cores=[core];
  expect(constructionError(w,'ship',10,29,{dockStyle:'unfolding',dock:{x:15,y:29.5,angle:Math.PI/2}})).toBeNull();
  expect(constructionError(w,'ship',15,29,{dockStyle:'unfolding',dock:{x:13,y:29.5,angle:Math.PI/2}})).toBeTruthy();
});
it('keeps finite salvage, collection progress and launch credit across serialized return without overfilling storage',()=>{
  const l:any=freshLogistics(),site=makeSite('alert','ruin',20,20),truck:any={x:23.5,y:21.5,cargo:0,collecting:0,task:{action:'collect'}};site.state='conquered';
  expect(collectSalvage(l,site,truck,4)).toBe(true);expect(truck.cargo).toBe(0);
  const saved=JSON.parse(JSON.stringify({l,truck}));collectSalvage(saved.l,site,saved.truck,4);
  expect(saved.truck.cargo).toBe(180);expect(saved.l.salvage.ruin).toBe(0);
  expect(collectSalvage(saved.l,site,{...truck,cargo:0},8)).toBe(false);expect(site.state).toBe('conquered');
  saved.l.supplies=1990;const station={cargo:180,launch:5};tickLaunch(saved.l,station,2);
  const returned=JSON.parse(JSON.stringify(station));tickLaunch(saved.l,returned,3);
  expect(saved.l.supplies).toBe(2000);expect(returned.cargo).toBe(170);expect(saved.l.shipments).toBe(1);
  tickLaunch(saved.l,returned,10);expect(saved.l.shipments).toBe(1);
  l.supplies=249;tickSupplies(l,10);expect(l.supplies).toBe(250);l.supplies=300;tickSupplies(l,10);expect(l.supplies).toBe(300);
});
it('lets crawlers approach and damage facilities, while armor rejects insufficient penetration and friendly shells cannot damage them',()=>{
  const w=flat();w.logistics.facilities=[{id:'factory',kind:'factory',x:20,y:20,remaining:0}];
  const target=facilityTargets(w)[0];expect(hurtFacility(target,100,1)).toBe(false);expect(target.hp.health).toBe(400);
  const initial=createCombat(w).checkpoint();initial.enemies=[{id:77,x:17.5,y:21.5,hp:10000,angle:0,path:[],reroute:0}];
  const c=createCombat(w,initial);for(let i=0;i<100;i++)c.tick(.1,[]);
  expect(target.hp.health).toBeLessThan(400);const before=target.hp.health;
  expect(c.lob({id:'friendly',x:15,y:21},21,21,null,'HE')).toBeNull();
  const quiet=c.checkpoint();quiet.enemies=[];const friendly=createCombat(w,quiet);friendly.tick(6,[]);expect(target.hp.health).toBe(before);
});
it('keeps an airborne aircraft flying after base loss and waits for funded replacement after aircraft loss',()=>{
  const w=flat(),base:any=newAirbase('a','a',40,40);w.airbases=[base];base.destroyed=true;
  Object.assign(base.aircraft,{state:'flying',x:42,y:47,leftBase:true,speed:6,angle:0});tickAircraft(w,base,null,.1);expect(base.aircraft.state).toBe('flying');
  Object.assign(base.aircraft,{state:'destroyed',remaining:.1,health:0});tickAircraft(w,base,null,1);expect(base.aircraft.state).toBe('destroyed');
  w.logistics.supplies=0;expect(emergencyTankError(w)).toBeNull();w.tanks=[{destroyed:false}];expect(emergencyTankError(w)).toBeTruthy();
});

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
it('enforces remote placement at HTTP admission, spends only accepted deployments and retains them through restart',async()=>{
  const f=await fixture();try{
    await f.connect();const before=(await f.state()).logistics.supplies;
    expect((await f.post('airbases',{x:88,y:60,method:'factory',factoryId:'friendly'})).data.error).toContain('24 tiles');
    expect((await f.post('missiles',{x:90,y:60,method:'factory',factoryId:'friendly'})).data.error).toContain('24 tiles');
    const accepted=await f.post('airbases',{x:48,y:32});expect(accepted.status).toBe(201);
    expect((await f.state()).logistics.supplies).toBe(before-300);
    expect((await f.post('airbases',{x:48,y:32})).status).toBe(200);expect((await f.state()).logistics.supplies).toBe(before-300);
    await f.restart();expect((await f.state()).airbases[0].id).toBe(accepted.data.airbase.id);expect((await f.state()).logistics.supplies).toBe(before-300);
    const time=(await f.state()).logistics.time;await new Promise(r=>setTimeout(r,200));expect((await f.state()).logistics.time).toBe(time);
  }finally{await f.close();}
});
it('serializes shared spending so simultaneous requests cannot overdraw or build unpaid objects',async()=>{
  const f=await fixture((_db,_w,l)=>l.supplies=25);try{
    const result=await Promise.all([f.post('buildings',{x:50,y:60}),f.post('buildings',{x:51,y:60},1)]);
    expect(result.map(r=>r.status).sort()).toEqual([201,409]);const s=await f.state();expect(s.logistics.supplies).toBe(0);expect(s.buildings.filter((b:any)=>!b.coreId)).toHaveLength(1);
    await f.restart();expect((await f.state()).logistics.supplies).toBe(0);
  }finally{await f.close();}
});
it('reserves discounted construction, blocks premature operation and refunds only half when cancelling',async()=>{
  const f=await fixture((_db,_w,l)=>l.facilities.push({id:'factory',owner:'a',kind:'factory',x:48,y:24,remaining:0,cargo:0}));try{
    await f.connect();const r=await f.post('missiles',{x:54,y:36,method:'factory',factoryId:'factory'});expect(r.status).toBe(201);
    expect((await f.state()).logistics.groundSupplies).toBe(1145);
    expect((await f.post('artillery/control',{id:r.data.gun.id})).data.error).toContain('construction');
    await f.restart();expect((await f.state()).logistics.jobs[r.data.gun.id].remaining).toBeGreaterThan(0);await f.connect();
    expect((await f.post('logistics/cancel',{id:r.data.gun.id},1)).status).toBe(409);
    expect((await f.post('logistics/cancel',{id:r.data.gun.id})).status).toBe(200);
    const s=await f.state();expect(s.artillery).toHaveLength(0);expect(s.logistics.groundSupplies).toBe(1172);
    expect((await f.post('logistics/cancel',{id:r.data.gun.id})).status).toBe(409);await f.restart();expect((await f.state()).artillery).toHaveLength(0);
  }finally{await f.close();}
});
it('recovers from an exhausted economy and no cores, including a new HE drop and free robot recovery',async()=>{
  const f=await fixture((db,_w,l)=>{l.supplies=0;db.exec('DELETE FROM cores');db.prepare('UPDATE robot_states SET value=? WHERE scout_id=?').run(JSON.stringify({...freshLife(),health:0,life:'disabled',deployed:true}),'a');});try{
    await f.connect();expect((await f.post('recovery/orbit')).status).toBe(200);expect((await f.state()).me.body).toBe('orbital');
    expect((await f.post('cores',{x:36,y:28})).status).toBe(201);
    await expect.poll(async()=>(await f.state()).me.deploying,{timeout:6500}).toBe(false);
    const tank=await f.post('tanks',{x:50,y:42,emergency:true});expect(tank.status).toBe(201);expect(tank.data.tank).toMatchObject({weapon:'HE',emergency:true});
    expect((await f.post('tanks',{x:65,y:42,emergency:true},1)).status).toBe(409);
    await f.restart();expect((await f.state()).me.body).toBe('robot');expect((await f.state()).tanks).toHaveLength(1);
  }finally{await f.close();}
},12000);
it('completes a saved rocket once and drops unlaunched cargo when the station is destroyed',async()=>{
  const f=await fixture((_db,_w,l)=>{l.facilities=[{id:'shipper',owner:'a',kind:'uplink',x:44,y:30,remaining:0,cargo:180,launch:.4},{id:'lost',owner:'a',kind:'uplink',x:44,y:40,remaining:0,cargo:90,launch:0}];l.durability['uplink:lost']={health:0,max:300,armor:2};});try{
    await f.connect();await expect.poll(async()=>(await f.state()).logistics.shipments).toBe(1);
    const l=(await f.state()).logistics;expect(l.supplies).toBe(1380);expect(l.crates[0].amount).toBe(90);expect(l.facilities).toHaveLength(1);
    await f.restart();expect((await f.state()).logistics.supplies).toBe(1380);await f.connect();await new Promise(r=>setTimeout(r,200));expect((await f.state()).logistics.shipments).toBe(1);
  }finally{await f.close();}
});
it('retains deployed identity and safe flooring when the last core is destroyed, including its offline owner',async()=>{
  const f=await fixture((_db,w,l)=>{w.terrain[27*128+37]=3;l.durability['core:friendly']={health:0,max:500,armor:2};});try{
    await f.connect();await expect.poll(async()=>(await f.state()).cores.length).toBe(0);
    const s=await f.state(1);expect(s.me.body).toBe('robot');expect(s.logistics.floors).toContain(27*s.world.width+37);expect(canStand(s.world,[],37.5,27.5)).toBe(true);
    await f.restart();expect((await f.state(1)).me.body).toBe('robot');expect((await f.state()).cores).toHaveLength(0);
  }finally{await f.close();}
});
it('cancels unfinished orders when their factory is lost without deleting completed equipment',async()=>{
  const f=await fixture((db,_w,l)=>{
    l.supplies=1000;l.facilities=[{id:'factory',owner:'a',kind:'factory',x:48,y:24,remaining:0,cargo:0}];l.durability['factory:factory']={health:0,max:400,armor:2};
    l.jobs.pending={kind:'missile',remaining:15,factoryId:'factory',cost:132};
    for(const id of ['pending','complete'])db.prepare('INSERT INTO artillery VALUES (?,?)').run(id,JSON.stringify({id,owner:'a',kind:'missile',x:id==='pending'?54:60,y:36,reload:0,ammo:'HE'}));
  });try{
    await f.connect();await expect.poll(async()=>(await f.state()).logistics.facilities.length).toBe(0);
    const s=await f.state();expect(s.artillery.map((g:any)=>g.id)).toEqual(['complete']);expect(s.logistics.jobs).toEqual({});expect(s.logistics.supplies).toBe(1066);
    await f.restart();expect((await f.state()).artillery.map((g:any)=>g.id)).toEqual(['complete']);
  }finally{await f.close();}
});
it('repairs a saved airbase without replacing its airborne aircraft or taking a second payment on retry',async()=>{
  const f=await fixture((db,_w,l)=>{
    const base:any=newAirbase('lostbase','a',48,48);base.destroyed=true;Object.assign(base.aircraft,{state:'flying',speed:6,x:55,y:50,angle:0,leftBase:true});
    db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));l.durability['airbase:lostbase']={health:0,max:500,armor:2};
  });try{
    await f.connect();expect((await f.post('logistics/repair',{kind:'airbase',id:'lostbase'})).status).toBe(200);
    expect((await f.post('logistics/repair',{kind:'airbase',id:'lostbase'})).status).toBe(409);expect((await f.state()).logistics.groundSupplies).toBe(1050);
    await f.restart();await f.connect();await expect.poll(async()=>(await f.state()).airbases[0].destroyed,{timeout:11000}).toBe(false);
    expect((await f.state()).airbases[0].aircraft.id).toBe('lostbase:bomber');expect((await f.state()).logistics.groundSupplies).toBe(1050);
  }finally{await f.close();}
},16000);
it('rejects unknown prototype properties as deployment kinds without corrupting supplies',async()=>{
  const f=await fixture();try{await f.connect();expect((await f.post('logistics/deploy',{kind:'__proto__',x:50,y:50})).status).toBe(400);expect((await f.state()).logistics.supplies).toBe(1200);}finally{await f.close();}
});


it('drives the recycler at bounded speed, blocks terrain and bodies, and requires a safe exit',()=>{
  const w=flat(),r:any={id:'r',x:20.5,y:20.5,angle:0,occupant:'a',cargo:0,remaining:0,path:[]};w.logistics.recyclers=[r];
  recyclerStep(w,[],r,{x:1,y:1},.1);expect(Math.hypot(r.x-20.5,r.y-20.5)).toBeCloseTo(RECYCLER.speed*.1);
  w.terrain.fill(0);const before={x:r.x,y:r.y};expect(recyclerStep(w,[],r,{x:1,y:0},.1)).toBe(false);expect({x:r.x,y:r.y}).toEqual(before);expect(recyclerExit(w,[],r)).toBeNull();
  w.terrain.fill(2);expect(recyclerExit(w,[],r)).not.toBeNull();const other={id:'b',x:r.x+.5,y:r.y,life:'active'};
  expect(recyclerStep(w,[],r,{x:1,y:0},.1,[other])).toBe(false);
});
it('chooses unloading before salvage and preserves bounded corpse cargo through a save',()=>{
  const w=flat(),l=w.logistics,r={x:20,y:20,cargo:40};l.facilities=[{id:'u',kind:'uplink',x:21,y:20,remaining:0,cargo:0}];
  addRemains(l,{x:19,y:20,angle:0},'dead1');addRemains(l,{x:19.5,y:20},'dead2');expect(l.crates).toHaveLength(1);expect(l.crates[0].amount).toBe(16);
  expect(parkedTask(w,r)).toEqual({action:'deliver',id:'u'});r.cargo=0;expect(parkedTask(w,r)).toEqual({action:'recover',id:'dead1'});
  expect(JSON.parse(JSON.stringify(l)).crates[0].amount).toBe(16);addRemains(l,{x:19,y:20,kind:'swimmer'},'fish');expect(l.crates[0].amount).toBe(16);
  for(let i=0;i<100;i++)addRemains(l,{x:i*3,y:50},'body'+i);expect(l.crates).toHaveLength(64);
});
it('boards one recycler seat, drives, rejects weapons and remote takeover, and restores the seat after restart',async()=>{
  const f=await fixture((db,w,l)=>{l.recyclers=[{id:'r',owner:'a',x:33.5,y:42.5,remaining:0,cargo:0,path:[],angle:0}];});try{
    await f.connect();await f.connect(1);
    expect((await f.post('logistics/board',{id:'r'})).status).toBe(200);expect((await f.state()).me).toMatchObject({body:'recycler',recyclerId:'r'});
    expect((await f.post('logistics/board',{id:'r'},1)).status).toBe(409);
    expect((await f.post('logistics/command',{id:'r',action:'stop'})).status).toBe(409);expect((await f.post('fire',{x:40,y:42})).status).toBe(409);
    expect((await f.post('input',{x:1,y:0})).status).toBe(200);await expect.poll(async()=>(await f.state()).logistics.recyclers[0].x).toBeGreaterThan(33.7);
    await f.post('input',{x:0,y:0});await f.restart();expect((await f.state()).me).toMatchObject({body:'recycler',recyclerId:'r'});
    await f.connect();expect((await f.post('logistics/exit')).status).toBe(200);expect((await f.state()).me.body).toBe('robot');expect((await f.state()).logistics.recyclers[0].occupant).toBeNull();
  }finally{await f.close();}
});
it('automatically collects ruins and loose remains while parked, unloads, and credits a launch once',async()=>{
  const f=await fixture((db,w,l)=>{
    l.recyclers=[{id:'r',owner:'a',x:33.5,y:42.5,remaining:0,cargo:0,path:[],angle:0}];
    l.facilities=[{id:'u',owner:'a',kind:'uplink',x:33,y:38,remaining:0,cargo:0,launch:0}];
    l.crates=[{id:'dead',kind:'remains',x:33.5,y:43.5,amount:8}];w.sites=[{...makeSite('alert','ruin',35,42),state:'conquered',hp:0}];
  });try{
    await f.connect();await f.post('logistics/board',{id:'r'});
    await expect.poll(async()=>(await f.state()).logistics.crates.length).toBe(0);
    await expect.poll(async()=>(await f.state()).logistics.salvage.ruin,{timeout:12000}).toBe(0);
    await expect.poll(async()=>(await f.state()).logistics.facilities[0].cargo).toBe(188);
    expect((await f.post('logistics/launch',{id:'u'})).status).toBe(200);await f.post('logistics/launch',{id:'u'});
    await expect.poll(async()=>(await f.state()).logistics.shipments,{timeout:7000}).toBe(1);expect((await f.state()).logistics.supplies).toBe(1388);
    await f.restart();expect((await f.state()).logistics.salvage.ruin).toBe(0);expect((await f.state()).logistics.crates).toHaveLength(0);
  }finally{await f.close();}
},22000);
it('losing an occupied recycler disables its driver and drops its cargo, including across restart',async()=>{
  const f=await fixture((db,w,l)=>{l.recyclers=[{id:'r',owner:'a',x:33.5,y:42.5,remaining:0,cargo:33,path:[],angle:0,occupant:'a'}];l.durability['recycler:r']={health:0,max:160,armor:1};});try{
    await f.connect();await expect.poll(async()=>(await f.state()).me.life).toBe('disabled');const s=await f.state();expect(s.me.recyclerId).toBeNull();expect(s.logistics.crates[0].amount).toBe(33);
    await f.restart();expect((await f.state()).me.life).toBe('disabled');expect((await f.state()).logistics.recyclers).toHaveLength(0);
  }finally{await f.close();}
});

it('admits one paid bridge across uneven shores, locks construction, and resumes saved unfolding',async()=>{
  const f=await fixture((db,w,l)=>{
    for(let y=0;y<w.height;y++)for(let x=35;x<=40;x++)w.terrain[y*w.width+x]=0;
    w.terrain[41*w.width+35]=1;w.terrain[41*w.width+36]=1;w.terrain[43*w.width+40]=2;
    l.recyclers=[{id:'builder',kind:'builder',owner:'a',x:33.5,y:42.5,remaining:0,cargo:0,path:[],angle:0}];
  });try{
    await f.connect();const data={from:{x:34,y:42},to:{x:41,y:42}};
    expect((await f.post('logistics/bridge',data)).status).toBe(409);await f.post('logistics/board',{id:'builder'});
    const bad=await f.post('logistics/bridge',{...data,to:{x:41,y:43}});expect(bad.status).toBe(409);expect((await f.state()).logistics.supplies).toBe(1200);
    expect((await f.post('logistics/bridge',data)).status).toBe(201);expect((await f.post('logistics/bridge',data)).status).toBe(200);
    expect((await f.state()).logistics.groundSupplies).toBe(1134);await f.post('input',{x:1,y:0});
    await expect.poll(async()=>(await f.state()).logistics.bridges[0].elapsed).toBeGreaterThan(.3);expect((await f.state()).logistics.recyclers[0].x).toBe(33.5);
    await f.restart();const saved=(await f.state()).logistics.bridges[0].elapsed;expect(saved).toBeGreaterThan(0);await f.connect();
    await expect.poll(async()=>bridgeReady((await f.state()).logistics.bridges[0]),{timeout:9000}).toBe(true);expect((await f.state()).logistics.groundSupplies).toBe(1134);
    expect((await f.post('logistics/command',{id:'builder',action:'collect',targetId:'fake'})).status).toBe(409);
  }finally{await f.close();}
},15000);
it('removes a destroyed builders unfinished crossing without refunding or losing completed bridges',async()=>{
  const f=await fixture((db,w,l)=>{l.recyclers=[{id:'builder',kind:'builder',owner:'a',x:33.5,y:42.5,remaining:0,cargo:0,path:[],angle:0}];l.durability['recycler:builder']={health:0,max:160,armor:1};l.bridges=[{id:'unfinished',builderId:'builder',from:{x:34,y:42},to:{x:41,y:42},elapsed:0},{id:'finished',builderId:'builder',from:{x:34,y:50},to:{x:41,y:50},elapsed:99}];});try{await f.connect();await expect.poll(async()=>(await f.state()).logistics.bridges.length).toBe(1);expect((await f.state()).logistics.bridges[0].id).toBe('finished');await f.restart();expect((await f.state()).logistics.bridges).toHaveLength(1);}finally{await f.close();}
});
