import { canStand } from './world.js';
import { enemyProfile, heavyEnemy, ENEMY_ROLES } from './enemy-profiles.js';
import { facilityDistance, facilityPoint } from './logistics.js';
import { hullDistance, hullPoint } from './vehicle.js';
import { raycast } from './raycast.js';
import { isGroundEnemy } from './target-domain.js';
import { CENTIPEDE, isCentipede } from './centipede.js';

export const LAND_AI=Object.freeze({acquire:10,retain:14,memory:4000,speed:ENEMY_ROLES.hunter.speed,retry:3000,
  sense:250,facilityAcquire:6,facilityRetain:8,sightChecks:12,patrolRadius:5,patrolSpeed:.55});
export const targetDistance=(enemy,target)=>target.facility?facilityDistance(target.facility,enemy):target.vehicle?hullDistance(target.vehicle,enemy):Math.hypot(target.x-enemy.x,target.y-enemy.y);
const controlled=t=>!t.facility&&!t.vehicle||!!(t.vehicle?.occupant||t.facility?.object?.occupant);
const structure=t=>!!t.facility&&!controlled(t);
export function landVisible(world,buildings,enemy,target){
  const p=target.facility?facilityPoint(target.facility,enemy):target.vehicle?hullPoint(target.vehicle,enemy):target;
  const d=Math.hypot(p.x-enemy.x,p.y-enemy.y);
  return d<.05||!raycast(world,buildings,enemy,(p.x-enemy.x)/d,(p.y-enemy.y)/d,Math.max(0,d-.05)).blocked;
}
// Only a bounded minority of ordinary heavy units prefers local infrastructure.
// Other units can still attack nearby equipment when no visible player is available.
export function landSiegeMembers(enemies){
  const ground=enemies.filter(e=>e.hp>0&&isGroundEnemy(e)&&!['swimmer','twin-lens','heavy-lens','centipede'].includes(e.kind));
  return new Set(ground.filter(heavyEnemy).sort((a,b)=>String(a.id).localeCompare(String(b.id)))
    .slice(0,Math.floor(ground.length/4)).map(e=>e.id));
}
export function landTarget(enemy,available,now,visible=target=>true,siege=false){
  const giant=isCentipede(enemy),infrastructure=t=>structure(t)&&(!giant||t.facility.kind!=='recycler');
  const reach=(t,retained)=>infrastructure(t)?giant?(retained?CENTIPEDE.retain:CENTIPEDE.acquire):(retained?LAND_AI.facilityRetain:LAND_AI.facilityAcquire):(retained?LAND_AI.retain:LAND_AI.acquire);
  const candidates=available.filter(t=>!(enemy.failedTarget?.id===t.id&&enemy.failedTarget.until>now)&&
    (!t.facility||!t.facility.protected&&t.facility.hp.armor<=enemyProfile(enemy).penetration));
  const held=candidates.find(t=>t.id===enemy.targetId&&targetDistance(enemy,t)<reach(t,true));
  const retained=held&&visible(held)?held:null;
  // Recheck a retained contact's visibility every tick. Full acquisition scans
  // are slower; an unseen target never refreshes memory with its live position.
  if(retained&&(giant?infrastructure(retained):controlled(retained)))return retained;
  if(now<(enemy.nextSense||0))return retained||undefined;
  enemy.nextSense=now+LAND_AI.sense;
  const preference=t=>(giant||siege&&heavyEnemy(enemy))&&infrastructure(t)?0:controlled(t)?1:t.vehicle?2:3;
  const ordered=candidates.filter(t=>targetDistance(enemy,t)<reach(t,false))
    .sort((a,b)=>preference(a)-preference(b)||targetDistance(enemy,a)-targetDistance(enemy,b)||String(a.id).localeCompare(String(b.id)));
  return ordered.slice(0,LAND_AI.sightChecks).find(visible)||retained||undefined;
}
export function rememberTarget(enemy,target,now){
  if(target)enemy.lastContact={id:target.id,x:target.x,y:target.y,until:now+LAND_AI.memory};
  else if(enemy.lastContact?.until<=now)delete enemy.lastContact;
}
const patrolRandom=p=>{p.rng=(Math.imul(p.rng,1664525)+1013904223)>>>0;return p.rng/4294967296;};
export function patrolGoal(enemy,home,now,walkable){
  if(!Number.isFinite(home?.x)||!Number.isFinite(home?.y))return null;
  if(!enemy.patrol){
    let seed=2166136261;for(const c of `${enemy.id}:${enemy.siteId||'roaming'}:${home.x}:${home.y}`)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
    enemy.patrol={rng:seed,goal:null,nextAt:now};
  }
  const p=enemy.patrol;
  if(p.goal&&(Math.hypot(p.goal.x-home.x,p.goal.y-home.y)>LAND_AI.patrolRadius||!walkable(p.goal.x,p.goal.y)))p.goal=null;
  if(p.goal&&Math.hypot(enemy.x-p.goal.x,enemy.y-p.goal.y)<.5){p.goal=null;p.nextAt=now+2000+Math.floor(patrolRandom(p)*3000);}
  if(p.goal)return p.goal;
  if(now<p.nextAt)return null;
  p.nextAt=now+LAND_AI.retry;
  // Twelve candidate points, then the shared incremental navigator handles the
  // route. No map search or new random goal on every simulation frame.
  for(let i=0;i<12;i++){
    const angle=patrolRandom(p)*Math.PI*2,radius=2+patrolRandom(p)*3;
    const point={x:Math.floor(home.x+Math.cos(angle)*radius)+.5,y:Math.floor(home.y+Math.sin(angle)*radius)+.5};
    if(Math.hypot(point.x-home.x,point.y-home.y)<=LAND_AI.patrolRadius&&Math.hypot(point.x-enemy.x,point.y-enemy.y)>1&&walkable(point.x,point.y))return p.goal=point;
  }
  return null;
}
// Route to an attack position, never the blocked center of a vehicle/building.
export function attackGoals(world,buildings,target,reach){
  if(!target.vehicle&&!target.facility)return [{x:target.x,y:target.y}];
  const shape=target.facility,w=shape?.w??4,h=shape?.h??4,goals=[];
  for(let y=Math.floor(target.y-h/2)-1;y<=Math.ceil(target.y+h/2);y++)for(let x=Math.floor(target.x-w/2)-1;x<=Math.ceil(target.x+w/2);x++){
    const point={x:x+.5,y:y+.5};if(targetDistance(point,target)<=reach&&canStand(world,buildings,point.x,point.y))goals.push(point);
  }
  return goals;
}
