import { submerged } from './submarine-depth.js';
import { tileAt } from './world.js';
import { hull, rectanglesOverlap } from './ship.js';
import { hullPoint, hullDistance, operational, hurtVehicle } from './vehicle.js';
import { insideField, heatSpeed, activeSectors } from './hazards.js';
export const SWIMMER=Object.freeze({health:60,speed:1.85,damage:35,reach:1.1,windup:1000,cooldown:1600,radius:.85,max:6,group:3,contactCooldown:30});
export function canSwim(world,x,y) {
 for(const dx of [-.24,.24])for(const dy of [-.24,.24])if(x+dx<0||y+dy<0||x+dx>=world.width||y+dy>=world.height||tileAt(world,x+dx,y+dy)!==0)return false;
 return !(world.ships||[]).some(s=>!s.destroyed&&rectanglesOverlap(hull(s,s.elapsed<4.5),{x,y,w:.48,h:.48,angle:0}));
}
// One bounded water BFS per routing interval; never travels through land or hulls.
/** @param {any} world @param {{x:number,y:number}} start @param {(x:number,y:number)=>boolean} accept */
export function waterRoute(world,start,accept,blocked=(_x,_y)=>false,limit=2048) {
 const sx=Math.floor(start.x),sy=Math.floor(start.y),first=sy*world.width+sx;
 const previous=new Map([[first,first]]),queue=[first];
 for(let head=0;head<queue.length&&head<limit;head++){
  const id=queue[head],x=id%world.width+.5,y=Math.floor(id/world.width)+.5;
  if(accept(x,y)){const route=[];for(let at=id;at!==first;at=previous.get(at))route.push({x:at%world.width+.5,y:Math.floor(at/world.width)+.5});return route.reverse();}
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,next=Math.floor(ny)*world.width+Math.floor(nx);if(previous.has(next)||!canSwim(world,nx,ny)||blocked(nx,ny))continue;previous.set(next,id);queue.push(next);}
 }
 return null;
}
export function navalSpawn(world,ship,existing) {
 const candidates=[];
 for(let i=0;i<32;i++){const a=i*Math.PI/16,r=9+(i%3);const p={x:Math.floor(ship.x+Math.cos(a)*r)+.5,y:Math.floor(ship.y+Math.sin(a)*r)+.5};
  if(!canSwim(world,p.x,p.y)||existing.some(e=>Math.hypot(e.x-p.x,e.y-p.y)<2)||candidates.some(e=>Math.hypot(e.x-p.x,e.y-p.y)<3))continue;
  if(waterRoute(world,p,(x,y)=>hullDistance(ship,{x,y})<=SWIMMER.reach,()=>false,1024)!==null)candidates.push(p);
  if(candidates.length===SWIMMER.group)break;
 }
 return candidates;
}
export function swimStep(world,e,ships,fields,now,dt) {
 const targets=ships.filter(s=>operational(s)&&!submerged(s));
 if((e.targetId&&!targets.some(s=>s.id===e.targetId))||(e.attack&&!targets.some(s=>s.id===e.attack.targetId))){e.attack=null;e.path=[];e.targetId=undefined;e.reroute=0;}
 let victim=targets.find(s=>s.id===e.targetId)||targets.sort((a,b)=>hullDistance(a,e)-hullDistance(b,e))[0];
 const burning=e.burnUntil>now;
 const fire=(x,y)=>fields.some(f=>f.weapon==='INCENDIARY'&&insideField(f,x,y,.7));
 const clouds=fields.filter(f=>f.weapon==='GAS'&&f.capacity>0).flatMap(f=>f.sectors?activeSectors(f).map(s=>({...s,field:f})):[{...f,field:f}]).filter(f=>Math.hypot(f.x-e.x,f.y-e.y)<10).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y));
 const lure=clouds[0];
 if(burning||lure){e.attack=null;e.behavior=burning?'fleeing':'lured';}else e.behavior=victim?'hunting':'searching';
 if(e.strike&&now-e.strike.at>250)e.strike=null;
 if(e.attack){
  if(now>=e.attack.at){const target=targets.find(s=>s.id===e.attack.targetId);const hit=!!target&&hullDistance(target,e.attack)<=SWIMMER.radius&&hullDistance(target,e)<=SWIMMER.reach+.25&&clearWaterLine(world,e,hullPoint(target,e));if(hit)hurtVehicle(target,SWIMMER.damage);e.strike={...e.attack,at:now,hit};e.attack=null;e.reroute=0;}
  return;
 }
 if(!burning&&!lure&&victim&&hullDistance(victim,e)<=SWIMMER.reach&&now>=(e.nextAttack||0)){
  e.attack={...hullPoint(victim,e),targetId:victim.id,at:now+SWIMMER.windup,radius:SWIMMER.radius,windup:SWIMMER.windup};e.nextAttack=now+SWIMMER.windup+SWIMMER.cooldown;e.path=[];return;
 }
 if(now>=(e.reroute||0)||e.targetId!==victim?.id){
  e.targetId=victim?.id;e.reroute=now+1000;
  let accept;
  if(burning){const dx=e.x-e.heatX,dy=e.y-e.heatY,length=Math.hypot(dx,dy)||1;const goal={x:e.x+dx/length*3,y:e.y+dy/length*3};accept=(x,y)=>Math.hypot(x-goal.x,y-goal.y)<1;}
  else if(lure)accept=(x,y)=>insideField(lure.field,x,y,0);
  else if(victim)accept=(x,y)=>hullDistance(victim,{x,y})<=SWIMMER.reach;
  e.path=accept?waterRoute(world,e,accept,fire)||[]:[];
 }
 const target=e.path?.[0];if(!target)return;
 const d=Math.hypot(target.x-e.x,target.y-e.y),step=Math.min(d,dt*SWIMMER.speed*heatSpeed(fields,e));
 if(d<.03){e.path.shift();return;}
 const x=e.x+(target.x-e.x)/d*step,y=e.y+(target.y-e.y)/d*step;
 if(canSwim(world,x,y)&&!fire(x,y)){e.angle=Math.atan2(y-e.y,x-e.x)+Math.PI/2;e.x=x;e.y=y;}else{e.reroute=now+500;e.path=[];}
}
function clearWaterLine(world,a,b){const d=Math.hypot(a.x-b.x,a.y-b.y),steps=Math.ceil(d/.15);for(let i=0;i<=steps;i++)if(tileAt(world,a.x+(b.x-a.x)*i/(steps||1),a.y+(b.y-a.y)*i/(steps||1))!==0)return false;return true;}
