import {expect,it} from 'vitest';
import {createApp} from '../server.js';
import {createWorld} from '../public/world.js';
import {freshLogistics} from '../public/logistics.js';
import {freshLife} from '../public/survival.js';
import {newAirbase} from '../public/aircraft.js';
import {shipSite,SHIP} from '../public/ship.js';
import {prepareCarrier,wingId} from '../public/carrier.js';
import {yardFromShip} from '../public/shipyard.js';
import {serviceQuote,serviceError,nearbyService,carrierRecycleQuote} from '../public/facility-service.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const world=():any=>({...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128<30?0:2),sites:[],ships:[],cores:[],tanks:[],artillery:[],rails:[],airbases:[],logistics:{...freshLogistics(),shipyards:[],groundSupplies:1000}});
async function fixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-service-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),w=world(),tokens=[randomUUID(),randomUUID()];
 const ship={...shipSite(w,[],[],27,40,'a','gunship','unfolding').ship,id:'yard',elapsed:SHIP.duration};w.logistics.shipyards=[yardFromShip(ship)];
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(w.logistics));
 for(const [i,id] of ['a','b'].entries()){db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,45.5,40.5+i,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run(id,JSON.stringify({...freshLife(),deployed:true}));}
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('workshop-core','a',45,48,99);
 const base=newAirbase('base','a',60,55);Object.assign(base.aircraft,{state:'vacant',health:0});db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));db.close();
 let url='',controllers:AbortController[]=[];
 async function open(){app=createApp({dataDir:dir,logSink:()=>{}});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+(app.server.address() as any).port;}
 await open();
 const state=async()=>(await fetch(url+'/api/world',{headers:{Cookie:'frontier='+tokens[0]}})).json();
 const post=async(data:any,i=0,route='facilities/vehicle')=>{const r=await fetch(url+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};};
 const connect=async(i=0)=>{const c=new AbortController();controllers.push(c);const r=await fetch(url+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body as any){}}catch{}})();};
 const restart=async(mutate?:(db:DatabaseSync)=>void)=>{controllers.forEach(c=>c.abort());controllers=[];await app.close();if(mutate){const db=new DatabaseSync(path.join(dir,'world.sqlite'));mutate(db);db.close();}await open();};
 return {state,post,connect,restart,close:async()=>{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-service-'))throw Error('Unsafe fixture path');await rm(dir,{recursive:true,force:true});}};
}
const order=(type:string,id:string,kind:string,expected:any=null)=>({type,id,kind,expected,orderId:randomUUID()});
function finishShip(db:DatabaseSync){const row:any=db.prepare('SELECT * FROM ships LIMIT 1').get(),s=JSON.parse(row.value);Object.assign(s,{assemblyRemaining:0,elapsed:SHIP.duration});db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(s),s.id);}
function finishAir(db:DatabaseSync){const row:any=db.prepare('SELECT * FROM airbases LIMIT 1').get(),b=JSON.parse(row.value);Object.assign(b.aircraft,{state:'parked',remaining:0});db.prepare('UPDATE airbases SET value=? WHERE id=?').run(JSON.stringify(b),b.id);}
it('trade-in uses actual same-pool payment, not list price, and never yields cash',()=>{
 expect(serviceQuote('carrier',{purchase:{paid:100,pool:'groundSupplies'}})).toEqual({cost:100,credit:80,due:20,pool:'groundSupplies'});
 for(const old of [undefined,{purchase:{paid:240,pool:'supplies'}},{purchase:{paid:0,pool:'groundSupplies'}},{destroyed:true,purchase:{paid:100,pool:'groundSupplies'}}])expect(serviceQuote('carrier',old).credit).toBe(0);
 expect(serviceQuote('gunship',{purchase:{paid:1000,pool:'groundSupplies'}})).toMatchObject({credit:60,due:0});
});
it('dock orders and exchanges are persisted, charge once and reject stale/foreign requests',async()=>{
 const f=await fixture();try{
 await f.connect();const buy=order('dock','yard','gunship');expect((await f.post(buy)).status).toBe(201);
 let s=await f.state();expect(s.ships).toHaveLength(1);expect(s.logistics.groundSupplies).toBe(940);expect(s.logistics.supplies).toBe(1200);const receipt=s.ships[0].purchase;
 expect(receipt).toMatchObject({pool:'groundSupplies',paid:60});expect((await f.post(buy)).body.replayed).toBe(true);
 expect((await f.post(order('dock','yard','transport',receipt.id))).status).toBe(409);
 await f.restart(finishShip);await f.connect();await f.connect(1);
 expect((await f.post(order('dock','yard','transport',receipt.id),1)).status).toBe(409);
 const exchange=order('dock','yard','submarine',receipt.id),results=await Promise.all([f.post(exchange),f.post(exchange)]);expect(results.map(r=>r.status).sort()).toEqual([200,201]);
 s=await f.state();expect(s.ships).toHaveLength(1);expect(s.ships[0]).toMatchObject({kind:'submarine',purchase:{paid:22,pool:'groundSupplies'}});expect(s.logistics.groundSupplies).toBe(918);
 expect((await f.post(order('dock','yard','transport',receipt.id))).status).toBe(409);
 await f.restart();s=await f.state();expect(s.ships[0].purchase.orderId).toBe(exchange.orderId);expect(s.logistics.groundSupplies).toBe(918);
 }finally{await f.close();}
},20000);
it('GND aircraft assembly is separate from free orbital delivery and exchanges without minting credit',async()=>{
 const f=await fixture();try{
 await f.connect();const buy=order('airbase','base','bomber');expect((await f.post(buy)).status).toBe(201);let s=await f.state(),p=s.airbases[0].aircraft;
 expect(p).toMatchObject({kind:'bomber',state:'delivering',deliveryMethod:'factory',purchase:{paid:25,pool:'groundSupplies'}});expect(p.remaining).toBeGreaterThan(59);expect(s.logistics).toMatchObject({groundSupplies:975,freeBomberUsed:false,supplies:1200});
 await f.restart(finishAir);await f.connect();const swap=order('airbase','base','attack-jet',p.purchase.id);expect((await f.post(swap)).body).toMatchObject({cost:25,credit:20,due:5});
 s=await f.state();expect(s.airbases).toHaveLength(1);expect(s.airbases[0].aircraft.purchase.paid).toBe(5);expect(s.logistics.groundSupplies).toBe(970);
 expect((await f.post(swap)).body.replayed).toBe(true);await f.restart();expect((await f.state()).logistics.groundSupplies).toBe(970);
 }finally{await f.close();}
},20000);
it('insufficient supplies do not remove an existing aircraft or its receipt',async()=>{
 const f=await fixture();try{
 await f.restart(db=>{const row:any=db.prepare('SELECT * FROM airbases').get(),b=JSON.parse(row.value);Object.assign(b.aircraft,{state:'parked',health:180,purchase:{id:'receipt',paid:100,pool:'supplies'}});db.prepare('UPDATE airbases SET value=? WHERE id=?').run(JSON.stringify(b),b.id);const l=JSON.parse((db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get() as any).value);l.groundSupplies=0;db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));});await f.connect();
 expect((await f.post(order('airbase','base','attack-jet','receipt'))).status).toBe(409);const s=await f.state();expect(s.airbases[0].aircraft).toMatchObject({kind:'bomber',purchase:{id:'receipt'}});expect(s.logistics.groundSupplies).toBe(0);
 }finally{await f.close();}
});
it('builds and exchanges an AC-130 through saved GND service orders and paid orbital delivery',async()=>{
 const f=await fixture();try{
  await f.connect();const buy=order('airbase','base','air-gunship');expect((await f.post(buy)).status).toBe(201);
  let s=await f.state(),p=s.airbases[0].aircraft;expect(p).toMatchObject({kind:'air-gunship',state:'delivering',purchase:{paid:25,pool:'groundSupplies'}});expect(s.logistics.groundSupplies).toBe(975);expect(s.logistics.freeBomberUsed).toBe(false);
  expect((await f.post(buy)).body.replayed).toBe(true);await f.restart(finishAir);await f.connect();await f.connect(1);
  expect((await f.post(order('airbase','base','bomber',p.purchase.id),1)).status).toBe(409);
  expect((await f.post(order('airbase','base','attack-jet',p.purchase.id))).body).toMatchObject({cost:25,credit:20,due:5});
  await f.restart(finishAir);await f.connect();expect((await f.post({id:'base',kind:'air-gunship'},0,'aircraft/deliver')).status).toBe(200);
  s=await f.state();expect(s.airbases[0].aircraft).toMatchObject({kind:'air-gunship',purchase:{paid:100,pool:'supplies'}});expect(s.logistics).toMatchObject({groundSupplies:970,supplies:1100,freeBomberUsed:false});
  await f.restart();expect((await f.state()).airbases[0].aircraft.kind).toBe('air-gunship');
 }finally{await f.close();}
});
it('blocks active crews, cargo, away ships and reserved runways; detects the whole airbase footprint',()=>{
 const w=world(),ship:any={...shipSite(w,[],[],27,40,'a','gunship','unfolding').ship,id:'ship',elapsed:SHIP.duration};w.ships=[ship];w.logistics.shipyards=[yardFromShip(ship)];
 expect(serviceError(w,'dock','ship','a','transport')).toBeNull();
 ship.occupant='a';expect(serviceError(w,'dock','ship','a','transport')).toMatch(/Disembark/);ship.occupant=null;
 ship.cargo={id:'tank'};expect(serviceError(w,'dock','ship','a','transport')).toMatch(/Unload/);ship.cargo=null;
 ship.x-=10;expect(serviceError(w,'dock','ship','a','transport')).toMatch(/Return/);
 Object.assign(ship,{destroyed:true,assemblyRemaining:45,elapsed:0,replacement:0});expect(serviceError(w,'dock','ship','a','transport')).toBeNull();ship.replacement=10;expect(serviceError(w,'dock','ship','a','transport')).toBeNull(); // Wreck timers cannot reserve a manufacturing slot.
 const b:any=newAirbase('base','a',60,55);w.airbases=[b];b.aircraft.state='flying';expect(serviceError(w,'airbase','base','a','attack-jet')).toMatch(/capacity/);
 b.aircraft.state='landing';expect(serviceError(w,'airbase','base','a','attack-jet')).toMatch(/reserved/);
 expect(nearbyService(w,{id:'a',body:'robot',life:'active',x:61,y:56})).toEqual({type:'airbase',id:'base'});
 expect(nearbyService(w,{id:'a',body:'rover',life:'active',x:61,y:56})).toBeNull();
});

it('local empty docks charge GND only, require support and finish without creating ships',async()=>{
 const f=await fixture();try{
 await f.connect();expect((await f.post({x:22,y:85,method:'factory',factoryId:'workshop-core'},0,'shipyards')).status).toBe(409);
 const r=await f.post({x:22,y:60,method:'factory',factoryId:'workshop-core'},0,'shipyards');expect(r.status).toBe(201);const id=r.body.yard.id;let s=await f.state();expect(s.ships).toHaveLength(0);expect(s.logistics.groundSupplies).toBe(970);expect(s.logistics.supplies).toBe(1200);expect(s.logistics.jobs[id]).toMatchObject({method:'factory',kind:'shipyard',cost:30,pool:'groundSupplies'});expect(Number.isFinite(s.logistics.jobs[id].droneBay.x)).toBe(true);
 expect((await f.post(order('dock',id,'gunship'))).status).toBe(409);
 await f.restart(db=>{const l=JSON.parse((db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get() as any).value);l.jobs[id].remaining=.01;db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));});await f.connect();
 await expect.poll(async()=>(await f.state()).logistics.shipyards.find((y:any)=>y.id===id).dockReady).toBe(true);s=await f.state();expect(s.ships).toHaveLength(0);expect(s.logistics.jobs[id]).toBeUndefined();
 }finally{await f.close();}
});

it('a salvage wreck does not block exchange, but both live carrier aircraft remain protected',()=>{
 const w=world(),ship:any={...shipSite(w,[],[],27,40,'a','carrier','unfolding').ship,id:'carrier',kind:'carrier',elapsed:SHIP.duration,health:600,purchase:{id:'paid',paid:100,pool:'groundSupplies'}};
 prepareCarrier(ship);w.ships=[ship];w.logistics.shipyards=[yardFromShip(ship)];
 w.logistics.wrecks=[{id:'old-carrier',kind:'carrier',x:ship.x,y:ship.y,angle:ship.angle}];
 w.logistics.recovery={old:{medium:'sea',x:ship.x,y:ship.y,amount:50}};
 expect(serviceError(w,'dock',ship.id,'a','gunship')).toBeNull();
 Object.assign(ship.aircraft,{state:'parked',health:180});
 expect(serviceError(w,'dock',ship.id,'a','gunship')).toBeNull();
 expect(serviceError(w,'dock',ship.id,'a','carrier')).toBeNull();
 ship.aircraft.occupant='a';expect(serviceError(w,'dock',ship.id,'a','carrier')).toMatch(/disembark/);ship.aircraft.occupant=null;
 ship.aircraft.state='destroyed';Object.assign(ship.wing.aircraft,{state:'flying',health:180,baseId:wingId(ship)});
 expect(serviceError(w,'dock',ship.id,'a','gunship')).toMatch(/Land and disembark/);
 expect(serviceError(w,'dock',ship.id,'a','carrier')).toMatch(/Land and disembark/);
 ship.wing.aircraft.state='destroyed';
 expect(serviceError(w,'dock',ship.id,'a','gunship')).toBeNull();
 expect(w.logistics.recovery.old.amount).toBe(50);
});

it('exchanges a carrier with two parked aircraft, preserving receipts and assignments across restart',async()=>{
 const f=await fixture();try{
  await f.connect();expect((await f.post(order('dock','yard','carrier'))).status).toBe(201);
  await f.restart(db=>{
   finishShip(db);const row:any=db.prepare('SELECT * FROM ships LIMIT 1').get(),ship=JSON.parse(row.value);
   for(const [i,p]of [ship.aircraft,ship.wing.aircraft].entries())Object.assign(p,{id:'plane-'+i,state:'parked',health:123+i,kind:i?'attack-jet':'bomber',purchase:{id:'plane-receipt-'+i,pool:'supplies',paid:100},bombCooldown:2+i});
   db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(ship),ship.id);
   const rowL:any=db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get(),l=JSON.parse(rowL.value);l.wrecks=[{id:'old',kind:'carrier',x:ship.x,y:ship.y,angle:ship.angle}];l.recovery={old:{id:'old',sourceId:'old',medium:'sea',x:ship.x,y:ship.y,amount:50}};db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
  });await f.connect();const before=await f.state(),old=before.ships[0],buy=order('dock','yard','carrier',old.purchase.id);
  const result=await f.post(buy);expect(result.status).toBe(201);expect(result.body).toMatchObject({cost:100,credit:80,due:20});
  let s=await f.state();expect(s.ships).toHaveLength(1);expect(s.ships[0].id).toBe(old.id);expect(s.ships[0].aircraft).toMatchObject({id:'plane-0',baseId:old.id,state:'parked',health:123,purchase:{id:'plane-receipt-0'}});expect(s.ships[0].wing.aircraft).toMatchObject({id:'plane-1',baseId:wingId(old),state:'parked',health:124,purchase:{id:'plane-receipt-1'}});expect(s.logistics.recovery.old.amount).toBe(50);
  expect((await f.post(buy)).body.replayed).toBe(true);expect((await f.state()).logistics.groundSupplies).toBe(880);
  await f.restart();s=await f.state();expect(s.ships[0].aircraft.id).toBe('plane-0');expect(s.ships[0].wing.aircraft.id).toBe('plane-1');expect(s.logistics.groundSupplies).toBe(880);
 }finally{await f.close();}
});

function paidCarrier(db:DatabaseSync,{external=false,ground=0,paid=100,planePaid=25,planePool='groundSupplies',flight=false,pilot=false,foreign=false,fail=false}:any={}){
 finishShip(db);const row:any=db.prepare('SELECT * FROM ships LIMIT 1').get(),ship=JSON.parse(row.value);ship.purchase.paid=paid;ship.deckSupplies=120;
 for(const [i,p]of [ship.aircraft,ship.wing.aircraft].entries())Object.assign(p,{id:'recycle-plane-'+i,state:i&&flight?'flying':'parked',health:180,occupant:i&&pilot?'a':null,owner:i&&foreign?'b':'a',kind:i?'attack-jet':'bomber',purchase:{id:'air-receipt-'+i,pool:i?'supplies':planePool,paid:i?100:planePaid}});
 if(external){const rowB:any=db.prepare('SELECT * FROM airbases LIMIT 1').get(),base=JSON.parse(rowB.value);base.aircraft=ship.aircraft;ship.aircraft={...ship.aircraft,id:'vacant-placeholder',state:'vacant',health:0};db.prepare('UPDATE airbases SET value=? WHERE id=?').run(JSON.stringify(base),base.id);}
 db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(ship),ship.id);
 const rowL:any=db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get(),l=JSON.parse(rowL.value);l.groundSupplies=ground;l.supplies=1200;l.wrecks=[{id:'old',kind:'carrier',x:ship.x,y:ship.y,angle:ship.angle}];l.recovery={old:{id:'old',sourceId:'old',medium:'sea',x:ship.x,y:ship.y,amount:50}};db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
 if(fail)db.exec("CREATE TRIGGER reject_exchange BEFORE INSERT ON ships WHEN NEW.id != '"+ship.id+"' BEGIN SELECT RAISE(ABORT, 'exchange write failure'); END");
}
it('recycles both assigned parked aircraft into their original pools exactly once, including external storage',async()=>{
 const f=await fixture();try{
  await f.connect();expect((await f.post(order('dock','yard','carrier'))).status).toBe(201);
  await f.restart(db=>paidCarrier(db,{external:true}));await f.connect();const before=await f.state(),buy=order('dock','yard','gunship',before.ships[0].purchase.id);
  const results=await Promise.all([f.post(buy),f.post(buy)]);expect(results.map(r=>r.status).sort()).toEqual([200,201]);expect(results.find(r=>r.status===201)?.body).toMatchObject({due:0,recycledAircraft:2,refund:{groundSupplies:12.5,supplies:50}});
  let s=await f.state();expect(s.ships).toHaveLength(1);expect(s.ships[0]).toMatchObject({kind:'gunship',purchase:{paid:0,aircraftRefund:{groundSupplies:12.5,supplies:50}}});expect(s.ships[0].purchase.recycledAircraft).toHaveLength(2);expect(s.ships[0].aircraft).toBeUndefined();expect(s.ships[0].wing).toBeUndefined();expect(s.airbases[0].aircraft.state).toBe('vacant');expect(s.airbases[0].aircraft.purchase).toBeUndefined();expect(s.logistics).toMatchObject({groundSupplies:12.5,supplies:1250});expect(s.logistics.recovery.old.amount).toBe(50);
  await f.restart();await f.connect();expect((await f.post(buy)).body.replayed).toBe(true);s=await f.state();expect(s.logistics).toMatchObject({groundSupplies:12.5,supplies:1250});expect(s.airbases[0].aircraft.state).toBe('vacant');
 }finally{await f.close();}
});
it('uses recycled GND to fund the new hull without counting ORB as GND',async()=>{
 const f=await fixture();try{
  await f.connect();await f.post(order('dock','yard','carrier'));await f.restart(db=>paidCarrier(db,{ground:45,paid:0,planePaid:40}));await f.connect();const s=await f.state();
  const r=await f.post(order('dock','yard','gunship',s.ships[0].purchase.id));expect(r.status).toBe(201);expect(r.body).toMatchObject({due:60,refund:{groundSupplies:20,supplies:50}});expect((await f.state()).logistics).toMatchObject({groundSupplies:5,supplies:1250});
 }finally{await f.close();}
});
for(const [label,options]of [['airborne',{flight:true}],['occupied',{pilot:true}],['foreign aircraft',{foreign:true}],['insufficient GND',{ground:0,paid:0,planePool:'supplies'}],['failed save',{external:true,fail:true}]] as const)it('rejected carrier recycling preserves aircraft and supplies: '+label,async()=>{
 const f=await fixture();try{
  await f.connect();await f.post(order('dock','yard','carrier'));await f.restart(db=>paidCarrier(db,options));await f.connect();const before=await f.state();
  const r=await f.post(order('dock','yard','gunship',before.ships[0].purchase.id));expect(r.status).toBe(label==='failed save'?500:409);let s=await f.state();expect(s.ships[0].id).toBe(before.ships[0].id);expect(s.ships[0].kind).toBe('carrier');expect(s.ships[0].wing.aircraft.purchase.id).toBe('air-receipt-1');expect(s.logistics.groundSupplies).toBe(before.logistics.groundSupplies);expect(s.logistics.supplies).toBe(before.logistics.supplies);
  if(label==='failed save'){expect(s.airbases[0].aircraft.state).toBe('parked');await f.restart();s=await f.state();expect(s.airbases[0].aircraft.state).toBe('parked');expect(s.ships[0].kind).toBe('carrier');expect(s.logistics.groundSupplies).toBe(before.logistics.groundSupplies);}
 }finally{await f.close();}
});
it('aircraft recycling uses half actual payment and never credits free, invalid or missing receipts',()=>{
 const ship:any={id:'carrier',kind:'carrier',owner:'a',x:0,y:0};prepareCarrier(ship);const w:any={ships:[ship],airbases:[]};
 for(const receipt of [undefined,{paid:0,pool:'supplies'},{paid:-100,pool:'supplies'},{paid:NaN,pool:'groundSupplies'},{paid:100,pool:'unknown'}]){Object.assign(ship.aircraft,{state:'parked',purchase:receipt});expect(carrierRecycleQuote(w,ship,'gunship').refund).toEqual({groundSupplies:0,supplies:0});}
 ship.aircraft.purchase={paid:5,pool:'groundSupplies'};expect(carrierRecycleQuote(w,ship,'gunship').refund.groundSupplies).toBe(2.5);expect(carrierRecycleQuote(w,ship,'carrier').aircraft).toHaveLength(0);
 ship.aircraft.state='destroyed';expect(carrierRecycleQuote(w,ship,'gunship').refund.groundSupplies).toBe(0);
});
