import { SLING } from './helicopter-sling.js';
import {flightLineClear} from './terrain-rules.js';
import { fieldLandingError } from './helicopter-landing.js';
import { angleDelta } from './turret.js';

export const HELI = Object.freeze({ size:3, max:8, speed:4, acceleration:4, braking:6, turn:2.2, turretSpeed:3.5,
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
// World-direction hover assist: bounded vector acceleration, not fixed-wing
// steering. Integrate small steps so turns and braking agree across tick sizes.
export function helicopterMotion(world,p,input,dt){
  const ix=input?.x||0,iy=input?.y||0,length=Math.max(1,Math.hypot(ix,iy));
  const speed=p.sling?SLING.speed:HELI.speed;
  const tx=ix/length*speed,ty=iy/length*speed;
  for(let left=dt;left>1e-8;){
    const step=Math.min(.025,left);left-=step;
    const vx=p.vx||0,vy=p.vy||0,dx=tx-vx,dy=ty-vy,distance=Math.hypot(dx,dy);
    const braking=tx*vx+ty*vy<0||Math.hypot(tx,ty)<Math.hypot(vx,vy);
    const blend=distance?Math.min(1,(braking?HELI.braking:p.sling?SLING.acceleration:HELI.acceleration)*step/distance):0;
    p.vx=vx+dx*blend;p.vy=vy+dy*blend;
    const x=p.x+(vx+p.vx)*.5*step,y=p.y+(vy+p.vy)*.5*step;
    p.terrainWarning=!flightLineClear(world,p,{x,y});
    if(p.terrainWarning){p.vx=0;p.vy=0;break;}
    p.x=clamp(x,.5,world.width-.5);p.y=clamp(y,.5,world.height-.5);
    if(p.x!==x)p.vx=0;if(p.y!==y)p.vy=0;
  }
  p.speed=Math.hypot(p.vx||0,p.vy||0);
}
export function helicopterPoint(world,p,target,rocket=false){
  const profile=rocket?HELI_ROCKET:HELI_CANNON;
  const distance=Math.min(profile.range,Math.hypot(target.x-p.x,target.y-p.y));
  return {x:clamp(p.x+Math.sin(p.turret??p.angle)*distance,0,world.width-.001),y:clamp(p.y-Math.cos(p.turret??p.angle)*distance,0,world.height-.001)};
}
export function helicopterFireError(world,p,target,rocket=false){
  if(p?.slingOperation)return 'Wait for the sling transfer to finish.';
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
  if(p.fieldLanding)p.rearm=0;
  if(p.state==='parked'&&!(p.rearm>0||p.cannonCooldown>0||p.rocketCooldown>0||p.rocketRecovery>0||p.rocketWindow>0))return false;
  for(const key of ['cannonCooldown','rocketCooldown','rocketRecovery'])p[key]=Math.max(0,(p[key]||0)-dt);
  if(p.rocketWindow>0){p.rocketWindow=Math.max(0,p.rocketWindow-dt);if(!p.rocketWindow){p.rocketRecovery=HELI.recovery;p.rocketBurstShots=0;}}
  if(p.state==='parked'){if(p.rearm>0){p.rearm=Math.max(0,p.rearm-dt);if(!p.rearm)Object.assign(p,helicopterLoad());}return true;}
  if(p.state==='takeoff'||p.state==='landing'){
    p.remaining=Math.max(0,p.remaining-dt);p.speed=0;p.vx=0;p.vy=0;
    if(!p.remaining){
      if(p.state==='landing'){
        const error=p.fieldLanding?fieldLandingError(world,p,p.fieldLanding):!canLand?'Helipad unavailable.':null;
        if(error){p.state='flying';p.landingError=error;delete p.fieldLanding;}
        else{Object.assign(p,p.fieldLanding||home,{state:'parked',rearm:p.fieldLanding?0:HELI.rearm});delete p.landingError;}
      }else{p.state='flying';delete p.fieldLanding;}
    }return true;
  }
  if(p.state!=='flying')return false;
  if(p.slingOperation){p.speed=0;p.vx=0;p.vy=0;return true;}
  helicopterMotion(world,p,input,dt);
  if(input?.target)p.target={...input.target};
  const desired=p.target?Math.atan2(p.target.x-p.x,-(p.target.y-p.y)):p.angle;
  p.angle+=clamp(angleDelta(p.angle,desired),-HELI.turn*dt,HELI.turn*dt);
  p.turret=(p.turret??p.angle)+clamp(angleDelta(p.turret??p.angle,desired),-HELI.turretSpeed*dt,HELI.turretSpeed*dt);
  if(Math.hypot(p.x-home.x,p.y-home.y)>3)p.leftBase=true;
  if(!p.sling&&p.mission?.phase==='return'&&canLand&&p.leftBase&&p.speed<.8&&Math.hypot(p.x-home.x,p.y-home.y)<1.2&&(!p.mission||['complete','lost','return'].includes(p.mission.phase)))Object.assign(p,{state:'landing',remaining:HELI.transition,vx:0,vy:0,speed:0});
  return true;
}
