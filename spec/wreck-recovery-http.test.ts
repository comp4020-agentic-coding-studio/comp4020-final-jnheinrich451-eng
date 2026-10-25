import {it,expect} from 'vitest';
import {wreckRecoveryFixture} from '../tests/helpers/wreck-recovery-fixture.js';
const wreck=(s:any,id:string):any=>Object.values(s.logistics.recovery).find((w:any)=>w.sourceId===id);
it('records orbital and discounted local payments exactly once and keeps receipts through restart',async()=>{
 const f=await wreckRecoveryFixture();try{
  await f.connect();expect((await f.post('logistics/exit')).status).toBe(200);
  const orbital=await f.post('tanks',{x:85,y:60});expect(orbital.status).toBe(201);
  const local=await f.post('tanks',{x:105,y:75,method:'factory',factoryId:'support'});expect(local.status).toBe(201);
  const a='tank:'+orbital.data.tank.id,b='tank:'+local.data.tank.id,s=await f.state();
  expect(s.logistics.purchases[a]).toMatchObject({paid:100,pool:'supplies'});
  expect(s.logistics.purchases[b]).toMatchObject({paid:25,pool:'groundSupplies'});
  expect((await f.post('tanks',{x:85,y:60})).status).toBe(200);
  await f.restart();const restored=await f.state();expect(restored.logistics.purchases[a]).toEqual(s.logistics.purchases[a]);expect(restored.logistics.purchases[b]).toEqual(s.logistics.purchases[b]);
  expect(restored.logistics.groundSupplies).toBe(975);expect(restored.logistics.supplies).toBe(1100);
 }finally{await f.close();}
});
it('shares a land wreck between two players and never regenerates it across restart',async()=>{
 const f=await wreckRecoveryFixture();try{
  await f.connect();await f.connect(1);
  await expect.poll(async()=>wreck(await f.state(),'lost-tank').amount,{timeout:6000}).toBe(0);
  const s=await f.state();expect(s.logistics.recyclers.reduce((n:number,r:any)=>n+r.cargo,0)).toBeCloseTo(50);
  expect(wreck(s,'factory').amount).toBe(75);expect(s.logistics.facilities).toHaveLength(0);
  await f.restart();await f.connect();await f.connect(1);
  const restored=await f.state();expect(wreck(restored,'lost-tank').amount).toBe(0);expect(restored.logistics.recyclers.reduce((n:number,r:any)=>n+r.cargo,0)).toBeCloseTo(50);
  expect((await f.post('logistics/exit')).status).toBe(200);
  await expect.poll(async()=>{await f.post('input',{x:0,y:-1});return (await f.state()).me.y;},{interval:100}).toBeLessThan(49);
  await f.post('input',{x:0,y:0});
  expect((await f.post('logistics/command',{id:'r0',action:'wreck',targetId:wreck(restored,'factory').id})).status).toBe(200);
  await expect.poll(async()=>wreck(await f.state(),'factory').amount,{timeout:12000}).toBe(0);
  expect((await f.state()).logistics.recyclers.reduce((n:number,r:any)=>n+r.cargo,0)).toBeCloseTo(125);
 }finally{await f.close();}
},20000);
it('saves sea wreck debit and carried cargo together, stops at capacity and retains both after restart',async()=>{
 const f=await wreckRecoveryFixture({sea:true});try{
  await f.connect();const ship=(s:any)=>s.ships.find((v:any)=>v.id==='transport');
  await expect.poll(async()=>ship(await f.state()).cargo.vehicle.cargo,{timeout:6000}).toBe(180);
  expect(wreck(await f.state(),'lost-ship').amount).toBe(70);
  await f.restart();await f.connect();const s=await f.state();expect(ship(s).cargo.vehicle.cargo).toBe(180);expect(wreck(s,'lost-ship').amount).toBe(70);
  expect((await f.post('logistics/command',{id:'sea-r',action:'wreck',targetId:wreck(s,'lost-ship').id})).status).toBe(409);
 }finally{await f.close();}
},12000);
