import {expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {navalRemoteFixture} from '../tests/helpers/naval-remote-fixture.js';

it('accepts four remote salvos, deduplicates retries and keeps each cooldown across restart',async()=>{
 const f=await navalRemoteFixture({submarine:true});try{
  await f.connect();const orders:any[]=[];
  for(let i=0;i<4;i++){
   const order={id:'ship',action:'strike',target:{x:120,y:50},ammo:'HE',rotated:false,expected:i,orderId:randomUUID()};orders.push(order);
   expect((await f.post('ships/remote-action',order)).status).toBe(201);expect((await f.post('ships/remote-action',order)).status).toBe(200);
  }
  let s=await f.state();expect(s.combat.barrages.map((b:any)=>b.group)).toEqual([0,1,2,3]);expect(s.ships.find((v:any)=>v.id==='ship').siloReloads.every((r:number)=>r>0)).toBe(true);
  expect((await f.post('ships/remote-action',{...orders[0],expected:4,orderId:randomUUID()})).status).toBe(409);
  await f.restart();await f.connect();expect((await f.post('ships/remote-action',orders[3])).status).toBe(200);
  s=await f.state();const ship=s.ships.find((v:any)=>v.id==='ship');expect(ship.siloReloads).toHaveLength(4);expect(ship.nextSiloGroup).toBe(0);expect(ship.siloReloads.every((r:number)=>r>0)).toBe(true);expect(ship.remoteActionRevision).toBe(4);
  expect((await f.post('ships/remote-action',{...orders[0],expected:4,orderId:randomUUID()})).status).toBe(409);
 }finally{f.mutateSave((db:DatabaseSync)=>db.exec('DROP TRIGGER IF EXISTS reject_launch'));await f.close();}
});

for(const manual of [false,true])it('rolls back a failed '+(manual?'manual':'remote')+' submarine launch without spending a group',async()=>{
 const f=await navalRemoteFixture({submarine:true});try{
  await f.restart((db:DatabaseSync)=>{
   const row:any=db.prepare("SELECT value FROM ships WHERE id='ship'").get(),s=JSON.parse(row.value);s.siloReloads=[0,0,0,0];s.nextSiloGroup=0;if(manual)s.occupant='pilot0';
   db.prepare("UPDATE ships SET value=? WHERE id='ship'").run(JSON.stringify(s));

  });await f.connect();
  f.mutateSave((db:DatabaseSync)=>db.exec("CREATE TRIGGER reject_launch BEFORE INSERT ON ships WHEN NEW.id='ship' BEGIN SELECT RAISE(ABORT,'test launch failure'); END"));
  const result=manual?await f.post('ships/fire',{x:120,y:50}):await f.post('ships/remote-action',{id:'ship',action:'strike',target:{x:120,y:50},ammo:'HE',rotated:false,expected:0,orderId:randomUUID()});
  expect(result.status).toBe(500);const s=await f.state();expect(s.combat.barrages).toHaveLength(0);expect(s.ships.find((v:any)=>v.id==='ship')).toMatchObject({siloReloads:[0,0,0,0],nextSiloGroup:0,reload:0});
  f.mutateSave((db:DatabaseSync)=>db.exec('DROP TRIGGER reject_launch'));await f.restart();const saved=await f.state();expect(saved.ships.find((v:any)=>v.id==='ship').siloReloads).toEqual([0,0,0,0]);
 }finally{await f.close();}
});
