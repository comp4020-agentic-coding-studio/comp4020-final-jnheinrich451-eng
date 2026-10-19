import {it,expect} from 'vitest';
import {createApp} from '../server.js';
import {createWorld} from '../public/world.js';
import {newAirbase} from '../public/aircraft.js';
import {freshLife} from '../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
it('authorizes only the helicopter pilot and preserves pod ammo and timing across idle restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-heli-save-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();let streams:AbortController[]=[];
 try{
  const db=new DatabaseSync(path.join(dir,'world.sqlite')),tokens=[randomUUID(),randomUUID()],b:any=newAirbase('pad','a',30,30,'helicopter','helipad');
  Object.assign(b.aircraft,{occupant:'a',state:'flying',x:50,y:50,leftBase:true});
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify({...createWorld(),width:128,height:96,version:2,terrain:Array(128*96).fill(2),sites:[]}));
  for(const [i,id] of ['a','b'].entries()){db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,50,50+i*3,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run(id,JSON.stringify({...freshLife(),deployed:true}));}
  db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));db.close();let url='';
  async function start(){app=createApp({dataDir:dir,logSink:()=>{}});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+(app.server.address() as any).port;}
  async function connect(i:number){const c=new AbortController();streams.push(c);const r=await fetch(url+'/api/events',{headers:{cookie:'frontier='+tokens[i]},signal:c.signal});void r.text().catch(()=>{});}
  const post=async(i:number,data:any)=>fetch(url+'/api/aircraft/helicopter-fire',{method:'POST',headers:{cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});
  const state=async()=>(await fetch(url+'/api/world',{headers:{cookie:'frontier='+tokens[0]}})).json();
  await start();await connect(0);await connect(1);
  expect((await post(1,{weapon:'rockets',target:{x:50,y:35}})).status).toBe(409);
  expect((await post(0,{weapon:'rockets',target:{x:50,y:35},damage:999999})).status).toBe(200);
  const fired=await state();expect(fired.airbases[0].aircraft.rockets).toBe(39);expect(fired.combat.salvos[0].profile.damage).toBe(42);
  expect((await post(0,{weapon:'arbitrary',target:{x:50,y:35}})).status).toBe(409);
  streams.forEach(c=>c.abort());streams=[];await app.close();await start();
  const restored=(await state()).airbases[0];expect(restored.kind).toBe('helipad');expect(restored.aircraft).toMatchObject({kind:'helicopter',occupant:'a',rockets:39,rocketBurstShots:1});
  expect(restored.aircraft.rocketWindow).toBeGreaterThan(0);await new Promise(r=>setTimeout(r,150));expect((await state()).airbases[0].aircraft.rocketWindow).toBe(restored.aircraft.rocketWindow);
  await connect(0);await expect.poll(async()=>(await state()).airbases[0].aircraft.rocketWindow).toBeLessThan(restored.aircraft.rocketWindow);
 }finally{streams.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-heli-save-'))throw Error('Bad fixture path');await rm(dir,{recursive:true,force:true});}
},15000);
