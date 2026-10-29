import { shipStopped } from './ship-motion.js';
import { tileAt } from './world.js';
import { LARGE_DOCK } from './naval-scale.js';
import { isCarrier } from './carrier.js';
import { operational, hullHealth, VEHICLE, SHIP_REPAIR_DELAY } from './vehicle.js';
import { SHIP, shipSite, shipKind, dockComplete, canSail, hull, rectanglesOverlap, dockRects, hullCells, mooredDock, recallShipError } from './ship.js';

export const SHIPYARD = Object.freeze({ max: 8, perOwner: 4, buildTime: 12, wrecks: 24 });
// Bind a confirmation to every part of the displayed site, including which side
// holds the berth. The server still derives and validates all geometry itself.
export function shipyardPreview(ship){
  if(!ship)return null;
  return {siteX:ship.siteX,siteY:ship.siteY,dockX:ship.dock.x,dockY:ship.dock.y,dockAngle:ship.dock.angle,
    berthX:ship.berthX,berthY:ship.berthY,dockScale:ship.dockScale??1};
}
export function matchesShipyardPreview(ship,preview){
  const current=shipyardPreview(ship);
  return !!current&&!!preview&&typeof preview==='object'&&!Array.isArray(preview)&&
    Object.entries(current).every(([key,value])=>Number.isFinite(preview[key])&&preview[key]===value);
}
export function yardRetireError(world,yard,people=[]){
  if(!yard)return 'Select an empty dock first.';
  if((world.ships||[]).some(s=>(s.yardId||s.id)===yard.id)||world.logistics?.jobs?.[yard.id])return 'Retire its vessel and finish construction first.';
  return recallShipError(world,{...yard,destroyed:true},people);
}
// Old saves and isolated domain fixtures still carry their dock on the hull.
export function dockRecords(world) {
  const yards = world.logistics?.shipyards || [];
  return [...yards.filter(y=>!y.supersededBy), ...(world.ships || []).filter(s => !yards.some(y => y.id === (s.yardId || s.id)))];
}
export function yardFromShip(s) {
  return { id: s.yardId || s.id, owner: s.owner, dock: { ...s.dock }, dockStyle: s.dockStyle, dockScale:s.dockScale,
    berthX: s.berthX, berthY: s.berthY, angle: s.dock.angle, siteX: s.siteX, siteY: s.siteY,
    requestX:s.requestX, requestY:s.requestY,
    elapsed: s.dockReady ? SHIP.duration : s.elapsed, dockReady: dockComplete(s), dockDestroyed: !!s.dockDestroyed };
}
export function linkYard(ship, yard) {
  if(ship.berthX===undefined){ship.navalScale=yard.dockScale===2?2:1;if(ship.navalScale===2)ship.aftTurret??=(ship.angle||0)+Math.PI;}
  Object.assign(ship, { yardId: yard.id, dock: yard.dock, dockStyle: yard.dockStyle,
    dockScale:yard.dockScale,
    berthX: yard.berthX, berthY: yard.berthY, siteX: yard.siteX, siteY: yard.siteY,
    dockReady: dockComplete(yard), dockDestroyed: !!yard.dockDestroyed });
}
export function syncShipyards(world) {
  for (const ship of world.ships || []) {
    const yard = world.logistics?.shipyards?.find(y => y.id === (ship.yardId || ship.id));
    if (yard) linkYard(ship, yard);
  }
}
export function shipyardSite(world, buildings, occupants, x, y, owner,layoutVersion=1) {
  const yards = dockRecords(world).filter(y=>!y.dockDestroyed);
  if (yards.length >= SHIPYARD.max || yards.filter(y => y.owner === owner).length >= SHIPYARD.perOwner)
    return { error: 'Shipyard limit: four per scout, eight per campaign.', ship: null };
  const ruin=yardsAtRuinedSite(world,x,y,owner);
  if(!ruin)return layoutVersion===2?nearbyShipyardSite(world,buildings,occupants,x,y,owner):shipSite(world, buildings, occupants, x, y, owner, 'gunship', 'unfolding', null, true,null,layoutVersion);
  const survivor=(world.ships||[]).find(s=>!s.destroyed&&s.owner===owner&&(s.yardId||s.id)===ruin.id);
  // Hide only this abandoned deck during validation. The surviving hull still
  // blocks the new pier; only its own reserved berth may contain that hull.
  const all=dockRecords(world),placement={...world,logistics:{...world.logistics,shipyards:all.map(y=>y.id===ruin.id?{...y,supersededBy:'placement'}:y)}};
  const people=occupants.filter(p=>!survivor||p.id!==survivor.occupant);
  const site=shipSite(placement,buildings,people,x,y,owner,'gunship','unfolding',ruin,true,survivor?.id);
  if(!site.error)Object.assign(site.ship,{replacesYardId:ruin.id,survivingShipId:survivor?.id||null});
  return site;
}
// Keep saved/canonical site coordinates separate from the player's click. Search
// is bounded, deterministic and shared by preview and authoritative admission.
function nearbyShipyardSite(world,buildings,occupants,x,y,owner){
  const fail=error=>({error,ship:null});
  if(![x,y].every(Number.isInteger)||x<0||y<0||x>=world.width||y>=world.height)return fail('Select shore or nearby ocean for the dock.');
  const check=(sx,sy)=>shipSite(world,buildings,occupants,sx,sy,owner,'gunship','unfolding',null,true,null,2);
  const accepted=site=>{Object.assign(site.ship,{requestX:x,requestY:y});return site;};
  const exact=check(x,y);if(!exact.error)return accepted(exact);
  const candidates=[],seen=new Set(),radius=LARGE_DOCK.length,half=(LARGE_DOCK.width-1)/2;
  for(let ay=Math.max(0,y-radius);ay<=Math.min(world.height-1,y+radius);ay++)for(let ax=Math.max(0,x-radius);ax<=Math.min(world.width-1,x+radius);ax++){
    const distance=(ax-x)**2+(ay-y)**2;if(distance>radius**2)continue;
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
      let land=false,clear=true;
      for(let across=-half;across<=half;across++){
        const sx=ax-dy*across,sy=ay+dx*across;
        if(sx<0||sy<0||sx>=world.width||sy>=world.height){clear=false;break;}
        if(tileAt(world,sx,sy)!==0)land=true;
        // The first offshore row must clear even on a zigzag coastline.
        if(tileAt(world,sx+dx,sy+dy)!==0){clear=false;break;}
      }
      if(!clear||!land)continue;
      const sx=ax+dx*LARGE_DOCK.siteDistance,sy=ay+dy*LARGE_DOCK.siteDistance,key=sx+':'+sy;
      if(seen.has(key))continue;seen.add(key);candidates.push({x:sx,y:sy,distance});
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
  for(const p of candidates){const site=check(p.x,p.y);if(!site.error)return accepted(site);}
  return fail('No clear dock site nearby. Select shore or ocean within 12 tiles of land. The 7 x 1 platform must touch clear land; the 7 x 12 pier, side berth and departure route need open ocean.');
}
export const yardsAtRuinedSite=(world,x,y,owner)=>dockRecords(world).find(d=>d.dockDestroyed&&d.owner===owner&&d.dockStyle==='unfolding'&&d.siteX===x&&d.siteY===y);
export function yardBuildError(world, yard, owner, kind, previous = null, people = []) {
  if (!yard || yard.owner !== owner) return 'Choose your own shipyard.';
  if (!['gunship', 'submarine', 'transport','carrier'].includes(kind)) return 'Choose a supported vessel.';
  if (yard.dockDestroyed) return 'Dock destroyed permanently. Deploy a new shipyard.';
  if (!dockComplete(yard) || world.logistics?.jobs?.[yard.id]) return 'Wait for the shipyard to finish assembly or repairs.';
  if ((world.ships || []).some(s => !s.destroyed && s.id !== previous?.id && (s.yardId || s.id) === yard.id)) return 'This shipyard already supports a vessel. Retire it before changing type.';
  if (world.ships.filter(s=>!s.destroyed&&s.id!==previous?.id).length >= SHIP.max) return 'Fleet limit: four vessels per campaign.';
  if([previous?.aircraft,previous?.wing?.aircraft].some(p=>p&&!['vacant','destroyed'].includes(p.state))&&kind!=='carrier')return 'An airborne aircraft still uses this carrier slot. Rebuild as a carrier.';
  if (previous && (!previous.destroyed || previous.replacement > .001)) return 'Wait for the lost vessel replacement countdown.';
  const next = { ...yard, kind, navalScale:yard.dockScale===2?2:1, id: previous?.id || 'preview', x: yard.berthX, y: yard.berthY, angle: yard.dock.angle };
  if (!canSail(world, next, next.x, next.y, next.angle, true)) return 'Clear the shipyard water berth.';
  if (people.some(p => p.body !== 'aircraft' && p.life !== 'disabled' && (p.hp === undefined || p.hp > 0) && rectanglesOverlap(hull(next, true), { x: p.x, y: p.y, w: .8, h: .8, angle: 0 }))) return 'A unit blocks the shipyard berth.';
  return null;
}
export function rememberWreck(world, ship) {
  if (!ship.destroyed || ship.wreckRecorded) return false;
  const wrecks = world.logistics.wrecks ||= [];
  wrecks.push({ id: ship.id + ':' + (ship.hurt || 0), kind: shipKind(ship), navalScale:ship.navalScale, x: ship.x, y: ship.y, angle: ship.angle });
  if (wrecks.length > SHIPYARD.wrecks) wrecks.splice(0, wrecks.length - SHIPYARD.wrecks);
  ship.wreckRecorded = true;
  return true;
}

export const DOCK_REPAIR = Object.freeze({ rate: 10, perHp: .2, delay: SHIP_REPAIR_DELAY });
export function tickDockRepair(world, ship, dt) {
  const oldDelay=ship.repairDelay||0,wasRepairing=!!ship.repairing;
  ship.repairDelay=Math.max(0,oldDelay-dt);ship.repairing=false;
  if(isCarrier(ship)||!operational(ship)||ship.assemblyRemaining>0||ship.repairDelay>0||!shipStopped(ship)||hullHealth(ship)>=VEHICLE.ship)return wasRepairing||oldDelay>0;
  const dock=mooredDock(world,ship),yard=dockRecords(world).find(y=>y.dock===dock);
  if(!yard||world.logistics?.jobs?.[yard.id])return wasRepairing||oldDelay>0;
  const restored=Math.min(VEHICLE.ship-hullHealth(ship),DOCK_REPAIR.rate*dt,world.logistics.groundSupplies/DOCK_REPAIR.perHp);
  if(!(restored>0))return wasRepairing||oldDelay>0;
  ship.health=Math.min(VEHICLE.ship,hullHealth(ship)+restored);
  world.logistics.groundSupplies=Math.max(0,world.logistics.groundSupplies-restored*DOCK_REPAIR.perHp);
  ship.repairing=true;ship.repairTime=(ship.repairTime||0)+dt;
  return true;
}
export function nearbyShipyard(world, person) {
  if(!person||person.body!=='robot'||person.life==='disabled')return null;
  const choices=dockRecords(world).filter(y=>y.owner===person.id&&dockComplete(y)).map(y=>{
    const points=[y.dock,...dockRects(y).flatMap(hullCells).map(p=>({x:p.x+.5,y:p.y+.5}))];
    const point=points.sort((a,b)=>Math.hypot(a.x-person.x,a.y-person.y)-Math.hypot(b.x-person.x,b.y-person.y))[0];
    return {yard:y,...point,distance:Math.hypot(point.x-person.x,point.y-person.y)};
  }).filter(p=>p.distance<=1.4).sort((a,b)=>a.distance-b.distance);
  return choices[0]||null;
}

// Assignment reserves production; a visiting friendly vessel may still use the berth.
export function dockBoardingShip(world,yard) {
  if(!yard)return null;
  return (world.ships||[]).filter(s=>operational(s)&&mooredDock(world,s)===yard.dock)
    .sort((a,b)=>Number(!!a.occupant)-Number(!!b.occupant))[0]||null;
}
