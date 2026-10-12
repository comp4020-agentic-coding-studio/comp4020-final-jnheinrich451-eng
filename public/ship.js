import { airbaseAt } from './footprints.js';
import { surfaced } from './submarine-depth.js';
import { POD } from './pod.js';
import { tileAt, canStand } from './world.js';
import { artilleryBlocks, railCorridor } from './footprints.js';
import { angleDelta } from './turret.js';
import { hullPoint, operational } from './vehicle.js';

export const SHIP = Object.freeze({ ...POD, max:4, width:2, length:4, speed:2.5, reverse:1.5, turnSpeed:Math.PI/5, turretSpeed:Math.PI/3, minRange:6, range:40, reload:6, dockRange:.8, boardRange:1.4 });
export const shipKind = ship => ship?.kind==='submarine'?'submarine':'gunship';
export const shipName = ship => shipKind(ship)==='submarine'?'Missile submarine':'Coastal gunship';
export function hull(ship, cradle=false) {
  return { x:cradle?ship.berthX:ship.x, y:cradle?ship.berthY:ship.y, angle:cradle?ship.dock.angle:ship.angle, w:cradle?3:SHIP.width, h:cradle?5:SHIP.length };
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
  return [{x:d.x,y:d.y,w:3,h:1,angle:d.angle},{x:d.x+dx*3,y:d.y+dy*3,w:3,h:5,angle:d.angle}];
}
export const dockAt = (world,x,y) => world.ships?.some(s=>dockRects(s).some(r=>rectanglesOverlap(r,{x:x+.5,y:y+.5,w:1,h:1,angle:0}))||[s.dock,...(!s.destroyed&&s.ramp?[s.ramp]:[])].some(p=>Math.floor(p.x)===x&&Math.floor(p.y)===y));
export function shipBlocks(world,x,y,radius=.21) {
  return world.ships?.some(s=>!s.destroyed&&rectanglesOverlap(hull(s,s.elapsed<SHIP.duration),{x,y,w:radius*2,h:radius*2,angle:0}))||false;
}
export function canSail(world,ship,x=ship.x,y=ship.y,angle=ship.angle,cradle=false) {
  const rect=cradle?hull(ship,true):hull({...ship,x,y,angle});
  for(const cell of hullCells(rect))if(cell.x<0||cell.y<0||cell.x>=world.width||cell.y>=world.height||tileAt(world,cell.x,cell.y)!==0||artilleryBlocks(world,cell.x,cell.y))return false;
  if((world.ships||[]).some(s=>dockRects(s).some(r=>rectanglesOverlap(rect,r))))return false;
  return !(world.ships||[]).some(s=>!s.destroyed&&s.id!==ship.id&&rectanglesOverlap(rect,hull(s,s.elapsed<SHIP.duration)));
}
/** @param {{dock:{x:number,y:number,angle:number},berthX:number,berthY:number} | null} [original] */
export function shipSite(world,buildings,occupants,x,y,owner,kind='gunship',dockStyle='legacy',original=null) {
  const fail=error=>({error,ship:null});
  if(!['gunship','submarine'].includes(kind))return fail('Choose a coastal gunship or missile submarine.');
  if(!['legacy','unfolding'].includes(dockStyle))return fail('Choose a supported dock layout.');
  if(![x,y].every(Number.isInteger))return fail('Select a coastal water tile for the ship center.');
  if(world.ships?.some(s=>s.owner===owner&&shipKind(s)===kind))return fail('One '+shipName({kind}).toLowerCase()+' per scout in this field test.');
  if((world.ships?.length||0)>=SHIP.max)return fail('This field test allows four ships.');
  if(x<0||y<0||x>=world.width||y>=world.height||tileAt(world,x,y)!==0)return fail('The ship needs open water. Choose a coastal water tile.');
  for(let distance=3;distance<=5;distance++)for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]) {
    if(dockStyle==='unfolding'&&distance!==3)continue;
    const dock={x:x+.5+dx*distance,y:y+.5+dy*distance,angle:Math.atan2(-dx,dy)};
    if(original&&(Math.hypot(dock.x-original.dock.x,dock.y-original.dock.y)>.001||Math.abs(angleDelta(dock.angle,original.dock.angle))>.001))continue;
    if(airbaseAt(world,dock.x,dock.y)||!canStand(world,buildings,dock.x,dock.y)||dockAt(world,Math.floor(dock.x),Math.floor(dock.y))||railCorridor(world,Math.floor(dock.x),Math.floor(dock.y)))continue;
    if(occupants.some(p=>p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&Math.hypot(p.x-dock.x,p.y-dock.y)<.8))continue;
    let clear=true;for(let step=1;step<distance;step++)if(tileAt(world,x+dx*step,y+dy*step)!==0)clear=false;
    if(!clear)continue;
    const ship={id:'preview',kind,owner,x:x+.5,y:y+.5,berthX:x+.5,berthY:y+.5,dock,angle:dock.angle,turret:dock.angle,elapsed:0,ammo:'HE',reload:0,occupant:null};
    if(dockStyle==='unfolding'){
      Object.assign(ship,{dockStyle,siteX:x,siteY:y});
      const rects=dockRects(ship),cells=rects.flatMap(hullCells);
      if(cells.some(cell=>cell.x<0||cell.y<0||cell.x>=world.width||cell.y>=world.height||dockAt(world,cell.x,cell.y)||railCorridor(world,cell.x,cell.y)||airbaseAt(world,cell.x,cell.y)||artilleryBlocks(world,cell.x,cell.y)))continue;
      if(hullCells(rects[0]).some(cell=>tileAt(world,cell.x,cell.y)===0||!canStand(world,buildings,cell.x+.5,cell.y+.5)))continue;
      if(hullCells(rects[1]).some(cell=>tileAt(world,cell.x,cell.y)!==0))continue;
      if(rects.some(r=>(world.ships||[]).some(s=>rectanglesOverlap(r,hull(s,s.elapsed<SHIP.duration))||rectanglesOverlap(r,hull(s,true)))||occupants.some(p=>p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&rectanglesOverlap(r,{x:p.x,y:p.y,w:.8,h:.8,angle:0}))))continue;
      // The ship arrives alongside the dock; either side is valid if clear.
      let found=false;
      for(const side of [1,-1]){
        ship.x=ship.berthX=x+.5+Math.cos(dock.angle)*3*side;ship.y=ship.berthY=y+.5+Math.sin(dock.angle)*3*side;
        if(original&&Math.hypot(ship.berthX-original.berthX,ship.berthY-original.berthY)>.001)continue;
        if(canSail(world,ship,ship.x,ship.y,ship.angle,true)&&!(world.ships||[]).some(s=>rectanglesOverlap(hull(ship,true),hull(s,true)))&&!occupants.some(p=>rectanglesOverlap(hull(ship,true),{x:p.x,y:p.y,w:.8,h:.8,angle:0}))){found=true;break;}
      }
      if(!found)continue;
    }
    if(!canSail(world,ship,ship.x,ship.y,ship.angle,true))continue;
    if((world.ships||[]).some(s=>rectanglesOverlap(hull(ship,true),hull(s,true))))continue;
    if(occupants.some(p=>rectanglesOverlap(hull(ship,true),{x:p.x,y:p.y,w:.8,h:.8,angle:0})))continue;
    return {error:null,ship};
  }
  return fail(dockStyle==='unfolding'?'Need 3 clear shore tiles, a 3 x 5 offshore dock and open water beside it. Select water three tiles from shore.':'Need a clear 3 x 5 water cradle and accessible shore 3 to 5 tiles away. Try farther along the coast.');
}
// Recall the saved deployment as a pair; never leave a live crew without a berth.
export function recallShipError(world,ship) {
  if(!ship)return 'Choose your ship first.';
  if(ship.elapsed<SHIP.duration)return 'Wait for deployment to finish before recalling it.';
  if(ship.occupant)return 'Disembark before recalling the ship and dock.';
  if(ship.launchRemaining>0)return 'Wait for the missile launch to finish.';
  if(!ship.destroyed&&(!surfaced(ship)||Math.hypot(ship.x-ship.berthX,ship.y-ship.berthY)>SHIP.dockRange||Math.abs(Math.sin(angleDelta(ship.angle,ship.dock.angle)))>=Math.sin(Math.PI/8)))return 'Return the ship to its original dock, surface and disembark first.';
  if(world.ships.some(s=>s.id!==ship.id&&!s.destroyed&&Math.hypot(s.x-ship.berthX,s.y-ship.berthY)<=SHIP.dockRange))return 'Another ship is using this dock. Move it away first.';
  return null;
}
export function mooredDock(world,ship) {
  if(!surfaced(ship))return null;
  return (world.ships||[]).find(s=>s.elapsed>=SHIP.duration&&Math.hypot(ship.x-s.berthX,ship.y-s.berthY)<=SHIP.dockRange&&Math.abs(Math.sin(angleDelta(ship.angle,s.dock.angle)))<Math.sin(Math.PI/8))?.dock||null;
}
export const SHORE_RAMP = Object.freeze({reach:2, width:.42});
// Validate the entire narrow crossing: only the endpoint tile may be land.
export function rampClear(world,buildings,ship,point) {
  if(!surfaced(ship)||!operational(ship)||![point?.x,point?.y].every(Number.isFinite)||!canStand(world,buildings,point.x,point.y))return false;
  const start=hullPoint(ship,point),dx=point.x-start.x,dy=point.y-start.y,d=Math.hypot(dx,dy);
  if(d<.25||d>SHORE_RAMP.reach+1e-8)return false;
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
  if(!surfaced(ship)||!operational(ship)||!canSail(world,ship))return null;
  const candidates=[],r=SHIP.length/2+SHORE_RAMP.reach+1;
  for(let y=Math.max(0,Math.floor(ship.y-r));y<Math.min(world.height,ship.y+r);y++)for(let x=Math.max(0,Math.floor(ship.x-r));x<Math.min(world.width,ship.x+r);x++){
    if(airbaseAt(world,x,y)||tileAt(world,x,y)===0||dockAt(world,x,y)||railCorridor(world,x,y))continue;
    const p={x:x+.5,y:y+.5};
    if(occupants.some(v=>v.id!==ship.occupant&&v.life!=='disabled'&&(v.hp===undefined||v.hp>0)&&Math.hypot(v.x-p.x,v.y-p.y)<.8)||!rampClear(world,buildings,ship,p))continue;
    candidates.push(p);
  }
  candidates.sort((a,b)=>Math.hypot(a.x-ship.x,a.y-ship.y)-Math.hypot(b.x-ship.x,b.y-ship.y)||a.y-b.y||a.x-b.x);
  return candidates[0]||null;
}
export function boardingPoint(world,ship,buildings=[]) {
  const p=ship.ramp;
  if(p&&Math.hypot(ship.x-p.shipX,ship.y-p.shipY)<.001&&Math.abs(angleDelta(ship.angle,p.shipAngle))<.001&&rampClear(world,buildings,ship,p))return p;
  return mooredDock(world,ship);
}
export function sailStep(world,ship,steer,throttle,dt) {
  if(ship.ramp||ship.launchRemaining>0)return false;
  const steps=Math.max(1,Math.ceil(dt/.025));let changed=false;
  for(let i=0;i<steps;i++) {
    const step=dt/steps,angle=ship.angle+steer*SHIP.turnSpeed*step;
    if(steer&&canSail(world,ship,ship.x,ship.y,angle)){ship.angle=Math.atan2(Math.sin(angle),Math.cos(angle));changed=true;}
    const speed=throttle>0?SHIP.speed:SHIP.reverse;
    const x=ship.x+Math.sin(ship.angle)*throttle*speed*step,y=ship.y-Math.cos(ship.angle)*throttle*speed*step;
    if(throttle&&canSail(world,ship,x,y,ship.angle)){ship.x=x;ship.y=y;changed=true;}
  }
  return changed;
}
export function shipSolution(ship,target) {
  const distance=target?Math.hypot(target.x-ship.x,target.y-ship.y):SHIP.minRange;
  const range=Math.max(SHIP.minRange,Math.min(SHIP.range,distance));
  return{x:ship.x+Math.sin(ship.turret)*range,y:ship.y-Math.cos(ship.turret)*range,range,inRange:distance>=SHIP.minRange&&distance<=SHIP.range};
}
