import {SHIP,canSail,sailStep,rampClear,mooredDock,dockComplete} from './ship.js';
import {shipDimensions,largeHull} from './naval-scale.js';
import {dockRecords} from './shipyard.js';
import {stopShip,shipStopped} from './ship-motion.js';
import {deckLocked} from './carrier.js';
import {operational} from './vehicle.js';
import {canDamageEnemy} from './enemy-profiles.js';
import {angleDelta,turnTurret} from './turret.js';
import {mainMounts,mainReload,mountPoint,secondaryMounts,sideSolution,stepSecondaryMounts,NAVAL_GUN} from './ship-armament.js';

export const NAVAL_ORDER=Object.freeze({salvos:3,searchLimit:4096,blockedTime:10});
const pointValid=(w,p)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<w.width&&p.y<w.height;
const active=o=>o&&['moving','aiming','reloading'].includes(o.phase);
export const navalOrderActive=s=>active(s?.remoteOrder);
const homeDock=(world,s)=>dockRecords(world).find(y=>y.id===(s?.yardId||s?.id));
export function returnDockError(world,s){
 const error=remoteShipError(world,s);if(error)return error;
 const yard=homeDock(world,s);
 if(!yard||yard.dockDestroyed)return 'Home dock lost. Deploy a replacement shipyard at its original site first.';
 if(!dockComplete(yard))return 'Wait for the home dock to finish unfolding.';
 if(deckLocked(world,s))return 'Wait for carrier flight operations to finish.';
 return null;
}
export function remoteShipError(world,s){
 if(!s||!operational(s)||s.assemblyRemaining>0||world.logistics?.jobs?.[s.id])return 'Choose a completed, living ship.';
 if(s.occupant)return 'A pilot is at the helm.';
 return null;
}
function turnClear(world,s,x,y,from,to){
 const d=angleDelta(from,to),steps=Math.ceil(Math.abs(d)/.12);
 // Docking waypoints are reached within a tolerance, not teleported to their
 // mathematical centre. Reserve turning room for that small position error.
 const margin=Math.abs(d)>.01?s.routeTurnMargin||0:0;
 const offsets=margin?[[0,0],[margin,0],[-margin,0],[0,margin],[0,-margin]]:[[0,0]];
 for(let i=0;i<=steps;i++)for(const [dx,dy] of offsets)if(!canSail(world,s,x+dx,y+dy,from+d*i/(steps||1)))return false;
 return true;
}
function legClear(world,s,a,b,angle){
 const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.4);
 for(let i=0;i<=n;i++)if(!canSail(world,s,a.x+(b.x-a.x)*i/(n||1),a.y+(b.y-a.y)*i/(n||1),angle))return false;
 return true;
}
// Bounded A*: forward/reverse sailing legs and swept turns use the full hull.
// Heading is part of the state so a narrow channel never implies room to turn.
export function shipRoute(world,s,goal){
 if(!pointValid(world,goal))return null;
 if(![s.angle,...[0,1,2,3].map(h=>h*Math.PI/2)].some(a=>canSail(world,s,goal.x,goal.y,a)))return null;
 const budget={remaining:NAVAL_ORDER.searchLimit};
 const direct=cardinalRoute(world,s,goal,budget);if(direct)return direct;
 // A berth can fit the current heading but no cardinal heading. Slide along
 // that exact heading before asking for any turn. Never bypass hull clearance.
 for(let distance=1;distance<=6&&budget.remaining>0;distance++)for(const direction of [-1,1]){
  const p={x:s.x+Math.sin(s.angle)*distance*direction,y:s.y-Math.cos(s.angle)*distance*direction};
  if(!legClear(world,s,s,p,s.angle))continue;
  const tail=cardinalRoute(world,{...s,...p},goal,budget);
  if(tail)return [{x:s.x,y:s.y,angle:s.angle},{...p,angle:s.angle,reverse:direction<0},...tail];
 }
 return null;
}
function cardinalRoute(world,s,goal,budget){
 const open=[],costs=new Map(),key=(x,y,h)=>x+':'+y+':'+h;
 const heuristic=p=>Math.hypot(p.x-goal.x,p.y-goal.y);
 const push=n=>{open.push(n);let i=open.length-1;while(i){const p=(i-1)>>1;if(open[p].f<=n.f)break;open[i]=open[p];i=p;}open[i]=n;};
 const pop=()=>{const first=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&open[c+1].f<open[c].f)c++;if(open[c].f>=last.f)break;open[i]=open[c];i=c;}open[i]=last;}return first;};
 for(let h=0;h<4;h++)if(turnClear(world,s,s.x,s.y,s.angle,h*Math.PI/2)){
  const n={x:s.x,y:s.y,ix:0,iy:0,h,g:Math.abs(angleDelta(s.angle,h*Math.PI/2)),parent:null,key:key(0,0,h),f:0};n.f=n.g+heuristic(n);costs.set(n.key,n.g);push(n);
 }
 while(open.length&&budget.remaining-->0){
  const n=pop();if(costs.get(n.key)!==n.g)continue;const angle=n.h*Math.PI/2,d=heuristic(n);
  for(const reverse of [false,true]){
  const endAngle=d<.01?angle:Math.atan2(goal.x-n.x,-(goal.y-n.y))+(reverse?Math.PI:0);
  if(d<=2.1&&turnClear(world,s,n.x,n.y,angle,endAngle)&&legClear(world,s,n,goal,endAngle)&&
     (goal.angle===undefined||turnClear(world,s,goal.x,goal.y,endAngle,goal.angle))){
   const path=[];for(let at=n;at;at=at.parent)path.push({x:at.x,y:at.y,angle:at.h*Math.PI/2,reverse:!!at.reverse});path.reverse();
   path.push({x:goal.x,y:goal.y,angle:endAngle,reverse});if(goal.angle!==undefined)path.push({...goal});
   // Keep turns; collapse straight stretches to avoid stop-start motion per tile.
   return path.filter((p,i)=>!i||i===path.length-1||p.angle!==path[i-1].angle||p.angle!==path[i+1].angle||!!p.reverse!==!!path[i+1].reverse);
  }
  }
  for(const [turn,direction] of [[-1,0],[0,1],[0,-1],[1,0]]){
   const h=(n.h+turn+4)%4,a=h*Math.PI/2,ix=n.ix+Math.round(Math.sin(a))*2*direction,iy=n.iy-Math.round(Math.cos(a))*2*direction;
   const p={x:s.x+ix,y:s.y+iy},id=key(ix,iy,h),g=n.g+(turn?1.5:direction<0?2.4:2);
   if(!pointValid(world,p)||(costs.get(id)??Infinity)<=g)continue;
   if(turn?!turnClear(world,s,n.x,n.y,angle,a):!legClear(world,s,n,p,a))continue;
   const next={...p,ix,iy,h,g,key:id,parent:n,reverse:direction<0,f:g+heuristic(p)};costs.set(id,g);push(next);
  }
 }
 return null;
}
export function planNavalOrder(world,buildings,people,s,data){
 const error=remoteShipError(world,s);if(error)return {error};
 if(!['move','shore','bombard','stop','ramp','dock'].includes(data.action))return {error:'Choose Move, Shore, Return to dock, Bombard, Ramp or Stop.'};
 if(s.kind==='submarine'&&['shore','bombard','ramp'].includes(data.action))return {error:'Submarines use Move, Return, depth controls and Missile strike.'};
 if(data.action==='stop')return {order:{kind:'stop',phase:'holding'}};
 if(data.action==='bombard'){
  const mounts=mainMounts(s),targets=data.targets;
  if(!mounts.length)return {error:'This ship has no main battery.'};
  if(!shipStopped(s))return {error:'Stop the ship before assigning bombardment.'};
  if(!['HE','INCENDIARY','GAS'].includes(data.ammo))return {error:'Choose HE, Fire or Gas.'};
  if(!Array.isArray(targets)||targets.length!==mounts.length||targets.some(p=>!pointValid(world,p)))return {error:'Choose one map target per main turret.'};
  if(targets.some(p=>{const d=Math.hypot(p.x-s.x,p.y-s.y);return d<SHIP.minRange||d>SHIP.range;}))return {error:`Main battery range: ${SHIP.minRange}–${SHIP.range} tiles.`};
  // Allow room for spread at the edge before accepting the whole barrage.
  if(targets.some(p=>p.x<3||p.y<3||p.x>world.width-3||p.y>world.height-3))return {error:'Keep all impact groups at least three tiles inside the map.'};
  return {order:{kind:'bombard',phase:'aiming',targets:targets.map(p=>({x:p.x,y:p.y})),ammo:data.ammo,remaining:NAVAL_ORDER.salvos,fired:0,reason:null}};
 }
 if(deckLocked(world,s))return {error:'Wait for carrier flight operations to finish.'};
 if(data.action==='dock'){
  const error=returnDockError(world,s);if(error)return {error};
  const yard=homeDock(world,s),berth={x:yard.berthX,y:yard.berthY,angle:yard.dock.angle},goal={...berth};
  // Wide carriers touch the mathematical pier edge at the original centre.
  // Leave 0.25 tile of fender clearance, inside the existing 0.8 docking range,
  // so tiny physical steering corrections cannot wedge a corner into the pier.
  if(yard.dockStyle==='unfolding'){
   const side=Math.sign((goal.x-yard.dock.x)*Math.cos(goal.angle)+(goal.y-yard.dock.y)*Math.sin(goal.angle));
   goal.x+=Math.cos(goal.angle)*side*.25;goal.y+=Math.sin(goal.angle)*side*.25;
  }
  if(!canSail(world,s,goal.x,goal.y,goal.angle))return {error:'Home berth obstructed. Clear the water beside the dock first.'};
  // Align in open water, then enter along the berth axis. No final broadside
  // turn through the pier, snapping, or collision exemption.
  let path=null;const routingShip={...s,routeTurnMargin:.2};
  if(Math.hypot(s.x-goal.x,s.y-goal.y)<1)path=shipRoute(world,routingShip,goal);
  const approachDistance=Math.max(6,shipDimensions(s).length+3);
  const approaches=[-1,1].map(direction=>({x:goal.x+Math.sin(goal.angle)*approachDistance*direction,y:goal.y-Math.cos(goal.angle)*approachDistance*direction,angle:goal.angle,direction}));
  approaches.sort((a,b)=>Math.hypot(s.x-a.x,s.y-a.y)-Math.hypot(s.x-b.x,s.y-b.y));
  for(const p of approaches){
   if(path)break;if(!pointValid(world,p)||!legClear(world,s,p,goal,goal.angle))continue;
   const route=shipRoute(world,routingShip,p);if(route)path=[...route,{...goal,reverse:p.direction>0}];
  }
  if(!path)return {error:'No clear approach to the home dock. Move into nearby open water or clear the approach, then return again.'};
  return {order:{kind:'dock',phase:'moving',yardId:yard.id,berth,target:goal,path,index:0,blocked:0,reason:null}};
 }
 if(data.action==='ramp'){
  if(!s.ramp)return {error:'Use Shore landing and choose a clear shore tile to deploy the ramp.'};
  return {order:{kind:'retract',phase:'holding'}};
 }
 if(!pointValid(world,data.target))return {error:'Choose a destination inside the map.'};
 let goal={x:data.target.x,y:data.target.y},path=null;
 if(data.action==='shore'){
  const bank={x:Math.floor(goal.x)+.5,y:Math.floor(goal.y)+.5},candidates=[];
  const size=shipDimensions(s),distances=largeHull(s)?[size.width/2+1,size.width/2+1.8,size.length/2+1,size.length/2+1.8]:[2.7,3.7,2.5];
  // Try each side and both ends facing the bank: transports land over the bow.
  for(const distance of distances)for(let h=0;h<4;h++)for(const parallel of [0,1,2]){
   const a=h*Math.PI/2,p={x:bank.x+Math.sin(a)*distance,y:bank.y-Math.cos(a)*distance,angle:a+parallel*Math.PI/2};
   if(canSail(world,s,p.x,p.y,p.angle)&&rampClear(world,buildings,{...s,...p},bank))candidates.push(p);
  }
  candidates.sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y));
  for(const p of candidates.slice(0,4)){path=shipRoute(world,s,p);if(path){goal=p;break;}}
  if(!path)return {error:'No clear hull route and ramp landing at that shore. Choose a more open beach.'};
  return {order:{kind:'shore',phase:'moving',target:goal,bank,path,index:0,blocked:0,reason:null}};
 }
 path=shipRoute(world,s,goal);if(!path)return {error:'No clear sailing route within the route budget. Choose a nearer waypoint in open water.'};
 return {order:{kind:'move',phase:'moving',target:goal,path,index:0,blocked:0,reason:null}};
}
export function tickNavalOrder(world,buildings,people,s,dt,fire){
 const o=s.remoteOrder;if(!active(o))return false;
 if(remoteShipError(world,s)){o.phase='cancelled';o.reason='Ship lost, unavailable or boarded.';stopShip(s);return true;}
 if(o.kind==='dock'){
  const yard=homeDock(world,s);
  if(!yard||yard.id!==o.yardId||yard.dockDestroyed||!dockComplete(yard)||Math.hypot(yard.berthX-o.berth.x,yard.berthY-o.berth.y)>.01||Math.abs(angleDelta(yard.dock.angle,o.berth.angle))>.01){
   stopShip(s);o.phase='blocked';o.reason='Home dock unavailable. Review the dock and assign Return again.';return true;
  }
 }
 if(o.kind==='bombard'){
  stopShip(s);let aligned=true;
  for(const [i,m] of mainMounts(s).entries()){
   const p=mountPoint(s,0,m.y),target=o.targets[i],a=Math.atan2(target.x-p.x,-(target.y-p.y));
   s[m.key]=turnTurret(s[m.key]??s.turret,a,dt,SHIP.turretSpeed);aligned&&=Math.abs(angleDelta(s[m.key],a))<.005;
  }
  if(mainMounts(s).some(m=>mainReload(s,m.id)>.001)){o.phase='reloading';return true;}
  o.phase='aiming';if(!aligned)return true;
  const error=fire(s,o.targets,o.ammo);o.reason=error||null;
  if(!error){o.remaining--;o.fired++;o.phase=o.remaining?'reloading':'complete';}
  return true;
 }
 if(deckLocked(world,s)){stopShip(s);o.reason='Waiting for flight operations.';return true;}
 const next=o.path[o.index];
 if(!next){
  stopShip(s);o.phase='holding';o.path=[];
  if(o.kind==='dock'){
   const yard=homeDock(world,s);
   if(mooredDock(world,s)===yard?.dock){o.phase='docked';o.reason='Home berth reached. Dock services ready.';}
   else{o.phase='blocked';o.reason='Berth alignment incomplete. Clear the approach and return again.';}
  }
  if(o.kind==='shore'){
   const clear=rampClear(world,buildings,s,o.bank)&&!people.some(p=>p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&Math.hypot(p.x-o.bank.x,p.y-o.bank.y)<.8);
   if(clear)s.ramp={...o.bank,shipX:s.x,shipY:s.y,shipAngle:s.angle};else{o.phase='blocked';o.reason='Shore landing blocked. Clear the bank and assign Shore again.';}
  }
  return true;
 }
 const d=Math.hypot(next.x-s.x,next.y-s.y),goal=d<.15?next.angle:Math.atan2(next.x-s.x,-(next.y-s.y))+(next.reverse?Math.PI:0),delta=angleDelta(s.angle,goal);
 if(d<.15&&Math.abs(delta)<.06){stopShip(s);o.index++;o.blocked=0;return true;}
 const before={x:s.x,y:s.y,angle:s.angle},demand=d<.15||Math.abs(delta)>.15?0:Math.min(1,d/4)*(next.reverse?-1:1);
 s.throttle=demand<0?-1:demand>0?4:0;sailStep(world,s,Math.max(-1,Math.min(1,delta*3)),demand,dt);
 const progressed=Math.hypot(s.x-before.x,s.y-before.y)+Math.abs(angleDelta(before.angle,s.angle))>.00001;
 o.blocked=progressed?0:(o.blocked||0)+dt;o.reason=null;
 if(o.blocked>NAVAL_ORDER.blockedTime){stopShip(s);o.phase='blocked';o.reason='Route obstructed. Assign another waypoint.';}
 return true;
}
export function automaticNavalDefence(world,s,enemies,dt,fire){
 if(s.kind==='submarine'||remoteShipError(world,s)||s.ramp||mooredDock(world,s))return false;
 let changed=false;
 for(const side of ['port','starboard']){
  const mounts=secondaryMounts(s).filter(m=>(m.side||m.id)===side);
  const target=enemies.filter(e=>e.hp>0&&canDamageEnemy(e,'NAVAL_APCR')&&Math.hypot(e.x-s.x,e.y-s.y)<=NAVAL_GUN.range+3&&mounts.some(m=>{const a=sideSolution(s,e,m);return a.inArc&&a.inRange;})).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
  if(target){stepSecondaryMounts(s,target,dt,mounts);fire(s,target);changed=true;}
 }
 return changed;
}
