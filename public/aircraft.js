import {isAirGunship,GUNSHIP,tickGunshipGuns} from './air-gunship.js';
import {mountainClear,flightLineClear} from './terrain-rules.js';
import {mountainSteer} from './mountain-flight.js';
import { HELI, isHelicopter, isHelipad, airSize, compatibleAirfield, heliParking, helicopterLoad, tickHelicopter } from './helicopter.js';
import { runwayAvailable } from './air-traffic.js';
import { placementError } from './world.js';
import { angleDelta } from './turret.js';
import { JET, isAttackJet } from './attack-jet.js';
import { POD } from './pod.js';
import { bomberPayload, payloadProfile, validPayload } from './bomber-payloads.js';

export const AIR = Object.freeze({width:6,height:10,max:4,minSpeed:6,maxSpeed:12,acceleration:3,turnSpeed:1.8,count:6,interval:.25,fall:1.8,runs:2,rearm:8,transition:2,landingRange:5});
// Manual handling only; mission and boundary controllers retain AIR authority.
export const FLIGHT = Object.freeze({bomber:Object.freeze({acceleration:2,braking:2.5,turnSpeed:1.5,rollRate:1.5}),jet:Object.freeze({acceleration:3.6,braking:4,turnSpeed:1.9,rollRate:3.5})});
export const flightProfile = p => isAirGunship(p)?GUNSHIP:isAttackJet(p)?FLIGHT.jet:FLIGHT.bomber;
export const flightLimits=p=>isAirGunship(p)?GUNSHIP:AIR;
export const airbaseGate = base => isHelipad(base) ? {x:base.x+2.5,y:base.y+2.5} : base.carrier ? {x:base.carrier.x,y:base.carrier.y} : ({x:base.x+5.5,y:base.y+8.5});
export const parkingPoint = base => isHelipad(base) ? heliParking(base) : base.parking || ({x:base.x+2,y:base.y+7.5});
export const AIR_HULL = Object.freeze({ health: 180, replacement: 20 });
export const aircraftHealth = p => p.health ?? AIR_HULL.health;
export const airborne = p => !!p && ['takeoff', 'flying', 'landing'].includes(p.state) && aircraftHealth(p) > 0;
export function hurtAircraft(p, amount) {
 if (!airborne(p) || !(amount > 0)) return false;
 p.health = Math.max(0, aircraftHealth(p) - amount); p.damageDirty = true;
 if (!p.health) Object.assign(p, { state:'destroyed', remaining:AIR_HULL.replacement, speed:0, bank:0, releaseRemaining:0, edgeTurn:false });
 return true;
}
export function airbaseError(world,buildings,occupants,x,y,owner,kind='airbase'){
 if(![x,y].every(Number.isInteger))return 'Choose the top-left tile for the airbase.';
 const pad=kind==='helipad',size=airSize({kind}),margin=pad?2:16;
 const count=world.airbases?.filter(b=>!b.destroyed&&isHelipad(b)===pad).length||0;
 if(count>=(pad?HELI.max:AIR.max))return `${pad?'Helipad':'Airbase'} limit reached (${count}/${pad?HELI.max:AIR.max}). Active facilities and construction count; ruins do not.`;
 if(x<margin||y<margin||x+size.width>world.width-margin||y+size.height>world.height-margin)return pad?'Keep the whole helipad two tiles inside the map.':'Keep the whole airbase 16 tiles inside the map for safe flight approaches.';
 if(!pad&&world.mountains&&!mountainClear(world,{x:x+size.width/2,y:y+size.height/2},24))return 'Keep the runway and its 24-tile flight approach clear of high mountains.';
 for(let cy=y;cy<y+size.height;cy++)for(let cx=x;cx<x+size.width;cx++){
  const error=placementError(world,buildings,occupants,cx,cy);if(error)return error;
 }
 return null;
}
export function newAirbase(id,owner,x,y,kind='bomber',facilityKind='airbase'){
 const base={id,owner,x,y,kind:facilityKind};return{...base,aircraft:{id:id+':bomber',baseId:id,owner,kind,rounds:JET.ammo,health:AIR_HULL.health,...parkingPoint(base),angle:base.angle||0,speed:0,bank:0,state:'parked',remaining:0,rearm:0,bombCooldown:0,runs:AIR.runs,occupant:null,releaseRemaining:0,leftBase:false,...(isHelicopter({kind})?helicopterLoad():{})}};
}
export function deliverAircraft(base, kind) {
 if (!['bomber','attack-jet','helicopter','air-gunship'].includes(kind)) return 'Choose a bomber or attack jet.';
 if (base.aircraft.occupant || base.aircraft.state !== 'parked' || isHelicopter(base.aircraft)&&base.aircraft.rearm > 0) return 'Land, finish servicing and disembark before exchanging aircraft.';
 if(!compatibleAirfield(base,{kind}))return 'Helicopters need a helipad; fixed-wing aircraft need a runway.';
 const next=newAirbase(base.id,base.owner,base.x,base.y,kind,base.kind).aircraft;
 delete base.aircraft.mission;Object.assign(base.aircraft,next,{state:'delivering',remaining:POD.duration});return null;
}
export function launchError(plane){if(plane.mission&&!['complete','lost'].includes(plane.mission.phase))return 'Bomber reserved for an automatic mission.';return plane.state==='delivering'?'Orbital delivery in progress.':plane.state==='destroyed'?'Aircraft destroyed. Order a new aircraft at an intact base.':plane.state!=='parked'?'The aircraft is already airborne.':isHelicopter(plane)&&plane.rearm>0?'Wait for the ground crew to finish rearming.':null;}
export function launchAircraft(plane,angle=0){const error=launchError(plane);if(error)return error;Object.assign(plane,{state:'takeoff',remaining:AIR.transition,speed:isHelicopter(plane)?0:flightLimits(plane).minSpeed,angle,bank:0,leftBase:false});return null;}
export function bombPattern(plane){
 const profile=payloadProfile(bomberPayload(plane));
 const dx=Math.sin(plane.angle),dy=-Math.cos(plane.angle);
 return Array.from({length:profile.count},(_,i)=>{const launch=Math.floor(i/profile.rows)*profile.interval,side=profile.count===1?0:(i%2?1:-1)*1.2;
  const originX=plane.x+dx*plane.speed*launch+dy*side,originY=plane.y+dy*plane.speed*launch-dx*side;
  return{originX,originY,x:originX+dx*plane.speed*AIR.fall,y:originY+dy*plane.speed*AIR.fall,launch,flight:AIR.fall,landed:false,craterSize:profile.craterSize};
 });
}
export function bombError(world,plane){
 if(isAirGunship(plane))return 'Use the side guns / 1, 2, 3.';
 if(isHelicopter(plane))return 'Use the helicopter cannon or rocket pods.';
 if(isAttackJet(plane))return 'The attack jet uses its autocannon, not bomb bays.';
 if(!validPayload(bomberPayload(plane)))return 'Choose a supported bomber payload.';
 const profile=payloadProfile(bomberPayload(plane));
 if(plane.state!=='flying')return 'Take off before releasing bombs.';
 if(plane.releaseRemaining>0)return 'Bomb release in progress. Holding course.';
 if(plane.bombCooldown>0)return 'Bomb system cooling / '+Math.ceil(plane.bombCooldown)+'s.';
 if(plane.edgeTurn)return 'Finish the boundary turn before releasing bombs.';
 if(bombPattern(plane).some(b=>b.x<profile.radius||b.y<profile.radius||b.x>world.width-profile.radius||b.y>world.height-profile.radius))return 'Keep the complete bombing area inside the map.';
 return null;
}
export function makeBombRun(plane,id){
 const payload=bomberPayload(plane),profile=payloadProfile(payload),r=profile.radius;
 const missiles=bombPattern(plane),xs=missiles.map(m=>m.x),ys=missiles.map(m=>m.y),x=Math.min(...xs)-r,y=Math.min(...ys)-r;
 return{id,kind:'bomber',payload,profile:{...profile},gasCapacity:profile.gasCapacity,reservedArea:profile.count*Math.PI*r*r,owner:plane.id,weapon:profile.weapon,x:plane.x,y:plane.y,age:0,box:{x,y,width:Math.max(...xs)+r-x,height:Math.max(...ys)+r-y},missiles};
}
// Positive forward speed only. Bounded substeps keep turns independent of tick rate.
export function tickAircraft(world,base,input,dt){
 const p=base.aircraft;if(p.state==='vacant')return false;if(!Number.isFinite(dt)||dt<=0)return false;
 const gunCooling=tickGunshipGuns(p,dt),limits=flightLimits(p);
 const cooling=gunCooling||!isHelicopter(p)&&p.bombCooldown>0;
 if(!isHelicopter(p)){p.bombCooldown=Math.max(0,(p.bombCooldown||0)-dt);p.rearm=0;}
 if(p.state==='delivering'){p.remaining=Math.max(0,p.remaining-dt);if(p.remaining<.000001)Object.assign(p,{state:'parked',remaining:0});return true;}
 if(p.state==='destroyed'){
  p.remaining=Math.max(0,p.remaining-dt);
  if(p.remaining<.000001&&!world.logistics&&!base.destroyed)Object.assign(p,{...newAirbase(base.id,base.owner,base.x,base.y,p.kind||'bomber',base.kind).aircraft});
  return true;
 }
 if(isHelicopter(p))return tickHelicopter(world,base,input,dt,runwayAvailable(world,base,p));
 if(p.state==='parked'){const repair=!world.logistics&&aircraftHealth(p)<AIR_HULL.health;if(repair)p.health=AIR_HULL.health;return cooling||repair;}
 const steps=Math.ceil(dt/.025),step=dt/steps,profile=input?.automatic?AIR:flightProfile(p);
 for(let i=0;i<steps;i++){
  if(p.state==='landing'){
   p.bank=0;
   p.remaining=Math.max(0,p.remaining-step);const t=1-p.remaining/AIR.transition,park=parkingPoint(base);
   p.x=p.landingX+(park.x-p.landingX)*t;p.y=p.landingY+(park.y-p.landingY)*t;p.angle+=angleDelta(p.angle,base.angle||0)*Math.min(1,step*4);
   if(p.remaining<.000001)Object.assign(p,{...park,angle:base.angle||0,speed:0,state:'parked',remaining:0,rearm:0,releaseRemaining:0});
   continue;
  }
  if(p.state==='parked')break;
  const releasing=p.releaseRemaining>0;
  p.releaseRemaining=Math.max(0,p.releaseRemaining-step);
  if(p.state==='takeoff'){p.remaining=Math.max(0,p.remaining-step);if(p.remaining<.000001){p.remaining=0;p.state='flying';}}
  else if(!releasing)p.speed=Math.max(limits.minSpeed,Math.min(limits.maxSpeed,p.speed+(input?.throttle||0)*((input?.throttle||0)<0?(profile.braking||profile.acceleration):profile.acceleration)*step));
  const boundaryTurn=AIR.turnSpeed*AIR.minSpeed/p.speed,radius=p.speed/boundaryTurn+4;
  const dx=Math.sin(p.angle),dy=-Math.cos(p.angle);
  p.edgeTurn=(p.x<radius&&dx<0)||(p.x>world.width-radius&&dx>0)||(p.y<radius&&dy<0)||(p.y>world.height-radius&&dy>0);
  let steer=input?.steer||0;
  const mountainTurn=mountainSteer(world,p);p.terrainWarning=mountainTurn!==null;
  if(mountainTurn!==null){steer=mountainTurn;p.speed=Math.max(limits.minSpeed,p.speed-(profile.braking||profile.acceleration||3)*step);p.edgeTurn=true;}
  if(p.edgeTurn&&mountainTurn===null){const target=Math.atan2(world.width/2-p.x,-(world.height/2-p.y));steer=Math.sign(angleDelta(p.angle,target));}
  if(releasing||p.state!=='flying'||p.edgeTurn||input?.automatic||!input)p.bank=0;
  else {const wanted=Math.max(-1,Math.min(1,steer)),bank=Number.isFinite(p.bank)?p.bank:0;p.bank=bank+Math.max(-profile.rollRate*step,Math.min(profile.rollRate*step,wanted-bank));}
  if((!releasing&&p.state==='flying')||mountainTurn!==null)p.angle+=(p.edgeTurn||input?.automatic?steer*boundaryTurn:p.bank*profile.turnSpeed*limits.minSpeed/p.speed)*step;
  const next={x:p.x+Math.sin(p.angle)*p.speed*step,y:p.y-Math.cos(p.angle)*p.speed*step};
  if(flightLineClear(world,p,next)){p.x=next.x;p.y=next.y;}else{p.terrainWarning=true;p.angle+=(mountainTurn||1)*boundaryTurn*step;}
  const park=parkingPoint(base),distance=Math.hypot(p.x-park.x,p.y-park.y);
  if(distance>12)p.leftBase=true;
  if(runwayAvailable(world,base,p)&&(!p.mission||['complete','lost','return','landing'].includes(p.mission.phase))&&p.state==='flying'&&p.leftBase&&!releasing&&p.speed<=limits.minSpeed+1&&distance<=AIR.landingRange){Object.assign(p,{state:'landing',remaining:AIR.transition,landingX:p.x,landingY:p.y});}
 }
 return true;
}

export function tickAirRepair(world,base,dt){
 const p=base.aircraft,was=!!p.repairing;p.repairing=false;
 if(p.fieldLanding||base.carrier||!world.logistics||base.destroyed||world.logistics.jobs?.[base.id]||p.state!=='parked'||aircraftHealth(p)>=AIR_HULL.health)return was;
 const amount=Math.min(AIR_HULL.health-aircraftHealth(p),10*dt,(world.logistics.groundSupplies||0)/.2);
 if(amount<=0)return was;
 p.health=aircraftHealth(p)+amount;world.logistics.groundSupplies=Math.max(0,world.logistics.groundSupplies-amount*.2);p.repairing=true;return true;
}
