import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {helicopterFieldFixture} from '../tests/helpers/helicopter-field-fixture.js';
import {navalRemoteFixture} from '../tests/helpers/naval-remote-fixture.js';
const plane=(s:any)=>s.airbases.find((b:any)=>b.id==='pad').aircraft;
const ship=(s:any)=>s.ships.find((b:any)=>b.id==='ship');
it.each(['tank','recycler','builder'])('persists remote %s delivery and ignores replay after a later order',async kind=>{
 const f=await helicopterFieldFixture({remote:true,sling:kind});try{
  await f.connect();await f.connect(1);
  const pickup={id:'pad',action:'pickup',vehicleId:'cargo',expected:0,expectedMissionId:'initial-hover',orderId:randomUUID()};
  const accepted=await f.post('aircraft/order',pickup);expect(accepted.status,JSON.stringify(accepted.body)).toBe(201);
  await expect.poll(async()=>plane(await f.state()).sling?.vehicle.id).toBe('cargo');
  await f.restart();await f.connect();expect((await f.post('aircraft/order',pickup)).status).toBe(200);
  await expect.poll(async()=>plane(await f.state()).mission.phase,{timeout:7000}).toBe('holding');
  expect((await f.post('aircraft/order',{...pickup,orderId:randomUUID()},1)).status).toBe(409);
  const drop={id:'pad',action:'drop',target:{x:54.5,y:55.5},expected:1,expectedMissionId:pickup.orderId,orderId:randomUUID()};
  expect((await f.post('aircraft/order',drop)).status).toBe(201);await f.restart();await f.connect();
  expect((await f.post('aircraft/order',pickup)).status).toBe(200);expect(plane(await f.state()).mission.id).toBe(drop.orderId);
  await expect.poll(async()=>!!plane(await f.state()).sling,{timeout:15000}).toBe(false);
  const s=await f.state(),vehicles=kind==='tank'?s.tanks:s.logistics.recyclers;
  expect(vehicles).toHaveLength(1);expect(vehicles[0]).toMatchObject({id:'cargo',health:123,cargo:73,x:54.5,y:55.5});
  expect((await f.post('aircraft/order',{...drop,action:'move'})).status).toBe(409);
 }finally{await f.close();}
},30000);
it('allows remote field landing and robot boarding, rejects unauthorized pickup and occupied controls',async()=>{
 const f=await helicopterFieldFixture({remote:true,sling:'tank'});try{
  await f.connect();await f.connect(1);
  const order={id:'pad',action:'pickup',vehicleId:'cargo',expected:0,expectedMissionId:'initial-hover',orderId:randomUUID()};
  expect((await f.post('aircraft/order',order,1)).status).toBe(409);
  const land={...order,action:'land',vehicleId:undefined,target:{x:45.5,y:47.5},orderId:randomUUID()};
  expect((await f.post('aircraft/order',land)).status).toBe(201);
  await expect.poll(async()=>plane(await f.state()).state,{timeout:15000}).toBe('parked');
  expect((await f.post('aircraft/board',{aircraftId:plane(await f.state()).id})).status).toBe(200);
  expect((await f.post('aircraft/order',{...land,action:'stop',expected:1,expectedMissionId:land.orderId,orderId:randomUUID()},1)).status).toBe(409);
 }finally{await f.close();}
},25000);
it('accepts underwater missiles and depth changes during navigation, without replay after restart',async()=>{
 const f=await navalRemoteFixture({submarine:true});try{
  await f.connect();await f.connect(1);
  const move={id:'ship',action:'move',target:{x:80.5,y:50.5},expectedOrderId:null,orderId:randomUUID()};
  const result=await f.post('ships/order',move);expect(result.status,JSON.stringify(result.body)).toBe(201);
  const dive={id:'ship',action:'dive',expected:0,orderId:randomUUID()};expect((await f.post('ships/remote-action',dive)).status).toBe(201);
  await expect.poll(async()=>ship(await f.state()).depth,{timeout:5000}).toBe('submerged');
  const moving=ship(await f.state());expect(moving.remoteOrder.id).toBe(move.orderId);expect(moving.x).toBeLessThan(97.5);
  const strike={id:'ship',action:'strike',target:{x:120,y:50.5},ammo:'HE',rotated:true,expected:1,orderId:randomUUID()};
  const fired=await f.post('ships/remote-action',strike);expect(fired.status,JSON.stringify(fired.body)).toBe(201);
  expect((await f.state()).combat.barrages).toHaveLength(1);expect(ship(await f.state()).remoteOrder.id).toBe(move.orderId);
  await f.restart();await f.connect();expect((await f.post('ships/remote-action',strike)).status).toBe(200);
  // Legacy drill combat is transient; receipts and tube cooldown still persist.
  expect((await f.state()).combat.barrages).toHaveLength(0);expect(ship(await f.state()).siloReloads[0]).toBeGreaterThan(0);expect(ship(await f.state()).reload).toBe(0);
  expect((await f.post('ships/remote-action',{...strike,orderId:randomUUID()},1)).status).toBe(409);
  expect((await f.post('ships/remote-action',{id:'ship',action:'surface',expected:2,orderId:randomUUID()})).status).toBe(201);
  expect(ship(await f.state()).remoteOrder.id).toBe(move.orderId);
 }finally{await f.close();}
},20000);
