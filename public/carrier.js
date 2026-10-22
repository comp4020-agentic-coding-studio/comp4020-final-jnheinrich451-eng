import { shipStopped } from './ship-motion.js';
import { POD } from './pod.js';
import { AIR_HULL } from './aircraft.js';

export const CARRIER=Object.freeze({width:3,length:5,health:600,speed:1.8,reverse:1,turnSpeed:Math.PI/9,supplies:120,refill:10,repair:10,perHp:.2});
export const isCarrier=s=>s?.kind==='carrier';
export const carrierReady=s=>isCarrier(s)&&!s.destroyed&&(s.health??CARRIER.health)>0&&s.elapsed>=POD.duration&&!(s.assemblyRemaining>0);
export function prepareCarrier(s){
 if(!isCarrier(s))return;
 s.deckSupplies=0;
 s.aircraft ||= {id:s.id+':aircraft',baseId:s.id,owner:s.owner,kind:'bomber',state:'vacant',health:0,x:s.x,y:s.y,angle:s.angle,occupant:null,remaining:0};
}
export function carrierField(s){return {id:s.id,owner:s.owner,kind:'carrier',carrier:s,x:s.x-2,y:s.y-7.5,angle:s.angle,parking:{x:s.x,y:s.y},destroyed:!carrierReady(s)};}
export function deckAircraft(world,s){return [...(world.airbases||[]),...(world.ships||[]).filter(v=>v.aircraft)].map(b=>b.aircraft).filter(p=>p.baseId===s.id);}
export function deckLocked(world,s){return isCarrier(s)&&deckAircraft(world,s).some(p=>['takeoff','landing','delivering'].includes(p.state)||p.state==='flying'&&p.mission?.phase==='return');}
export function syncCarrierDeck(world,s){
 let changed=false;if(s.destroyed&&s.deckSupplies){s.deckSupplies=0;changed=true;}
 for(const p of deckAircraft(world,s)){
  if(!['parked','delivering','landing'].includes(p.state))continue;
  if(!carrierReady(s)&&s.destroyed){const record=[...(world.airbases||[]),...(world.ships||[]).filter(v=>v.aircraft)].find(b=>b.aircraft===p);if(record&&(!p.mission||['complete','lost'].includes(p.mission.phase))){record.wrecks ||= [];record.wrecks.push({id:p.id+':sunk:'+s.hurt,x:p.x,y:p.y,angle:p.angle});record.wrecks.splice(0,Math.max(0,record.wrecks.length-8));}Object.assign(p,{state:'destroyed',health:0,remaining:20,damageDirty:true});changed=true;}
  else if(p.state!=='landing'&&(p.x!==s.x||p.y!==s.y||p.angle!==s.angle)){Object.assign(p,{x:s.x,y:s.y,angle:s.angle});changed=true;}
 }
 return changed;
}
// Supplies are moved, not copied. A rebuilt hull starts with an empty store.
export function tickCarrierService(world,s,planes,dt,atDock){
 const before=JSON.stringify([s.deckSupplies,s.health,s.repairDelay,s.repairing,planes.map(p=>[p.health,p.repairing])]);
 s.repairDelay=Math.max(0,(s.repairDelay||0)-dt);s.repairing=false;
 for(const p of planes)p.repairing=false;
 if(carrierReady(s)&&shipStopped(s)){
  s.deckSupplies=Math.max(0,s.deckSupplies||0);
  if(atDock){const amount=Math.min(CARRIER.supplies-s.deckSupplies,CARRIER.refill*dt,world.logistics.groundSupplies||0);s.deckSupplies+=amount;world.logistics.groundSupplies-=amount;}
  const repair=(v,max)=>{const amount=Math.min(Math.max(0,max-v.health),CARRIER.repair*dt,s.deckSupplies/CARRIER.perHp);if(amount>0){v.health+=amount;s.deckSupplies=Math.max(0,s.deckSupplies-amount*CARRIER.perHp);v.repairing=true;}};
  if(!s.repairDelay)repair(s,CARRIER.health);
  for(const p of planes)if(p.state==='parked')repair(p,AIR_HULL.health);
 }
 return before!==JSON.stringify([s.deckSupplies,s.health,s.repairDelay,s.repairing,planes.map(p=>[p.health,p.repairing])]);
}
