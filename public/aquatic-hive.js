import {bridgeAt} from './bridge-geometry.js';
import {canStand,waterTileAt} from './world.js';
import {canSwim,waterRoute,SWIMMER} from './naval.js';
import {operational,hullDistance,hurtVehicle} from './vehicle.js';
import {facilityDistance,hurtFacility} from './logistics.js';
import {hurtRobot} from './survival.js';
import {submerged} from './submarine-depth.js';

import {AQUATIC,isSpitter} from './aquatic-profile.js';
export {AQUATIC,isSpitter} from './aquatic-profile.js';
const center=s=>({x:s.x+1.5,y:s.y+1.5});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function makeAquaticHive(id,x,y){
 return {id,kind:'aquatic-hive',name:'Aquatic hive',x,y,hp:AQUATIC.hp,maxHp:AQUATIC.hp,state:'hostile',guardsRemaining:0,awake:false,hitAt:-10000,blockedAt:-10000,pending:null,alarmUntil:0,
  aquatic:{nextSpawn:0,sequence:0,nextVent:0},encounter:{id,name:'Glassmere / aquatic hive',...center({x,y}),radius:11,requiredIds:[id]}};
}
// Add one shoreline encounter without editing terrain or occupying saved assets.
export function seedAquaticHive(world,buildings=[],occupants=[]){
 if(world.template!=='vesper-v1'||world.sites?.some(s=>s.id==='vesper-aquatic-hive-01'))return [];
 const assets=[...buildings,...occupants,...(world.cores||[]),...(world.tanks||[]),...(world.airbases||[]),...(world.artillery||[]),...(world.ships||[]),...(world.logistics?.facilities||[]),...(world.logistics?.recyclers||[]),...(world.logistics?.shipyards||[]).map(s=>s.dock)];
 const candidates=[];for(let y=91;y<=126;y++)for(let x=294;x<=339;x++)if(world.waterKinds?.[y*world.width+x]===3)candidates.push({x,y});
 candidates.sort((a,b)=>distance(a,{x:331,y:112})-distance(b,{x:331,y:112}));
 for(const p of candidates){
  const c=center(p);if(assets.some(a=>a&&distance(a,c)<24)||(world.sites||[]).some(s=>distance(center(s),c)<14))continue;
  let clear=true;for(let y=p.y-2;y<p.y+5;y++)for(let x=p.x-2;x<p.x+5;x++)if(waterTileAt(world,x,y)!==0||bridgeAt(world,x,y))clear=false;
  if(!clear||!(world.rails||[]).every(r=>distance(r,c)>8))continue;
  if(!Array.from({length:16},(_,i)=>({x:c.x+Math.cos(i*Math.PI/8)*9,y:c.y+Math.sin(i*Math.PI/8)*9})).some(q=>canStand(world,buildings,q.x,q.y)))continue;
  return [makeAquaticHive('vesper-aquatic-hive-01',p.x,p.y)];
 }
 return [];
}
export function aquaticTargets(world,robots,facilities){
 const vehicles=[...(world.tanks||[]),...(world.ships||[])].filter(v=>operational(v)&&!submerged(v));
 const occupied=new Set(vehicles.map(v=>v.occupant).concat((world.logistics?.recyclers||[]).map(v=>v.occupant)));
 const foot=robots.filter(p=>p.life==='active'&&p.health>0&&!p.deploying&&!(p.shield>0)&&!occupied.has(p.id)&&!['orbital','rover','ship','aircraft','recycler'].includes(p.body));
 return foot.map(p=>({id:p.id,x:p.x,y:p.y,range:q=>distance(p,q),hurt:n=>hurtRobot(p,n)}))
  .concat(vehicles.map(v=>({id:v.id,x:v.x,y:v.y,range:q=>hullDistance(v,q),hurt:n=>hurtVehicle(v,n)})))
  .concat(facilities.filter(f=>f.hp.health>0&&!f.protected).map(f=>({id:f.id,x:f.x,y:f.y,range:q=>facilityDistance(f,q),hurt:n=>hurtFacility(f,n,3)})));
}
function spawnPoint(world,site,enemies,targets){
 const c=center(site);for(let i=0;i<24;i++){
  const a=(i+site.aquatic.sequence)*Math.PI/12,p={x:Math.floor(c.x+Math.cos(a)*4)+.5,y:Math.floor(c.y+Math.sin(a)*4)+.5};
  if(canSwim(world,p.x,p.y)&&!enemies.some(e=>e.hp>0&&distance(e,p)<1.5)&&!targets.some(t=>t.range(p)<3))return p;
 }return null;
}
// Fields reserve their complete area while warning/in flight. No hidden or
// post-restart catch-up damage; simulation time alone advances every deadline.
export function tickAquatic(world,enemies,sleeping,targets,clouds,shots,now,dt,nextId,capacity,admitField,emit=()=>{}){
 let changed=clouds.length>0||shots.some(s=>s.weapon==='BILE');
 const addField=(sourceId,p,radius,activeAt,duration,kind)=>{
  if(clouds.length>=AQUATIC.maxFields||!admitField(Math.PI*radius*radius))return null;
  const f={id:nextId(),weapon:'TOXIC',sourceId,...p,radius,at:now,activeAt,expiresAt:activeAt+duration,duration,kind};clouds.push(f);return f;
 };
 const hurtArea=(p,radius,amount,sourceId,projectileId,log=true)=>{for(const t of targets)if(t.range(p)<=radius&&t.hurt(amount)&&log)emit({event:'enemy.weapon.hit',kind:'system',sourceId,projectileId,targetId:t.id,weapon:'BILE'});};
 for(const s of shots)if(s.weapon==='BILE'&&!s.impacted&&now>=s.landAt){s.impacted=true;hurtArea(s,AQUATIC.blastRadius,AQUATIC.damage,s.sourceId,s.id);}
 for(let i=clouds.length-1;i>=0;i--){
  const f=clouds[i],site=(world.sites||[]).find(s=>s.id===f.sourceId);
  if(f.kind==='vent'&&site?.state==='conquered'&&site.conqueredAt<f.activeAt){clouds.splice(i,1);continue;}
  const seconds=Math.max(0,Math.min(now,f.expiresAt)-Math.max(now-dt*1000,f.activeAt))/1000;
  if(seconds){const log=now>=(f.logAt||0);hurtArea(f,f.radius,AQUATIC.poisonDps*seconds,f.sourceId,f.id,log);if(log)f.logAt=now+1000;}
  if(now>=f.expiresAt)clouds.splice(i,1);
 }
 for(const site of world.sites||[]){
  if(site.kind!=='aquatic-hive'||site.state!=='hostile')continue;changed=true;
  const a=site.aquatic ||= {nextSpawn:0,sequence:0,nextVent:0},c=center(site);
  const healing=Math.max(0,Math.min(dt,(now-site.hitAt-AQUATIC.healDelay)/1000));
  site.hp=Math.min(site.maxHp,site.hp+healing*AQUATIC.healRate);
  if(!targets.some(t=>t.range(c)<AQUATIC.wake))continue;
  site.awake=true;
  if(now>=a.nextSpawn){
   const all=enemies.concat(sleeping),count=all.filter(e=>e.hp>0&&e.siteId===site.id).length;
   if(count<AQUATIC.max&&enemies.filter(e=>e.hp>0&&e.kind==='swimmer').length<SWIMMER.max&&capacity()>0){
    const p=spawnPoint(world,site,all,targets);if(p){enemies.push({id:nextId(),...p,kind:'swimmer',variant:'bile-spitter',hp:AQUATIC.spitterHp,maxHp:AQUATIC.spitterHp,siteId:site.id,homeX:p.x,homeY:p.y,angle:0,path:[],reroute:0,behavior:'guarding',emergedAt:now});a.sequence++;emit({event:'reinforcement.changed',kind:'system',sourceId:site.id,cause:'aquatic_spawn',count:1});}
   }a.nextSpawn=now+AQUATIC.spawnEvery;
  }
  if(now>=a.nextVent&&targets.some(t=>t.range(c)<AQUATIC.ventRadius+2)){
   const f=addField(site.id,c,AQUATIC.ventRadius,now+AQUATIC.ventWarning,AQUATIC.ventDuration,'vent');
   a.nextVent=now+(f?AQUATIC.ventCooldown:1000);if(f)emit({event:'enemy.weapon.warning',kind:'system',sourceId:site.id,projectileId:f.id,weapon:'TOXIC',x:c.x,y:c.y});
  }
 }
 for(const e of enemies){
  if(!isSpitter(e)||e.hp<=0)continue;
  const home={x:e.homeX??e.x,y:e.homeY??e.y};
  const target=targets.filter(t=>t.range(e)<=20&&distance(t,home)<=28).sort((a,b)=>a.range(e)-b.range(e)||String(a.id).localeCompare(String(b.id)))[0];
  if(e.attack){
   if(now>=e.attack.fireAt){
    if(shots.filter(s=>!s.impacted).length<AQUATIC.maxShots){
     const f=addField(e.id,{x:e.attack.x,y:e.attack.y},AQUATIC.puddleRadius,now+AQUATIC.flight,AQUATIC.puddleDuration,'puddle');
     if(f){const s={id:nextId(),sourceId:e.id,weapon:'BILE',fromX:e.x,fromY:e.y,x:e.attack.x,y:e.attack.y,at:now,landAt:f.activeAt,impacted:false};shots.push(s);emit({event:'enemy.weapon.launched',kind:'system',sourceId:e.id,projectileId:s.id,weapon:'BILE',x:s.x,y:s.y});}
    }e.attack=null;e.nextShot=now+AQUATIC.reload;
   }continue;
  }
  if(target&&target.range(e)<=AQUATIC.range){
   e.path=[];e.angle=Math.atan2(target.x-e.x,-(target.y-e.y));
   if(now>=(e.nextShot||0)&&shots.filter(s=>!s.impacted).length<AQUATIC.maxShots&&clouds.length<AQUATIC.maxFields)e.attack={kind:'bile',x:target.x,y:target.y,at:now,fireAt:now+AQUATIC.windup};
   continue;
  }
  if(!target){e.path=[];continue;}
  if(now>=(e.reroute||0)){e.path=waterRoute(world,e,(x,y)=>target.range({x,y})<=AQUATIC.range&&distance({x,y},home)<28,()=>false,512)||[];e.reroute=now+1500;}
  const p=e.path?.[0];if(!p)continue;const d=distance(e,p),step=Math.min(d,AQUATIC.speed*dt);
  if(d<.05){e.path.shift();continue;}const x=e.x+(p.x-e.x)*step/d,y=e.y+(p.y-e.y)*step/d;
  if(canSwim(world,x,y)){e.angle=Math.atan2(x-e.x,-(y-e.y));e.x=x;e.y=y;}else{e.path=[];e.reroute=now+1000;}
 }
 return changed;
}
