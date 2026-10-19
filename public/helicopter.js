import { angleDelta } from './turret.js';

export const HELI = Object.freeze({ size:3, max:4, speed:4, acceleration:6, turn:2.2, turretSpeed:3.5,
  rounds:120, rockets:40, burst:5, recovery:8, rearm:8, transition:2 });
export const HELI_CANNON = Object.freeze({ range:9, cooldown:.18, flight:.25, radius:.65, lethalRadius:0, damage:24, edgeDamage:5, craterSize:.7 });
export const HELI_ROCKET = Object.freeze({ range:12, cooldown:.25, flight:.65, radius:1.1, lethalRadius:0, damage:42, edgeDamage:8, craterSize:1.2 });
export const isHelicopter = p => p?.kind === 'helicopter';
export const isHelipad = b => b?.kind === 'helipad';
export const airSize = b => isHelipad(b) ? {width:3,height:3} : {width:6,height:10};
export const compatibleAirfield = (b,p) => !!b && isHelipad(b) === isHelicopter(p);
export const heliParking = b => ({x:b.x+1.5,y:b.y+1.5});
export const helicopterLoad = () => ({rounds:HELI.rounds,rockets:HELI.rockets,cannonCooldown:0,rocketCooldown:0,rocketWindow:0,rocketRecovery:0,rocketBurstShots:0,vx:0,vy:0,turret:0});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function helicopterPoint(world,p,target,rocket=false){
  const profile=rocket?HELI_ROCKET:HELI_CANNON;
  const distance=Math.min(profile.range,Math.hypot(target.x-p.x,target.y-p.y));
  return {x:clamp(p.x+Math.sin(p.turret??p.angle)*distance,0,world.width-.001),y:clamp(p.y-Math.cos(p.turret??p.angle)*distance,0,world.height-.001)};
}
export function helicopterFireError(world,p,target,rocket=false){
  if(!isHelicopter(p)||p.state!=='flying')return 'Fly a helicopter before firing.';
  if(!target||![target.x,target.y].every(Number.isFinite))return 'Choose a finite ground target.';
  if(!(rocket?p.rockets>0:p.rounds>0))return 'Ammunition empty. Land at a helipad to rearm.';
  if(rocket&&(p.rocketRecovery>0||p.rocketBurstShots>=20))return 'Rocket pods cooling / eight seconds.';
  if((rocket?p.rocketCooldown:p.cannonCooldown)>1e-6)return 'Weapon cycling.';
  return null;
}
export function spendHelicopterShot(p,rocket=false){
  if(rocket){if(!(p.rocketWindow>0)){p.rocketWindow=HELI.burst;p.rocketBurstShots=0;}p.rocketBurstShots++;p.rockets--;p.rocketCooldown=HELI_ROCKET.cooldown;}
  else{p.rounds--;p.cannonCooldown=HELI_CANNON.cooldown;}
}
// Saved active-time timers: reconnecting, releasing the mouse or restarting cannot
// reset the five-second pod window, ammunition, or recovery interval.
export function tickHelicopter(world,base,input,dt,canLand){
  const p=base.aircraft,home=heliParking(base);
  if(p.state==='parked'&&!(p.rearm>0||p.cannonCooldown>0||p.rocketCooldown>0||p.rocketRecovery>0||p.rocketWindow>0))return false;
  for(const key of ['cannonCooldown','rocketCooldown','rocketRecovery'])p[key]=Math.max(0,(p[key]||0)-dt);
  if(p.rocketWindow>0){p.rocketWindow=Math.max(0,p.rocketWindow-dt);if(!p.rocketWindow){p.rocketRecovery=HELI.recovery;p.rocketBurstShots=0;}}
  if(p.state==='parked'){if(p.rearm>0){p.rearm=Math.max(0,p.rearm-dt);if(!p.rearm)Object.assign(p,helicopterLoad());}return true;}
  if(p.state==='takeoff'||p.state==='landing'){
    p.remaining=Math.max(0,p.remaining-dt);p.speed=0;p.vx=0;p.vy=0;
    if(!p.remaining){if(p.state==='landing')Object.assign(p,home,{state:'parked',rearm:HELI.rearm});else p.state='flying';}return true;
  }
  if(p.state!=='flying')return false;
  const ix=input?.x||0,iy=input?.y||0,length=Math.max(1,Math.hypot(ix,iy)),blend=Math.min(1,HELI.acceleration*dt);
  p.vx=(p.vx||0)+(ix/length*HELI.speed-(p.vx||0))*blend;p.vy=(p.vy||0)+(iy/length*HELI.speed-(p.vy||0))*blend;
  p.x=clamp(p.x+p.vx*dt,.5,world.width-.5);p.y=clamp(p.y+p.vy*dt,.5,world.height-.5);p.speed=Math.hypot(p.vx,p.vy);
  if(input?.target)p.target={...input.target};
  const desired=p.target?Math.atan2(p.target.x-p.x,-(p.target.y-p.y)):p.angle;
  p.angle+=clamp(angleDelta(p.angle,desired),-HELI.turn*dt,HELI.turn*dt);
  p.turret=(p.turret??p.angle)+clamp(angleDelta(p.turret??p.angle,desired),-HELI.turretSpeed*dt,HELI.turretSpeed*dt);
  if(Math.hypot(p.x-home.x,p.y-home.y)>3)p.leftBase=true;
  if(canLand&&p.leftBase&&p.speed<.8&&Math.hypot(p.x-home.x,p.y-home.y)<1.2&&(!p.mission||['complete','lost','return'].includes(p.mission.phase)))Object.assign(p,{state:'landing',remaining:HELI.transition,vx:0,vy:0});
  return true;
}
