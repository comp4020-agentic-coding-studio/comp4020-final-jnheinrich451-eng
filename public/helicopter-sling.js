import { rememberRecovery } from './wreck-recovery.js';
import { isHelicopter } from './helicopter.js';
import { transportVehicles } from './transport.js';
import { canStand, tileAt } from './world.js';
import { bridgeReady } from './bridge-geometry.js';
import { airbaseAt, railCorridor } from './footprints.js';
import { tankPodCells } from './tank.js';
import { rememberRuin } from './ruins.js';

export const SLING=Object.freeze({reach:1.8,hover:.4,duration:2,speed:2.5,acceleration:2});
export const slingCandidates=(world,p)=>transportVehicles(world).filter(c=>Math.hypot(c.vehicle.x-p.x,c.vehicle.y-p.y)<=SLING.reach).sort((a,b)=>Math.hypot(a.vehicle.x-p.x,a.vehicle.y-p.y)-Math.hypot(b.vehicle.x-p.x,b.vehicle.y-p.y));
export function slingHoverError(p){
 if(!isHelicopter(p)||p.state!=='flying')return 'Fly a helicopter before using the sling.';
 if(p.slingOperation)return 'Wait for the sling transfer to finish.';
 if(p.speed>=SLING.hover)return 'Release WASD and hover before using the sling.';
 return null;
}
export function slingLiftError(world,p,cargo){
 const error=slingHoverError(p);if(error)return error;
 if(p.sling)return 'Set down the carried vehicle first.';
 const v=cargo?.vehicle;
 if(!v||!transportVehicles(world).some(c=>c.vehicle.id===v.id))return 'Hover over an available tank, recycler or bridge builder.';
 if(v.occupant)return 'The vehicle must be unoccupied.';
 if(world.logistics?.jobs?.[v.id])return 'Finish vehicle construction first.';
 if(Math.abs(v.speed||0)>.05||v.path?.length||v.task)return 'Park the vehicle and stop its remote orders first.';
 if(world.logistics?.bridges?.some(b=>b.builderId===v.id&&!bridgeReady(b)))return 'Finish the bridge before lifting its builder.';
 if(Math.hypot(v.x-p.x,v.y-p.y)>SLING.reach)return 'Hover within two tiles of the vehicle.';
 return null;
}
export const slingGroundPoint=p=>({x:Math.floor(p.x)+.5,y:Math.floor(p.y)+.5});
export function slingDropError(world,p,point=slingGroundPoint(p)){
 if(!p.sling)return 'No vehicle attached.';
 if(![point.x,point.y].every(Number.isFinite)||point.x<.5||point.y<.5||point.x>world.width-.5||point.y>world.height-.5)return 'Keep the drop site inside the map.';
 if(tileAt(world,point.x,point.y)===0)return 'Cannot lower a vehicle into water.';
 const filtered={...world,airbases:(world.airbases||[]).map(b=>b.aircraft?.id===p.id?{...b,aircraft:null}:b)};
 if(airbaseAt(world,point.x,point.y)||railCorridor(world,Math.floor(point.x),Math.floor(point.y))||!canStand(filtered,world.buildings||[],point.x,point.y,null,.42))return 'Clear the vehicle drop site first.';
 const occupants=[...(world.players||[]),...(world.combat?.enemies||[]),...(world.logistics?.recyclers||[])];
 if(occupants.some(v=>v.id!==p.occupant&&!v.destroyed&&v.life!=='disabled'&&(v.hp===undefined||v.hp>0)&&!['aircraft','ship','orbital'].includes(v.body)&&Math.abs(v.x-point.x)<.9&&Math.abs(v.y-point.y)<.9))return 'A ground unit occupies the drop site.';
 // Two helicopters cannot commit a lowering operation to the same footprint.
 if((world.airbases||[]).some(b=>b.aircraft?.id!==p.id&&b.aircraft?.slingOperation?.kind==='lower'&&Math.abs(b.aircraft.slingOperation.point.x-point.x)<.84&&Math.abs(b.aircraft.slingOperation.point.y-point.y)<.84))return 'Another helicopter is lowering here.';
 return null;
}
export function attachSling(world,p,cargo){
 p.sling=structuredClone(cargo);
 Object.assign(p.sling.vehicle,{occupant:null,speed:0,vx:0,vy:0,driveSpeed:0,path:[],task:null,guard:null,collecting:0,idle:0});
 if(cargo.kind==='tank'){
  const floors=new Set(world.logistics.floors||[]);for(const cell of tankPodCells(cargo.vehicle.podX,cargo.vehicle.podY))floors.add(cell.y*world.width+cell.x);world.logistics.floors=[...floors];
  world.tanks=world.tanks.filter(v=>v.id!==cargo.vehicle.id);
 }else world.logistics.recyclers=world.logistics.recyclers.filter(v=>v.id!==cargo.vehicle.id);
 p.slingOperation={kind:'lift',remaining:SLING.duration};p.slingError=null;
 Object.assign(p,{vx:0,vy:0,speed:0});
}
export function beginSlingLower(world,p){
 const error=slingHoverError(p)||slingDropError(world,p);if(error)return error;
 p.slingOperation={kind:'lower',remaining:SLING.duration,point:slingGroundPoint(p)};p.slingError=null;
 Object.assign(p,{vx:0,vy:0,speed:0});return null;
}
// The server checkpoints completion together with the restored ground record.
// A late obstruction retains the one attached copy, without resetting its cargo.
export function tickSling(world,p,dt,context=world){
 const op=p.slingOperation;if(!op||p.state==='destroyed')return false;
 op.remaining=Math.max(0,op.remaining-dt);if(op.remaining>1e-8)return false;
 if(op.kind==='lower'){
  const error=slingDropError(context,p,op.point);
  if(error)p.slingError=error;
  else{
   const cargo=p.sling,v=cargo.vehicle;
   Object.assign(v,op.point,{angle:p.angle,occupant:null,speed:0,vx:0,vy:0,driveSpeed:0,path:[],task:null,guard:null,collecting:0,idle:0});
   if(cargo.kind==='tank')world.tanks.push(v);else world.logistics.recyclers.push(v);
   p.sling=null;p.slingError=null;
  }
 }
 p.slingOperation=null;return true;
}
export function loseSling(world,p){
 if(!p.sling)return false;
 const {kind,vehicle:v}=p.sling;p.sling=null;p.slingOperation=null;
 rememberRuin(world,v.id,kind==='tank'?'tank':v.kind||'recycler',p.x,p.y,p.angle);
 rememberRecovery(world,kind==='tank'?'tank':'recycler',v,p,kind!=='tank'&&tileAt(world,p.x,p.y)===0?v.cargo||0:0);
 if(kind==='tank'){
  Object.assign(v,{x:p.x,y:p.y,destroyed:true,health:0,occupant:null,speed:0,replacement:12});world.tanks.push(v);
 }else{
  delete world.logistics.durability['recycler:'+v.id];
  if(v.cargo>0&&tileAt(world,p.x,p.y)!==0){
   const crates=world.logistics.crates;
   if(crates.length<64)crates.push({id:p.id+':sling:'+v.id,x:p.x,y:p.y,amount:v.cargo});
   else crates[0].amount+=v.cargo;
  }
 }
 return true;
}
