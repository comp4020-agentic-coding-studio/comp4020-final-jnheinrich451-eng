import { it, expect } from 'vitest';
import { createWorld, placementError, canStand } from '../public/world.js';
import { AIR, airbaseError, newAirbase, launchAircraft, tickAircraft, bombPattern, bombError, parkingPoint } from '../public/aircraft.js';
import { createCombat } from '../public/combat.js';
import { corePlacementError } from '../public/core.js';
import { tankPlacementError } from '../public/tank.js';
import { missilePlacementError } from '../public/missile.js';
import { railError } from '../public/rail.js';
import { raycast } from '../public/raycast.js';
function fixture(){const w:any={...createWorld(),width:128,height:96,terrain:Array(128*96).fill(2),airbases:[],cores:[],tanks:[],ships:[],rails:[],artillery:[]},b=newAirbase('base','a',48,48);w.airbases.push(b);return{w,b,p:b.aircraft};}
it('reserves an entire land airbase without rebuilding terrain or blocking its walkable runway',()=>{
 const {w,b}=fixture();const empty={...w,airbases:[]};expect(airbaseError(empty,[],[],48,48,'a')).toBeNull();
 expect(airbaseError(w,[],[],48,48,'b')).toContain('airbase');expect(airbaseError(w,[],[],70,48,'a')).toContain('One');
 expect(airbaseError(empty,[],[],3,30,'a')).toContain('16');empty.terrain[50*128+50]=0;expect(airbaseError(empty,[],[],48,48,'a')).toContain('water');empty.terrain[50*128+50]=2;
 expect(placementError(w,[],[],50,50)).toContain('airbase');expect(corePlacementError(w,[],[],50,50,'b')).toBeTruthy();expect(tankPlacementError(w,[],[],50,50,'b')).toBeTruthy();expect(missilePlacementError(w,[],[],50,50,'b')).toBeTruthy();expect(railError(w,[],50,50,'EW',1,'b')).toBeTruthy();
 expect(canStand(w,[],b.x+2,b.y+3)).toBe(true);expect(canStand(w,[],b.x+4.5,b.y+2)).toBe(false);
 expect(raycast(w,[],{x:b.x+3,y:b.y+2},1,0,10).blocked).toBe(true);
});
it('keeps positive forward motion, clamps speed and makes high-speed turns wider',()=>{
 const {w,b,p}=fixture();expect(launchAircraft(p)).toBeNull();tickAircraft(w,b,null,2);expect(p.state).toBe('flying');
 const y=p.y;tickAircraft(w,b,{throttle:-1},1);expect(p.speed).toBe(AIR.minSpeed);expect(p.y).toBeLessThan(y);
 const slow:any={...b,aircraft:{...p,x:64,y:48,angle:0,speed:6}},fast:any={...b,aircraft:{...p,x:64,y:48,angle:0,speed:12}};
 tickAircraft(w,slow,{steer:1},.2);tickAircraft(w,fast,{steer:1},.2);expect(slow.aircraft.angle).toBeGreaterThan(fast.aircraft.angle);
 tickAircraft(w,b,{throttle:1},3);expect(p.speed).toBe(AIR.maxSpeed);
});
it('keeps unattended flight inside the map through smooth boundary turns',()=>{
 const {w,b,p}=fixture();launchAircraft(p);tickAircraft(w,b,null,2);p.speed=AIR.maxSpeed;
 for(let i=0;i<4000;i++){tickAircraft(w,b,null,.1);expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(w.width);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(w.height);}
});
it('commits the preview, holds course through release and shares barrage limits without spending rejected ammunition',()=>{
 const {w,b,p}=fixture(),c=createCombat(w);launchAircraft(p);tickAircraft(w,b,null,2);const preview=bombPattern(p),angle=p.angle,speed=p.speed;
 expect(c.bombRun(p)).toBeNull();expect(p.runs).toBe(1);expect(c.snapshot().barrages[0].missiles).toEqual(preview);
 tickAircraft(w,b,{throttle:1,steer:1},1);expect(p.angle).toBe(angle);expect(p.speed).toBe(speed);expect(c.bombRun(p)).toContain('progress');expect(p.runs).toBe(1);
 tickAircraft(w,b,null,.3);expect(c.bombRun(p)).toBeNull();expect(p.runs).toBe(0);const other={...p,id:'other',runs:2,releaseRemaining:0};expect(c.bombRun(other)).toContain('Two');expect(other.runs).toBe(2);
 c.tick(5,[]);expect(c.snapshot().impacts).toHaveLength(12);expect(c.snapshot().barrages).toHaveLength(0);expect(c.snapshot().marks.filter(m=>m.kind==='crater').length).toBeGreaterThan(0);
 p.releaseRemaining=0;expect(bombError(w,p)).toContain('empty');
});
it('automatically lands only after departure on a slow approach, then rearms at the base',()=>{
 const {w,b,p}=fixture();expect(bombError(w,p)).toContain('Take off');launchAircraft(p);tickAircraft(w,b,null,1);expect(p.state).toBe('takeoff');
 Object.assign(p,{state:'flying',...parkingPoint(b),y:parkingPoint(b).y+6,leftBase:true,angle:0,speed:12,runs:0});tickAircraft(w,b,null,.2);expect(p.state).toBe('flying');
 p.speed=6;tickAircraft(w,b,null,.1);expect(p.state).toBe('landing');expect(bombError(w,p)).toContain('Take off');
 tickAircraft(w,b,null,2);expect(p).toMatchObject({...parkingPoint(b),state:'parked',speed:0,runs:0});expect(launchAircraft(p)).toContain('rearming');
 tickAircraft(w,b,null,8);expect(p.runs).toBe(2);expect(launchAircraft(p)).toBeNull();
});
