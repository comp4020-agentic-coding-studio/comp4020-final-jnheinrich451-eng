import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLife} from '../../public/survival.js';
import {freshLogistics} from '../../public/logistics.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

export async function wreckRecoveryFixture({sea=false,snapshotCrates=0}={}){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-wreck-recovery-')),tokens=[randomUUID(),randomUUID()];
 let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite'));
 const w={...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128<55?0:2),sites:[]};
 const l=freshLogistics();l.groundSupplies=1000;
 l.crates=Array.from({length:snapshotCrates},(_,i)=>({id:'bulk-crate-'+i,x:110,y:80,amount:1,source:'large-snapshot-test'}));
 l.recyclers=sea?[]:[{id:'r0',kind:'recycler',owner:'pilot0',occupant:'pilot0',x:70.5,y:50.5,angle:0,cargo:0,remaining:0,path:[]},
  {id:'r1',kind:'recycler',owner:'pilot1',occupant:'pilot1',x:72,y:52,angle:0,cargo:0,remaining:0,path:[]}];
 l.facilities=[{id:'factory',kind:'factory',owner:'pilot0',x:75,y:50,remaining:0,cargo:0}];
 l.durability['factory:factory']={health:0,max:400,armor:2};
 l.purchases={'factory:factory':{id:'factory-paid',paid:150,pool:'supplies'}};
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
 db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
 for(const [i,token] of tokens.entries()){
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot'+i,'Salvager '+i,sea&&i===0?30.5:70.5+i*1.5,sea&&i===0?40.5:50.5+i*1.5,0);
  db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot'+i,JSON.stringify({...freshLife(),deployed:true}));
 }
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('support','pilot0',90,70,4.5);
 db.prepare('INSERT INTO tanks VALUES (?,?)').run('lost-tank',JSON.stringify({id:'lost-tank',owner:'pilot0',x:72,y:50.5,podX:95,podY:80,elapsed:99,angle:.3,health:0,destroyed:true,purchase:{id:'tank-paid',paid:100,pool:'supplies'}}));
 const vessel={id:'transport',kind:'transport',owner:'pilot0',occupant:sea?'pilot0':null,x:30.5,y:40.5,berthX:52.5,berthY:40.5,dock:{x:55.5,y:40.5,angle:-Math.PI/2},angle:0,turret:0,elapsed:4.5,health:300,ammo:'HE',reload:0,
  cargo:{kind:'utility',vehicle:{id:'sea-r',kind:'recycler',owner:'pilot0',x:30,y:40,remaining:0,cargo:150,path:[]}}};
 if(sea){
  db.prepare('INSERT INTO ships VALUES (?,?)').run(vessel.id,JSON.stringify(vessel));
  db.prepare('INSERT INTO ships VALUES (?,?)').run('lost-ship',JSON.stringify({...vessel,id:'lost-ship',kind:'gunship',occupant:null,cargo:null,berthY:60.5,dock:{...vessel.dock,y:60.5},destroyed:true,health:0,purchase:{id:'ship-paid',paid:200,pool:'groundSupplies'}}));
 }
 db.close();let url='',controllers=[];
 async function open(){app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+app.server.address().port;}
 await open();
 const state=async(i=0)=>(await fetch(url+'/api/world',{headers:{Cookie:'frontier='+tokens[i]}})).json();
 const post=async(route,data={},i=0)=>{const response=await fetch(url+'/api/'+route,{method:'POST',headers:{Cookie:'frontier='+tokens[i],'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,data:await response.json()};};
 const connect=async(i=0)=>{const c=new AbortController();controllers.push(c);const r=await fetch(url+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body){}}catch{}})();};
 const restart=async(update)=>{controllers.forEach(c=>c.abort());controllers=[];await app.close();if(update){const saved=new DatabaseSync(path.join(dir,'world.sqlite'));try{update(saved);}finally{saved.close();}}await open();};
 const close=async()=>{controllers.forEach(c=>c.abort());await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-wreck-recovery-'))throw Error('Unsafe fixture path');await rm(dir,{recursive:true,force:true});};
 return {get url(){return url;},tokens,state,post,connect,restart,close};
}
