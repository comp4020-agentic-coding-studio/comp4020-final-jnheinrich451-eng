import {it,expect} from 'vitest';
import {navalRemoteFixture} from '../tests/helpers/naval-remote-fixture.js';
it('requires a connected robot, shares orders with peers, rejects stale/foreign requests and saves retry receipts',async()=>{
 const f=await navalRemoteFixture();try{
  const order={id:'ship',action:'move',target:{x:30.5,y:40.5},orderId:'naval-move-0001',expectedOrderId:null};
  expect((await f.post('ships/order',order)).status).toBe(409);await f.connect();await f.connect(1);
  expect((await f.post('ships/order',{...order,id:'foreign-world-ship'})).status).toBe(404);
  expect((await f.post('ships/order',{...order,target:{x:'bad',y:40}})).status).toBe(409);
  const accepted=await f.post('ships/order',order);expect(accepted.status,JSON.stringify(accepted.body)).toBe(201);
  expect((await f.post('ships/order',order)).status).toBe(200);
  expect((await f.state(1)).ships.find((s:any)=>s.id==='ship').remoteOrder.id).toBe(order.orderId);
  await expect.poll(async()=>(await f.state()).ships.find((s:any)=>s.id==='ship').y,{timeout:5000}).toBeLessThan(49.5);
  expect((await f.post('ships/order',{...order,orderId:'naval-conflict-0002'},1)).status).toBe(409);
  await f.restart();await f.connect();expect((await f.post('ships/order',order)).status).toBe(200);
  expect((await f.state()).ships.find((s:any)=>s.id==='ship').remoteOrder).toMatchObject({id:order.orderId,kind:'move',phase:'moving'});
  expect((await f.post('ships/order',{id:'ship',action:'stop',orderId:'naval-stop-0003',expectedOrderId:order.orderId})).status).toBe(201);
  const held=(await f.state()).ships.find((s:any)=>s.id==='ship');expect(held.remoteOrder.phase).toBe('holding');expect(held.speed).toBe(0);
 }finally{await f.close();}
},15000);
it('commits the full target list once, persists barrage progress, and ignores a replay after Stop',async()=>{
 const f=await navalRemoteFixture();try{
  await f.connect();const order={id:'ship',orderId:'barrage-order-0001',expectedOrderId:null,action:'bombard',targets:[{x:85,y:40},{x:85,y:50},{x:85,y:60}],ammo:'HE'};
  expect((await f.post('ships/order',{...order,targets:order.targets.slice(0,2)})).status).toBe(409);
  expect((await f.post('ships/order',order)).status).toBe(201);
  await expect.poll(async()=>(await f.state()).ships.find((s:any)=>s.id==='ship').remoteOrder.fired,{timeout:6000}).toBe(1);
  const before=(await f.state()).ships.find((s:any)=>s.id==='ship');expect(Object.values(before.mainReloads).every(v=>Number(v)>0)).toBe(true);
  await f.restart();await f.connect();expect((await f.state()).ships.find((s:any)=>s.id==='ship').remoteOrder.fired).toBe(1);
  expect((await f.post('ships/order',order)).status).toBe(200);
  expect((await f.post('ships/order',{id:'ship',orderId:'barrage-stop-0002',expectedOrderId:order.orderId,action:'stop'})).status).toBe(201);
  expect((await f.post('ships/order',order)).status).toBe(200);expect((await f.state()).ships.find((s:any)=>s.id==='ship').remoteOrder.kind).toBe('stop');
 }finally{await f.close();}
},15000);
it('launches a carrier aircraft remotely and assigns a runway strike that continues to cruise',async()=>{
 const f=await navalRemoteFixture();try{
  await f.connect();expect((await f.post('aircraft/cruise',{id:'carrier'})).status).toBe(409);
  const launch=await f.post('aircraft/cruise',{id:'carrier',fromRemote:true});expect(launch.status,JSON.stringify(launch.body)).toBe(200);
  expect((await f.state()).ships.find((s:any)=>s.id==='carrier').aircraft.mission.kind).toBe('cruise');
  const strike=await f.post('aircraft/mission',{id:'airbase',orderId:'remote-runway-0001',target:{x:100,y:85},bearing:2,payload:'HE',fromRemote:true});expect(strike.status,JSON.stringify(strike.body)).toBe(201);
  expect((await f.state()).airbases[0].aircraft.mission.resumeCruise).toBe(true);
 }finally{await f.close();}
});

it('accepts a durable return-to-dock order without client coordinates and shares it with the crew',async()=>{
 const f=await navalRemoteFixture({returning:true});try{
  await f.connect();await f.connect(1);const order={id:'ship',action:'dock',orderId:'dock-return-0001',expectedOrderId:null};
  const accepted=await f.post('ships/order',order);expect(accepted.status,JSON.stringify(accepted.body)).toBe(201);
  expect(accepted.body.order).toMatchObject({kind:'dock',yardId:'ship',berth:{x:97.5,y:50.5}});
  expect((await f.state(1)).ships.find((s:any)=>s.id==='ship').remoteOrder.kind).toBe('dock');
  await f.restart();await f.connect();expect((await f.post('ships/order',order)).status).toBe(200);
  expect((await f.state()).ships.find((s:any)=>s.id==='ship').remoteOrder).toMatchObject({id:order.orderId,kind:'dock'});
 }finally{await f.close();}
});
