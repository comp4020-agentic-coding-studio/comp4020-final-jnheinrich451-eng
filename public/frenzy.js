import { mobileLaser } from './mobile-laser.js';
import { canStand } from './world.js';
import { targetDistance } from './land-ai.js';
import { enemyProfile, heavyEnemy } from './enemy-profiles.js';

export const FRENZY=Object.freeze({warning:5000,duration:60000,cooldown:30000,roster:12,facilityCap:3,assignment:5000,pulse:1000});
export const frenzyActive=f=>!!f&&['warning','surge'].includes(f.phase);

// Local test mix: six Hunters, two Breakers, two Bulwarks and one of each air specialist.
// Reuse nearby survivors unchanged; reserve missing roles before filling Hunters.
export const FRENZY_ROSTER=Object.freeze(['bulwark','breaker','twin-lens','heavy-lens','bulwark','breaker','hunter','hunter','hunter','hunter','hunter','hunter']);
export function planFrenzy(world,buildings,people,enemies,caller,now,id,capacity,options={}){
 const available=enemies.filter(e=>e.hp>0&&e.kind!=='swimmer'&&Math.hypot(e.x-caller.x,e.y-caller.y)<=32)
  .sort((a,b)=>Math.hypot(a.x-caller.x,a.y-caller.y)-Math.hypot(b.x-caller.x,b.y-caller.y));
 const members=[],points=[],arrivals=[];
 for(const kind of (options.roster||FRENZY_ROSTER)){
  let index=available.findIndex(e=>(e.kind||'hunter')===kind);
  if(index<0&&arrivals.length<Math.max(0,capacity)&&(!mobileLaser({kind})||enemies.filter(e=>e.hp>0&&mobileLaser(e)).length+arrivals.filter(k=>mobileLaser({kind:k})).length<4)){arrivals.push(kind);continue;}
  if(index<0&&!options.strictRoles)index=available.length?0:-1;
  if(index>=0)members.push(available.splice(index,1)[0].id);
 }
 const count=arrivals.length;
 for(let i=0;i<64&&points.length<count;i++){
  const angle=(options.angle||0)+i*Math.PI/32,r=12+(i%3),point={x:Math.floor(caller.x+Math.cos(angle)*r)+.5,y:Math.floor(caller.y+Math.sin(angle)*r)+.5};
  if(!canStand(world,buildings,point.x,point.y)||people.concat(enemies,points).some(p=>Math.hypot(p.x-point.x,p.y-point.y)<3))continue;
  // Admit only a continuous clear approach for test arrivals. Real encounters
  // can use authored spawn zones later; never place an arbitrary remote island.
  const d=Math.hypot(point.x-caller.x,point.y-caller.y),steps=Math.ceil(d*2);let clear=true;
  for(let k=1;k<steps&&d*(1-k/steps)>3;k++)if(!canStand(world,buildings,point.x+(caller.x-point.x)*k/steps,point.y+(caller.y-point.y)*k/steps)){clear=false;break;}
  if(clear)points.push({...point,kind:arrivals[points.length]});
 }
 if(!members.length&&!points.length)return null;
 return {id,phase:'warning',until:now+FRENZY.warning,members,points,orders:{},nextPulse:0,outcome:null};
}
const priority=t=>({core:8,outpost:7,factory:6,airbase:5,uplink:5,artillery:4,missile:4}[t.facility?.kind]||1);

export function tickFrenzy(f,world,enemies,combatants,facilities,now,spawn,emit,contacts=[]){
 if(!f)return;
 if(f.source==='natural'){
  const nearby=p=>Math.hypot(p.x-f.origin.x,p.y-f.origin.y)<=64;
  combatants=combatants.filter(nearby);facilities=facilities.filter(nearby);
 }
 const finish=outcome=>{
  f.phase='cooldown';f.until=now+FRENZY.cooldown;f.outcome=outcome;f.orders={};f.points=[];
  for(const e of enemies)if(f.members.includes(e.id)){
   e.targetId=null;e.attack=null;e.path=[];e.reroute=0;
   if(outcome==='no_ground_targets')e.frenzyRecoveryUntil=f.until;
   if(!e.siteId||Math.hypot(e.x-e.homeX,e.y-e.homeY)>20)e.rally={x:e.x,y:e.y};
  }
  emit({event:'frenzy.resolved',kind:'system',sourceId:f.id,cause:outcome});
 };
 if(f.phase==='cooldown'){if(now>=f.until)f.phase='complete';return;}
 if(f.phase==='complete')return;
 if(f.phase==='warning'){
  if(f.source==='natural'&&!contacts.length){finish('no_ground_targets');return;}
  if(now<f.until)return;
  for(const point of f.points){const e=spawn(point);if(e)f.members.push(e.id);}f.points=[];
  f.phase='surge';f.until=now+FRENZY.duration;emit({event:'frenzy.started',kind:'system',sourceId:f.id,count:f.members.length});
 }
 const alive=enemies.filter(e=>e.hp>0&&f.members.includes(e.id));
 if(!alive.length){finish('repelled');return;}
 if(now>=f.until){finish('signal_ended');return;}
 // All-core-loss recovery must not be trapped inside this same test event.
 if(!(f.source==='natural'&&contacts.length)&&!combatants.length&&!facilities.some(t=>['core','outpost'].includes(t.facility.kind))){finish('no_ground_targets');return;}
 const ground=alive.filter(e=>e.kind!=='swimmer'&&!mobileLaser(e));
 const targets=new Map([...combatants,...facilities].map(t=>[t.id,t]));
 for(const[id,order]of Object.entries(f.orders))if(!targets.has(order.targetId)||!ground.some(e=>String(e.id)===id))delete f.orders[id];
 if(now<f.nextPulse)return;f.nextPulse=now+FRENZY.pulse;
 const eligible=(e,t)=>!(e.failedTarget?.id===t.id&&e.failedTarget.until>now)&&(!t.facility||t.facility.hp.armor<=enemyProfile(e).penetration);
 const raids=facilities.filter(t=>ground.some(e=>eligible(e,t))),quota=raids.length?Math.floor(ground.length/4):0;
 const raiders=new Set(ground.filter(e=>raids.some(t=>eligible(e,t))).sort((a,b)=>{
  const keep=e=>f.orders[e.id]?.role==='raid'?-10000:0;
  const distance=e=>Math.min(...raids.map(t=>targetDistance(e,t)));
  return keep(a)-keep(b)||Number(heavyEnemy(b))-Number(heavyEnemy(a))||(raids.length?distance(a)-distance(b):a.id-b.id);
 }).slice(0,quota).map(e=>e.id));
 const counts=new Map(),baseCounts=new Map(),retained=new Set();
 // Nearby facilities share one attraction bucket: many cheap buildings do not
 // multiply the number of assigned raiders. Bucket boundaries are approximate.
 const base=t=>Math.floor(t.x/16)+','+Math.floor(t.y/16);
 const count=t=>{counts.set(t.id,(counts.get(t.id)||0)+1);if(t.facility)baseCounts.set(base(t),(baseCounts.get(base(t))||0)+1);};
 for(const e of ground){
  const order=f.orders[e.id],target=targets.get(order?.targetId),role=raiders.has(e.id)?'raid':'hunt';
  if(target&&order.role===role&&order.until>now&&eligible(e,target)&&
    (role==='hunt'?combatants.includes(target):(counts.get(target.id)||0)<FRENZY.facilityCap)){
   count(target);retained.add(e.id);order.x=target.x;order.y=target.y;
  }else delete f.orders[e.id];
 }
 for(const e of ground){
  if(retained.has(e.id))continue;
  let role=raiders.has(e.id)?'raid':'hunt',choices=(role==='raid'?raids:combatants).filter(t=>eligible(e,t));
  if(role==='raid')choices=choices.filter(t=>(counts.get(t.id)||0)<FRENZY.facilityCap);
  if(!choices.length&&role==='raid'){role='hunt';choices=combatants.filter(t=>eligible(e,t));}
  const score=t=>targetDistance(e,t)+(counts.get(t.id)||0)*16+(role==='raid'?(baseCounts.get(base(t))||0)*12-priority(t):0);
  choices.sort((a,b)=>score(a)-score(b)||String(a.id).localeCompare(String(b.id)));
  const target=choices[0];if(!target)continue;count(target);
  f.orders[e.id]={role,targetId:target.id,x:target.x,y:target.y,until:now+FRENZY.assignment};
 }
}
