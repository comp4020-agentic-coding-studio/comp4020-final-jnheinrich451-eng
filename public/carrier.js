import { shipStopped } from './ship-motion.js';
import { POD } from './pod.js';
import { AIR_HULL } from './aircraft.js';
import { shipDimensions } from './naval-scale.js';

export const CARRIER=Object.freeze({width:3,length:5,health:600,speed:1.8,reverse:1,turnSpeed:Math.PI/9,supplies:120,refill:10,repair:10,perHp:.2});
export const isCarrier=s=>s?.kind==='carrier';
export const carrierReady=s=>isCarrier(s)&&!s.destroyed&&(s.health??CARRIER.health)>0&&s.elapsed>=POD.duration&&!(s.assemblyRemaining>0);
// Two deck spots, each with its own runway: spot A launches over the bow on the
// axial catapults; spot B uses the angled deck, which leaves through the port bow
// slope. Spot A keeps the carrier id, so saved baseIds stay valid; spot B has its
// own aircraft holder nested on the ship (s.wing). A deck takes one heavy aircraft
// (bomber or aerial gunship) and one attack jet.
// Deck geometry in shares of the drawn half-beam (x, port negative) and half-length
// (y, bow -1); the carrier art draws from the same numbers.
export const CARRIER_BEAM=.85;
export const ANGLED_DECK=Object.freeze({x:.25,dx:-.96,dy:-1.67,half:.2});
export const DECK_SPOTS=Object.freeze([{x:.15,y:-.62},{x:-.04,y:.5}]);
export const wingId=s=>s.id+':wing';
export const deckRole=p=>p?.kind==='attack-jet'?'attack':'heavy';
const vacant=(id,s)=>({id:id+':aircraft',baseId:id,owner:s.owner,kind:'bomber',state:'vacant',health:0,x:s.x,y:s.y,angle:s.angle,occupant:null,remaining:0});
export function ensureWing(s){if(isCarrier(s))s.wing ||= {id:wingId(s),owner:s.owner,wingOf:s.id,aircraft:vacant(wingId(s),s)};return s.wing;}
export function prepareCarrier(s){
 if(!isCarrier(s))return;
 s.deckSupplies=0;
 s.aircraft ||= vacant(s.id,s);
 ensureWing(s);
}
export function aircraftHolders(world){return [...(world.airbases||[]),...(world.ships||[]).filter(v=>v.aircraft),...(world.ships||[]).filter(isCarrier).map(v=>v.wing).filter(w=>w?.aircraft)];}
export function spotPoint(s,index){
 const d=shipDimensions(s),spot=DECK_SPOTS[index]||DECK_SPOTS[0],x=spot.x*d.width/2*CARRIER_BEAM,y=spot.y*d.length/2,c=Math.cos(s.angle),n=Math.sin(s.angle);
 return {x:s.x+x*c-y*n,y:s.y+x*n+y*c};
}
// The angled runway turns toward port by the drawn deck's real angle.
export function angledOffset(s){const d=shipDimensions(s);return Math.atan2(-ANGLED_DECK.dx*d.width/2*CARRIER_BEAM,-ANGLED_DECK.dy*d.length/2);}
export const spotAngle=(s,index)=>index===1?s.angle-angledOffset(s):s.angle;
export const deckSpot=(s,id)=>id===wingId(s)?1:0;
export function carrierFields(s){
 const destroyed=!carrierReady(s);
 return [s.id,wingId(s)].map((id,index)=>({id,owner:s.owner,kind:'carrier',carrier:s,deck:index,x:s.x-2,y:s.y-7.5,angle:spotAngle(s,index),parking:spotPoint(s,index),destroyed}));
}
export const carrierField=s=>carrierFields(s)[0];
export function deckAircraft(world,s){const ids=[s.id,wingId(s)];return aircraftHolders(world).map(b=>b.aircraft).filter(p=>ids.includes(p.baseId));}
// Another live aircraft based on this carrier already fills the deck role.
export function deckRoleTaken(world,s,plane){return deckAircraft(world,s).some(p=>p.id!==plane?.id&&!['vacant','destroyed'].includes(p.state)&&deckRole(p)===deckRole(plane));}
export function deckLocked(world,s){return isCarrier(s)&&deckAircraft(world,s).some(p=>['takeoff','landing','delivering'].includes(p.state)||p.state==='flying'&&p.mission?.phase==='return');}
export function syncCarrierDeck(world,s){
 let changed=false;if(s.destroyed&&s.deckSupplies){s.deckSupplies=0;changed=true;}
 for(const p of deckAircraft(world,s)){
  if(!['parked','delivering','landing'].includes(p.state))continue;
  if(!carrierReady(s)&&s.destroyed){const record=aircraftHolders(world).find(b=>b.aircraft===p);if(record&&(!p.mission||['complete','lost'].includes(p.mission.phase))){record.wrecks ||= [];record.wrecks.push({id:p.id+':sunk:'+s.hurt,x:p.x,y:p.y,angle:p.angle});record.wrecks.splice(0,Math.max(0,record.wrecks.length-8));}Object.assign(p,{state:'destroyed',health:0,remaining:20,damageDirty:true});changed=true;}
  else if(p.state!=='landing'){const index=deckSpot(s,p.baseId),spot=spotPoint(s,index),angle=spotAngle(s,index);if(p.x!==spot.x||p.y!==spot.y||p.angle!==angle){Object.assign(p,{...spot,angle});changed=true;}}
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
