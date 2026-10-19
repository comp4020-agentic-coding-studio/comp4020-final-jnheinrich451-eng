import { isHelicopter, helicopterFireError, spendHelicopterShot } from './helicopter.js';
import { helicopterPlan, tickHelicopterMission } from './helicopter-mission.js';
import { AIR, AIR_HULL, launchError, launchAircraft, tickAircraft, parkingPoint, bombPattern, bombError } from './aircraft.js';
import { angleDelta } from './turret.js';
import { isAttackJet, JET, strafeError } from './attack-jet.js';
import { flightRoute, cruiseSite } from './air-routing.js';
export const AUTO_STRAFE=Object.freeze({rounds:12,interval:.2});
import { payloadProfile, validPayload } from './bomber-payloads.js';

export const MISSION = Object.freeze({ approach: 18, margin: 9, timeout: 120 });
export const missionActive = p => !!p?.mission && !['complete','lost'].includes(p.mission.phase);
export const RECOVERY_GRACE=30;
export const isCruising=p=>missionActive(p)&&p.mission.phase==='cruise';
export function launchCruise(world,base,id,actorId){
 const p=base.aircraft;if(p.occupant)return 'Disembark before launching cruise.';
 const error=launchAircraft(p,base.angle||0);if(error)return error;
 const center=cruiseSite(world,p).center;
 p.mission={id,actorId,kind:'cruise',phase:'takeoff',elapsed:0,returnTime:0,released:false,reason:null,target:center,entry:center,release:center,points:[],bearing:0,angle:0,cruiseCenter:center,cruiseIndex:0};
 return null;
}
function hold(world,p,reason=null){
 const m=p.mission,site=cruiseSite(world,p,m.target);m.cruiseCenter=site.center;m.cruiseIndex=0;
 const route=flightRoute(world,p,{x:site.center.x,y:site.center.y-8});
 m.egress=route.points;m.egressIndex=0;m.routeLimited=site.limited||route.limited;m.phase='egress';m.reason=reason||(m.routeLimited?'Limited safe airspace / flak risk remains':null);m.elapsed=0;
}
function failedApproach(world,p,reason){if(p.mission.resumeCruise)hold(world,p,reason);else abortMission(p,reason);}
export function prepareMission(world,base,plan){
 if(plan.error)return plan;
 if(isHelicopter(base.aircraft)){const route=flightRoute(world,base.aircraft,plan.entry);return {...plan,outbound:route.points,routeIndex:0,routeLimited:route.limited};}
 const dx=Math.sin(plan.angle),dy=-Math.cos(plan.angle),stage={x:plan.entry.x-dx*12,y:plan.entry.y-dy*12};
 const fits=stage.x>=MISSION.margin&&stage.y>=MISSION.margin&&stage.x<=world.width-MISSION.margin&&stage.y<=world.height-MISSION.margin;
 const route=flightRoute(world,base.aircraft,fits?stage:plan.entry);
 return {...plan,outbound:fits?[...route.points,plan.entry]:route.points,routeIndex:0,routeLimited:route.limited};
}

export const recoverableAircraft=p=>!!p&&['takeoff','flying','landing'].includes(p.state);
export function recoverAircraft(base,id,reason='Crew requested return'){
 const p=base.aircraft;if(missionActive(p)){abortMission(p,reason);return false;}
 if(!recoverableAircraft(p))return false;
 const home=parkingPoint(base);
 p.mission={id,kind:'recovery',actorId:null,phase:p.state==='landing'?'landing':'return',elapsed:0,returnTime:0,released:false,reason,target:home,entry:home,release:home,points:[],bearing:0,angle:0};
 return true;
}
// Only active room time counts. Existing unoccupied flights recover immediately;
// a disconnected seat gets the same 30-second grace as the room reconnect policy.
export function unattendedAircraft(base,connected,dt,id){
 const p=base.aircraft;
 if(connected||!recoverableAircraft(p)){p.unattended=0;return false;}
 p.unattended=(p.unattended||0)+dt;
 if(missionActive(p))return false;
 return (!p.occupant||p.unattended>=RECOVERY_GRACE)&&recoverAircraft(base,typeof id==='function'?id():id,'Pilot disconnected / returning home');
}
export function missionError(world,base,payload='HE'){
 if(!validPayload(payload))return 'Choose a supported bomber payload.';
 if(!base||!base.aircraft||base.aircraft.state==='vacant')return 'Choose an aircraft.';
 if(isHelicopter(base.aircraft)&&payload!=='HE')return 'Helicopters use HE cannon and rockets.';
 if(isAttackJet(base.aircraft)&&payload!=='HE')return 'Attack jets use the autocannon.';
 if(!isCruising(base.aircraft)&&(base.destroyed||world.logistics?.jobs?.[base.id]))return 'A completed operational airbase is required.';
 if(missionActive(base.aircraft)&&!isCruising(base.aircraft))return 'This aircraft already has a mission.';
 if(base.aircraft.occupant)return 'Disembark before assigning a mission.';
 return (!isCruising(base.aircraft)&&launchError(base.aircraft))|| (isHelicopter(base.aircraft)?!(base.aircraft.rounds>0||base.aircraft.rockets>0)?'Empty. Recall to rearm.':null:isAttackJet(base.aircraft)?base.aircraft.rounds<=0?'Autocannon empty. Recall to rearm.':null:base.aircraft.runs<payloadProfile(payload).cost?'Wait for enough bay charges to rearm.':null);
}
export function strikePlan(world,target,bearing=0,payload='HE',plane=null){
 if(isHelicopter(plane))return helicopterPlan(world,target,bearing);
 if(!validPayload(payload))return {error:'Choose a supported bomber payload.'};
 if(!target||![target.x,target.y,bearing].every(Number.isFinite)||![0,1,2,3].includes(bearing))return {error:'Choose a target and a cardinal approach.'};
 const jet=isAttackJet(plane),roundCount=jet?Math.min(AUTO_STRAFE.rounds,plane.rounds||0):0;
 const profile=payloadProfile(payload),angle=bearing*Math.PI/2,dx=Math.sin(angle),dy=-Math.cos(angle),lead=jet?JET.range+AIR.minSpeed*Math.max(0,roundCount-1)*AUTO_STRAFE.interval/2:AIR.minSpeed*(AIR.fall+(profile.count-1)*AIR.interval/2);
 const release={x:target.x-dx*lead,y:target.y-dy*lead},entry={x:release.x-dx*MISSION.approach,y:release.y-dy*MISSION.approach};
 const points=jet?Array.from({length:roundCount},(_,i)=>({x:release.x+dx*(JET.range+i*AIR.minSpeed*AUTO_STRAFE.interval),y:release.y+dy*(JET.range+i*AIR.minSpeed*AUTO_STRAFE.interval)})):bombPattern({...release,angle,speed:AIR.minSpeed,payload});
 if([entry,release,...points].some(p=>p.x<MISSION.margin||p.y<MISSION.margin||p.x>world.width-MISSION.margin||p.y>world.height-MISSION.margin))return {error:'Move the target inward or change approach: the complete flight and bombing strip must fit inside the map.'};
 return {error:undefined,payload,weapon:jet?'strafe':'bombs',roundCount,target:{x:target.x,y:target.y},bearing,angle,entry,release,points};
}
export function assignMission(base,plan,id,actorId){
 const p=base.aircraft,cruising=isCruising(p),previous=p.mission;
 const error=cruising?null:launchAircraft(p,base.angle||0);if(error)return error;
 base.aircraft.payload=plan.payload||'HE';
 base.aircraft.mission={id,actorId,resumeCruise:cruising,cruiseCenter:previous?.cruiseCenter,cruiseIndex:previous?.cruiseIndex||0,phase:cruising?'outbound':'takeoff',elapsed:0,returnTime:0,released:false,reason:null,...plan};return null;
}
export function abortMission(p,reason='Recalled by crew'){
 if(!missionActive(p)||['return','landing','service','emergency'].includes(p.mission.phase))return;
 p.mission.reason=reason;p.mission.phase='return';p.mission.returnTime=0;
}
function lost(base,reason){
 const p=base.aircraft,m=p.mission;m.phase='lost';m.reason=reason;
 base.wrecks ||= [];if(!base.wrecks.some(w=>w.id===m.id)){base.wrecks.push({id:m.id,x:p.x,y:p.y,angle:p.angle});base.wrecks.splice(0,Math.max(0,base.wrecks.length-8));}
 Object.assign(p,{state:'destroyed',health:0,remaining:AIR_HULL.replacement,speed:0,releaseRemaining:0,damageDirty:true});
}
// One physical aircraft, positive speed and the manual flight limits. Substeps
// bound release error; no teleport to target, homing bombs or simulated pilot.
export function tickMission(world,base,dt,release){
 const p=base.aircraft,m=p.mission;if(!missionActive(p))return false;
 if(isHelicopter(p))return tickHelicopterMission(world,base,dt,release,tickAircraft);
 if(p.state==='destroyed'){lost(base,'Aircraft shot down');return true;}
 const steps=Math.ceil(dt/.025),step=dt/steps;
 for(let i=0;i<steps;i++){
  m.elapsed+=step;
  if(base.destroyed&&m.kind!=='cruise'&&!m.resumeCruise&&!['return','service','emergency'].includes(m.phase)){if(p.state==='landing'){p.state='flying';p.remaining=0;m.phase='approach';}abortMission(p,'Home airbase lost');}
  if(m.phase==='emergency'){
   p.remaining=Math.max(0,p.remaining-step);if(!p.remaining){lost(base,m.reason||'Emergency landing');break;}continue;
  }
  if(p.state==='parked'){
   if(base.destroyed){lost(base,'Home airbase unavailable');break;}
   m.phase='service';tickAircraft(world,base,null,step);if(p.rearm<=0){m.phase='complete';break;}continue;
  }
  if(p.state==='landing')m.phase='landing';
  if(m.phase==='takeoff'&&p.state==='flying')m.phase=m.kind==='cruise'?'cruise':'outbound';
  if(m.elapsed>MISSION.timeout&&!['return','landing','service','cruise'].includes(m.phase)){if(m.phase==='egress')abortMission(p,'Cruise relocation timed out');else failedApproach(world,p,'Approach timed out');}
  let target=m.entry;
  if(m.phase==='outbound'){
   const route=m.outbound||[m.entry];m.routeIndex ||= 0;target=route[m.routeIndex]||m.entry;
   if(Math.hypot(p.x-target.x,p.y-target.y)<4){if(m.routeIndex<route.length-1)target=route[++m.routeIndex];else m.phase='approach';}
  }
  if(m.phase==='approach'||m.phase==='dive'){
   target=m.release;
   const dx=Math.sin(m.angle),dy=-Math.cos(m.angle),along=(p.x-target.x)*dx+(p.y-target.y)*dy,cross=Math.abs((p.x-target.x)*dy-(p.y-target.y)*dx);
   if(along>=-6&&cross<1.5)m.phase='dive';
   if(along>=-.2&&along<1&&cross<.8&&Math.abs(angleDelta(p.angle,m.angle))<.08){
    const error=release(p);if(error)failedApproach(world,p,error);else{m.released=true;m.phase='release';if(m.weapon==='strafe'){m.shotsRemaining=Math.max(0,m.roundCount-1);m.nextShot=AUTO_STRAFE.interval;m.burstTime=0;p.releaseRemaining=m.shotsRemaining*AUTO_STRAFE.interval;}}
   }else if(along>1)failedApproach(world,p,'Approach missed; ammunition retained');
   target={x:m.release.x+dx*(along+5),y:m.release.y+dy*(along+5)};
  }
  if(m.phase==='release'&&m.weapon==='strafe'&&m.shotsRemaining>0){
   m.burstTime+=step;m.nextShot-=step;p.releaseRemaining=Math.max(.1,p.releaseRemaining);
   if(m.nextShot<=0){const error=release(p);if(!error){m.shotsRemaining--;m.nextShot=AUTO_STRAFE.interval;}else m.nextShot=.05;}
   if(m.burstTime>5||p.rounds<=0){m.shotsRemaining=0;m.reason='Strafing pass ended';}
  }
  if(m.phase==='release'&&p.releaseRemaining<=0&&!(m.shotsRemaining>0)){if(m.resumeCruise)hold(world,p);else{m.phase='return';m.returnTime=0;}}
  if(m.phase==='egress'){
   target=m.egress[m.egressIndex]||m.cruiseCenter;
   if(Math.hypot(p.x-target.x,p.y-target.y)<4){if(m.egressIndex<m.egress.length-1)target=m.egress[++m.egressIndex];else{m.phase='cruise';m.elapsed=0;}}
  }
  if(m.phase==='cruise'){
   const center=m.cruiseCenter,points=[{x:center.x,y:center.y-8},{x:center.x+8,y:center.y},{x:center.x,y:center.y+8},{x:center.x-8,y:center.y}];
   target=points[m.cruiseIndex||0];if(Math.hypot(p.x-target.x,p.y-target.y)<3){m.cruiseIndex=((m.cruiseIndex||0)+1)%4;target=points[m.cruiseIndex];}
  }
  if(m.phase==='return'){
   target=parkingPoint(base);m.returnTime+=step;
   if((base.destroyed||world.logistics?.jobs?.[base.id])&&Math.hypot(p.x-target.x,p.y-target.y)<=AIR.landingRange||m.returnTime>MISSION.timeout){
    m.phase='emergency';m.reason='Runway unavailable / emergency landing';p.state='emergency-landing';p.remaining=AIR.transition;p.speed=0;continue;
   }
  }
  const desired=Math.atan2(target.x-p.x,-(target.y-p.y)),delta=angleDelta(p.angle,desired),turn=AIR.turnSpeed*AIR.minSpeed/p.speed;
  tickAircraft(world,base,{steer:Math.max(-1,Math.min(1,delta/(turn*step))),throttle:-1},step);
 }
 return true;
}
// A bounded dry-run rejects a route which this same steering controller cannot
// fly and recover. It does not predict flak or guarantee a successful combat hit.
export function validateMission(world,base,plan){
 if(plan.error)return plan.error;
 const trial=structuredClone(base);if(!isCruising(trial.aircraft))delete trial.aircraft.mission;
 assignMission(trial,plan,'preview','preview');
 for(let t=0;t<2*MISSION.timeout+20&&missionActive(trial.aircraft)&&!(trial.aircraft.mission.released&&isCruising(trial.aircraft));t+=.1)tickMission(world,trial,.1,(p,target,rocket)=>{if(isHelicopter(p)){const e=helicopterFireError(world,p,target,rocket);if(e)return e;spendHelicopterShot(p,rocket);return null;}if(isAttackJet(p)){const e=strafeError(world,p);if(e)return e;p.rounds--;return null;}const e=bombError(world,p);if(e)return e;const profile=payloadProfile(plan.payload);p.runs-=profile.cost;p.releaseRemaining=(profile.count-1)*AIR.interval;return null;});
 if(!trial.aircraft.mission.released||!['complete','cruise'].includes(trial.aircraft.mission.phase))return 'No safe approach from this base. Change target or approach direction.';
 return null;
}
