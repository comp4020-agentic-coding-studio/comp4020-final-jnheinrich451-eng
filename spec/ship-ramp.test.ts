import { expect, it } from 'vitest';
import { createWorld, tileAt, canStand, placementError } from '../public/world.js';
import { SHIP, shipSite, shoreRampSite, rampClear, boardingPoint, mooredDock, sailStep, dockAt } from '../public/ship.js';
import { railError } from '../public/rail.js';
import { corePlacementError } from '../public/core.js';
import { tankPlacementError } from '../public/tank.js';
import { missilePlacementError } from '../public/missile.js';
const coast=()=>({...createWorld(),terrain:Array.from({length:48*36},(_,i)=>i%48<20?0:2 as number),ships:[] as any[],tanks:[] as any[],cores:[] as any[],rails:[] as any[],artillery:[] as any[]});
function setup(){const w=coast(),s:any={...shipSite(w,[],[],17,12,'a').ship!,id:'ship',x:17.8,y:24.5,angle:0,elapsed:SHIP.duration,occupant:'a'};w.ships.push(s);return{w,s};}
const anchor=(s:any,p:any)=>s.ramp={...p,shipX:s.x,shipY:s.y,shipAngle:s.angle};
it('finds a short shore crossing away from all docks without changing terrain or hull pose',()=>{
 const {w,s}=setup(),terrain=[...w.terrain];expect(mooredDock(w,s)).toBeNull();
 const p=shoreRampSite(w,[],[],s);expect(p).toEqual({x:20.5,y:24.5});anchor(s,p);
 expect(boardingPoint(w,s)).toEqual(s.ramp);expect(canStand(w,[],p!.x,p!.y)).toBe(true);
 expect(sailStep(w,s,1,1,2)).toBe(false);expect(s).toMatchObject({x:17.8,y:24.5,angle:0});
 expect(w.terrain).toEqual(terrain);expect(tileAt(w,19,24)).toBe(0);
 s.ramp=null;expect(sailStep(w,s,0,1,.2)).toBe(true);expect(s.y).toBeLessThan(24.5);
});
it('rejects ocean, distance, rocks, blocked shore, intervening land and other hulls',()=>{
 const {w,s}=setup(),point={x:20.5,y:24.5};
 expect(rampClear(w,[],s,{x:19.5,y:24.5})).toBe(false);
 expect(rampClear(w,[],s,{x:23.5,y:24.5})).toBe(false);
 expect(rampClear(w,[{x:20,y:24}],s,point)).toBe(false);
 w.terrain[24*48+19]=3;expect(rampClear(w,[],s,point)).toBe(false);
 w.terrain[24*48+19]=2;expect(rampClear(w,[],s,point)).toBe(false);
 w.terrain[24*48+19]=0;w.ships.push({...s,id:'other',x:19.4,y:24.5});expect(rampClear(w,[],s,point)).toBe(false);
 w.ships.pop();s.x=10;expect(shoreRampSite(w,[],[],s)).toBeNull();
});
it('chooses unoccupied shore and reserves the landing against all ground construction until retracted',()=>{
 const {w,s}=setup();const p=shoreRampSite(w,[],[{id:'enemy',x:20.5,y:24.5,hp:60}],s)!;
 expect(p).toBeTruthy();expect(p.y).not.toBe(24.5);anchor(s,p);const x=Math.floor(p.x),y=Math.floor(p.y);
 expect(dockAt(w,x,y)).toBe(true);expect(placementError(w,[],[],x,y)).toContain('boarding');
 // Isolate the reservation rule from earlier coastline footprint rejections.
 const ground={...w,terrain:w.terrain.map(()=>2)};
 expect(railError(ground,[],x,y,'NS',1,'b')).toContain('dock');
 expect(corePlacementError(ground,[],[],x,y,'b')).toContain('dock');expect(tankPlacementError(ground,[],[],x,y,'b')).toContain('dock');expect(missilePlacementError(ground,[],[],x,y,'b')).toContain('dock');
 s.ramp=null;expect(dockAt(w,x,y)).toBe(false);
});
it('revalidates blocked, moved and destroyed ships rather than returning a stale boarding point',()=>{
 const {w,s}=setup(),p=shoreRampSite(w,[],[],s)!;anchor(s,p);
 expect(boardingPoint(w,s,[{x:20,y:24}])).toBeNull();
 s.x+=.1;expect(boardingPoint(w,s)).toBeNull();s.x-=.1;
 s.angle+=.1;expect(boardingPoint(w,s)).toBeNull();s.angle-=.1;
 s.destroyed=true;expect(boardingPoint(w,s)).toBeNull();expect(dockAt(w,20,24)).toBe(false);
});
it('uses rotated hull clearance rather than requiring the original berth heading',()=>{
 for(const angle of [Math.PI/8,Math.PI/2,-Math.PI/2,Math.PI]){
  const {w,s}=setup();s.angle=angle;const p=shoreRampSite(w,[],[],s);
  expect(p).toBeTruthy();anchor(s,p);expect(boardingPoint(w,s)).toEqual(s.ramp);
 }
});
