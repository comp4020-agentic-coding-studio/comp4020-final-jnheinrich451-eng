import { canStand } from './world.js';
import { ECONOMY, facilityCenter } from './logistics.js';

export const RECYCLER = Object.freeze({ speed: 3.5, radius: .42, boardRange: 1.8, pickupRange: 2, idleTime: .5 });

export function recyclerStep(world, buildings, truck, input, dt, occupants = []) {
  let dx = input?.x || 0, dy = input?.y || 0;
  const length = Math.hypot(dx, dy); if (length > 1) { dx /= length; dy /= length; }
  const clear = (x,y) => canStand(world,buildings,x,y,undefined,RECYCLER.radius)
    && !(world.logistics?.recyclers || []).some(r => r.id !== truck.id && Math.hypot(r.x-x,r.y-y) < .9)
    && !occupants.some(p => p.id !== truck.occupant && p.life !== 'disabled' && Math.hypot(p.x-x,p.y-y) < .75);
  const oldX=truck.x,oldY=truck.y;
  const x=truck.x+dx*RECYCLER.speed*dt,y=truck.y+dy*RECYCLER.speed*dt;
  if(clear(x,truck.y))truck.x=x;
  if(clear(truck.x,y))truck.y=y;
  const moved=Math.hypot(truck.x-oldX,truck.y-oldY)>.00001;
  if(length){truck.angle=Math.atan2(dx,-dy);truck.idle=0;truck.collecting=0;truck.task=null;}
  else truck.idle=(truck.idle||0)+dt;
  truck.speed=moved?Math.hypot(truck.x-oldX,truck.y-oldY)/dt:0;
  return moved;
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
  if(truck.cargo>0){const station=l.facilities.find(f=>f.kind==='uplink'&&f.remaining<=0&&!(f.launch>0)&&f.cargo<ECONOMY.cargo*4&&Math.hypot(truck.x-facilityCenter(f).x,truck.y-facilityCenter(f).y)<=4);if(station)return {action:'deliver',id:station.id};}
  if(truck.cargo>=ECONOMY.cargo)return null;
  const crate=l.crates.filter(c=>c.amount>0&&Math.hypot(c.x-truck.x,c.y-truck.y)<=RECYCLER.pickupRange).sort((a,b)=>Math.hypot(a.x-truck.x,a.y-truck.y)-Math.hypot(b.x-truck.x,b.y-truck.y))[0];
  if(crate)return {action:'recover',id:crate.id};
  const site=(world.sites||[]).find(s=>s.state==='conquered'&&(l.salvage[s.id]??ECONOMY.salvage)>0&&Math.hypot(truck.x-s.x-1.5,truck.y-s.y-1.5)<=4);
  return site?{action:'collect',id:site.id}:null;
}
