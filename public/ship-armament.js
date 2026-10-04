import { SHIP } from './ship.js';
import { turnTurret, angleDelta } from './turret.js';
export const NAVAL_GUN = Object.freeze({range:8,halfArc:80*Math.PI/180,turnSpeed:Math.PI*1.5,tolerance:4*Math.PI/180});
export const MAIN_MOUNTS = Object.freeze([{id:'fore',y:-1.05,key:'turret'},{id:'aft',y:1.05,key:'aftTurret'}]);
export const SIDE_MOUNTS = Object.freeze([{id:'port',x:-1.02,center:-Math.PI/2,key:'portTurret'},{id:'starboard',x:1.02,center:Math.PI/2,key:'starboardTurret'}]);
export const mainReload = (ship,id) => ship.mainReloads?.[id] ?? ship.reload ?? 0;
export const readyMainMounts = ship => MAIN_MOUNTS.filter(m=>mainReload(ship,m.id)<=.001);
export function tickMainReloads(ship,dt) {
 const before=MAIN_MOUNTS.map(m=>mainReload(ship,m.id));
 ship.mainReloads=Object.fromEntries(MAIN_MOUNTS.map((m,i)=>[m.id,Math.max(0,before[i]-dt)]));
 ship.reload=Math.max(...Object.values(ship.mainReloads)); // legacy summary, not a firing gate
 return before.some(v=>v>0);
}
export function mountPoint(ship,x,y) {const c=Math.cos(ship.angle),s=Math.sin(ship.angle);return{x:ship.x+x*c-y*s,y:ship.y+x*s+y*c};}
export function sideSolution(ship,target,mount) {
 const p=mountPoint(ship,mount.x,0),distance=target?Math.hypot(target.x-p.x,target.y-p.y):Infinity;
 const desired=target?Math.atan2(target.x-p.x,-(target.y-p.y)):ship.angle+mount.center;
 const relative=angleDelta(ship.angle,desired),offset=angleDelta(mount.center,relative);
 const local=ship[mount.key]??mount.center,angle=ship.angle+local;
 return{...p,id:mount.id,angle,desired,distance,inArc:Math.abs(offset)<=NAVAL_GUN.halfArc+1e-8,inRange:distance>=.2&&distance<=NAVAL_GUN.range,aligned:Math.abs(angleDelta(angle,desired))<=NAVAL_GUN.tolerance,goal:mount.center+Math.max(-NAVAL_GUN.halfArc,Math.min(NAVAL_GUN.halfArc,offset))};
}
export function stepShipMounts(ship,target,dt,fallback=ship.turret) {
 const initial=ship.turret;
 for(const m of MAIN_MOUNTS){const p=mountPoint(ship,0,m.y),desired=target?Math.atan2(target.x-p.x,-(target.y-p.y)):fallback;ship[m.key]=turnTurret(ship[m.key]??initial,desired,dt,SHIP.turretSpeed);}
 for(const m of SIDE_MOUNTS){const aim=sideSolution(ship,target,m),current=ship[m.key]??m.center,step=NAVAL_GUN.turnSpeed*dt;ship[m.key]=Math.max(m.center-NAVAL_GUN.halfArc,Math.min(m.center+NAVAL_GUN.halfArc,current+Math.max(-step,Math.min(step,aim.goal-current))));}
}
// Selected ready mounts commit together; each contributes both barrels.
export function mainSalvo(ship,target,mounts=MAIN_MOUNTS) {
 const range=Math.max(SHIP.minRange,Math.min(SHIP.range,Math.hypot(target.x-ship.x,target.y-ship.y)));
 return mounts.flatMap(m=>{
  const index=MAIN_MOUNTS.indexOf(m);
  const p=mountPoint(ship,0,m.y),angle=ship[m.key]??ship.turret,dx=Math.sin(angle),dy=-Math.cos(angle),rx=Math.cos(angle),ry=Math.sin(angle);
  return [-1,1].map(side=>({mount:m.id,barrel:side,owner:ship.id+':'+m.id+':'+side,x:p.x+rx*side*.13+dx*.8,y:p.y+ry*side*.13+dy*.8,angle,
   targetX:p.x+dx*range+rx*side*.55,targetY:p.y+dy*range+ry*side*.55,duration:1+range/18+index*.1+(side===1?.06:0)}));
 });
}
