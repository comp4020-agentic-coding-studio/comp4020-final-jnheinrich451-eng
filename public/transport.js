import { dockRecords } from './shipyard.js';
import { boardingPoint, mooredDock, dockRects, rampClear, dockFloorAt } from './ship.js';
import {largeHull,shipDimensions} from './naval-scale.js';
import { canStand } from './world.js';
import { operational } from './vehicle.js';
import { bridgeReady } from './bridge-geometry.js';

export const TRANSPORT = Object.freeze({ reach:4, routeLimit:8, gateReach:1.1 });
export const isTransport = ship => ship?.kind === 'transport';
export const cargoName = cargo => cargo?.kind === 'tank' ? 'Tank' : cargo?.vehicle?.kind === 'builder' ? 'Bridge builder' : 'Recycler';
export const carriedVehicles = world => [...(world.ships || []).flatMap(s => s.cargo ? [s.cargo] : []),...(world.airbases||[]).flatMap(b=>b.aircraft?.sling?[b.aircraft.sling]:[])];
export const transportVehicles = world => [
  ...(world.tanks || []).filter(operational).map(vehicle => ({kind:'tank',vehicle})),
  ...(world.logistics?.recyclers || []).filter(v => v.remaining<=0&&!v.destroyed&&(world.logistics.durability?.['recycler:'+v.id]?.health??1)>0).map(vehicle => ({kind:'utility',vehicle}))
];
export function cargoAccess(world,buildings,ship){
  if(!isTransport(ship)||!operational(ship))return null;
  if(Math.abs(ship.speed||0)>.05)return null;
  if(largeHull(ship)){
    const dock=mooredDock(world,ship);
    if(!ship.ramp&&!dock)return null;
    if(ship.ramp&&rampClear(world,buildings,ship,ship.ramp))return {x:ship.ramp.x,y:ship.ramp.y};
    if(!ship.ramp){const gate=pierGate(world,buildings,ship,dock);if(gate)return gate;}
    const bow=transportBow(ship),dx=Math.sin(ship.angle),dy=-Math.cos(ship.angle);
    for(const distance of [1,1.5,2,2.5,3,3.5]){const p={x:bow.x+dx*distance,y:bow.y+dy*distance};if(canStand(world,buildings,p.x,p.y)&&rampClear(world,buildings,ship,p))return p;}
    return null;
  }
  return boardingPoint(world,ship,buildings);
}
export function transportBow(ship){const length=shipDimensions(ship).length;return {x:ship.x+Math.sin(ship.angle)*length/2,y:ship.y-Math.cos(ship.angle)*length/2};}
// Moored at a dock the bow faces the sea, so vehicles cross a side gate from the
// pier into the forward well deck instead of the bow ramp.
export const TRANSPORT_WELL = .2;
// The same gate used for loading is accessible to an on-foot driver.
export function shoreCargoError(world,buildings,ship,person){
  if(!ship?.cargo||!isTransport(ship))return 'No vehicle aboard this transport.';
  if(ship.occupant)return 'The transport helm is occupied.';
  const gate=driveGate(world,buildings,ship);
  if(!gate||Math.hypot(person.x-gate.x,person.y-gate.y)>TRANSPORT.reach)return 'Stand within four tiles of the vehicle loading gate.';
  return null;
}
export function pierGate(world,buildings,ship,dock){
  const owner=dockRecords(world).find(s=>s.dock===dock),pier=owner&&dockRects(owner)[1];if(!pier)return null;
  const size=shipDimensions(ship),fx=Math.sin(ship.angle),fy=-Math.cos(ship.angle),rx=Math.cos(ship.angle),ry=Math.sin(ship.angle);
  const wx=ship.x+fx*size.length*TRANSPORT_WELL,wy=ship.y+fy*size.length*TRANSPORT_WELL,side=Math.sign((pier.x-ship.x)*rx+(pier.y-ship.y)*ry)||1;
  for(let extra=.3;extra<=4.5;extra+=.4){const p={x:wx+rx*side*(size.width/2+extra),y:wy+ry*side*(size.width/2+extra)};if(dockFloorAt(world,Math.floor(p.x),Math.floor(p.y))&&canStand(world,buildings,p.x,p.y,null,.42))return p;}
  return null;
}
// Small, local ground search: loading cannot reach across water or solid cover.
function route(world,buildings,people,from,to,ignoreId){
  const filtered={...world,tanks:(world.tanks||[]).filter(v=>v.id!==ignoreId)};
  const clear=(x,y)=>canStand(filtered,buildings,x,y,null,.42)&&
    !(world.logistics?.recyclers||[]).some(v=>v.id!==ignoreId&&Math.abs(v.x-x)<.84&&Math.abs(v.y-y)<.84)&&
    !people.some(p=>p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&p.body!=='aircraft'&&Math.hypot(p.x-x,p.y-y)<.85);
  if(!clear(from.x,from.y)||!clear(to.x,to.y))return false;
  const queue=[{x:Math.floor(from.x)+.5,y:Math.floor(from.y)+.5,n:0}],seen=new Set();
  for(let i=0;i<queue.length;i++){
    const p=queue[i],key=p.x+':'+p.y;if(seen.has(key))continue;seen.add(key);
    if(Math.floor(p.x)===Math.floor(to.x)&&Math.floor(p.y)===Math.floor(to.y))return true;
    if(p.n>=TRANSPORT.routeLimit)continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(clear(p.x+dx,p.y+dy))queue.push({x:p.x+dx,y:p.y+dy,n:p.n+1});
  }
  return false;
}
export function loadError(world,buildings,people,ship,cargo){
  if(ship?.cargo)return 'Unload the carried vehicle first.';
  const bank=cargoAccess(world,buildings,ship);
  if(!bank)return 'Stop at a dock or deploy a shore ramp before loading.';
  const v=cargo?.vehicle;if(!v)return 'Park an empty tank, recycler or builder near the shore point.';
  if(v.occupant)return 'Exit the vehicle before loading it.';
  if(Math.abs(v.speed||0)>.05||v.path?.length||v.task)return 'Park the vehicle and stop its remote orders first.';
  if(world.logistics?.bridges?.some(b=>b.builderId===v.id&&!bridgeReady(b)))return 'Finish the bridge before loading its builder.';
  if(Math.hypot(v.x-bank.x,v.y-bank.y)>TRANSPORT.reach)return 'Park within four tiles of the shore point.';
  if(!route(world,buildings,people,bank,v,v.id))return 'Clear a vehicle-width land route to the shore point.';
  return null;
}
export function unloadPoint(world,buildings,people,ship,drive=false){
  const bank=drive?driveGate(world,buildings,ship):cargoAccess(world,buildings,ship);if(!bank||!ship.cargo)return null;
  if(drive&&route(world,buildings,people,bank,bank,null))return bank;
  const candidates=[];
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    const p={x:Math.floor(bank.x)+dx+.5,y:Math.floor(bank.y)+dy+.5},d=Math.hypot(p.x-bank.x,p.y-bank.y);
    // Leave the pedestrian exit clear for the pilot.
    if(d>=1&&d<=3)candidates.push({...p,d});
  }
  return candidates.sort((a,b)=>a.d-b.d).find(p=>route(world,buildings,people,bank,p,null))||null;
}

// A short loading ramp joins the pier edge (or anchored beach ramp) to the hull.
export function driveGate(world,buildings,ship){
  const access=cargoAccess(world,buildings,ship);if(!access)return null;
  if(largeHull(ship))return access;
  if(ship.ramp)return {x:ship.ramp.x,y:ship.ramp.y};
  const dock=mooredDock(world,ship),owner=dockRecords(world).find(s=>s.dock===dock),pier=owner&&dockRects(owner)[1];
  if(!pier)return dock;
  const dx=ship.x-pier.x,dy=ship.y-pier.y,d=Math.hypot(dx,dy);
  return {x:pier.x+dx/d,y:pier.y+dy/d};
}
export function driveOnError(world,buildings,people,ship,cargo,driver,input){
  if(!isTransport(ship)||ship.occupant||ship.cargo)return 'The transport must have an empty helm and cargo bay.';
  const v=cargo.vehicle;
  if(v.occupant!==driver)return 'Drive your vehicle to the loading ramp.';
  const filtered={...world,tanks:(world.tanks||[]).filter(t=>t.id!==v.id)};
  const gate=driveGate(filtered,buildings,ship);
  if(!gate||Math.hypot(v.x-gate.x,v.y-gate.y)>TRANSPORT.gateReach)return 'Approach the marked vehicle ramp.';
  const throttle=-(input?.y||0),dx=Math.sin(v.angle||0)*throttle,dy=-Math.cos(v.angle||0)*throttle;
  if((ship.x-gate.x)*dx+(ship.y-gate.y)*dy<=.1)return 'Drive toward the transport to board.';
  if(world.logistics?.bridges?.some(b=>b.builderId===v.id&&!bridgeReady(b)))return 'Finish the bridge before boarding.';
  if(!route(filtered,buildings,people,gate,v,v.id))return 'Clear the loading ramp.';
  return null;
}
