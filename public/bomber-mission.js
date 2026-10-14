import { AIR, AIR_HULL, launchError, launchAircraft, tickAircraft, parkingPoint, bombPattern, bombError } from './aircraft.js';
import { angleDelta } from './turret.js';
import { isAttackJet } from './attack-jet.js';

export const MISSION = Object.freeze({ approach: 18, margin: 9, timeout: 120 });
export const missionActive = p => !!p?.mission && !['complete','lost'].includes(p.mission.phase);
export function missionError(world,base){
 if(!base||isAttackJet(base.aircraft))return 'Choose an HE bomber.';
 if(base.destroyed||world.logistics?.jobs?.[base.id])return 'A completed operational airbase is required.';
 if(missionActive(base.aircraft))return 'This bomber already has a mission.';
 if(base.aircraft.occupant)return 'Disembark before assigning a mission.';
 return launchError(base.aircraft)|| (base.aircraft.runs<=0?'Wait for rearming.':null);
}
export function strikePlan(world,target,bearing=0){
 if(!target||![target.x,target.y,bearing].every(Number.isFinite)||![0,1,2,3].includes(bearing))return {error:'Choose a target and a cardinal approach.'};
 const angle=bearing*Math.PI/2,dx=Math.sin(angle),dy=-Math.cos(angle),lead=AIR.minSpeed*(AIR.fall+(AIR.count-1)*AIR.interval/2);
 const release={x:target.x-dx*lead,y:target.y-dy*lead},entry={x:release.x-dx*MISSION.approach,y:release.y-dy*MISSION.approach};
 const points=bombPattern({...release,angle,speed:AIR.minSpeed});
 if([entry,release,...points].some(p=>p.x<MISSION.margin||p.y<MISSION.margin||p.x>world.width-MISSION.margin||p.y>world.height-MISSION.margin))return {error:'Move the target inward or change approach: the complete flight and bombing strip must fit inside the map.'};
 return {target:{x:target.x,y:target.y},bearing,angle,entry,release,points};
}
export function assignMission(base,plan,id,actorId){
 const error=launchAircraft(base.aircraft);if(error)return error;
 base.aircraft.mission={id,actorId,phase:'takeoff',elapsed:0,returnTime:0,released:false,reason:null,...plan};return null;
}
export function abortMission(p,reason='Recalled by crew'){
 if(!missionActive(p)||['return','landing','service','emergency'].includes(p.mission.phase))return;
 p.mission.reason=reason;p.mission.phase='return';p.mission.returnTime=0;
}
function lost(base,reason){
 const p=base.aircraft,m=p.mission;m.phase='lost';m.reason=reason;
 base.wrecks ||= [];if(!base.wrecks.some(w=>w.id===m.id)){base.wrecks.push({id:m.id,x:p.x,y:p.y,angle:p.angle});base.wrecks=base.wrecks.slice(-8);}
 Object.assign(p,{state:'destroyed',health:0,remaining:AIR_HULL.replacement,speed:0,releaseRemaining:0,damageDirty:true});
}
// One physical aircraft, positive speed and the manual flight limits. Substeps
// bound release error; no teleport to target, homing bombs or simulated pilot.
export function tickMission(world,base,dt,release){
 const p=base.aircraft,m=p.mission;if(!missionActive(p))return false;
 if(p.state==='destroyed'){lost(base,'Aircraft shot down');return true;}
 const steps=Math.ceil(dt/.025),step=dt/steps;
 for(let i=0;i<steps;i++){
  m.elapsed+=step;
  if(base.destroyed&&!['return','service','emergency'].includes(m.phase)){if(p.state==='landing'){p.state='flying';p.remaining=0;m.phase='approach';}abortMission(p,'Home airbase lost');}
  if(m.phase==='emergency'){
   p.remaining=Math.max(0,p.remaining-step);if(!p.remaining){lost(base,m.reason||'Emergency landing');break;}continue;
  }
  if(p.state==='parked'){
   if(base.destroyed){lost(base,'Home airbase unavailable');break;}
   m.phase='service';tickAircraft(world,base,null,step);if(p.rearm<=0){m.phase='complete';break;}continue;
  }
  if(p.state==='landing')m.phase='landing';
  if(m.phase==='takeoff'&&p.state==='flying')m.phase='outbound';
  if(m.elapsed>MISSION.timeout&&!['return','landing','service'].includes(m.phase))abortMission(p,'Approach timed out');
  let target=m.entry;
  if(m.phase==='outbound'&&Math.hypot(p.x-target.x,p.y-target.y)<4){m.phase='approach';}
  if(m.phase==='approach'){
   target=m.release;
   const dx=Math.sin(m.angle),dy=-Math.cos(m.angle),along=(p.x-target.x)*dx+(p.y-target.y)*dy,cross=Math.abs((p.x-target.x)*dy-(p.y-target.y)*dx);
   if(along>=-.2&&along<1&&cross<.8&&Math.abs(angleDelta(p.angle,m.angle))<.08){
    const error=release(p);if(error)abortMission(p,error);else{m.released=true;m.phase='release';}
   }else if(along>1)abortMission(p,'Approach missed; bombs retained');
   target={x:m.release.x+dx*(along+5),y:m.release.y+dy*(along+5)};
  }
  if(m.phase==='release'&&p.releaseRemaining<=0){m.phase='return';m.returnTime=0;}
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
 const trial=structuredClone(base);delete trial.aircraft.mission;
 assignMission(trial,plan,'preview','preview');
 for(let t=0;t<2*MISSION.timeout+20&&missionActive(trial.aircraft);t+=.1)tickMission(world,trial,.1,p=>{const e=bombError(world,p);if(e)return e;p.runs--;p.releaseRemaining=(AIR.count-1)*AIR.interval;return null;});
 if(!trial.aircraft.mission.released||trial.aircraft.mission.phase!=='complete')return 'No safe approach from this base. Change target or approach direction.';
 return null;
}
