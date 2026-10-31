import { sensorContacts } from './sensors.js';
import { canStand } from './world.js';
import { navalSpawn, canSwim, SWIMMER } from './naval.js';
import { operational } from './vehicle.js';
import { submerged } from './submarine-depth.js';
import { planFrenzy } from './frenzy.js';
import { mobileLaser, cancelMobileLaser } from './mobile-laser.js';
import { islandAt, islandContacts } from './island-pressure.js';
import { updatePressure, pressureContext, PRESSURE } from './pressure-budget.js';
import { planRoaming } from './roaming-pressure.js';
import { AERIAL, aerialPointClear } from './aerial-enemy.js';
import { isAirEnemy } from './target-domain.js';

export const ENCOUNTERS=Object.freeze({firstMin:180000,firstMax:300000,quietMin:120000,quietMax:300000,
 warning:8000,pulse:2000,retry:30000,compoundCap:6,activeRange:36,sleepRange:80,wakeRange:52,sleepLimit:128,
 roamMin:90000,roamMax:150000,roamRetry:10000,roamCap:6});
export const groupKey=s=>s.encounter?.id||s.settlement?.id||s.id;
function random(d){d.rng=(Math.imul(d.rng,1664525)+1013904223)>>>0;return d.rng/4294967296;}
const interval=(d,min,max)=>Math.round(min+random(d)*(max-min));
export function createDirector(seed){
 let rng=2166136261;for(const c of String(seed))rng=Math.imul(rng^c.charCodeAt(0),16777619)>>>0;
 const d={version:1,rng,elapsed:0,nextRaid:0,nextPulse:0,sequence:0,focusCursor:0,lastEvent:null,cursor:0,groups:{},sleeping:[],deferred:null};
 d.nextRaid=interval(d,ENCOUNTERS.firstMin,ENCOUNTERS.firstMax);return d;
}
export function raidContacts(world,people){
 const seen=new Set();
 return sensorContacts(world,people).filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true;})
  .map(p=>({...p,medium:p.ground?'ground':p.targetId.startsWith('ship:')?'sea':'air'}));
}
export function raidPointClear(world,buildings,people,enemies,point){
 return (point.kind==='swimmer'?canSwim(world,point.x,point.y):canStand(world,buildings,point.x,point.y))
  &&!people.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<8)
  &&!enemies.some(e=>e.hp>0&&Math.hypot(e.x-point.x,e.y-point.y)<2);
}
function shore(world,buildings,contact){
 if(canStand(world,buildings,contact.x,contact.y))return contact;
 // Fixed candidate budget: find a nearby usable coast, never scan the planet.
 for(let r=4;r<=24;r+=4)for(let i=0;i<16;i++){
  const a=i*Math.PI/8,p={x:Math.floor(contact.x+Math.cos(a)*r)+.5,y:Math.floor(contact.y+Math.sin(a)*r)+.5};
  if(canStand(world,buildings,p.x,p.y))return p;
 }
 return null;
}
export function planNaturalRaid(d,world,buildings,contacts,enemies,now,capacity,admit=()=>capacity){
 if(!contacts.length||capacity<=0)return null;
 const sorted=[...contacts].sort((a,b)=>a.id.localeCompare(b.id)),contact=sorted[(d.focusCursor??d.sequence)%sorted.length];
 capacity=Math.min(capacity,admit(contact,'raid'));if(capacity<=0)return null;
 const id='raid-'+(d.sequence+1),points=[],members=[],anchor=shore(world,buildings,contact);
 const air=contact.medium==='air';
 // Team pressure scales the island's arrival clock, never every raid's roster.
 const roster=air?['twin-lens','heavy-lens']:['bulwark','breaker','hunter','hunter','hunter','hunter'];
 if(contact.medium==='sea'){
  const ship=(world.ships||[]).find(s=>s.occupant===contact.id&&operational(s)&&!submerged(s));
  if(ship)for(const p of navalSpawn(world,ship,enemies).slice(0,Math.max(0,SWIMMER.max-enemies.filter(e=>e.kind==='swimmer'&&e.hp>0).length))){
   if(points.length>=capacity)break;points.push({...p,kind:'swimmer',targetId:ship.id});
  }
 }
 if(anchor&&points.length<capacity){
  const plan=planFrenzy(world,buildings,contacts,enemies,anchor,now,id,capacity-points.length,{strictRoles:true,roster:contact.medium==='sea'?['breaker','hunter','hunter']:roster,angle:random(d)*Math.PI*2});
  if(plan){points.push(...plan.points);members.push(...plan.members);}
 }
 const valid=points.filter(p=>raidPointClear(world,buildings,contacts,enemies,p)&&(!air||Math.hypot(p.x-contact.x,p.y-contact.y)<(p.kind==='heavy-lens'?28:17)));
 if(!valid.length&&!members.length)return null;
 const pressureIsland=pressureContext(world,contact);
 return {id,source:'natural',focus:contact.id,origin:{x:contact.x,y:contact.y},medium:contact.medium,pressureIsland,
  phase:'warning',until:now+ENCOUNTERS.warning,members,points:valid.map(p=>({...p,pressureIsland})),orders:{},nextPulse:0,outcome:null};
}
// One pulse per two active-play seconds. Save RNG and deadlines, never wall-clock
// catch-up; unavailable space defers one attempt rather than accumulating waves.
export function tickDirector(d,world,buildings,people,enemies,now,dt,frenzy,pressure,capacity,admit=()=>capacity()){
 if(!d)return null;
 const contacts=raidContacts(world,people);if(!contacts.length)return null;
 d.elapsed+=dt*1000;
 if(d.lastEvent&&frenzy?.id===d.lastEvent&&frenzy.phase==='complete'){
  d.nextRaid=d.elapsed+interval(d,ENCOUNTERS.quietMin,ENCOUNTERS.quietMax);d.lastEvent=null;
 }
 if(d.elapsed<d.nextPulse)return null;d.nextPulse=d.elapsed+ENCOUNTERS.pulse;
 pressure(contacts);
 if(frenzy&&frenzy.phase!=='complete'||d.lastEvent||d.elapsed<d.nextRaid)return null;
 const focus=[...contacts].sort((a,b)=>a.id.localeCompare(b.id))[(d.focusCursor??d.sequence)%contacts.length];
 const denied=admit(focus,'raid')<=0;
 const plan=denied?null:planNaturalRaid(d,world,buildings,contacts,enemies,now,capacity(),admit);
 // Hold a denied focus until the raid's actual turn. Otherwise a six-turn
 // cycle with four contacts can sample only two of them on every scarce turn.
 if(!denied||!d.pressure||PRESSURE.producers[d.pressure.cursor]==='raid')d.focusCursor=(d.focusCursor||0)+1;
 if(!plan){d.nextRaid=d.elapsed+(denied?ENCOUNTERS.pulse:ENCOUNTERS.retry);d.deferred='capacity_or_no_safe_approach';return null;}
 d.sequence++;d.lastEvent=plan.id;d.deferred=null;return plan;
}
export function pressureGroups(d,world,contacts,enemies,pendingCount,queue,admit=()=>pendingCount()){
 // Direct callers and older checkpoints acquire only the new director fields.
 if(!d.pressure)updatePressure(d,world,contacts,enemies,d.elapsed,0,24-pendingCount());
 const groups=new Map();
 for(const site of world.sites||[])if(site.state==='hostile'&&site.kind!=='aquatic-hive'){
  const key=groupKey(site);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(site);
 }
 const entries=[...groups.entries()];if(!entries.length)return;
 // Rotate admission order so a crowded first compound cannot monopolise slots.
 for(let i=0;i<entries.length;i++){
  const [key,sites]=entries[(d.cursor+i)%entries.length];
  const island=islandAt(world,sites[0].x+1.5,sites[0].y+1.5),budget=d.pressure.islands[island];
  if(!budget?.active||budget.credit<1)continue;
  if(!sites.some(s=>contacts.some(p=>p.medium!=='sea'&&islandAt(world,p.x,p.y)===island&&Math.hypot(p.x-s.x-1.5,p.y-s.y-1.5)<=ENCOUNTERS.activeRange)))continue;
  const state=d.groups[key] ||= {next:0,wave:0};if(d.elapsed<state.next)continue;
  const ids=new Set((world.sites||[]).filter(s=>groupKey(s)===key).map(s=>s.id));
  const count=enemies.concat(d.sleeping).filter(e=>e.hp>0&&e.pressureKind!=='roaming'&&ids.has(e.siteId)).length+sites.reduce((n,s)=>n+(s.pending?.kind==='roaming'?0:s.pending?.points.length||0),0);
  if(count>=ENCOUNTERS.compoundCap||pendingCount()<=0)continue;
  const site=sites.find(s=>!s.pending&&(s.guardsRemaining>0||s.kind==='modifier'))||sites.find(s=>!s.pending);if(!site)continue;
  const available=Math.min(2,ENCOUNTERS.compoundCap-count,pendingCount(),admit({x:site.x+1.5,y:site.y+1.5},'city'));
  if(available<=0||budget.credit+1e-8<available)continue;
  site.awake=true;
  // Let the saved finite opening roster emerge first, without rewriting it.
  if(sites.some(s=>s.guardsRemaining>0)){state.next=d.elapsed+4000;continue;}
  const roster=['hunter',state.wave%3===2?'bulwark':state.wave%3===1?'breaker':'hunter'];
  if(sites.some(s=>s.kind==='anti-air')&&state.wave%4===3)roster[1]=state.wave%8===7?'heavy-lens':'twin-lens';
  const flyers=enemies.concat(d.sleeping).filter(e=>e.hp>0&&isAirEnemy(e)).length
   +(world.sites||[]).reduce((n,s)=>n+(s.pending?.points||[]).filter(isAirEnemy).length,0);
  if(state.wave%3===0&&flyers<AERIAL.cap&&contacts.some(p=>p.medium==='ground'&&islandAt(world,p.x,p.y)===island&&
    Math.hypot(p.x-site.x-1.5,p.y-site.y-1.5)<=ENCOUNTERS.activeRange))roster[1]='skimmer';
  if(queue(site,roster.slice(0,available),{pressureIsland:island})){
   budget.credit=Math.max(0,budget.credit-(site.pending?.points.length||Math.min(roster.length,available)));
   state.wave++;state.next=d.elapsed+ENCOUNTERS.pulse;d.cursor=(d.cursor+i+1)%entries.length;break;
  }
 }
}

// Cleared-ground arrivals share the island budget. They investigate one saved
// location; local perception and the normal home leash govern subsequent combat.
export function pressureRoaming(d,world,buildings,contacts,enemies,queue,admit,blocked=()=>false){
 const groups=islandContacts(world,contacts);if(!groups.length)return;
 const offset=d.pressure.roamCursor||0;
 for(let i=0;i<groups.length;i++){
  const group=groups[(offset+i)%groups.length],state=d.pressure.islands[group.id];
  if(state.nextRoam==null)state.nextRoam=state.clock+interval(d,ENCOUNTERS.roamMin,ENCOUNTERS.roamMax);
  if(state.clock<state.nextRoam)continue;
  const count=enemies.concat(d.sleeping).filter(e=>e.hp>0&&e.pressureKind==='roaming'&&e.pressureIsland===group.id).length
   +(world.sites||[]).reduce((n,s)=>n+(s.pending?.kind==='roaming'&&s.pending.pressureIsland===group.id?s.pending.points.length:0),0);
  const ground=group.contacts.filter(p=>p.medium==='ground');
  // One bounded retry, never a bank of missed arrivals after absence or crowding.
  state.nextRoam=state.clock+ENCOUNTERS.roamRetry;
  if(!ground.length||count>=ENCOUNTERS.roamCap||state.credit<1)continue;
  const focus=ground[(state.focusCursor||0)%ground.length];
  const free=Math.min(2,ENCOUNTERS.roamCap-count,Math.floor(state.credit),admit(focus,'roaming'));
  // Scaled retries can alias the real-time producer cycle (e.g. two players
  // sample only every third turn). Retry admission on the next director pulse.
  if(free<=0){state.nextRoam=state.clock;continue;}
  state.focusCursor=(state.focusCursor||0)+1;
  const sources=(world.sites||[]).filter(s=>s.state==='hostile'&&s.hp>0&&s.kind!=='aquatic-hive'&&!s.pending
   &&islandAt(world,s.x+1.5,s.y+1.5)===group.id);
  if(!sources.length)continue;
  const source=sources[(state.focusCursor-1)%sources.length];
  const plan=planRoaming(world,buildings,contacts,enemies.concat(d.sleeping),focus,source,random(d)*Math.PI*2,blocked);
  if(!plan)continue;
  plan.points=plan.points.slice(0,free);
  if(queue(source,plan.points.map(p=>p.kind),{...plan,kind:'roaming',pressureIsland:group.id})){
   state.credit=Math.max(0,state.credit-plan.points.length);
   state.nextRoam=state.clock+interval(d,ENCOUNTERS.roamMin,ENCOUNTERS.roamMax);
   d.pressure.roamCursor=(offset+i+1)%groups.length;return;
  }
 }
}
// Sleep distant survivors without healing or deleting them. Incoming attacks and
// hazards still resolve against sleeping bodies through the combat damage pool.
export function sleepEnemies(d,world,buildings,contacts,enemies,facilities,now,reserved,frenzy){
 if(!d||!contacts.length)return;
 const important=contacts.concat(facilities.map(f=>({x:f.x,y:f.y})),(world.tanks||[]).filter(operational),(world.ships||[]).filter(operational));
 const close=(e,points,range)=>points.some(p=>Math.hypot(e.x-p.x,e.y-p.y)<range);
 for(let i=enemies.length-1;i>=0&&d.sleeping.length<ENCOUNTERS.sleepLimit;i--){
  const e=enemies[i];
  if(e.hp<=0||e.attack||e.burnUntil>now||['warning','surge'].includes(frenzy?.phase)&&frenzy.members.includes(e.id)||close(e,contacts,ENCOUNTERS.sleepRange)||close(e,important,24))continue;
  cancelMobileLaser(e);e.path=[];e.reroute=0;e.lurePath=null;e.targetId=null;d.sleeping.push(e);enemies.splice(i,1);
 }
 for(let i=d.sleeping.length-1;i>=0;i--){
  const e=d.sleeping[i];if(enemies.length+reserved>=24)break;
  if(!close(e,contacts,ENCOUNTERS.wakeRange)&&!close(e,important,20))continue;
  if(mobileLaser(e)&&enemies.filter(p=>p.hp>0&&mobileLaser(p)).length>=4||e.kind==='swimmer'&&enemies.filter(p=>p.hp>0&&p.kind==='swimmer').length>=SWIMMER.max)continue;
  const clear=isAirEnemy(e)?aerialPointClear(world,e):e.kind==='swimmer'?canSwim(world,e.x,e.y):canStand(world,buildings,e.x,e.y);
  if(!clear)continue; // Preserve the record if construction now occupies its tile.
  e.reroute=0;enemies.push(e);d.sleeping.splice(i,1);
 }
}
