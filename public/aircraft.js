import { HELI, isHelicopter, isHelipad, airSize, compatibleAirfield, heliParking, helicopterLoad, tickHelicopter } from './helicopter.js';
import { runwayAvailable } from './air-traffic.js';
import { placementError } from './world.js';
import { angleDelta } from './turret.js';
import { JET, isAttackJet } from './attack-jet.js';
import { POD } from './pod.js';
import { bomberPayload, payloadProfile, validPayload } from './bomber-payloads.js';

export const AIR = Object.freeze({width:6,height:10,max:4,minSpeed:6,maxSpeed:12,acceleration:3,turnSpeed:1.8,count:6,interval:.25,fall:1.8,runs:2,rearm:8,transition:2,landingRange:5});
export const airbaseGate = base => isHelipad(base) ? {x:base.x+2.5,y:base.y+2.5} : base.carrier ? {x:base.carrier.x,y:base.carrier.y} : ({x:base.x+5.5,y:base.y+8.5});
export const parkingPoint = base => isHelipad(base) ? heliParking(base) : base.parking || ({x:base.x+2,y:base.y+7.5});
export const AIR_HULL = Object.freeze({ health: 180, replacement: 20 });
export const aircraftHealth = p => p.health ?? AIR_HULL.health;
export const airborne = p => !!p && ['takeoff', 'flying', 'landing'].includes(p.state) && aircraftHealth(p) > 0;
export function hurtAircraft(p, amount) {
 if (!airborne(p) || !(amount > 0)) return false;
 p.health = Math.max(0, aircraftHealth(p) - amount); p.damageDirty = true;
 if (!p.health) Object.assign(p, { state:'destroyed', remaining:AIR_HULL.replacement, speed:0, releaseRemaining:0, edgeTurn:false });
 return true;
}
export function airbaseError(world,buildings,occupants,x,y,owner,kind='airbase'){
 if(![x,y].every(Number.isInteger))return 'Choose the top-left tile for the airbase.';
 const pad=kind==='helipad',size=airSize({kind}),margin=pad?2:16;
 if((world.airbases?.filter(b=>isHelipad(b)===pad).length||0)>=(pad?HELI.max:AIR.max))return pad?'Four helipads are allowed per campaign.':'Four airbases are allowed in this flight test.';
 if(x<margin||y<margin||x+size.width>world.width-margin||y+size.height>world.height-margin)return pad?'Keep the whole helipad two tiles inside the map.':'Keep the whole airbase 16 tiles inside the map for safe flight approaches.';
 for(let cy=y;cy<y+size.height;cy++)for(let cx=x;cx<x+size.width;cx++){
  const error=placementError(world,buildings,occupants,cx,cy);if(error)return error;
 }
 return null;
}
export function newAirbase(id,owner,x,y,kind='bomber',facilityKind='airbase'){
 const base={id,owner,x,y,kind:facilityKind};return{...base,aircraft:{id:id+':bomber',baseId:id,owner,kind,rounds:JET.ammo,health:AIR_HULL.health,...parkingPoint(base),angle:base.angle||0,speed:0,state:'parked',remaining:0,rearm:0,runs:AIR.runs,occupant:null,releaseRemaining:0,leftBase:false,...(isHelicopter({kind})?helicopterLoad():{})}};
}
export function deliverAircraft(base, kind) {
 if (!['bomber','attack-jet','helicopter'].includes(kind)) return 'Choose a bomber or attack jet.';
 if (base.aircraft.occupant || base.aircraft.state !== 'parked' || base.aircraft.rearm > 0) return 'Land, finish rearming and disembark before exchanging aircraft.';
 if(!compatibleAirfield(base,{kind}))return 'Helicopters need a helipad; fixed-wing aircraft need a runway.';
 const next=newAirbase(base.id,base.owner,base.x,base.y,kind,base.kind).aircraft;
 delete base.aircraft.mission;Object.assign(base.aircraft,next,{state:'delivering',remaining:POD.duration});return null;
}
export function launchError(plane){if(plane.mission&&!['complete','lost'].includes(plane.mission.phase))return 'Bomber reserved for an automatic mission.';return plane.state==='delivering'?'Orbital delivery in progress.':plane.state==='destroyed'?'Replacement aircraft preparing at the airbase.':plane.state!=='parked'?'The aircraft is already airborne.':plane.rearm>0?'Wait for the ground crew to finish rearming.':null;}
export function launchAircraft(plane,angle=0){const error=launchError(plane);if(error)return error;Object.assign(plane,{state:'takeoff',remaining:AIR.transition,speed:isHelicopter(plane)?0:AIR.minSpeed,angle,leftBase:false});return null;}
export function bombPattern(plane){
 const profile=payloadProfile(bomberPayload(plane));
 const dx=Math.sin(plane.angle),dy=-Math.cos(plane.angle);
 return Array.from({length:profile.count},(_,i)=>{const launch=i*AIR.interval,side=profile.count===1?0:(i%2?1:-1)*.45;
  const originX=plane.x+dx*plane.speed*launch+dy*side,originY=plane.y+dy*plane.speed*launch-dx*side;
  return{originX,originY,x:originX+dx*plane.speed*AIR.fall,y:originY+dy*plane.speed*AIR.fall,launch,flight:AIR.fall,landed:false,craterSize:profile.craterSize};
 });
}
export function bombError(world,plane){
 if(isHelicopter(plane))return 'Use the helicopter cannon or rocket pods.';
 if(isAttackJet(plane))return 'The attack jet uses its autocannon, not bomb bays.';
 if(!validPayload(bomberPayload(plane)))return 'Choose a supported bomber payload.';
 const profile=payloadProfile(bomberPayload(plane));
 if(plane.state!=='flying')return 'Take off before releasing bombs.';
 if(plane.releaseRemaining>0)return 'Bomb release in progress. Holding course.';
 if(plane.runs<=0)return 'Bomb bays empty. Return to your airbase to rearm.';
 if(plane.runs<profile.cost)return 'Heavy HE needs both bay charges. Return to rearm or choose a carpet.';
 if(plane.edgeTurn)return 'Finish the boundary turn before releasing bombs.';
 if(bombPattern(plane).some(b=>b.x<profile.radius||b.y<profile.radius||b.x>world.width-profile.radius||b.y>world.height-profile.radius))return 'Keep the complete bombing area inside the map.';
 return null;
}
export function makeBombRun(plane,id){
 const payload=bomberPayload(plane),profile=payloadProfile(payload),r=profile.radius;
 const missiles=bombPattern(plane),xs=missiles.map(m=>m.x),ys=missiles.map(m=>m.y),x=Math.min(...xs)-r,y=Math.min(...ys)-r;
 return{id,kind:'bomber',payload,profile:{...profile},gasCapacity:profile.gasCapacity,owner:plane.id,weapon:profile.weapon,x:plane.x,y:plane.y,age:0,box:{x,y,width:Math.max(...xs)+r-x,height:Math.max(...ys)+r-y},missiles};
}
// Positive forward speed only. Bounded substeps keep turns independent of tick rate.
export function tickAircraft(world,base,input,dt){
 const p=base.aircraft;if(p.state==='vacant')return false;if(!Number.isFinite(dt)||dt<=0)return false;
 if(p.state==='delivering'){p.remaining=Math.max(0,p.remaining-dt);if(p.remaining<.000001)Object.assign(p,{state:'parked',remaining:0});return true;}
 if(p.state==='destroyed'){
  p.remaining=Math.max(0,p.remaining-dt);
  if(p.remaining<.000001&&!world.logistics&&!base.destroyed)Object.assign(p,{...newAirbase(base.id,base.owner,base.x,base.y,p.kind||'bomber',base.kind).aircraft});
  return true;
 }
 if(isHelicopter(p))return tickHelicopter(world,base,input,dt,runwayAvailable(world,base,p));
 if(p.state==='parked'){if(p.rearm<=0)return false;p.rearm=Math.max(0,p.rearm-dt);if(!p.rearm){p.runs=AIR.runs;p.rounds=JET.ammo;if(!world.logistics)p.health=AIR_HULL.health;}return true;}
 const steps=Math.ceil(dt/.025),step=dt/steps;
 for(let i=0;i<steps;i++){
  if(p.state==='landing'){
   p.remaining=Math.max(0,p.remaining-step);const t=1-p.remaining/AIR.transition,park=parkingPoint(base);
   p.x=p.landingX+(park.x-p.landingX)*t;p.y=p.landingY+(park.y-p.landingY)*t;p.angle+=angleDelta(p.angle,base.angle||0)*Math.min(1,step*4);
   if(p.remaining<.000001)Object.assign(p,{...park,angle:base.angle||0,speed:0,state:'parked',remaining:0,rearm:AIR.rearm,releaseRemaining:0});
   continue;
  }
  if(p.state==='parked')break;
  const releasing=p.releaseRemaining>0;
  p.releaseRemaining=Math.max(0,p.releaseRemaining-step);
  if(p.state==='takeoff'){p.remaining=Math.max(0,p.remaining-step);if(p.remaining<.000001){p.remaining=0;p.state='flying';}}
  else if(!releasing)p.speed=Math.max(AIR.minSpeed,Math.min(AIR.maxSpeed,p.speed+(input?.throttle||0)*AIR.acceleration*step));
  const turn=AIR.turnSpeed*AIR.minSpeed/p.speed,radius=p.speed/turn+4;
  const dx=Math.sin(p.angle),dy=-Math.cos(p.angle);
  p.edgeTurn=(p.x<radius&&dx<0)||(p.x>world.width-radius&&dx>0)||(p.y<radius&&dy<0)||(p.y>world.height-radius&&dy>0);
  let steer=input?.steer||0;
  if(p.edgeTurn){const target=Math.atan2(world.width/2-p.x,-(world.height/2-p.y));steer=Math.sign(angleDelta(p.angle,target));}
  if(!releasing&&p.state==='flying')p.angle+=steer*turn*step;
  p.x+=Math.sin(p.angle)*p.speed*step;p.y-=Math.cos(p.angle)*p.speed*step;
  const park=parkingPoint(base),distance=Math.hypot(p.x-park.x,p.y-park.y);
  if(distance>12)p.leftBase=true;
  if(runwayAvailable(world,base,p)&&(!p.mission||['complete','lost','return','landing'].includes(p.mission.phase))&&p.state==='flying'&&p.leftBase&&!releasing&&p.speed<=AIR.minSpeed+1&&distance<=AIR.landingRange){Object.assign(p,{state:'landing',remaining:AIR.transition,landingX:p.x,landingY:p.y});}
 }
 return true;
}

export function tickAirRepair(world,base,dt){
 const p=base.aircraft,was=!!p.repairing;p.repairing=false;
 if(base.carrier||!world.logistics||base.destroyed||world.logistics.jobs?.[base.id]||p.state!=='parked'||aircraftHealth(p)>=AIR_HULL.health)return was;
 const amount=Math.min(AIR_HULL.health-aircraftHealth(p),10*dt,(world.logistics.groundSupplies||0)/.2);
 if(amount<=0)return was;
 p.health=aircraftHealth(p)+amount;world.logistics.groundSupplies=Math.max(0,world.logistics.groundSupplies-amount*.2);p.repairing=true;return true;
}
