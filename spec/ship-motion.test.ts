import { it, expect } from 'vitest';
import { driveShip, stopShip, shipStopped, throttleDemand } from '../public/ship-motion.js';
import { SHIP, sailStep, mooredDock, boardingPoint, shoreRampSite } from '../public/ship.js';
import { CARRIER, carrierField } from '../public/carrier.js';
import { runwayAvailable } from '../public/air-traffic.js';
const body = (kind='gunship'):any => ({kind,x:50,y:50,angle:0,turret:1,speed:0,driveSpeed:0,throttle:0});
const advance = (s:any,steer:number,demand:number,seconds:number,dt=.05) => {
  for(let t=0;t<seconds-1e-8;t+=dt)driveShip(s,steer,demand,dt,s.kind==='carrier'?CARRIER:SHIP,()=>true);
};
it('accelerates to quarter/full speeds, coasts to Stop and brakes before reversing',()=>{
 const s=body();advance(s,0,throttleDemand(1),2);expect(s.driveSpeed).toBeCloseTo(SHIP.speed/4);
 advance(s,0,1,4);expect(s.driveSpeed).toBe(SHIP.speed);
 const y=s.y;advance(s,0,0,.2);expect(s.y).toBeLessThan(y);expect(s.driveSpeed).toBeGreaterThan(0);
 advance(s,0,-1,.2);expect(s.driveSpeed).toBeGreaterThan(0);
 advance(s,0,-1,5);expect(s.driveSpeed).toBe(-SHIP.reverse);
 advance(s,0,0,3);expect(s.driveSpeed).toBe(0);expect(shipStopped(s)).toBe(true);
});
it('centres the rudder gradually and gives full speed a wider turning radius',()=>{
 const quarter=body(),full=body();advance(quarter,0,.25,4);advance(full,0,1,4);
 advance(quarter,1,.25,1);advance(full,1,1,1);
 expect(full.driveSpeed/Math.abs(full.turnRate)).toBeGreaterThan(quarter.driveSpeed/Math.abs(quarter.turnRate));
 expect(full.turret).toBe(1);const angle=full.angle;advance(full,0,1,.2);
 expect(full.rudder).toBeGreaterThan(0);expect(full.rudder).toBeLessThan(1);expect(full.angle).toBeGreaterThan(angle);
 advance(full,0,1,1);expect(full.rudder).toBe(0);expect(full.turnRate).toBe(0);
});
it('keeps harbour pivoting and makes carriers respond more slowly',()=>{
 const small=body(),large=body('carrier');advance(small,1,0,1);advance(large,1,0,1);
 expect(small.angle).toBeGreaterThan(large.angle);expect(large.angle).toBeGreaterThan(0);
 expect(shipStopped(small)).toBe(false);expect(small.x).toBe(50);expect(small.y).toBe(50);
 stopShip(small);stopShip(large);advance(small,0,1,1);advance(large,0,1,1);expect(large.driveSpeed).toBeLessThan(small.driveSpeed);
});
it('uses bounded substeps, preserves collision barriers and never accumulates a large stalled tick',()=>{
 const a=body(),b=body();advance(a,1,1,3,.05);advance(b,1,1,3,.025);
 expect(a.x).toBeCloseTo(b.x,6);expect(a.y).toBeCloseTo(b.y,6);expect(a.angle).toBeCloseTo(b.angle,6);
 const blocked=body();blocked.driveSpeed=SHIP.speed;
 for(let i=0;i<100;i++)driveShip(blocked,0,1,.05,SHIP,(_x:number,y:number)=>y>=49.5);
 expect(blocked.y).toBeGreaterThanOrEqual(49.5);expect(blocked.driveSpeed).toBe(0);
 const stalled=body();driveShip(stalled,0,1,20,SHIP,()=>true);expect(50-stalled.y).toBeLessThan(.02);
});
it('requires actual rest and Stop for docks, ramps and carrier runways',()=>{
 const s={...body('carrier'),id:'c',elapsed:4.5,health:600,berthX:50,berthY:50,dock:{x:52,y:50,angle:0}};
 const w:any={ships:[s],airbases:[],logistics:{jobs:{}}};
 expect(mooredDock(w,s)).toBeTruthy();expect(runwayAvailable(w,carrierField(s))).toBe(true);
 for(const moving of [{speed:1},{turnRate:.2},{throttle:1}]){
  Object.assign(s,{speed:0,turnRate:0,throttle:0},moving);
  expect(mooredDock(w,s)).toBeNull();expect(boardingPoint(w,s)).toBeNull();expect(shoreRampSite(w,[],[],s)).toBeNull();
  expect(runwayAvailable(w,carrierField(s))).toBe(false);
 }
 stopShip(s);expect(runwayAvailable(w,carrierField(s))).toBe(true);
});
it('clears propulsion under a ramp or carrier deck lock',()=>{
 const s:any={...body(),driveSpeed:2,speed:2,throttle:4,rudder:1,ramp:{x:1,y:1}};
 expect(sailStep({},s,1,1,.1)).toBe(true);expect(s).toMatchObject({x:50,y:50,throttle:0,speed:0,rudder:0,driveSpeed:0});
 expect(sailStep({},s,1,1,.1)).toBe(false);
});
