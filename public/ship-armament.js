import { SHIP } from './ship.js';
import { shipArtScale, navalWeaponScale } from './naval-scale.js';
import { turnTurret, angleDelta } from './turret.js';
export const NAVAL_GUN = Object.freeze({range:8,halfArc:80*Math.PI/180,turnSpeed:Math.PI*1.5,tolerance:4*Math.PI/180});
export const MAIN_MOUNTS = Object.freeze([{id:'fore',label:'FORE',y:-1.05,key:'turret'},{id:'raised',label:'RAISED',y:-.37,key:'raisedTurret'},{id:'aft',label:'AFT',y:1.05,key:'aftTurret'}]);
export const SIDE_MOUNTS = Object.freeze([{id:'port',x:-1.02,center:-Math.PI/2,key:'portTurret'},{id:'starboard',x:1.02,center:Math.PI/2,key:'starboardTurret'}]);
export const TWIN_BATTERY = Object.freeze({damage:5,interval:180,muzzle:.43,barrelOffset:.055,spreadBase:.12,spreadRate:.035});
export const twinBattery = ship => !['carrier','transport','submarine'].includes(ship?.kind);
// Iowa-style gunship secondaries sit inboard on the superstructure, abaft turret two.
export const BATTERY_MOUNTS = Object.freeze(SIDE_MOUNTS.flatMap(m=>{const x=Math.sign(m.x)*.6;return [
 {...m,x,id:m.id+'-fore',side:m.id,y:-.25,key:m.id+'ForeTurret',legacyKey:m.key},
 {...m,x,side:m.id,y:.2,legacyKey:m.key},
 {...m,x,id:m.id+'-aft',side:m.id,y:.65,key:m.id+'AftTurret',legacyKey:m.key}
];}));
// Transport (LCU style): one triple turret on the stern and single open side guns
// beside it; the bow is the vehicle ramp. The turret keeps its saved 'fore' id and
// key, so reloads, in-flight salvos, recoil and bearings survive the move aft.
export const TRANSPORT_MAIN = Object.freeze([{id:'fore',label:'STERN',y:1.35,key:'turret'}]);
export const TRANSPORT_SIDE_MOUNTS = Object.freeze(SIDE_MOUNTS.map(m=>({...m,x:Math.sign(m.x)*.58,y:1.2})));
export const secondaryMounts = ship => ship?.kind==='submarine'?[]:twinBattery(ship)?BATTERY_MOUNTS:ship?.kind==='transport'?TRANSPORT_SIDE_MOUNTS:SIDE_MOUNTS;
export const secondaryAngle = (ship,mount) => ship[mount.key]??ship[mount.legacyKey]??mount.center;
export const mainMounts = ship => ['carrier','submarine'].includes(ship?.kind) ? [] : ship?.kind==='transport' ? TRANSPORT_MAIN : MAIN_MOUNTS;
/** @param {any} [_ship] */
export const mainBarrels = _ship => [-1,0,1];
export const mainReload = (ship,id) => ship.mainReloads?.[id] ?? ship.reload ?? 0;
export const readyMainMounts = ship => mainMounts(ship).filter(m=>mainReload(ship,m.id)<=.001);
export function tickMainReloads(ship,dt) {
 const before=mainMounts(ship).map(m=>mainReload(ship,m.id));
 ship.mainReloads=Object.fromEntries(mainMounts(ship).map((m,i)=>[m.id,Math.max(0,before[i]-dt)]));
 ship.reload=Math.max(0,...Object.values(ship.mainReloads)); // legacy summary, not a firing gate
 return before.some(v=>v>0);
}
export function mountPoint(ship,x,y) {const scale=shipArtScale(ship);x*=scale.x;y*=scale.y;const c=Math.cos(ship.angle),s=Math.sin(ship.angle);return{x:ship.x+x*c-y*s,y:ship.y+x*s+y*c};}
export function sideSolution(ship,target,mount) {
 const p=mountPoint(ship,mount.x,mount.y||0),distance=target?Math.hypot(target.x-p.x,target.y-p.y):Infinity;
 const desired=target?Math.atan2(target.x-p.x,-(target.y-p.y)):ship.angle+mount.center;
 const relative=angleDelta(ship.angle,desired),offset=angleDelta(mount.center,relative);
 const local=secondaryAngle(ship,mount),angle=ship.angle+local;
 return{...p,id:mount.id,angle,desired,distance,inArc:Math.abs(offset)<=NAVAL_GUN.halfArc+1e-8,inRange:distance>=.2&&distance<=NAVAL_GUN.range,aligned:Math.abs(angleDelta(angle,desired))<=NAVAL_GUN.tolerance,goal:mount.center+Math.max(-NAVAL_GUN.halfArc,Math.min(NAVAL_GUN.halfArc,offset))};
}
export function stepShipMounts(ship,target,dt,fallback=ship.turret) {
 const initial=ship.turret;
 for(const m of mainMounts(ship)){const p=mountPoint(ship,0,m.y),desired=target?Math.atan2(target.x-p.x,-(target.y-p.y)):fallback;ship[m.key]=turnTurret(ship[m.key]??initial,desired,dt,SHIP.turretSpeed);}
 stepSecondaryMounts(ship,target,dt);
}
export function stepSecondaryMounts(ship,target,dt,mounts=secondaryMounts(ship)){
 // Read legacy bearings before changing any mount, so missing mounts share the same starting pose.
 const angles=mounts.map(m=>secondaryAngle(ship,m));
 for(const [i,m] of mounts.entries()){const aim=sideSolution(ship,target,m),current=angles[i],step=NAVAL_GUN.turnSpeed*dt;ship[m.key]=Math.max(m.center-NAVAL_GUN.halfArc,Math.min(m.center+NAVAL_GUN.halfArc,current+Math.max(-step,Math.min(step,aim.goal-current))));}
}

export function secondarySpread(ship,target,mount){
 const a=sideSolution(ship,target,mount),distance=Math.min(NAVAL_GUN.range,a.distance);
 return {...a,x:a.x+Math.sin(a.angle)*distance,y:a.y-Math.cos(a.angle)*distance,radius:TWIN_BATTERY.spreadBase+distance*TWIN_BATTERY.spreadRate};
}
export function secondaryEnvelope(ship,target){
 const solutions=secondaryMounts(ship).map(m=>secondarySpread(ship,target,m)).filter(a=>a.inArc&&a.inRange&&a.aligned);
 return solutions.length?{x:target.x,y:target.y,radius:Math.max(...solutions.map(a=>Math.hypot(a.x-target.x,a.y-target.y)+a.radius))}:null;
}
// A deterministic disk sample at the actual turret aim plane; accepted bullets
// retain their ray when the cursor moves. Clamp spread to the outward firing arc.
export function secondaryRound(ship,target,mount,barrel,sequence){
 const a=sideSolution(ship,target,mount),spread=secondarySpread(ship,target,mount),p=mountPoint(ship,mount.x,mount.y||0);
 const scale=navalWeaponScale(ship),muzzle=TWIN_BATTERY.muzzle*scale;
 const x=p.x+Math.sin(a.angle)*muzzle+Math.cos(a.angle)*barrel*TWIN_BATTERY.barrelOffset*scale;
 const y=p.y-Math.cos(a.angle)*muzzle+Math.sin(a.angle)*barrel*TWIN_BATTERY.barrelOffset*scale;
 const n=sequence*2+(barrel===1?1:0)+1,phase=n*2.399963229728653,r=spread.radius*Math.sqrt((n*.7548776662466927)%1);
 // Project a disk sample onto the aim plane: these are direct bullets, not lobbed shells.
 const lateral=Math.cos(phase)*r,tx=spread.x+Math.cos(a.angle)*lateral,ty=spread.y+Math.sin(a.angle)*lateral,desired=Math.atan2(tx-x,-(ty-y));
 const offset=angleDelta(ship.angle+mount.center,desired),angle=ship.angle+mount.center+Math.max(-NAVAL_GUN.halfArc,Math.min(NAVAL_GUN.halfArc,offset));
 return {x,y,angle,owner:ship.id+':'+mount.id+':'+barrel,barrel,batterySide:mount.side,remaining:NAVAL_GUN.range-muzzle};
}
// Selected ready mounts commit together; the transport fires its stern triple turret.
export function mainSalvo(ship,target,mounts=mainMounts(ship),precise=false) {
 const range=Math.max(SHIP.minRange,Math.min(SHIP.range,Math.hypot(target.x-ship.x,target.y-ship.y)));
 return mounts.flatMap(m=>{
  const index=Math.max(0,MAIN_MOUNTS.indexOf(m));
  const p=mountPoint(ship,0,m.y),angle=ship[m.key]??ship.turret,dx=Math.sin(angle),dy=-Math.cos(angle),rx=Math.cos(angle),ry=Math.sin(angle);
  const scale=navalWeaponScale(ship);
  return mainBarrels(ship).map(side=>({mount:m.id,barrel:side,owner:ship.id+':'+m.id+':'+side,x:p.x+(rx*side*.13+dx*.8)*scale,y:p.y+(ry*side*.13+dy*.8)*scale,angle,
   targetX:p.x+dx*(precise?Math.hypot(target.x-p.x,target.y-p.y):range)+rx*side*.55,targetY:p.y+dy*(precise?Math.hypot(target.x-p.x,target.y-p.y):range)+ry*side*.55,duration:1+range/18+index*.1+(side+1)*.03}));
 });
}
