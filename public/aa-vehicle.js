import { AA35 } from './weapons.js';
import { isAirEnemy, isGroundEnemy } from './target-domain.js';
import { operational } from './vehicle.js';
import { flightLineClear, mountainClear } from './terrain-rules.js';
import { raycast } from './raycast.js';
import { angleDelta, turnTurret } from './turret.js';

export const AA = Object.freeze({ acquire: 2.4, release: 3, turnSpeed: Math.PI * 1.6, tolerance: .06, search: .25 });
export const isAA = tank => tank?.kind === 'aa';
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

// The cursor is an input, never overwritten by this solution. Air tracking only
// assists a nearby, reachable contact; free aim always remains available.
export function aaAimSolution(world, buildings, tank, enemies, aimX, aimY, now = 0) {
  const ground={x:aimX,y:aimY,targetId:null,domain:'ground'};
  if(!isAA(tank)||tank.aaGround||![aimX,aimY].every(Number.isFinite))return ground;
  const cursor={x:aimX,y:aimY};
  const candidates=enemies.filter(e=>e.hp>0&&isAirEnemy(e)&&distance(tank,e)<=AA35.range&&
    distance(cursor,e)<=(tank.aaAim?.targetId===e.id?AA.release:AA.acquire)&&flightLineClear(world,tank,e,.15));
  candidates.sort((a,b)=>distance(cursor,a)-distance(cursor,b)||String(a.id).localeCompare(String(b.id)));
  const target=candidates[0];if(!target)return ground;
  let time=distance(tank,target)/AA35.speed, x=target.x, y=target.y;
  // Two fixed iterations approximate interception without an unbounded solver.
  for(let i=0;i<2;i++){x=target.x+(target.vx||0)*time;y=target.y+(target.vy||0)*time;time=Math.min(.65,Math.hypot(x-tank.x,y-tank.y)/AA35.speed);}
  if(x<0||y<0||x>=world.width||y>=world.height||!flightLineClear(world,tank,{x,y},.15)){x=target.x;y=target.y;}
  return{x,y,targetId:target.id,domain:'air'};
}

// Air rays ignore low ground geometry, while mountain ridges remain solid.
// Entity intersections use the same nearest-hit ordering as ground shots.
export function airRaycast(world, origin, dx, dy, range, enemies, radius=.65) {
  let length=range,blocked=false;
  const steps=Math.max(1,Math.ceil(range*4));
  for(let i=1;i<=steps;i++){
    const d=range*i/steps,p={x:origin.x+dx*d,y:origin.y+dy*d};
    if(p.x<0||p.y<0||p.x>=world.width||p.y>=world.height||!mountainClear(world,p,.1)){length=d;blocked=true;break;}
  }
  let enemy=null;
  for(const e of enemies){
    if(e.hp<=0||!isAirEnemy(e))continue;
    const x=e.x-origin.x,y=e.y-origin.y,along=x*dx+y*dy,disc=radius*radius-(x*x+y*y-along*along);
    if(disc<0||along+Math.sqrt(disc)<0)continue;
    const d=Math.max(0,along-Math.sqrt(disc));if(d<length-1e-8){length=d;enemy=e;blocked=false;}
  }
  return{x:origin.x+dx*length,y:origin.y+dy*length,distance:length,enemy,blocked};
}

export function aaGuardStep(world,buildings,tank,enemies,dt,now){
  if(!isAA(tank)||!operational(tank)||tank.occupant||tank.carriedBy||world.logistics?.jobs?.[tank.id]||Math.abs(tank.driveSpeed||0)>.05){
    if(isAA(tank)&&!tank.occupant)tank.aaAim=null;return null;
  }
  const visible=e=>{
    const d=distance(tank,e);if(e.hp<=0||d<.2||d>AA35.range)return false;
    if(isAirEnemy(e))return flightLineClear(world,tank,e,.15);
    if(e.kind==='bulwark')return false;
    return raycast(world,buildings,tank,(e.x-tank.x)/d,(e.y-tank.y)/d,d+.01,enemies.filter(isGroundEnemy)).enemy?.id===e.id;
  };
  const state=tank.aaGuard ||= {search:0,targetId:null};state.search=Math.max(0,state.search-dt);
  let target=enemies.find(e=>e.id===state.targetId&&visible(e));
  if(!state.search){
    const candidates=enemies.filter(visible).sort((a,b)=>Number(isAirEnemy(b))-Number(isAirEnemy(a))||distance(tank,a)-distance(tank,b));
    target=candidates[0];state.targetId=target?.id??null;state.search=AA.search;
  }
  if(!target){tank.aaAim=null;return null;}
  tank.aaGround=false;tank.aaAim=aaAimSolution(world,buildings,tank,enemies,target.x,target.y,now);
  const aim=Math.atan2(tank.aaAim.x-tank.x,tank.y-tank.aaAim.y);
  tank.turret=turnTurret(tank.turret??tank.angle??0,aim,dt,AA.turnSpeed);tank.timerDirty=true;
  return Math.abs(angleDelta(tank.turret,aim))<AA.tolerance?{target,weapon:'AA35'}:null;
}
