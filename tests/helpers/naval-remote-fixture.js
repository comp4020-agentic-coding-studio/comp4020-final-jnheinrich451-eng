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
export async function navalRemoteFixture({bowIn=false,returning=false,tightDock=false,submarine=false}={}){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-remote-naval-')),tokens=[randomUUID(),randomUUID()];
 let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite'));
 const world={...createWorld(),version:3,width:160,height:120,terrain:Array.from({length:160*120},(_,i)=>i%160>=100?2:0),sites:[],spawn:{x:110,y:60},fronts:[]};
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
 db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify({...freshLogistics(),groundSupplies:1200}));
 for(const [i,token] of tokens.entries()){
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot'+i,'Pilot '+i,returning?100.5:110.5+i*2,returning?50.5:60.5,0);
  db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot'+i,JSON.stringify({...freshLife(),deployed:true}));
 }
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot0',110,70,4.5);
 const ship={id:'ship',kind:'gunship',owner:'pilot0',x:30.5,y:50.5,berthX:97.5,berthY:50.5,dock:{x:100.5,y:50.5,angle:-Math.PI/2},angle:0,turret:0,elapsed:4.5,health:300,ammo:'HE',reload:0,occupant:null};
 if(returning)Object.assign(ship,{x:90.5,y:54.5});
 if(submarine)Object.assign(ship,{kind:'submarine',x:97.5,y:50.5,angle:-Math.PI/2});
 if(tightDock)Object.assign(ship,{x:93.649269256792,y:47.24845714856943,angle:-.17949931828134416,berthY:47.5,dockStyle:'unfolding'});
 if(bowIn)Object.assign(ship,{x:97.9,angle:Math.PI/2});
 const carrier={...ship,id:'carrier',kind:'carrier',x:40.5,y:70.5,berthY:80.5,health:600,dock:{...ship.dock,y:80.5},aircraft:{...newAirbase('carrier','pilot0',40,70).aircraft,id:'deck-plane',baseId:'carrier',state:'parked',x:40.5,y:70.5}};
 for(const s of [ship,carrier])db.prepare('INSERT INTO ships VALUES (?,?)').run(s.id,JSON.stringify(s));
 const base=newAirbase('airbase','pilot0',120,40);Object.assign(base.aircraft,{state:'parked',x:122,y:47.5});db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));db.close();
 let url='',controllers=[];
 async function open(){app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',()=>resolve()));url='http://127.0.0.1:'+app.server.address().port;}
 await open();
 const headers=(i=0)=>({Cookie:'frontier='+tokens[i],'Content-Type':'application/json'});
 const state=async(i=0)=>(await fetch(url+'/api/world',{headers:headers(i)})).json();
 const post=async(route,data,i=0)=>{const response=await fetch(url+'/api/'+route,{method:'POST',headers:headers(i),body:JSON.stringify(data)});return {status:response.status,body:await response.json()};};
 const connect=async(i=0)=>{const controller=new AbortController();controllers.push(controller);const response=await fetch(url+'/api/events',{headers:headers(i),signal:controller.signal});void(async()=>{try{for await(const chunk of response.body){}}catch{}})();};
 async function restart(mutate){controllers.forEach(c=>c.abort());controllers=[];await app.close();if(mutate){const db=new DatabaseSync(path.join(dir,'world.sqlite'));try{mutate(db);}finally{db.close();}}await open();}
 async function close(){controllers.forEach(c=>c.abort());await app.close();const target=path.resolve(dir);if(path.dirname(target)!==path.resolve(tmpdir())||!path.basename(target).startsWith('frontier-remote-naval-'))throw Error('Unexpected test directory');await rm(target,{recursive:true,force:true});}
 const mutateSave=mutate=>{const db=new DatabaseSync(path.join(dir,'world.sqlite'));try{mutate(db);}finally{db.close();}};
 return {get url(){return url;},tokens,state,post,connect,restart,mutateSave,close};
}
