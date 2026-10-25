import { sensorContacts } from './sensors.js';
import { canStand } from './world.js';
import { navalSpawn, canSwim, SWIMMER } from './naval.js';
import { operational } from './vehicle.js';
import { submerged } from './submarine-depth.js';
import { planFrenzy } from './frenzy.js';
import { mobileLaser, cancelMobileLaser } from './mobile-laser.js';

export const ENCOUNTERS=Object.freeze({firstMin:180000,firstMax:300000,quietMin:120000,quietMax:300000,
 warning:8000,pulse:2000,retry:30000,compoundCap:6,activeRange:36,sleepRange:80,wakeRange:52,sleepLimit:128});
export const groupKey=s=>s.encounter?.id||s.settlement?.id||s.id;
function random(d){d.rng=(Math.imul(d.rng,1664525)+1013904223)>>>0;return d.rng/4294967296;}
const interval=(d,min,max)=>Math.round(min+random(d)*(max-min));
export function createDirector(seed){
 let rng=2166136261;for(const c of String(seed))rng=Math.imul(rng^c.charCodeAt(0),16777619)>>>0;
 const d={version:1,rng,elapsed:0,nextRaid:0,nextPulse:0,sequence:0,focusCursor:0,lastEvent:null,cursor:0,groups:{},sleeping:[],deferred:null};
 d.nextRaid=interval(d,ENCOUNTERS.firstMin,ENCOUNTERS.firstMax);return d;
}
export function raidContacts(world,people){
 return sensorContacts(world,people).map(p=>({...p,medium:p.ground?'ground':p.targetId.startsWith('ship:')?'sea':'air'}));
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
export function planNaturalRaid(d,world,buildings,contacts,enemies,now,capacity){
 if(!contacts.length||capacity<=0)return null;
 const sorted=[...contacts].sort((a,b)=>a.id.localeCompare(b.id)),contact=sorted[(d.focusCursor??d.sequence)%sorted.length];
 const id='raid-'+(d.sequence+1),points=[],members=[],anchor=shore(world,buildings,contact);
 const air=contact.medium==='air';
 const roster=air?['twin-lens','heavy-lens']:['bulwark','breaker',...Array(Math.min(10,2+contacts.length*2)).fill('hunter')];
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
 return {id,source:'natural',focus:contact.id,origin:{x:contact.x,y:contact.y},medium:contact.medium,
  phase:'warning',until:now+ENCOUNTERS.warning,members,points:valid,orders:{},nextPulse:0,outcome:null};
}
// One pulse per two active-play seconds. Save RNG and deadlines, never wall-clock
// catch-up; unavailable space defers one attempt rather than accumulating waves.
export function tickDirector(d,world,buildings,people,enemies,now,dt,frenzy,pressure,capacity){
 if(!d)return null;
 const contacts=raidContacts(world,people);if(!contacts.length)return null;
 d.elapsed+=dt*1000;
 if(d.lastEvent&&frenzy?.id===d.lastEvent&&frenzy.phase==='complete'){
  d.nextRaid=d.elapsed+interval(d,ENCOUNTERS.quietMin,ENCOUNTERS.quietMax);d.lastEvent=null;
 }
 if(d.elapsed<d.nextPulse)return null;d.nextPulse=d.elapsed+ENCOUNTERS.pulse;
 pressure(contacts);
 if(frenzy&&frenzy.phase!=='complete'||d.lastEvent||d.elapsed<d.nextRaid)return null;
 const plan=planNaturalRaid(d,world,buildings,contacts,enemies,now,capacity());
 d.focusCursor=(d.focusCursor||0)+1;
 if(!plan){d.nextRaid=d.elapsed+ENCOUNTERS.retry;d.deferred='capacity_or_no_safe_approach';return null;}
 d.sequence++;d.lastEvent=plan.id;d.deferred=null;return plan;
}
export function pressureGroups(d,world,contacts,enemies,pendingCount,queue){
 const groups=new Map();
 for(const site of world.sites||[])if(site.state==='hostile'&&site.kind!=='aquatic-hive'){
  const key=groupKey(site);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(site);
 }
 const entries=[...groups.entries()];if(!entries.length)return;
 // Rotate admission order so a crowded first compound cannot monopolise slots.
 for(let i=0;i<entries.length;i++){
  const [key,sites]=entries[(d.cursor+i)%entries.length];
  if(!sites.some(s=>contacts.some(p=>Math.hypot(p.x-s.x-1.5,p.y-s.y-1.5)<=ENCOUNTERS.activeRange)))continue;
  const state=d.groups[key] ||= {next:0,wave:0};if(d.elapsed<state.next)continue;
  const ids=new Set((world.sites||[]).filter(s=>groupKey(s)===key).map(s=>s.id));
  const count=enemies.concat(d.sleeping).filter(e=>e.hp>0&&ids.has(e.siteId)).length+sites.reduce((n,s)=>n+(s.pending?.points.length||0),0);
  if(count>=ENCOUNTERS.compoundCap||pendingCount()<=0)continue;
  const site=sites.find(s=>!s.pending&&(s.guardsRemaining>0||s.kind==='modifier'))||sites.find(s=>!s.pending);if(!site)continue;
  site.awake=true;
  // Let the saved finite opening roster emerge first, without rewriting it.
  if(sites.some(s=>s.guardsRemaining>0)){state.next=d.elapsed+4000;continue;}
  const roster=['hunter',state.wave%3===2?'bulwark':state.wave%3===1?'breaker':'hunter'];
  if(sites.some(s=>s.kind==='anti-air')&&state.wave%4===3)roster[1]=state.wave%8===7?'heavy-lens':'twin-lens';
  if(queue(site,roster.slice(0,Math.min(ENCOUNTERS.compoundCap-count,pendingCount())))){
   state.wave++;state.next=d.elapsed+interval(d,20000,35000);d.cursor=(d.cursor+i+1)%entries.length;break;
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
  const clear=e.kind==='swimmer'?canSwim(world,e.x,e.y):canStand(world,buildings,e.x,e.y);
  if(!clear)continue; // Preserve the record if construction now occupies its tile.
  e.reroute=0;enemies.push(e);d.sleeping.splice(i,1);
 }
}
