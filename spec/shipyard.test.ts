import { expect, it } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.js';
import { createWorld, tileAt } from '../public/world.js';
import { shipSite, dockAt } from '../public/ship.js';
import { freshLife } from '../public/survival.js';
import { freshLogistics, facilityTargets, hurtFacility } from '../public/logistics.js';
import { dockRecords, yardFromShip, rememberWreck, yardBuildError, tickDockRepair, nearbyShipyard, dockBoardingShip } from '../public/shipyard.js';
import { hurtVehicle } from '../public/vehicle.js';
import { rampSentryStep, newRampGun } from '../public/ramp-sentry.js';
import { createCombat } from '../public/combat.js';

const coast=():any=>({...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128>=21&&i%128<60?0:2),sites:[],ships:[],cores:[],tanks:[],artillery:[],rails:[],airbases:[],logistics:freshLogistics()});

it('migrates docks with a backup, buys an empty yard, rebuilds there once and preserves the original sinking trace',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'frontier-yard-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
  const token=randomUUID(),db=new DatabaseSync(path.join(dir,'world.sqlite')),w=coast();
  const original:any={...shipSite(w,[],[],23,25,'a','gunship','unfolding').ship,id:'lost',elapsed:4.5,destroyed:true,health:0,replacement:0,x:38,y:36};
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify({...freshLogistics(),groundSupplies:1200}));
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'a','Pilot',19.5,25.5,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('a',JSON.stringify({...freshLife(),deployed:true}));db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','a',10,28,4.5);db.prepare('INSERT INTO ships VALUES (?,?)').run(original.id,JSON.stringify(original));db.close();
  let url='',controller:AbortController|undefined;
  const open=async()=>{app=createApp({dataDir:dir,logSink:()=>{}});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+(app.server.address() as any).port;};await open();
  const state=async()=>(await fetch(url+'/api/world',{headers:{Cookie:'frontier='+token}})).json();
  const post=async(route:string,data:any)=>{const r=await fetch(url+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+token,'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
  const connect=async()=>{controller=new AbortController();const r=await fetch(url+'/api/events',{headers:{Cookie:'frontier='+token},signal:controller.signal});void(async()=>{try{for await(const c of r.body as any){}}catch{}})();};
  const restart=async(change?:(db:DatabaseSync)=>void)=>{controller?.abort();await app.close();if(change){const db=new DatabaseSync(path.join(dir,'world.sqlite'));change(db);db.close();}await open();};
  try{
    let s=await state();expect(s.logistics.shipyards).toHaveLength(1);expect(s.logistics.wrecks).toMatchObject([{x:38,y:36}]);expect((await readdir(path.join(dir,'backups'))).some(n=>n.startsWith('before-shipyards-'))).toBe(true);
    await connect();const order=await post('shipyards',{x:23,y:39});expect(order.status).toBe(201);const yard=order.body.yard;
    expect((await state()).logistics.supplies).toBe(1080);expect((await post('shipyards',{x:23,y:39})).status).toBe(200);expect((await state()).logistics.supplies).toBe(1080);
    expect((await post('vehicles/replace',{kind:'ship',id:'lost',yardId:yard.id})).status).toBe(409);
    await expect.poll(async()=>(await state()).logistics.shipyards.find((y:any)=>y.id===yard.id).dockReady,{timeout:6500}).toBe(true);
    expect((await post('vehicles/replace',{kind:'ship',id:'lost',yardId:yard.id})).status).toBe(200);
    s=await state();expect(s.logistics.groundSupplies).toBe(1140);expect(s.ships[0].yardId).toBe(yard.id);expect(s.ships[0].assemblyRemaining).toBeGreaterThan(11);expect(s.logistics.wrecks).toHaveLength(1);expect(s.logistics.shipyards).toHaveLength(2);
    expect((await post('vehicles/replace',{kind:'ship',id:'lost',yardId:yard.id})).status).toBe(200);expect((await state()).logistics.groundSupplies).toBe(1140);
    await restart(db=>{const l=JSON.parse((db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get() as any).value);l.shipyards.find((y:any)=>y.id===yard.id).dockDestroyed=true;db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));});
    const remaining=(await state()).ships[0].assemblyRemaining;await connect();await new Promise(r=>setTimeout(r,200));expect((await state()).ships[0].assemblyRemaining).toBe(remaining);
    expect((await post('logistics/repair',{kind:'dock',id:yard.id})).status).toBe(200);
    await expect.poll(async()=>(await state()).ships[0].assemblyRemaining,{timeout:10000}).toBeLessThan(remaining);
    expect((await state()).ships[0].assemblyDuration).toBe(60);
    await restart(db=>{const ship=JSON.parse((db.prepare('SELECT value FROM ships WHERE id=?').get('lost') as any).value);ship.assemblyRemaining=.2;db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(ship),'lost');});await connect();
    await expect.poll(async()=>(await state()).ships[0].assemblyRemaining,{timeout:3000}).toBe(0);
    await restart(db=>{const ship=JSON.parse((db.prepare('SELECT value FROM ships WHERE id=?').get('lost') as any).value);ship.rampGun.destroyed=true;db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(ship),'lost');});
    await connect();expect((await state()).ships[0].rampGun.destroyed).toBe(true);
    expect((await post('ships/ramp-repair',{id:'lost'})).status).toBe(200);expect((await state()).logistics.groundSupplies).toBe(1025);
    expect((await post('ships/ramp-repair',{id:'lost'})).status).toBe(200);expect((await state()).logistics.groundSupplies).toBe(1025);expect((await state()).ships[0].rampGun.destroyed).toBe(false);
    expect((await post('ships/recall',{id:'lost',keepYard:true})).status).toBe(200);s=await state();expect(s.ships).toHaveLength(0);expect(s.logistics.shipyards).toHaveLength(2);
    expect((await post('ships',{kind:'transport',yardId:yard.id})).status).toBe(201);s=await state();expect(s.ships[0].kind).toBe('transport');expect(s.logistics.groundSupplies).toBe(975);
    await restart();s=await state();expect(s.ships).toHaveLength(1);expect(s.logistics.wrecks).toHaveLength(1);expect(s.logistics.shipyards).toHaveLength(2);expect(tileAt(s.world,23,25)).toBe(4);
    // Each dock has its own slot, even when the same owner chooses the same type.
    await connect();
    const second=await post('ships',{kind:'transport',yardId:'lost'});expect(second.status).toBe(201);
    expect((await post('ships',{kind:'transport',yardId:'lost'})).status).toBe(200);
    expect((await state()).ships).toHaveLength(2);expect((await state()).logistics.groundSupplies).toBe(925);
    await restart(db=>{const ship=JSON.parse((db.prepare('SELECT value FROM ships WHERE id=?').get(second.body.ship.id) as any).value);Object.assign(ship,{elapsed:4.5,assemblyRemaining:0,health:250});db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(ship),ship.id);});
    await connect();await expect.poll(async()=>(await state()).ships.find((v:any)=>v.id===second.body.ship.id).health,{timeout:8000}).toBe(300);
    expect((await state()).logistics.groundSupplies).toBeCloseTo(915,4);
    await restart();s=await state();expect(s.ships.find((v:any)=>v.id===second.body.ship.id).health).toBe(300);expect(s.logistics.groundSupplies).toBeCloseTo(915,4);
    await restart(db=>{const ship=JSON.parse((db.prepare('SELECT value FROM ships WHERE id=?').get(second.body.ship.id) as any).value);Object.assign(ship,{destroyed:true,health:0,replacement:0});db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(ship),ship.id);});
    await connect();const changed=await post('vehicles/replace',{kind:'ship',vesselKind:'submarine',id:second.body.ship.id});expect(changed.status).toBe(200);expect(changed.body.vehicle).toMatchObject({kind:'submarine',ammo:'HE',health:300,depth:'surfaced'});
    s=await state();expect(s.logistics.groundSupplies).toBeCloseTo(845,6);expect(s.ships).toHaveLength(2);
  }finally{controller?.abort();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-yard-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}
},100000);

it('retains empty dock geometry and bounds cosmetic wrecks without obstructing water',()=>{
  const w=coast(),s:any={...shipSite(w,[],[],23,25,'a','gunship','unfolding').ship,id:'s',elapsed:4.5,destroyed:true};
  w.logistics.shipyards=[yardFromShip(s)];expect(dockRecords(w)).toHaveLength(1);expect(tileAt(w,23,25)).toBe(4);
  for(let i=0;i<40;i++)rememberWreck(w,{...s,id:String(i),x:40,y:40});expect(w.logistics.wrecks).toHaveLength(24);expect(tileAt(w,40,40)).toBe(0);
  w.ships=[{...s,destroyed:false,ramp:{x:20.5,y:40.5}}];expect(dockAt(w,20,40)).toBe(true);
});

it.each(['swimmer','crawler'])('ramp sentry hits a %s with real projectiles and preserves damage across folding',kind=>{
  const w=coast(),ship:any={...shipSite(w,[],[],23,25,'a','gunship','unfolding').ship,id:'s',elapsed:4.5,health:300,ramp:{x:20.5,y:25.5}};
  ship.rampGun={...newRampGun(ship),angle:Math.PI/2};w.ships=[ship];
  const saved=createCombat(w).checkpoint();saved.enemies=[{id:1,kind,x:kind==='swimmer'?25:18,y:25.5,hp:100,angle:0,path:[],reroute:0,behavior:'hunting',targetId:'s'}];saved.serial=2;
  const combat=createCombat(w,saved);for(let i=0;i<40;i++)combat.tick(.05,[],[],[]);
  expect(combat.snapshot().kills>0||combat.snapshot().enemies.some((e:any)=>e.hp<100)).toBe(true);
  const target=facilityTargets(w).find(f=>f.kind==='ramp')!;hurtFacility(target,20);const hp=target.hp.health,gun=ship.rampGun;gun.remaining=.3;ship.ramp=null;
  let fired=false;rampSentryStep(w,ship,[{id:3,x:19,y:25,hp:10}],[],.05,()=>{fired=true;return null;});expect(fired).toBe(false);expect(gun.remaining).toBeCloseTo(.25);expect(target.hp.health).toBe(hp);
  ship.ramp={x:20.5,y:25.5};gun.destroyed=true;rampSentryStep(w,ship,[{id:3,x:19,y:25,hp:10}],[],1,()=>{fired=true;return null;});expect(fired).toBe(false);
});

function repairFixture(){
  const w=coast(),ship:any={...shipSite(w,[],[],23,25,'a','gunship','unfolding').ship,id:'s',elapsed:4.5,health:200,speed:0};
  w.ships=[ship];w.logistics.shipyards=[yardFromShip(ship)];w.logistics.groundSupplies=100;return {w,ship,yard:w.logistics.shipyards[0]};
}
it('repairs only real missing hull health, stops on damage, and never charges beyond available supplies',()=>{
  const {w,ship}=repairFixture();tickDockRepair(w,ship,1);expect(ship.health).toBe(210);expect(w.logistics.groundSupplies).toBe(98);expect(ship.repairing).toBe(true);
  hurtVehicle(ship,20);tickDockRepair(w,ship,4);expect(ship.health).toBe(190);expect(ship.repairing).toBe(false);expect(w.logistics.groundSupplies).toBe(98);
  tickDockRepair(w,ship,1);expect(ship.health).toBe(200);
  ship.health=299;tickDockRepair(w,ship,1);expect(ship.health).toBe(300);expect(w.logistics.groundSupplies).toBeCloseTo(95.8);
  tickDockRepair(w,ship,1);expect(w.logistics.groundSupplies).toBeCloseTo(95.8);expect(ship.repairing).toBe(false);
  ship.health=200;w.logistics.groundSupplies=.1;tickDockRepair(w,ship,1);expect(ship.health).toBe(200.5);expect(w.logistics.groundSupplies).toBe(0);
  tickDockRepair(w,ship,1);expect(ship.health).toBe(200.5);expect(ship.repairing).toBe(false);
});
it.each(['moving','away','submerged','destroyed','assembling','dock destroyed','dock repairing'])('does not heal while %s',reason=>{
  const {w,ship,yard}=repairFixture();
  if(reason==='moving')ship.speed=1;if(reason==='away')ship.x+=10;
  if(reason==='submerged'){ship.kind='submarine';ship.depth='submerged';}
  if(reason==='destroyed')ship.destroyed=true;if(reason==='assembling')ship.assemblyRemaining=2;
  if(reason==='dock destroyed')yard.dockDestroyed=true;if(reason==='dock repairing')w.logistics.jobs[yard.id]={remaining:3};
  tickDockRepair(w,ship,1);expect(ship.health).toBe(200);expect(w.logistics.groundSupplies).toBe(100);expect(ship.repairing).toBe(false);
});
it('reserves a per-dock slot at sea, counts active hulls and finds dock interaction from its deck',()=>{
  const {w,ship,yard}=repairFixture();ship.x+=15;
  expect(yardBuildError(w,yard,'a','transport')).toContain('already supports');
  expect(yardBuildError(w,yard,'other','transport')).toContain('own shipyard');
  ship.destroyed=true;expect(yardBuildError(w,yard,'a','transport',ship)).toBeNull();
  for(let n=0;n<4;n++)w.ships.push({...ship,id:'other'+n,yardId:'other'+n,destroyed:false,x:45,y:60+n*6});
  expect(yardBuildError(w,yard,'a','transport',ship)).toContain('four vessels');
  expect(nearbyShipyard(w,{id:'a',body:'robot',life:'active',...yard.dock})?.yard.id).toBe(yard.id);
  expect(nearbyShipyard(w,{id:'b',body:'robot',life:'active',...yard.dock})).toBeNull();
});

it('offers boarding for a visitor without transferring its assigned production slot',()=>{
  const {w,ship,yard}=repairFixture();
  const visitor={...ship,id:'friend',owner:'friend',yardId:'other-yard'};ship.x+=12;w.ships.push(visitor);
  expect(dockBoardingShip(w,yard)?.id).toBe('friend');expect(visitor.yardId).toBe('other-yard');
  visitor.destroyed=true;expect(dockBoardingShip(w,yard)).toBeNull();
});
