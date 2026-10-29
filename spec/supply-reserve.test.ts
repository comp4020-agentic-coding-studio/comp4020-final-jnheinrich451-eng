import {expect,it} from 'vitest';
import {ECONOMY,freshLogistics,supplyReserve,tickSupplies} from '../public/logistics.js';
import {createApp} from '../server.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

it.each([[0,0,0],[1,250,50],[2,400,85],[3,650,135],[4,900,185]])('scales refill thresholds for %s connected players', (players,orbital,ground)=>{
 expect(supplyReserve(players)).toEqual({players,orbital,ground});
});
it('refills both pools at fixed rates, caps passive income, and preserves earned supplies when players leave',()=>{
 const l:any=freshLogistics();l.supplies=0;tickSupplies(l,10,3);
 expect(l.supplies).toBe(20);expect(l.groundSupplies).toBe(4);
 tickSupplies(l,10000,3);expect(l.supplies).toBe(650);expect(l.groundSupplies).toBe(135);
 tickSupplies(l,100,1);expect(l.supplies).toBe(650);expect(l.groundSupplies).toBe(135);
 l.supplies=249;l.groundSupplies=49.9;tickSupplies(l,10,1);
 expect(l.supplies).toBe(250);expect(l.groundSupplies).toBe(50);
 l.supplies=1200;l.groundSupplies=800;tickSupplies(l,100,4);
 expect(l.supplies).toBe(1200);expect(l.groundSupplies).toBe(800);
});
it('preserves fractional progress across serialization and gives no offline or invalid-time credit',()=>{
 const l:any=freshLogistics();l.supplies=0;tickSupplies(l,.25,1);
 const restored=JSON.parse(JSON.stringify(l));tickSupplies(restored,.25,1);
 expect(restored.supplies).toBe(1);expect(restored.groundSupplies).toBe(.2);
 const before=JSON.stringify(restored);tickSupplies(restored,99999,0);
 for(const dt of [NaN,Infinity,-1,0])tickSupplies(restored,dt,3);
 expect(JSON.stringify(restored)).toBe(before);
});
it('counts distinct connected pilots per map, clamps both pools, and resumes saved balances without a join grant',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-supply-reserve-')),tokens=[randomUUID(),randomUUID(),randomUUID()];
 let app=createApp({dataDir:dir,logSink:()=>{}}),base='';const streams:AbortController[]=[];
 const open=async()=>{app=createApp({dataDir:dir,logSink:()=>{}});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(app.server.address() as any).port}`;};
 const state=async()=>(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[0]}})).json();
 const connect=async(i:number)=>{const c=new AbortController();streams.push(c);const r=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body as any){}}catch{}})();return c;};
 try{
  await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite'));
  for(const [i,token] of tokens.entries())db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot-'+i,'Pilot '+i,20+i,20,0);
  const l:any=freshLogistics();l.supplies=399.8;l.groundSupplies=84.96;db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));db.close();await open();
  expect((await state()).supplyReserve.players).toBe(0);
  await connect(0);expect((await state()).supplyReserve).toEqual({players:1,orbital:250,ground:50});
  await connect(0);expect((await state()).supplyReserve.players).toBe(1);
  await connect(1);await expect.poll(async()=>(await state()).logistics.groundSupplies).toBe(85);
  expect((await state()).logistics.supplies).toBe(400);
  const third=await connect(2);expect((await state()).supplyReserve).toEqual({players:3,orbital:650,ground:135});
  await expect.poll(async()=>(await state()).logistics.groundSupplies).toBeGreaterThan(85);
  third.abort();await expect.poll(async()=>(await state()).supplyReserve.players).toBe(2);
  const above=(await state()).logistics;expect(above.supplies).toBeGreaterThan(400);expect(above.groundSupplies).toBeGreaterThan(85);
  streams.forEach(c=>c.abort());await app.close();await open();
  const restored=(await state()).logistics;expect(restored.supplies).toBeCloseTo(above.supplies,8);expect(restored.groundSupplies).toBeCloseTo(above.groundSupplies,8);
  expect((await state()).supplyReserve.players).toBe(0);await connect(0);const solo=(await state()).logistics;
  expect(solo.supplies).toBe(restored.supplies);expect(solo.groundSupplies).toBe(restored.groundSupplies);
  expect((await state()).supplyReserve).toEqual({players:1,orbital:250,ground:50});
 }finally{
  streams.forEach(c=>c.abort());await app.close();
  if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-supply-reserve-'))throw Error('Unexpected test save path');
  await rm(dir,{recursive:true,force:true});
 }
},15000);
