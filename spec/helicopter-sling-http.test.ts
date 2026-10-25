import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {helicopterFieldFixture} from '../tests/helpers/helicopter-field-fixture.js';
const plane=(s:any)=>s.airbases.find((b:any)=>b.id==='pad').aircraft;
it.each(['tank','recycler','builder'])('atomically lifts and sets down %s through restart without replay or duplicate ground records',async kind=>{
 const f=await helicopterFieldFixture({sling:kind});try{
  await f.connect();await f.connect(1);
  const lift={action:'lift',vehicleId:'cargo',orderId:randomUUID(),expected:0};
  expect((await f.post('aircraft/sling',lift,1)).status).toBe(409);
  expect((await f.post('aircraft/sling',lift)).status).toBe(200);
  expect((await f.post('aircraft/sling',lift)).status).toBe(200);
  let s=await f.state();expect(kind==='tank'?s.tanks:s.logistics.recyclers).toHaveLength(0);
  expect(plane(s).sling.vehicle).toMatchObject({id:'cargo',health:123,cargo:73,weapon:'MAGNETIC'});
  await f.restart();s=await f.state();expect(plane(s).sling.vehicle.id).toBe('cargo');
  expect(kind==='tank'?s.tanks:s.logistics.recyclers).toHaveLength(0);
  await f.connect();expect((await f.post('aircraft/sling',lift)).status).toBe(200);
  await expect.poll(async()=>!!plane(await f.state()).slingOperation,{timeout:7000}).toBe(false);
  expect((await f.post('aircraft/exit')).status).toBe(409);
  const lower={action:'lower',vehicleId:'cargo',orderId:randomUUID(),expected:1};
  expect((await f.post('aircraft/sling',lower)).status).toBe(200);
  await f.restart();expect(plane(await f.state()).slingOperation.kind).toBe('lower');
  await f.connect();await expect.poll(async()=>!!plane(await f.state()).sling,{timeout:7000}).toBe(false);
  expect((await f.post('aircraft/sling',lower)).status).toBe(200);
  expect((await f.post('aircraft/sling',lift)).status).toBe(200); // acknowledged, never repeated
  expect((await f.post('aircraft/sling',{...lift,orderId:randomUUID()})).status).toBe(409);
  await f.restart();s=await f.state();const vehicles=kind==='tank'?s.tanks:s.logistics.recyclers;
  expect(vehicles).toHaveLength(1);expect(vehicles[0]).toMatchObject({id:'cargo',health:123,cargo:73,x:50.5,y:50.5});expect(plane(s).sling).toBeNull();
  if(kind!=='tank')expect(s.logistics.durability['recycler:cargo'].health).toBe(92);
 }finally{await f.close();}
},25000);
it('arbitrates simultaneous authorized pilots and preserves the one winning sling across restart',async()=>{
 const f=await helicopterFieldFixture({sling:'tank',twoHelicopters:true,sharedCargo:true});try{
  await f.connect();await f.connect(1);
  const request=()=>({action:'lift',vehicleId:'cargo',orderId:randomUUID(),expected:0});
  const results=await Promise.all([f.post('aircraft/sling',request()),f.post('aircraft/sling',request(),1)]);
  expect(results.map(r=>r.status).sort()).toEqual([200,409]);await f.restart();
  const s=await f.state();expect(s.tanks).toHaveLength(0);expect(s.airbases.filter((b:any)=>b.aircraft.sling?.vehicle.id==='cargo')).toHaveLength(1);
 }finally{await f.close();}
},15000);
it('denies lifting another owner’s vehicle without shared management authority',async()=>{
 const f=await helicopterFieldFixture({sling:'tank',twoHelicopters:true});try{
  await f.connect(1);expect((await f.post('aircraft/sling',{action:'lift',vehicleId:'cargo',orderId:randomUUID(),expected:0},1)).status).toBe(403);
  expect((await f.state()).tanks).toHaveLength(1);
 }finally{await f.close();}
},12000);
