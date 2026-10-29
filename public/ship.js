import { fieldHelicopterBlocks } from './footprints.js';
import { inlandWaterAt } from './terrain-rules.js';
import { largeHull, dockDimensions, shipDimensions } from './naval-scale.js';
import { driveShip, stopShip, shipStopped } from './ship-motion.js';
import { isCarrier, CARRIER, deckLocked, aircraftHolders, wingId } from './carrier.js';
import { dockRecords, SHIPYARD } from './shipyard.js';
import { bridgeAt, bridgeDeckAt } from './bridge-geometry.js';
import { airbaseAt } from './footprints.js';
import { surfaced } from './submarine-depth.js';
import { POD } from './pod.js';
import { tileAt, waterTileAt, canStand } from './world.js';
import { artilleryBlocks, railCorridor } from './footprints.js';
import { angleDelta } from './turret.js';
import { hullPoint, operational } from './vehicle.js';

export const SHIP = Object.freeze({ ...POD, max:4, width:2, length:4, speed:2.5, reverse:1.5, turnSpeed:Math.PI/5, turretSpeed:Math.PI/3, minRange:6, range:100, reload:6, dockRange:.8, boardRange:1.4 });
export const shipKind = ship => isCarrier(ship)?'carrier':ship?.kind==='submarine'?'submarine':ship?.kind==='transport'?'transport':'gunship';
export const shipName = ship => isCarrier(ship)?'Aircraft carrier':shipKind(ship)==='submarine'?'Missile submarine':shipKind(ship)==='transport'?'Armored transport':'Coastal gunship';
export function hull(ship, cradle=false) {
  const d=shipDimensions(ship),dock=dockDimensions(ship);
  return { x:cradle?ship.berthX:ship.x, y:cradle?ship.berthY:ship.y, angle:cradle?ship.dock.angle:ship.angle, w:cradle?dock.berthWidth:d.width, h:cradle?dock.berthLength:d.length };
}
// Separating axes for two rectangles; exact oriented clearance, not a square apron.
export function rectanglesOverlap(a,b) {
  const axes = r => [{x:Math.cos(r.angle),y:Math.sin(r.angle)},{x:-Math.sin(r.angle),y:Math.cos(r.angle)}];
  const aa=axes(a),bb=axes(b),dx=b.x-a.x,dy=b.y-a.y;
  for(const n of [...aa,...bb]) {
    const extent=(r,axes)=>Math.abs(n.x*axes[0].x+n.y*axes[0].y)*r.w/2+Math.abs(n.x*axes[1].x+n.y*axes[1].y)*r.h/2;
    if(Math.abs(dx*n.x+dy*n.y)>=extent(a,aa)+extent(b,bb)-1e-8)return false;
  }
  return true;
}
export function hullCells(rect) {
  const cells=[],r=Math.hypot(rect.w,rect.h)/2;
  for(let y=Math.floor(rect.y-r);y<=Math.floor(rect.y+r);y++)for(let x=Math.floor(rect.x-r);x<=Math.floor(rect.x+r);x++)if(rectanglesOverlap(rect,{x:x+.5,y:y+.5,w:1,h:1,angle:0}))cells.push({x,y});
  return cells;
}
export function dockRects(ship) {
  if(ship.dockStyle!=='unfolding')return [];
  const d=ship.dock,dx=Math.sin(d.angle),dy=-Math.cos(d.angle);
  const size=dockDimensions(ship),offset=(size.length+1)/2;
  return [{x:d.x,y:d.y,w:size.width,h:1,angle:d.angle},{x:d.x+dx*offset,y:d.y+dy*offset,w:size.width,h:size.length,angle:d.angle}];
}
export const dockComplete = ship => ship.dockReady || ship.elapsed >= SHIP.duration;
// Larger berths need practical manual parking tolerance; legacy docks keep theirs.
export const dockMooringRange = yard => yard.dockScale === 2 ? 1.5 : SHIP.dockRange;
export function dockFloorAt(world,x,y){
  return dockRecords(world).some(s=>dockComplete(s)&&dockRects(s).some(r=>rectanglesOverlap(r,{x:x+.5,y:y+.5,w:1,h:1,angle:0})));
}
export const dockAt = (world,x,y) => dockRecords(world).some(s=>dockRects(s).some(r=>rectanglesOverlap(r,{x:x+.5,y:y+.5,w:1,h:1,angle:0}))||(Math.floor(s.dock.x)===x&&Math.floor(s.dock.y)===y))||(world.ships||[]).some(s=>!s.destroyed&&s.ramp&&Math.floor(s.ramp.x)===x&&Math.floor(s.ramp.y)===y);
export function shipBlocks(world,x,y,radius=.21) {
  if([-radius,radius].every(dx=>[-radius,radius].every(dy=>bridgeDeckAt(world,x+dx,y+dy))))return false;
  return world.ships?.some(s=>!s.destroyed&&rectanglesOverlap(hull(s,s.elapsed<SHIP.duration),{x,y,w:radius*2,h:radius*2,angle:0}))||false;
}
export function canSail(world,ship,x=ship.x,y=ship.y,angle=ship.angle,cradle=false) {
  const rect=cradle?hull(ship,true):hull({...ship,x,y,angle});
  if(hullCells(rect).some(cell=>inlandWaterAt(world,cell.x,cell.y)))return false;
  for(const cell of hullCells(rect))if(cell.x<0||cell.y<0||cell.x>=world.width||cell.y>=world.height||waterTileAt(world,cell.x,cell.y)!==0||(cradle&&bridgeDeckAt(world,cell.x,cell.y))||artilleryBlocks(world,cell.x,cell.y))return false;
  if(dockRecords(world).some(s=>dockRects(s).some(r=>rectanglesOverlap(rect,r))))return false;
  return !(world.ships||[]).some(s=>!s.destroyed&&s.id!==ship.id&&rectanglesOverlap(rect,hull(s,s.elapsed<SHIP.duration)));
}
/** @param {{dock:{x:number,y:number,angle:number},berthX:number,berthY:number} | null} [original] */
export function shipSite(world,buildings,occupants,x,y,owner,kind='gunship',dockStyle='legacy',original=null,yardOnly=false,residentId=null,layoutVersion=1) {
  const fail=error=>({error,ship:null});
  if(!['gunship','submarine','transport','carrier'].includes(kind))return fail('Choose a gunship, missile submarine or armored transport.');
  if(!['legacy','unfolding'].includes(dockStyle))return fail('Choose a supported dock layout.');
  if(![x,y].every(Number.isInteger))return fail('Select a coastal water tile for the ship center.');
  if(dockRecords(world).filter(d=>!d.dockDestroyed).length>=SHIPYARD.max||dockRecords(world).filter(d=>!d.dockDestroyed&&d.owner===owner).length>=SHIPYARD.perOwner)return fail('Shipyard limit: four per scout, eight per campaign.');
  if(!yardOnly&&world.ships?.some(s=>!s.destroyed&&s.owner===owner&&shipKind(s)===kind))return fail('One '+shipName({kind}).toLowerCase()+' per scout in this field test.');
  if(!yardOnly&&(world.ships?.filter(s=>!s.destroyed).length||0)>=SHIP.max)return fail('This field test allows four ships.');
  if(x<0||y<0||x>=world.width||y>=world.height||tileAt(world,x,y)!==0)return fail('The ship needs open water. Choose a coastal water tile.');
  const dockScale=original?.dockScale??layoutVersion,size=dockDimensions({dockScale});
  for(const distance of dockStyle==='unfolding'?[size.siteDistance]:[3,4,5])for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]) {
    const dock={x:x+.5+dx*distance,y:y+.5+dy*distance,angle:Math.atan2(-dx,dy)};
    if(original&&(Math.hypot(dock.x-original.dock.x,dock.y-original.dock.y)>.001||Math.abs(angleDelta(dock.angle,original.dock.angle))>.001))continue;
    const unevenShore=dockStyle==='unfolding'&&dockScale===2;
    if(bridgeAt(world,dock.x,dock.y)||airbaseAt(world,dock.x,dock.y)||(!canStand(world,buildings,dock.x,dock.y)&&!(unevenShore&&tileAt(world,dock.x,dock.y)===0))||dockAt(world,Math.floor(dock.x),Math.floor(dock.y))||railCorridor(world,Math.floor(dock.x),Math.floor(dock.y)))continue;
    if(occupants.some(p=>p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&Math.hypot(p.x-dock.x,p.y-dock.y)<.8))continue;
    let clear=true;for(let step=1;step<distance;step++)if(tileAt(world,x+dx*step,y+dy*step)!==0)clear=false;
    if(!clear)continue;
    const ship={id:residentId||'preview',kind,owner,x:x+.5,y:y+.5,berthX:x+.5,berthY:y+.5,dock,angle:dock.angle,turret:dock.angle,elapsed:0,ammo:'HE',reload:0,occupant:null};
    if(dockStyle==='unfolding'){
      Object.assign(ship,{dockStyle,siteX:x,siteY:y,...(dockScale===2?{dockScale:2,navalScale:2}:{})});
      const rects=dockRects(ship),cells=rects.flatMap(hullCells);
      if(cells.some(cell=>fieldHelicopterBlocks(world,cell.x+.5,cell.y+.5,.5)||cell.x<0||cell.y<0||cell.x>=world.width||cell.y>=world.height||bridgeAt(world,cell.x,cell.y)||dockAt(world,cell.x,cell.y)||railCorridor(world,cell.x,cell.y)||airbaseAt(world,cell.x,cell.y)||artilleryBlocks(world,cell.x,cell.y)))continue;
      // A large shore platform can bridge the water gaps of a stepped coast,
      // but must touch clear land. The full offshore pier remains ocean-only.
      const shore=hullCells(rects[0]),land=shore.filter(cell=>tileAt(world,cell.x,cell.y)!==0);
      if(!land.length||(!unevenShore&&land.length!==shore.length)||land.some(cell=>!canStand(world,buildings,cell.x+.5,cell.y+.5))||shore.some(cell=>inlandWaterAt(world,cell.x,cell.y)))continue;
      if(hullCells(rects[1]).some(cell=>tileAt(world,cell.x,cell.y)!==0||inlandWaterAt(world,cell.x,cell.y)))continue;
      if(rects.some(r=>(world.ships||[]).some(s=>!s.destroyed&&(rectanglesOverlap(r,hull(s,s.elapsed<SHIP.duration))||rectanglesOverlap(r,hull(s,true))))||occupants.some(p=>p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&rectanglesOverlap(r,{x:p.x,y:p.y,w:.8,h:.8,angle:0}))))continue;
      // The ship arrives alongside the dock; either side is valid if clear.
      let found=false;
      for(const side of [1,-1]){
        ship.x=ship.berthX=x+.5+Math.cos(dock.angle)*size.berthOffset*side;ship.y=ship.berthY=y+.5+Math.sin(dock.angle)*size.berthOffset*side;
        if(original&&Math.hypot(ship.berthX-original.berthX,ship.berthY-original.berthY)>.001)continue;
        const largest={...ship,kind:'carrier'},exitX=ship.x+Math.sin(ship.angle)*15,exitY=ship.y-Math.cos(ship.angle)*15;
        const approachClear=dockScale!==2||(Array.from({length:16},(_,i)=>i).every(step=>canSail(world,largest,ship.x+Math.sin(ship.angle)*step,ship.y-Math.cos(ship.angle)*step,ship.angle))&&Array.from({length:16},(_,i)=>i*Math.PI/8).every(angle=>canSail(world,largest,exitX,exitY,angle)));
        if(approachClear&&canSail(world,ship,ship.x,ship.y,ship.angle,true)&&!dockRecords(world).some(s=>!s.dockDestroyed&&rectanglesOverlap(hull(ship,true),hull(s,true)))&&!occupants.some(p=>rectanglesOverlap(hull(ship,true),{x:p.x,y:p.y,w:.8,h:.8,angle:0}))){found=true;break;}
      }
      if(!found)continue;
    }
    if(!canSail(world,ship,ship.x,ship.y,ship.angle,true))continue;
    if(dockRecords(world).some(s=>!s.dockDestroyed&&rectanglesOverlap(hull(ship,true),hull(s,true))))continue;
    if(occupants.some(p=>rectanglesOverlap(hull(ship,true),{x:p.x,y:p.y,w:.8,h:.8,angle:0})))continue;
    return {error:null,ship};
  }
  return fail(dockStyle==='unfolding'?`Need ${size.width} clear shore tiles, a ${size.width} x ${size.length} offshore dock and an open berth beside it. Select water ${size.siteDistance} tiles from shore.`:'Need a clear 3 x 5 water cradle and accessible shore 3 to 5 tiles away. Try farther along the coast.');
}
// Recall the saved deployment as a pair; never leave a live crew without a berth.
export function recallShipError(world,ship,people=[],keepYard=false,aircraftHandled=false) {
  if(!ship)return 'Choose your ship first.';
  if(ship.elapsed<SHIP.duration)return 'Wait for deployment to finish before recalling it.';
  const pier=dockRects(ship)[1];
  if(!keepYard&&pier){
    const blocking=[...people,...(world.tanks||[]).filter(v=>!v.destroyed).map(v=>({...v,body:'tank'})),...(world.logistics?.recyclers||[]).filter(v=>!v.destroyed).map(v=>({...v,body:v.kind==='builder'?'bridge builder':'recycler'}))].find(p=>p.body!=='aircraft'&&p.body!=='ship'&&p.life!=='disabled'&&rectanglesOverlap(pier,{x:p.x,y:p.y,w:.84,h:.84,angle:0}));
    if(blocking){const name=blocking.id===ship.owner?'Your robot':blocking.name||blocking.body||'A ground unit';return `${name} is on the offshore dock at ${Math.floor(blocking.x)}:${Math.floor(blocking.y)}. Move onto land before dismantling the dock; its flooring will disappear.`;}
  }
  const deck=[ship.id,wingId(ship)];
  if(!aircraftHandled&&isCarrier(ship)&&aircraftHolders(world).some(b=>!['destroyed','vacant'].includes(b.aircraft.state)&&(deck.includes(b.id)||deck.includes(b.aircraft.baseId))))return 'Carrier aircraft still assigned. Launch parked aircraft, then use H to recall each to another free runway before exchanging or retiring this carrier. Old sea wrecks do not block exchange.';
  if(ship.cargo)return 'Unload the vehicle before recalling this ship.';
  if(ship.occupant)return 'Disembark before recalling the ship and dock.';
  if(ship.launchRemaining>0)return 'Wait for the missile launch to finish.';
  if(!ship.destroyed&&(!surfaced(ship)||Math.hypot(ship.x-ship.berthX,ship.y-ship.berthY)>dockMooringRange(ship)||Math.abs(Math.sin(angleDelta(ship.angle,ship.dock.angle)))>=Math.sin(Math.PI/8)))return 'Return the ship to its original dock, surface and disembark first.';
  if(world.ships.some(s=>s.id!==ship.id&&!s.destroyed&&Math.hypot(s.x-ship.berthX,s.y-ship.berthY)<=SHIP.dockRange))return 'Another ship is using this dock. Move it away first.';
  return null;
}
export function mooredDock(world,ship) {
  if(!surfaced(ship)||!shipStopped(ship))return null;
  return dockRecords(world).find(s=>!s.dockDestroyed&&dockComplete(s)&&Math.hypot(ship.x-s.berthX,ship.y-s.berthY)<=dockMooringRange(s)&&Math.abs(Math.sin(angleDelta(ship.angle,s.dock.angle)))<Math.sin(Math.PI/8))?.dock||null;
}
// Replacement uses an existing dock. People on its shore platform do not block
// rebuilding the hull alongside it; only the reserved water cradle must clear.
export function replacementShipError(world,people,ship){
  if(!ship?.destroyed)return 'Choose a destroyed ship.';
  if(ship.dockDestroyed)return 'Dock destroyed permanently. Deploy a new shipyard.';
  if(world.logistics?.jobs?.[ship.yardId||ship.id])return 'Wait for dock repairs to finish.';
  if(ship.replacement>.001)return 'Replacement ready in '+Math.ceil(ship.replacement)+'s.';
  const next={...ship,x:ship.berthX,y:ship.berthY,angle:ship.dock.angle};
  if(!canSail(world,next,next.x,next.y,next.angle,true))return 'Clear the water berth beside the existing dock.';
  const cradle=hull(next,true);
  if(people.some(p=>p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&p.body!=='aircraft'&&rectanglesOverlap(cradle,{x:p.x,y:p.y,w:.8,h:.8,angle:0})))return 'A unit blocks the dock berth. Move it away before rebuilding.';
  return null;
}
export const SHORE_RAMP = Object.freeze({reach:2, width:.42});
// Validate the entire narrow crossing: only the endpoint tile may be land.
export function rampClear(world,buildings,ship,point) {
  if(!surfaced(ship)||!operational(ship)||![point?.x,point?.y].every(Number.isFinite)||!canStand(world,buildings,point.x,point.y))return false;
  // Large transports land vehicles over a bow ramp, straight ahead of the stem.
  const bowRamp=largeHull(ship)&&ship.kind==='transport',size=shipDimensions(ship);
  const start=bowRamp?{x:ship.x+Math.sin(ship.angle)*size.length/2,y:ship.y-Math.cos(ship.angle)*size.length/2}:hullPoint(ship,point),dx=point.x-start.x,dy=point.y-start.y,d=Math.hypot(dx,dy);
  if(bowRamp&&(dx*Math.sin(ship.angle)-dy*Math.cos(ship.angle)<=0||Math.abs(dx*Math.cos(ship.angle)+dy*Math.sin(ship.angle))>.5))return false;
  if(d<.25||d>(largeHull(ship)&&ship.kind==='transport'?3.5:SHORE_RAMP.reach)+1e-8)return false;
  const steps=Math.ceil(d/.12),nx=-dy/d*SHORE_RAMP.width/2,ny=dx/d*SHORE_RAMP.width/2;
  for(let i=1;i<=steps;i++)for(const side of [-1,0,1]){
    const x=start.x+dx*i/steps+nx*side,y=start.y+dy*i/steps+ny*side;
    const endpoint=Math.floor(x)===Math.floor(point.x)&&Math.floor(y)===Math.floor(point.y);
    if(x<0||y<0||x>=world.width||y>=world.height||(!endpoint&&tileAt(world,x,y)!==0)||artilleryBlocks(world,x,y))return false;
    if((world.ships||[]).some(s=>s.id!==ship.id&&!s.destroyed&&rectanglesOverlap(hull(s,s.elapsed<SHIP.duration),{x,y,w:.12,h:.12,angle:0})))return false;
  }
  return true;
}
export function shoreRampSite(world,buildings,occupants,ship) {
  if(!surfaced(ship)||!operational(ship)||!shipStopped(ship)||!canSail(world,ship))return null;
  const candidates=[],r=shipDimensions(ship).length/2+SHORE_RAMP.reach+1;
  for(let y=Math.max(0,Math.floor(ship.y-r));y<Math.min(world.height,ship.y+r);y++)for(let x=Math.max(0,Math.floor(ship.x-r));x<Math.min(world.width,ship.x+r);x++){
    if(bridgeAt(world,x,y)||airbaseAt(world,x,y)||tileAt(world,x,y)===0||dockAt(world,x,y)||railCorridor(world,x,y))continue;
    const p={x:x+.5,y:y+.5};
    if(occupants.some(v=>v.id!==ship.occupant&&v.life!=='disabled'&&(v.hp===undefined||v.hp>0)&&Math.hypot(v.x-p.x,v.y-p.y)<.8)||!rampClear(world,buildings,ship,p))continue;
    candidates.push(p);
  }
  candidates.sort((a,b)=>Math.hypot(a.x-ship.x,a.y-ship.y)-Math.hypot(b.x-ship.x,b.y-ship.y)||a.y-b.y||a.x-b.x);
  return candidates[0]||null;
}
/** @param {{x:number,y:number}|null} [near] */
export function boardingPoint(world,ship,buildings=[],near=null,people=[]) {
  if(!shipStopped(ship))return null;
  const clear=p=>canStand(world,buildings,p.x,p.y)&&!people.some(v=>v.id!==ship.occupant&&v.id!==near?.id&&v.life!=='disabled'&&(v.hp===undefined||v.hp>0)&&Math.hypot(v.x-p.x,v.y-p.y)<.8);
  const p=ship.ramp;
  if(p&&Math.hypot(ship.x-p.shipX,ship.y-p.shipY)<.001&&Math.abs(angleDelta(ship.angle,p.shipAngle))<.001&&rampClear(world,buildings,ship,p)&&clear(p))return p;
  const dock=mooredDock(world,ship);
  if(!dock)return null;
  const owner=dockRecords(world).find(s=>s.dock===dock),rects=dockRects(owner);
  const points=[dock,...rects.flatMap(hullCells).map(p=>({x:p.x+.5,y:p.y+.5}))];
  const origin=near||dock;
  return points.filter(clear).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))[0]||null;
}
export function sailStep(world,ship,steer,throttle,dt) {
  if(deckLocked(world,ship)||ship.ramp||(shipKind(ship)!=='submarine'&&ship.launchRemaining>0))return stopShip(ship);
  return driveShip(ship,steer,throttle,dt,isCarrier(ship)?CARRIER:SHIP,(x,y,angle)=>canSail(world,ship,x,y,angle));
}
export function shipSolution(ship,target) {
  const distance=target?Math.hypot(target.x-ship.x,target.y-ship.y):SHIP.minRange;
  const range=Math.max(SHIP.minRange,Math.min(SHIP.range,distance));
  return{x:ship.x+Math.sin(ship.turret)*range,y:ship.y-Math.cos(ship.turret)*range,range,inRange:distance>=SHIP.minRange&&distance<=SHIP.range};
}
