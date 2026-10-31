import { ENEMY_ROLES } from './enemy-profiles.js';
import { isAirEnemy } from './target-domain.js';
import { islandAt } from './island-pressure.js';
import { mountainClear, flightLineClear } from './terrain-rules.js';
import { operational, hullDistance, hurtVehicle } from './vehicle.js';
import { facilityDistance, hurtFacility } from './logistics.js';
import { hurtRobot } from './survival.js';
import { turnTurret } from './turret.js';

const profile = ENEMY_ROLES.skimmer;
export const AERIAL = Object.freeze({ hp:profile.hp, speed:profile.speed, height:2.5, cap:4,
  acquire:18, retain:22, range:profile.reach, leash:32, clearance:.45, turnSpeed:2.8,
  warning:profile.windup, flight:250, cooldown:profile.cooldown, damage:profile.damage,
  radius:profile.radius, memory:4000, sense:300, orbitRadius:4.5, maxLead:3,
  maxShots:8, impactLife:700, maxMoveDt:.25 });
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const position = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const velocity = p => ({ vx:Number.isFinite(p.vx)?p.vx:0, vy:Number.isFinite(p.vy)?p.vy:0 });

export function aerialPointClear(world, point) {
  return position(point) && point.x >= AERIAL.clearance && point.y >= AERIAL.clearance &&
    point.x < world.width-AERIAL.clearance && point.y < world.height-AERIAL.clearance &&
    !!islandAt(world,point.x,point.y) && mountainClear(world,point,AERIAL.clearance);
}

// Air paths ignore low ground obstacles, but never cut across the ocean, another
// island, or a Vesper mountain chain. Check the whole step, not only its endpoint.
export function aerialLineClear(world, from, to, island = islandAt(world,from.x,from.y)) {
  if (!island || !aerialPointClear(world,from) || !aerialPointClear(world,to) ||
    !flightLineClear(world,from,to,AERIAL.clearance)) return false;
  const steps = Math.max(1,Math.ceil(distance(from,to)*3));
  for (let i=0;i<=steps;i++) if (islandAt(world,from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps)!==island) return false;
  return true;
}

/** @param {{siteId?:string,pressureIsland?:string,now?:number}} options */
export function newAerialEnemy(id, point, options = {}) {
  const now = options.now || 0;
  return { id, kind:'skimmer', domain:'air', height:AERIAL.height, x:point.x, y:point.y,
    hp:AERIAL.hp, maxHp:AERIAL.hp, angle:0, vx:0, vy:0, path:[], reroute:0,
    homeX:point.x, homeY:point.y, rally:{x:point.x,y:point.y}, emergedAt:now,
    ...(options.siteId?{siteId:options.siteId}:{}),
    ...(options.pressureIsland?{pressureIsland:options.pressureIsland}:{}),
    behavior:'patrolling', attack:null, targetId:null,
    flight:{phase:'patrol',nextSense:0,nextAttack:now,orbitAngle:0,blocked:false} };
}

// Utilities are vehicle records even though their HP lives in facility durability.
// Never include stationary structures, ships, aircraft, or a carried vehicle copy.
export function aerialGroundTargets(world, robots = [], facilities = []) {
  const tanks = (world.tanks||[]).filter(v=>v.berthX===undefined&&operational(v));
  const utility = new Map((world.logistics?.recyclers||[]).map(v=>[v.id,v]));
  const trucks = facilities.filter(f=>f.kind==='recycler'&&f.object&&utility.get(f.object.id)===f.object&&
    !f.object.destroyed&&!(f.object.remaining>0)&&!world.logistics?.jobs?.[f.object.id]&&f.hp.health>0);
  const occupied = new Set([...(world.tanks||[]),...(world.ships||[]),...(world.logistics?.recyclers||[])]
    .map(v=>v.occupant).filter(Boolean));
  const foot = robots.filter(p=>(p.body===undefined||p.body==='robot')&&p.life==='active'&&p.health>0&&
    !p.deploying&&!(p.shield>0)&&!occupied.has(p.id));
  const targets = foot.map(p=>({id:p.id,x:p.x,y:p.y,...velocity(p),controlled:true,
    range:q=>distance(p,q),hurt:amount=>hurtRobot(p,amount)}))
    .concat(tanks.map(v=>({id:'vehicle:'+v.id,x:v.x,y:v.y,...velocity(v),controlled:!!v.occupant,
      range:q=>hullDistance(v,q),hurt:amount=>hurtVehicle(v,amount)})))
    .concat(trucks.map(f=>({id:f.id,x:f.x,y:f.y,...velocity(f.object),controlled:!!f.object.occupant,
      range:q=>facilityDistance(f,q),hurt:amount=>hurtFacility(f,amount,2)})));
  const seen = new Set();
  return targets.filter(t=>position(t)&&!seen.has(t.id)&&!!seen.add(t.id));
}

function move(world, enemy, goal, seconds, island, home) {
  const before = {x:enemy.x,y:enemy.y}, dt = Math.min(seconds,AERIAL.maxMoveDt);
  const steps = Math.max(1,Math.ceil(dt/.05)), step = dt/steps;
  enemy.flight.blocked=false;
  for (let i=0;i<steps;i++) {
    const remaining=distance(enemy,goal); if (remaining<.15) break;
    const wanted=Math.atan2(goal.x-enemy.x,enemy.y-goal.y);
    const angle=turnTurret(enemy.angle||0,wanted,step,AERIAL.turnSpeed), travel=Math.min(remaining,AERIAL.speed*step);
    let next=null;
    // A bounded steering fan follows a wall or coast instead of attempting a
    // world path search. Never teleport to a valid point beyond a blocked segment.
    for (const offset of [0,.55,-.55,1.1,-1.1]) {
      const heading=angle+offset, point={x:enemy.x+Math.sin(heading)*travel,y:enemy.y-Math.cos(heading)*travel};
      if (distance(point,home)<=AERIAL.leash&&aerialLineClear(world,enemy,point,island)) {next={...point,angle:heading};break;}
    }
    if (!next) {enemy.flight.blocked=true;break;}
    Object.assign(enemy,next);
  }
  enemy.vx=(enemy.x-before.x)/seconds;enemy.vy=(enemy.y-before.y)/seconds;
}

function predictedPoint(world, enemy, target, home, island) {
  const lead=(AERIAL.warning+AERIAL.flight)/1000, length=Math.hypot(target.vx,target.vy)*lead;
  const scale=length>AERIAL.maxLead?AERIAL.maxLead/length:1;
  const point={x:target.x+target.vx*lead*scale,y:target.y+target.vy*lead*scale};
  return distance(point,home)<=AERIAL.leash&&aerialLineClear(world,enemy,point,island)?point:{x:target.x,y:target.y};
}

// All timers and aim points are ordinary checkpoint data. Killing a source
// cancels its unlaunched warning; a released shot resolves once independently.
export function tickAerialEnemies(world, enemies, robots, facilities, shots, now, dt, nextId, emit = event=>{}) {
  if (!Number.isFinite(now)||!Number.isFinite(dt)||dt<=0) return false;
  const targets=aerialGroundTargets(world,robots,facilities);
  let changed=shots.length>0;
  const resolve=()=>{
    for (const shot of shots) if (shot.weapon==='SKIMMER'&&!shot.impacted&&now>=shot.landAt) {
      shot.impacted=true;
      for (const target of targets) if (target.range(shot)<=AERIAL.radius&&target.hurt(AERIAL.damage))
        emit({event:'enemy.weapon.hit',kind:'system',sourceId:String(shot.sourceId),projectileId:shot.id,targetId:target.id,weapon:'SKIMMER'});
    }
  };
  resolve();
  for (const enemy of enemies) {
    if (!isAirEnemy(enemy)||enemy.hp<=0) continue;
    changed=true;enemy.domain='air';enemy.height=AERIAL.height;enemy.path=[];
    const f=enemy.flight ||= {phase:'patrol',nextSense:0,nextAttack:0,orbitAngle:0,blocked:false};
    const home={x:enemy.homeX??enemy.x,y:enemy.homeY??enemy.y};
    const island=enemy.pressureIsland||islandAt(world,home.x,home.y);
    if (island) enemy.pressureIsland=island;
    if (enemy.attack?.kind==='skimmer') {
      enemy.vx=0;enemy.vy=0;f.phase='warning';enemy.behavior='attacking';
      if (now>=enemy.attack.fireAt) {
        if (shots.filter(s=>!s.impacted).length<AERIAL.maxShots) {
          // Freeze the launch orientation for the three cosmetic bile outlets.
          // They converge on this one authoritative projectile/impact.
          const shot={id:nextId(),sourceId:enemy.id,weapon:'SKIMMER',fromX:enemy.x,fromY:enemy.y,fromAngle:enemy.angle||0,
            x:enemy.attack.x,y:enemy.attack.y,at:enemy.attack.fireAt,landAt:enemy.attack.fireAt+AERIAL.flight,
            radius:AERIAL.radius,impacted:false};
          shots.push(shot);f.circle={x:shot.x,y:shot.y};
          emit({event:'enemy.weapon.launched',kind:'system',sourceId:String(enemy.id),projectileId:shot.id,weapon:'SKIMMER',x:shot.x,y:shot.y});
        }
        enemy.attack=null;f.nextAttack=now+AERIAL.cooldown;f.phase='circling';enemy.behavior='circling';
      }
      continue;
    }
    if (!island||!aerialPointClear(world,enemy)) {enemy.vx=0;enemy.vy=0;f.blocked=true;continue;}
    const visible=target=>distance(target,home)<=AERIAL.leash&&distance(enemy,target)<=AERIAL.retain&&
      islandAt(world,target.x,target.y)===island&&aerialLineClear(world,enemy,target,island);
    let target=targets.find(t=>t.id===enemy.targetId&&visible(t));
    if (now>=(f.nextSense||0)) {
      const candidate=targets.filter(t=>distance(enemy,t)<=AERIAL.acquire&&visible(t))
        .sort((a,b)=>Number(b.controlled)-Number(a.controlled)||distance(enemy,a)-distance(enemy,b)||String(a.id).localeCompare(String(b.id)))[0];
      if (!target||candidate?.controlled&&!target.controlled) target=candidate;
      f.nextSense=now+AERIAL.sense;
    }
    enemy.targetId=target?.id??null;
    if (target) f.lastContact={x:target.x,y:target.y,until:now+AERIAL.memory};
    if (target&&target.range(enemy)<=AERIAL.range&&now>=(f.nextAttack||0)&&
      shots.filter(s=>!s.impacted).length+enemies.filter(e=>e.hp>0&&e.attack?.kind==='skimmer').length<AERIAL.maxShots) {
      const point=predictedPoint(world,enemy,target,home,island);
      enemy.attack={kind:'skimmer',...point,at:now,fireAt:now+AERIAL.warning,targetId:target.id};
      enemy.vx=0;enemy.vy=0;enemy.behavior='attacking';f.phase='warning';
      emit({event:'enemy.weapon.warning',kind:'system',sourceId:String(enemy.id),targetId:target.id,weapon:'SKIMMER',x:point.x,y:point.y});
      continue;
    }
    let goal;
    if (now<(f.nextAttack||0)&&f.circle) {
      f.phase='circling';enemy.behavior='circling';
      f.orbitAngle=(f.orbitAngle||0)+Math.min(dt,AERIAL.maxMoveDt)*AERIAL.speed/AERIAL.orbitRadius;
      goal={x:f.circle.x+Math.cos(f.orbitAngle)*AERIAL.orbitRadius,y:f.circle.y+Math.sin(f.orbitAngle)*AERIAL.orbitRadius};
    } else if (target) {goal=target;f.phase='pursuing';enemy.behavior='pursuing';}
    else if (f.lastContact?.until>now) {goal=f.lastContact;f.phase='investigating';enemy.behavior='investigating';}
    else {
      f.phase='patrol';enemy.behavior='patrolling';
      f.orbitAngle=(f.orbitAngle||0)+Math.min(dt,AERIAL.maxMoveDt)*.45;
      goal={x:home.x+Math.cos(f.orbitAngle)*3,y:home.y+Math.sin(f.orbitAngle)*3};
    }
    move(world,enemy,goal,dt,island,home);
  }
  resolve();
  for (let i=shots.length-1;i>=0;i--) if (shots[i].weapon==='SKIMMER'&&shots[i].impacted&&now>=shots[i].landAt+AERIAL.impactLife) shots.splice(i,1);
  return changed;
}
