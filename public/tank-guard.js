import { operational } from './vehicle.js';
import { WEAPONS, loadout } from './weapons.js';
import { turnTurret, angleDelta } from './turret.js';
import { raycast } from './raycast.js';

export const TANK_GUARD = Object.freeze({ search:.5, tolerance:Math.PI/90 });
export const tankGuardReady = (world,tank) => operational(tank)&&!tank.occupant&&!world.logistics?.jobs?.[tank.id]&&!tank.carriedBy&&Math.abs(tank.speed||0)<.05;
export function tankGuardTarget(world,buildings,tank,enemies,id) {
  if(!tankGuardReady(world,tank))return null;
  const weapon=tank.weapon==='MAGNETIC'?'MAGNETIC':'HE',range=WEAPONS[weapon].range;
  const target=enemies.find(e=>e.id===id&&e.hp>0);if(!target)return null;
  const d=Math.hypot(target.x-tank.x,target.y-tank.y);if(d<=.2||d>range)return null;
  return raycast(world,buildings,tank,(target.x-tank.x)/d,(target.y-tank.y)/d,d+.01,enemies).enemy?.id===target.id?target:null;
}
export function tankGuardStep(world,buildings,tank,enemies,dt) {
  const state=tank.guard ||= {targetId:null,search:0};
  if(!tankGuardReady(world,tank)){state.targetId=null;state.search=0;return null;}
  let target=tankGuardTarget(world,buildings,tank,enemies,state.targetId);
  state.search=Math.max(0,state.search-dt);
  if(!state.search){
    const distance=e=>Math.hypot(e.x-tank.x,e.y-tank.y);
    const candidates=enemies.filter(e=>e.hp>0&&distance(e)<=WEAPONS[tank.weapon==='MAGNETIC'?'MAGNETIC':'HE'].range)
      .sort((a,b)=>Number(b.kind==='bulwark')-Number(a.kind==='bulwark')||distance(a)-distance(b)||a.id-b.id);
    const best=candidates.find(e=>tankGuardTarget(world,buildings,tank,enemies,e.id));
    if(!target||best?.kind==='bulwark'&&target.kind!=='bulwark')target=best;
    state.search=TANK_GUARD.search;
  }
  state.targetId=target?.id??null;if(!target)return null;
  const aim=Math.atan2(target.x-tank.x,tank.y-target.y),before=tank.turret??tank.angle??0;
  tank.turret=turnTurret(before,aim,dt,loadout('rover').turnSpeed);
  if(tank.turret!==before)tank.timerDirty=true;
  return Math.abs(angleDelta(tank.turret,aim))<=TANK_GUARD.tolerance?{target,weapon:tank.weapon==='MAGNETIC'?'MAGNETIC':'HE'}:null;
}
