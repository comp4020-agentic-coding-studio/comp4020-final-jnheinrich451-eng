import {isHelicopter} from './helicopter.js';
import {launchAircraft,tickAircraft,parkingPoint} from './aircraft.js';
import {airfields,freeAirbase,requestHelicopterLanding,runwayAvailable} from './air-traffic.js';
import {fieldLandingPoint,fieldLandingError} from './helicopter-landing.js';
import {slingLiftError,slingDropError,attachSling,beginSlingLower} from './helicopter-sling.js';
import {transportVehicles} from './transport.js';
import {flightRoute} from './air-routing.js';

export const transportOrderActive=p=>p?.mission?.kind==='transport'&&!['complete','lost','return','service','emergency'].includes(p.mission.phase);
export function helicopterOrderError(p){
 if(!isHelicopter(p)||!['parked','flying','takeoff','landing'].includes(p.state))return 'Choose a living helicopter.';
 if(p.occupant)return 'A pilot controls this helicopter.';
 if(p.slingOperation)return 'Wait for the sling transfer to finish.';
 if(['takeoff','landing'].includes(p.state))return 'Wait for takeoff or landing to finish.';
 return null;
}
export function planHelicopterOrder(world,p,data,canManage=()=>true){
 const error=helicopterOrderError(p);if(error)return {error};
 if(!['move','land','pickup','drop','return','stop'].includes(data.action))return {error:'Choose Move, Land, Pick up, Set down, Return or Stop.'};
 if(data.action==='stop')return {order:{kind:'transport',action:'stop',phase:p.state==='parked'?'complete':'holding',target:{x:p.x,y:p.y}}};
 let target=data.target,baseId=null;
 if(data.action==='return'){
  if(p.sling)return {error:'Set down the carried vehicle before returning to a helipad.'};
  const pad=freeAirbase(world,p);if(!pad)return {error:'No completed, free helipad. Choose clear land instead.'};
  baseId=pad.id;target=parkingPoint(pad);
 }
 if(data.action==='pickup'){
  const cargo=transportVehicles(world).find(c=>c.vehicle.id===data.vehicleId);
  if(!cargo)return {error:'That ground vehicle is no longer available.'};
  if(!canManage(cargo.vehicle.owner))return {error:'Only lift vehicles you can manage.'};
  const error=slingLiftError(world,{...p,...cargo.vehicle,kind:'helicopter',state:'flying',speed:0,sling:p.sling,slingOperation:null},cargo);
  if(error)return {error};target={x:cargo.vehicle.x,y:cargo.vehicle.y};
 }
 if(!target||![target.x,target.y].every(Number.isFinite)||target.x<.5||target.y<.5||target.x>world.width-.5||target.y>world.height-.5)return {error:'Choose a point inside the map.'};
 target=['land','drop'].includes(data.action)?fieldLandingPoint(target):{x:target.x,y:target.y};
 if(data.action==='land'){
  if(p.sling)return {error:'Set down the carried vehicle before landing.'};
  const error=fieldLandingError(world,p,target);if(error)return {error};
 }
 if(data.action==='drop'){const error=slingDropError(world,p,target);if(error)return {error};}
 const route=flightRoute(world,p,target);
 if(route.blocked)return {error:'No flight route around the high mountains. Choose another destination.'};
 return {order:{kind:'transport',action:data.action,phase:'moving',target,baseId,vehicleId:data.action==='pickup'?data.vehicleId:null,path:route.points,index:0,elapsed:0,routeLimited:route.limited,reason:null}};
}
export function startHelicopterOrder(p,order,id,actorId){
 if(p.state==='parked'&&order.action!=='stop'){const error=launchAircraft(p,p.angle);if(error)return error;}
 p.mission={elapsed:0,returnTime:0,...order,id,actorId};if(order.baseId)p.baseId=order.baseId;
 p.unattended=0;delete p.landingError;return null;
}
// The server owns transfer commits. Tests can supply the same mutation directly.
export function tickHelicopterOrder(world,context,base,dt,canManage,commit=fn=>fn()){
 const p=base.aircraft,o=p.mission;if(!transportOrderActive(p))return false;
 const hold=reason=>{o.phase='holding';o.reason=reason||null;o.path=[];o.target={x:p.x,y:p.y};};
 if(p.state==='destroyed'){o.phase='lost';return true;}
 if(p.occupant){o.phase='complete';return true;}
 if(o.phase==='transfer'){
  tickAircraft(context,base,null,dt);
  if(!p.slingOperation)hold(p.slingError||'Transfer complete.');
  return true;
 }
 if(o.phase==='landing'){
  tickAircraft(context,base,null,dt);
  if(p.state==='parked'){o.phase='complete';o.reason='Landed.';}
  else if(p.state==='flying')hold(p.landingError||'Landing interrupted.');
  return true;
 }
 if(o.phase==='holding'){tickAircraft(context,base,null,dt);return true;}
 o.elapsed=(o.elapsed||0)+dt;
 if(o.action==='return'){
  const pad=airfields(world).find(b=>b.id===o.baseId);
  if(!pad||pad.destroyed||!runwayAvailable(world,pad,p)){hold('Destination helipad unavailable. Choose another order.');return true;}
 }
 let target=o.path?.[o.index]||o.target;
 const final=!o.path?.length||o.index>=o.path.length-1;
 const distance=Math.hypot(target.x-p.x,target.y-p.y);
 if(!final&&distance<.6)target=o.path[++o.index];
 const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),scale=d>.08?Math.min(1,d/2)/Math.max(.001,d):0;
 tickAircraft(context,base,{x:dx*scale,y:dy*scale,target},dt);
 if(o.elapsed>600){hold('Route timed out. Assign another destination.');return true;}
 if(!final||p.state!=='flying'||Math.hypot(p.x-o.target.x,p.y-o.target.y)>.15||p.speed>=.15)return true;
 if(o.action==='move'){hold('Position reached.');return true;}
 if(o.action==='land'||o.action==='return'){
  const error=requestHelicopterLanding(context,p);if(error)hold(error);else o.phase='landing';return true;
 }
 if(o.action==='pickup'){
  const cargo=transportVehicles(world).find(c=>c.vehicle.id===o.vehicleId);
  const error=cargo&&!canManage(cargo.vehicle.owner,o.actorId)?'Vehicle management permission changed.':slingLiftError(world,p,cargo);
  if(error){hold(error);return true;}
  commit(()=>{attachSling(world,p,cargo);o.phase='transfer';p.slingRevision=(p.slingRevision||0)+1;},cargo);
 }else if(o.action==='drop'){
  const error=slingDropError(context,p);if(error){hold(error);return true;}
  commit(()=>{const error=beginSlingLower(context,p);if(error)hold(error);else{o.phase='transfer';p.slingRevision=(p.slingRevision||0)+1;}});
 }
 return true;
}
