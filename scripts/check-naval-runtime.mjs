// Disposable four-viewer workload. No user saves or external server required.
import { createApp } from '../server.js';
import { createWorld } from '../public/world.js';
import { expandWorld } from '../public/expansion.js';
import { shipSite } from '../public/ship.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'frontier-naval-runtime-')),controllers=[];
let app=createApp({dataDir:dir});await app.close();
const world=expandWorld(createWorld());world.terrain=world.terrain.map((_,i)=>i%world.width<64?0:2);world.spawn={x:70.5,y:48.5};world.bridges=[];
const db=new DatabaseSync(path.join(dir,'world.sqlite')),tokens=[];
db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world),'world');
for(let i=0;i<4;i++){
 const id='pilot-'+i,token=randomUUID(),y=20+i*16;tokens.push(token);
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,id,id,60.5,y+.5,0);
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-'+i,id,75,y,4.5);
 const site=shipSite(world,[],[],60,y,id);if(site.error)throw Error(site.error);
 db.prepare('INSERT INTO ships VALUES (?,?)').run(id,JSON.stringify({...site.ship,id,elapsed:4.5,health:300,hurt:0,occupant:id}));
}
db.close();app=createApp({dataDir:dir});
const latencies=[],begin=performance.now(),cpu=process.cpuUsage();let snapshots=0,peakRss=0,peakEnemies=0;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const post=async(i,route,data)=>{const before=performance.now();const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await r.json();latencies.push(performance.now()-before);return{status:r.status,...body};};
 for(const token of tokens){const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events',{headers:{Cookie:'frontier='+token},signal:c.signal});void(async()=>{try{for await(const bytes of r.body)snapshots++;}catch{}})();}
 await post(0,'ships/contact',{});
 // Turn continuously and send short drive packets; one ship is allowed to be destroyed.
 for(let n=0;n<160;n++){
  await Promise.all(tokens.map((_,i)=>post(i,'input',{x:i===0?0:(n%40<20?1:-1),y:i===0?0:-1,aim:n*.04})));
  if(n%40===0)for(let i=1;i<4;i++)await post(i,'ships/fire',{x:47,y:20+i*16});
  const state=await(await fetch(base+'/api/world',{headers:{Cookie:'frontier='+tokens[0]}})).json();
  peakEnemies=Math.max(peakEnemies,state.combat.naval.count);peakRss=Math.max(peakRss,process.memoryUsage().rss);
  await new Promise(r=>setTimeout(r,125));
 }
 const elapsed=performance.now()-begin,usage=process.cpuUsage(cpu);latencies.sort((a,b)=>a-b);
 const result={seconds:+(elapsed/1000).toFixed(2),viewers:4,ships:4,peakSwimmers:peakEnemies,snapshots,peakProcessRssMiB:+(peakRss/1048576).toFixed(1),cpuCorePercent:+((usage.user+usage.system)/elapsed/10).toFixed(1),requestP95Ms:+latencies[Math.floor(latencies.length*.95)].toFixed(2),note:'Windows local Node process includes server and test clients. Short bounded check; not a Fly 256 MB or sustained battle capacity proof.'};
 await mkdir('.local/run',{recursive:true});
 await writeFile('.local/run/naval-runtime.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{controllers.forEach(c=>c.abort());await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-naval-runtime-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}
