import { canStand } from './world.js';
import { enemyProfile, heavyEnemy, ENEMY_ROLES } from './enemy-profiles.js';
import { facilityDistance } from './logistics.js';
import { hullDistance } from './vehicle.js';

export const LAND_AI=Object.freeze({acquire:10,retain:14,memory:4000,speed:ENEMY_ROLES.hunter.speed,retry:3000});
export const targetDistance=(enemy,target)=>target.facility?facilityDistance(target.facility,enemy):target.vehicle?hullDistance(target.vehicle,enemy):Math.hypot(target.x-enemy.x,target.y-enemy.y);
export function landTarget(enemy,available,now){
  const candidates=available.filter(t=>!(enemy.failedTarget?.id===t.id&&enemy.failedTarget.until>now)&&(!t.facility||t.facility.hp.armor<=enemyProfile(enemy).penetration));
  let target=candidates.find(t=>t.id===enemy.targetId&&targetDistance(enemy,t)<LAND_AI.retain);
  const preference=t=>heavyEnemy(enemy)?Number(!t.facility&&!t.vehicle):Number(!!t.facility);
  if(!target)target=candidates.filter(t=>targetDistance(enemy,t)<LAND_AI.acquire).sort((a,b)=>preference(a)-preference(b)||targetDistance(enemy,a)-targetDistance(enemy,b))[0];
  return target;
}
export function rememberTarget(enemy,target,now){
  if(target)enemy.lastContact={id:target.id,x:target.x,y:target.y,until:now+LAND_AI.memory};
  else if(enemy.lastContact?.until<=now)delete enemy.lastContact;
}
// Route to an attack position, never the blocked center of a vehicle/building.
export function attackGoals(world,buildings,target,reach){
  if(!target.vehicle&&!target.facility)return [{x:target.x,y:target.y}];
  const shape=target.facility,w=shape?.w??4,h=shape?.h??4,goals=[];
  for(let y=Math.floor(target.y-h/2)-1;y<=Math.ceil(target.y+h/2);y++)for(let x=Math.floor(target.x-w/2)-1;x<=Math.ceil(target.x+w/2);x++){
    const point={x:x+.5,y:y+.5};if(targetDistance(point,target)<=reach&&canStand(world,buildings,point.x,point.y))goals.push(point);
  }
  return goals;
}
