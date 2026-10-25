import { heliParking, HELI } from './helicopter.js';
import {mountainClear} from './terrain-rules.js';
import {mountainWaypoint} from './mountain-flight.js';
import { beginSlingLower } from './helicopter-sling.js';
import { emergencyLandingPoint, fieldLandingError } from './helicopter-landing.js';
import { flightRoute, cruiseSite } from './air-routing.js';

export function helicopterPlan(world,target,bearing){
  if(!target||![target.x,target.y,bearing].every(Number.isFinite)||![0,1,2,3].includes(bearing))return {error:'Choose an area and approach direction.'};
  const angle=bearing*Math.PI/2,entry={x:target.x-Math.sin(angle)*8,y:target.y+Math.cos(angle)*8};
  if(!mountainClear(world,entry,2))return {error:'High mountains block this hovering position. Change the approach.'};
  if([target,entry].some(p=>p.x<2||p.y<2||p.x>world.width-2||p.y>world.height-2))return {error:'Keep the target and hovering position inside the map.'};
  return {payload:'HE',weapon:'helicopter',target:{...target},bearing,angle,entry,release:entry,points:[{...target}]};
}
function relocate(world,p){
  const m=p.mission,site=cruiseSite(world,p,m.target),route=flightRoute(world,p,site.center);
  m.cruiseCenter=site.center;m.egress=route.points;m.egressIndex=0;m.phase='egress';m.elapsed=0;m.routeLimited=site.limited||route.limited;
}
// A bounded ten-second fire-support visit. Each accepted shot spends real ammo.
// Saving the elapsed window and weapon timers prevents replay after a restart.
export function tickHelicopterMission(world,base,dt,release,tick){
  const p=base.aircraft,m=p.mission;
  const lose=reason=>{m.phase='lost';m.reason=reason;Object.assign(p,{state:'destroyed',health:0,remaining:20,speed:0,damageDirty:true});base.wrecks||=[];if(!base.wrecks.some(w=>w.id===m.id)){base.wrecks.push({id:m.id,x:p.x,y:p.y,angle:p.angle});base.wrecks=base.wrecks.slice(-8);}};
  if(p.state==='destroyed'){lose('Helicopter shot down');return true;}
  for(let left=dt;left>1e-8;){const step=Math.min(.025,left);left-=step;m.elapsed+=step;
    if(p.state==='parked'){m.phase='service';tick(world,base,null,step);if(p.rearm<=0)m.phase='complete';continue;}
    if(base.destroyed&&!m.resumeCruise&&m.kind!=='cruise')m.phase='return';
    if(m.phase==='takeoff'&&p.state==='flying')m.phase=m.kind==='cruise'?'egress':'outbound';
    if(m.phase==='egress'&&!m.egress){const route=flightRoute(world,p,m.cruiseCenter);m.egress=route.points;m.egressIndex=0;}
    let target=m.entry;
    if(m.phase==='outbound'||m.phase==='egress'){
      const outbound=m.phase==='outbound',route=(outbound?m.outbound:m.egress)||[m.entry],key=outbound?'routeIndex':'egressIndex';m[key]||=0;target=route[m[key]]||m.entry;
      if(Math.hypot(target.x-p.x,target.y-p.y)<.6){if(m[key]<route.length-1)target=route[++m[key]];else{m.phase=outbound?'support':'cruise';m.supportTime=0;}}
    }
    if(m.phase==='support'){
      target=m.entry;m.supportTime+=step;
      // Small deterministic sweep avoids expensive target searches and locks each
      // launched projectile independently; new shots track the current pattern.
      const aim={x:m.target.x+Math.sin(m.supportTime*2)*.8,y:m.target.y+Math.cos(m.supportTime*2)*.8};p.target=aim;
      if(p.state==='flying'){
        if(!release(p,aim,false))m.released=true;
        if(m.supportTime<=HELI.burst&&!release(p,aim,true))m.released=true;
      }
      if(m.supportTime>=10||!(p.rounds>0||p.rockets>0)){if(m.resumeCruise)relocate(world,p);else{m.phase='return';m.returnTime=0;}}
    }
    if(m.phase==='cruise')target=m.cruiseCenter;
    if(m.phase==='return'||m.phase==='landing'){
      target=heliParking(base);m.returnTime=(m.returnTime||0)+step;
      if(!p.sling&&(base.destroyed||world.logistics?.jobs?.[base.id]||m.returnTime>120)){
        m.reason='Helipad unavailable / finding clear ground';
        m.searchWait=Math.max(0,(m.searchWait||0)-step);
        if(!m.emergencyPoint&&!m.searchWait){m.emergencyPoint=emergencyLandingPoint(world,p);m.searchWait=2;}
        target=m.emergencyPoint||{x:p.x,y:p.y};
        if(!p.sling&&p.state==='flying'&&m.emergencyPoint&&Math.hypot(p.x-target.x,p.y-target.y)<.6&&p.speed<.8){
          if(fieldLandingError(world,p,target)){m.emergencyPoint=null;}
          else Object.assign(p,{fieldLanding:{...target},state:'landing',remaining:HELI.transition,speed:0,vx:0,vy:0});
        }
      }
      // Unattended recovery keeps the load attached until a clear nearby ground
      // site exists. Lower first, then continue the ordinary pad/field landing.
      if(p.sling){
        m.searchWait=Math.max(0,(m.searchWait||0)-step);
        if(!m.slingRecoveryPoint&&!m.searchWait){m.slingRecoveryPoint=emergencyLandingPoint(world,p);m.searchWait=2;}
        target=m.slingRecoveryPoint||(!base.destroyed&&!world.logistics?.jobs?.[base.id]?heliParking(base):{x:p.x,y:p.y});
        if(!p.slingOperation&&m.slingRecoveryPoint&&Math.hypot(p.x-target.x,p.y-target.y)<.4&&p.speed<.4){
          const error=beginSlingLower(world,p);if(error){m.slingRecoveryPoint=null;m.reason=error;}
        }
      }
      p.leftBase=true;
    }else if(m.elapsed>120&&!['cruise','service'].includes(m.phase)){m.phase='return';m.returnTime=0;m.reason='Support route timed out';}
    if(p.state==='landing')m.phase='landing';
    if(['return','cruise','landing'].includes(m.phase))target=mountainWaypoint(world,p,target);
    const dx=target.x-p.x,dy=target.y-p.y,distance=Math.hypot(dx,dy),scale=Math.min(1,distance/2)/Math.max(.001,distance);
    tick(world,base,{x:dx*scale,y:dy*scale,target:m.phase==='support'?p.target:target},step);
    if(m.phase==='complete'||m.phase==='lost')break;
  }
  return true;
}
