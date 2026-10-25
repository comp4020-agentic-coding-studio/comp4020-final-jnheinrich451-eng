import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {newAirbase} from '../../public/aircraft.js';
import {freshLife} from '../../public/survival.js';
import {freshLogistics} from '../../public/logistics.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

export async function helicopterFieldFixture({losePad=false,onPad=false,sling='',twoHelicopters=false,sharedCargo=false,remote=false}={}){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-heli-field-')),tokens=[randomUUID(),randomUUID()];
 let app=createApp({dataDir:dir,logSink:()=>{},canManage:()=>sharedCargo});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite'));
 const world={...createWorld(),version:3,width:100,height:100,terrain:Array(10000).fill(2),sites:[],fronts:[],spawn:{x:50.5,y:50.5}};
 const logistics={...freshLogistics(),groundSupplies:400};
 if(sling){
  const v={id:'cargo',owner:'pilot0',kind:sling,x:50.5,y:50.5,angle:0,elapsed:99,remaining:0,podX:40,podY:40,health:123,cargo:73,weapon:'MAGNETIC',secondary:'HEAVY_FLAME',occupant:null,speed:0,path:[],task:null};
  if(sling==='tank')db.prepare('INSERT INTO tanks VALUES (?,?)').run(v.id,JSON.stringify(v));
  else{logistics.recyclers.push(v);logistics.durability['recycler:cargo']={health:92,max:160,armor:1};}
 }
 if(losePad)logistics.durability['airbase:pad']={health:0,max:300,armor:2};
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
 db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(logistics));
 for(const [i,token] of tokens.entries()){
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot'+i,'Pilot '+i,i?52.5:50.5,50.5,0);
  db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot'+i,JSON.stringify({...freshLife(),deployed:true}));
 }
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot0',65,65,99);
 const base=newAirbase('pad','pilot0',20,20,'helicopter','helipad');
 Object.assign(base.aircraft,{state:losePad?'parked':'flying',x:onPad?21.5:50.5,y:onPad?21.5:50.5,occupant:'pilot0',health:80,rounds:17,rockets:3,leftBase:true});
 if(remote){base.aircraft.occupant=null;base.aircraft.mission={id:'initial-hover',kind:'transport',action:'stop',phase:'holding',target:{x:base.aircraft.x,y:base.aircraft.y}};db.prepare('UPDATE scouts SET x=45.5,y=50.5 WHERE id=?').run('pilot0');}
 if(losePad&&!onPad)base.aircraft.fieldLanding={x:50.5,y:50.5};
 db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));
 if(twoHelicopters){const other=newAirbase('other-pad','pilot1',25,20,'helicopter','helipad');Object.assign(other.aircraft,{state:'flying',x:50.5,y:50.5,occupant:'pilot1'});db.prepare('INSERT INTO airbases VALUES (?,?)').run(other.id,JSON.stringify(other));}
 db.close();
 let url='',controllers=[];
 async function open(){app=createApp({dataDir:dir,logSink:()=>{},canManage:()=>sharedCargo});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+app.server.address().port;}
 await open();
 const headers=(i=0)=>({Cookie:'frontier='+tokens[i],'Content-Type':'application/json'});
 const state=async(i=0)=>(await fetch(url+'/api/world',{headers:headers(i)})).json();
 const post=async(route,data={},i=0)=>{const response=await fetch(url+'/api/'+route,{method:'POST',headers:headers(i),body:JSON.stringify(data)});return {status:response.status,body:await response.json()};};
 const connect=async(i=0)=>{const controller=new AbortController();controllers.push(controller);const response=await fetch(url+'/api/events',{headers:headers(i),signal:controller.signal});void(async()=>{try{for await(const chunk of response.body){}}catch{}})();};
 async function restart(){controllers.forEach(c=>c.abort());controllers=[];await app.close();await open();}
 async function close(){controllers.forEach(c=>c.abort());await app.close();const target=path.resolve(dir);if(path.dirname(target)!==path.resolve(tmpdir())||!path.basename(target).startsWith('frontier-heli-field-'))throw Error('Unexpected test directory');await rm(target,{recursive:true,force:true});}
 return {get url(){return url;},tokens,state,post,connect,restart,close};
}
