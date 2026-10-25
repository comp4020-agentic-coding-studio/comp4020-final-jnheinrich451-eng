import { nearbyRecovery } from './wreck-recovery.js';
import { driveTank, driveGroundRoute } from './tank-motion.js';
import { angleDelta, turnTurret } from './turret.js';
import { canStand } from './world.js';
import { ECONOMY, facilityCenter, salvageReceivers } from './logistics.js';

export const RECYCLER = Object.freeze({ speed: 3.5, radius: .42, boardRange: 1.8, pickupRange: 2, idleTime: .5 });

// Same bounded ground-drive integrator as tanks, with lighter utility profiles.
export const UTILITY_DRIVE = Object.freeze({
  recycler: Object.freeze({speed:3.5,reverse:1.7,acceleration:3.6,braking:7,turnSpeed:Math.PI,turnSlowdown:1.4,step:.025,maxDt:.15}),
  builder: Object.freeze({speed:3.5,reverse:1.4,acceleration:2.5,braking:6,turnSpeed:Math.PI*.8,turnSlowdown:1.6,step:.025,maxDt:.15})
});
export function stopUtility(truck){Object.assign(truck,{speed:0,driveSpeed:0,vx:0,vy:0,idle:0});}

function moveUtility(world,buildings,truck,input,dt,occupants,profile,driver=driveTank){
  let blocked=false;
  const clear=(x,y)=>{
    const ok=canStand(world,buildings,x,y,undefined,RECYCLER.radius)
      && !(world.logistics?.recyclers||[]).some(r=>r.id!==truck.id&&Math.hypot(r.x-x,r.y-y)<.9)
      && !occupants.some(p=>p.id!==truck.occupant&&p.life!=='disabled'&&Math.hypot(p.x-x,p.y-y)<.75);
    if(!ok)blocked=true;return ok;
  };
  truck.angle??=0;
  const before={x:truck.x,y:truck.y};
  const changed=driver(truck,input,dt,clear,profile);
  truck.speed=Math.hypot(truck.vx||0,truck.vy||0);
  return {moved:Math.hypot(truck.x-before.x,truck.y-before.y)>.00001,changed,blocked};
}

export function recyclerStep(world,buildings,truck,input,dt,occupants=[]){
  if(!Number.isFinite(dt)||dt<=0)return false;
  const profile=UTILITY_DRIVE[truck.kind==='builder'?'builder':'recycler'];
  // Missing/expired control is a safety stop; a live zero input brakes naturally.
  if(!input){const idle=truck.idle||0;stopUtility(truck);truck.idle=idle;}
  const controls=input||{x:0,y:0};
  const result=moveUtility(world,buildings,truck,controls,dt,occupants,profile);
  if(Math.hypot(controls.x,controls.y)||truck.speed>.01||Math.abs(truck.driveSpeed||0)>.01){
    truck.idle=0;truck.collecting=0;truck.task=null;
  }else truck.idle=(truck.idle||0)+Math.min(dt,profile.maxDt);
  return result.changed;
}

export function recyclerRouteStep(world,buildings,truck,dt,occupants=[]){
  if(!Number.isFinite(dt)||dt<=0)return;
  // Skip collinear nodes, retaining corner centers and the final destination.
  while(truck.path?.length>1){
    const a=truck.path[0],b=truck.path[1],dx=a.x-truck.x,dy=a.y-truck.y,ex=b.x-a.x,ey=b.y-a.y;
    if(Math.abs(dx*ey-dy*ex)>.01||dx*ex+dy*ey<0)break;
    truck.path.shift();
  }
  const next=truck.path?.[0];if(!next){stopUtility(truck);return;}
  const dx=next.x-truck.x,dy=next.y-truck.y,distance=Math.hypot(dx,dy);
  if(distance<.025){truck.path.shift();stopUtility(truck);return;}
  const base=UTILITY_DRIVE.recycler;
  // Finish braking and align at corners rather than clipping a narrow bank.
  const heading=Math.atan2(dx,-dy);
  if(Math.abs(angleDelta(truck.angle||0,heading))>.08){
    const result=moveUtility(world,buildings,truck,{x:0,y:0},dt,occupants,base);
    if(!truck.driveSpeed)truck.angle=turnTurret(truck.angle||0,heading,Math.min(dt,base.maxDt),base.turnSpeed);
    truck.blocked=result.blocked;truck.idle=0;
    if(result.blocked){truck.path=[];stopUtility(truck);}return;
  }
  // Slow at each corner or destination so narrow approaches remain usable.
  const demand=Math.min(1,distance*1.8),profile={...base,speed:2.5};
  const result=moveUtility(world,buildings,truck,{x:dx/distance*demand,y:dy/distance*demand},dt,occupants,profile,driveGroundRoute);
  truck.idle=0;truck.blocked=result.blocked;
  if(result.blocked){truck.path=[];stopUtility(truck);}
}

export function recyclerExit(world, buildings, truck, occupants = []) {
  for(const [dx,dy] of [[1.2,0],[-1.2,0],[0,1.2],[0,-1.2],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const p={x:truck.x+dx,y:truck.y+dy};
    if(canStand(world,buildings,p.x,p.y)&&!occupants.some(o=>o.id!==truck.occupant&&o.life!=='disabled'&&(o.hp===undefined||o.hp>0)&&Math.hypot(o.x-p.x,o.y-p.y)<.8)
      &&!(world.logistics?.recyclers||[]).some(r=>r.id!==truck.id&&Math.hypot(r.x-p.x,r.y-p.y)<.9))return p;
  }
  return null;
}

export function parkedTask(world, truck) {
  const l=world.logistics;
  if(truck.cargo>0){const station=salvageReceivers(world).filter(f=>f.kind==='uplink'?f.cargo+(f.inFlight||0)<ECONOMY.cargo*4:(l.groundSupplies||0)<ECONOMY.capacity).filter(f=>Math.hypot(truck.x-f.center.x,truck.y-f.center.y)<=4).sort((a,b)=>Math.hypot(truck.x-a.center.x,truck.y-a.center.y)-Math.hypot(truck.x-b.center.x,truck.y-b.center.y))[0];if(station)return {action:'deliver',id:station.id};}
  if(truck.cargo>=ECONOMY.cargo)return null;
  const crate=l.crates.filter(c=>c.amount>0&&Math.hypot(c.x-truck.x,c.y-truck.y)<=RECYCLER.pickupRange).sort((a,b)=>Math.hypot(a.x-truck.x,a.y-truck.y)-Math.hypot(b.x-truck.x,b.y-truck.y))[0];
  if(crate)return {action:'recover',id:crate.id};
  const wreck=nearbyRecovery(world,truck,'land');if(wreck)return {action:'wreck',id:wreck.id};
  const site=(world.sites||[]).find(s=>s.state==='conquered'&&(l.salvage[s.id]??ECONOMY.salvage)>0&&Math.hypot(truck.x-s.x-1.5,truck.y-s.y-1.5)<=4);
  return site?{action:'collect',id:site.id}:null;
}
