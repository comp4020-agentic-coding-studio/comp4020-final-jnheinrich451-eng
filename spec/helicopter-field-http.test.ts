import {it,expect} from 'vitest';
import {helicopterFieldFixture} from '../tests/helpers/helicopter-field-fixture.js';
const plane=(s:any)=>s.airbases.find((b:any)=>b.id==='pad').aircraft;
it('lands, exits locally, arbitrates crew boarding, and preserves field parking through a real restart',async()=>{
 const f=await helicopterFieldFixture();try{
  await f.connect();await f.connect(1);
  expect((await f.post('aircraft/exit')).status).toBe(200);
  expect((await f.post('aircraft/board',{aircraftId:'pad:bomber'},1)).status).toBe(409);
  await expect.poll(async()=>plane(await f.state()).state,{timeout:7000}).toBe('parked');
  expect((await f.post('aircraft/exit')).status).toBe(200);
  let s=await f.state();expect(s.players.find((p:any)=>p.id==='pilot0').x).toBeGreaterThan(45);
  expect(plane(s)).toMatchObject({occupant:null,health:80,rounds:17,rockets:3,rearm:0});
  await f.restart();expect(plane(await f.state())).toMatchObject({state:'parked',fieldLanding:{x:50.5,y:50.5},occupant:null,health:80,rounds:17,rockets:3});
  await f.connect();await f.connect(1);
  const claims=await Promise.all([f.post('aircraft/board',{aircraftId:'pad:bomber'}),f.post('aircraft/board',{aircraftId:'pad:bomber'},1)]);
  expect(claims.map(r=>r.status).sort()).toEqual([200,409]);
  s=await f.state();const pilot=plane(s).occupant==='pilot0'?0:1;
  expect((await f.post('aircraft/launch',{},1-pilot)).status).toBe(409);
  expect((await f.post('aircraft/launch',{},pilot)).status).toBe(200);
  await expect.poll(async()=>plane(await f.state()).state,{timeout:7000}).toBe('flying');
  expect(plane(await f.state()).fieldLanding).toBeUndefined();
 }finally{await f.close();}
},20000);
it.each([false,true])('losing the helipad preserves the helicopter %s, its ammunition and its fleet identity',async onPad=>{
 const f=await helicopterFieldFixture({losePad:true,onPad});try{
  await f.connect();await expect.poll(async()=>(await f.state()).airbases[0].destroyed).toBe(true);
  const p=plane(await f.state());expect(p).toMatchObject({state:'parked',health:80,rounds:17,rockets:3,occupant:'pilot0',rearm:0});expect(p.fieldLanding).toBeTruthy();
  await f.restart();expect(plane(await f.state())).toMatchObject({id:p.id,fieldLanding:p.fieldLanding,health:80});
  await f.connect();expect((await f.post('aircraft/launch')).status).toBe(200);
 }finally{await f.close();}
},12000);
