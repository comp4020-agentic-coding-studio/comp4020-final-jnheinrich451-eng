import {expect,it} from 'vitest';
import {createVesper} from '../public/vesper-world.js';
import {createPlanet} from '../public/planet-templates.js';
import {mountainAt,flightLineClear,inlandWaterAt} from '../public/terrain-rules.js';
import {mountainRoute} from '../public/mountain-flight.js';
import {canStand,tileAt} from '../public/world.js';
import {shipyardSite} from '../public/shipyard.js';
import {canSail} from '../public/ship.js';
import {canSwim} from '../public/naval.js';
import {freshLogistics} from '../public/logistics.js';
import {corePlacementError} from '../public/core.js';
import {tankPlacementError} from '../public/tank.js';
import {newAirbase,tickAircraft,airbaseError} from '../public/aircraft.js';
import {helicopterMotion} from '../public/helicopter.js';
import {strikePlan,recoverAircraft,tickMission,missionActive} from '../public/bomber-mission.js';
const world=():any=>({...createVesper(),cores:[],tanks:[],ships:[],artillery:[],rails:[],airbases:[],sites:[],logistics:freshLogistics()});
it('creates a repeatable distinct planet without modifying Caldera',()=>{
 const a=createPlanet(),before=JSON.stringify(a),v=createVesper();expect(v).toEqual(createVesper());expect(JSON.stringify(a)).toBe(before);
 expect(v.terrain).not.toEqual(a.terrain);expect(v.terrain).toHaveLength(512*384);expect(v.mountains.some(Boolean)).toBe(true);expect(new Set(v.waterKinds)).toEqual(new Set([0,1,2,3]));
 expect(JSON.parse(JSON.stringify(v))).toEqual(v);
});
it('reserves a core landing, runway plain and large ocean dock',()=>{
 const w=world();expect(corePlacementError(w,[],[],72,80,'p')).toBeNull();expect(airbaseError(w,[],[],60,70,'p')).toBeNull();
 expect(shipyardSite(w,[],[],24,80,'p',2).error).toBeNull();
});
it('blocks mountains even if flooring is present, and prevents covering them with pods',()=>{
 const w=world(),index=w.mountains.findIndex(Boolean),x=index%w.width,y=Math.floor(index/w.width);w.logistics.floors=[index];
 expect(tileAt(w,x,y)).toBe(3);expect(canStand(w,[],x+.5,y+.5)).toBe(false);
 expect(corePlacementError(w,[],[],x,y,'p')).toContain('mountains');expect(tankPlacementError(w,[],[],x,y,'p')).toContain('mountains');
});
it('allows swimmers in lakes while excluding every ship type',()=>{
 const w=world();expect(inlandWaterAt(w,316,110)).toBe(true);expect(canSwim(w,316.5,110.5)).toBe(true);
 for(const kind of ['gunship','carrier','transport','submarine']){const s={id:'s',kind,navalScale:2,x:316,y:110,angle:0};expect(canSail(w,s)).toBe(false);expect(canSail(w,s,256,192)).toBe(true);}
});
function ridgeWorld():any{const width=160,height=128,mountains=Array(width*height).fill(0),terrain=Array(width*height).fill(2);for(let y=30;y<96;y++)for(let x=77;x<83;x++){mountains[y*width+x]=2;terrain[y*width+x]=3;}return{width,height,mountains,terrain,ships:[],airbases:[],sites:[],logistics:freshLogistics()};}
it('routes around a mountain chain and refuses a target inside the ridge',()=>{
 const w=ridgeWorld(),from={x:30,y:60},to={x:130,y:60},r=mountainRoute(w,from,to);expect(r.blocked).toBe(false);expect(r.points.length).toBeGreaterThan(1);
 let last=from;for(const p of r.points){expect(flightLineClear(w,last,p)).toBe(true);last=p;}expect(last).toEqual(to);
 expect(mountainRoute(w,from,{x:80,y:60}).blocked).toBe(true);expect(strikePlan(w,{x:80,y:60},1).error).toContain('mountains');
});
it.each(['bomber','attack-jet','air-gunship'])('turns the manual %s away before entering a ridge',kind=>{
 const w=ridgeWorld(),base:any=newAirbase('a','p',20,20,kind);Object.assign(base.aircraft,{state:'flying',x:45,y:60,angle:Math.PI/2,speed:kind==='air-gunship'?8:12,leftBase:true});w.airbases=[base];let warned=false,distance=0;
 for(let i=0;i<350;i++){const last={x:base.aircraft.x,y:base.aircraft.y};tickAircraft(w,base,{throttle:1,steer:0},.05);expect(flightLineClear(w,last,base.aircraft)).toBe(true);warned ||=base.aircraft.terrainWarning;distance+=Math.hypot(last.x-base.aircraft.x,last.y-base.aircraft.y);}
 expect(warned).toBe(true);expect(distance).toBeGreaterThan(70);expect(mountainAt(w,base.aircraft.x,base.aircraft.y)).toBe(0);
});
it('brakes the helicopter at a ridge without tunnelling through it',()=>{
 const w=ridgeWorld(),p:any={x:74,y:60,vx:4,vy:0,speed:4};for(let i=0;i<60;i++)helicopterMotion(w,p,{x:1,y:0},.05);expect(p.x).toBeLessThan(77);expect(p.vx).toBe(0);expect(p.terrainWarning).toBe(true);
});
it('recovers an unattended bomber around the ridge to its runway',()=>{
 const w=ridgeWorld(),base:any=newAirbase('a','p',20,50);w.airbases=[base];Object.assign(base.aircraft,{state:'flying',x:130,y:60,angle:-Math.PI/2,speed:6,leftBase:true});recoverAircraft(base,'return');
 for(let i=0;i<2400&&missionActive(base.aircraft);i++){const last={x:base.aircraft.x,y:base.aircraft.y};tickMission(w,base,.1,()=>null);expect(flightLineClear(w,last,base.aircraft)).toBe(true);}
 expect(base.aircraft.state).toBe('parked');expect(base.aircraft.mission.phase).toBe('complete');
});
