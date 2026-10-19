import {it,expect} from 'vitest';
import {flightRoute,cruiseSite,flakZones} from '../public/air-routing.js';
import {newAirbase} from '../public/aircraft.js';
import {strikePlan,prepareMission,validateMission,assignMission,tickMission,isCruising,missionError} from '../public/bomber-mission.js';
import {createCombat} from '../public/combat.js';
import {createWorld} from '../public/world.js';
const fixture=(kind='bomber')=>{const b:any=newAirbase('base','pilot',48,48,kind),w:any={...createWorld(),width:128,height:96,terrain:Array(128*96).fill(2),sites:[],airbases:[b],ships:[],tanks:[],cores:[],artillery:[],rails:[]};Object.assign(b.aircraft,{x:50,y:55,state:'flying',speed:6,angle:Math.PI/2,leftBase:true,mission:{id:'cruise',kind:'cruise',phase:'cruise',cruiseCenter:{x:50,y:55},cruiseIndex:0,elapsed:0}});return {w,b,p:b.aircraft};};
it('routes around known live flak and stops treating conquered sites as threats',()=>{
 const w:any={width:256,height:192,sites:[{kind:'anti-air',state:'hostile',hp:600,x:98.5,y:58.5}]},start={x:30,y:60},end={x:200,y:60};
 const route=flightRoute(w,start,end);expect(route.limited).toBe(false);expect(route.points.length).toBeGreaterThan(1);
 let previous=start;for(const point of route.points){for(let t=0;t<=1;t+=.01)expect(Math.hypot(previous.x+(point.x-previous.x)*t-100,previous.y+(point.y-previous.y)*t-60)).toBeGreaterThan(24);previous=point;}
 w.sites[0].state='conquered';expect(flightRoute(w,start,end).points).toEqual([end]);
});
it('chooses a different cruise area with room for the orbit and bank outside flak',()=>{
 const w:any={width:256,height:192,sites:[{kind:'anti-air',state:'hostile',hp:600,x:98.5,y:58.5}]},p={x:100,y:60,angle:1},site=cruiseSite(w,p,p);
 expect(site.limited).toBe(false);expect(Math.hypot(site.center.x-p.x,site.center.y-p.y)).toBeGreaterThanOrEqual(44);
 expect(flakZones(w)).toHaveLength(1);
 const covered=cruiseSite({width:48,height:48,sites:[{kind:'anti-air',state:'hostile',hp:600,x:22.5,y:22.5}]},{x:24,y:24,angle:0});expect(covered.limited).toBe(true);
});
for(const kind of ['bomber','attack-jet'])it('flies a '+kind+' pass and relocates before resuming cruise',()=>{
 const {w,b,p}=fixture(kind),combat=createCombat(w),plan=prepareMission(w,b,strikePlan(w,{x:85,y:40},1,'HE',p));
 expect(missionError(w,b)).toBeNull();expect(validateMission(w,b,plan)).toBeNull();assignMission(b,plan,'remote-strike','pilot');
 let shots=0,sawEgress=false;for(let t=0;t<150&&!(p.mission.released&&isCruising(p));t+=.05){combat.tick(.05,[],[]);tickMission(w,b,.05,(q:any)=>{const e=kind==='attack-jet'?combat.strafe(q):combat.bombRun(q);if(!e)shots++;return e;});sawEgress ||= p.mission.phase==='egress';}
 expect(shots).toBe(kind==='attack-jet'?12:1);expect(sawEgress).toBe(true);expect(isCruising(p)).toBe(true);expect(p.occupant).toBeNull();
 expect(Math.hypot(p.mission.cruiseCenter.x-85,p.mission.cruiseCenter.y-40)).toBeGreaterThanOrEqual(30);
 expect(kind==='attack-jet'?p.rounds:p.runs).toBe(kind==='attack-jet'?78:1);
});
it('restores the remaining jet burst without replaying spent rounds',()=>{
 const {w,b,p}=fixture('attack-jet'),combat=createCombat(w);assignMission(b,prepareMission(w,b,strikePlan(w,{x:85,y:40},1,'HE',p)),'saved-jet','pilot');
 for(let t=0;t<120&&p.rounds>85;t+=.05){combat.tick(.05,[],[]);tickMission(w,b,.05,(q:any)=>combat.strafe(q));}
 expect(p.rounds).toBe(85);const saved=JSON.parse(JSON.stringify({world:w,combat:combat.checkpoint()})),next=createCombat(saved.world,saved.combat),base=saved.world.airbases[0];
 for(let t=0;t<150&&!isCruising(base.aircraft);t+=.05){next.tick(.05,[],[]);tickMission(saved.world,base,.05,(q:any)=>next.strafe(q));}
 expect(base.aircraft.rounds).toBe(78);expect(isCruising(base.aircraft)).toBe(true);
});

it('flies the transit detour outside a flak envelope using the real turn controller',()=>{
 const {w,b,p}=fixture();Object.assign(w,{width:256,height:192,terrain:Array(256*192).fill(2),sites:[{kind:'anti-air',state:'hostile',hp:600,x:98.5,y:58.5}]});Object.assign(p,{x:30,y:60,angle:Math.PI/2});
 const plan=prepareMission(w,b,strikePlan(w,{x:210,y:60},1,'HE',p));expect(plan.routeLimited).toBe(false);expect(plan.outbound!.length).toBeGreaterThan(1);assignMission(b,plan,'flak-detour','pilot');
 let closest=Infinity;for(let t=0;t<100&&p.mission.phase==='outbound';t+=.05){tickMission(w,b,.05,()=>null);closest=Math.min(closest,Math.hypot(p.x-100,p.y-60));}
 expect(p.mission.phase).toBe('approach');expect(closest).toBeGreaterThan(24);
});

it('aligns a cruising bomber before the run even when it starts midway through a tight turn',()=>{
 for(const delay of [1.5,1.75,9.75]){const {w,b,p}=fixture();for(let t=0;t<delay;t+=.05)tickMission(w,b,.05,()=>null);const plan=prepareMission(w,b,strikePlan(w,{x:78.5,y:45.5},1,'HE',p));expect(validateMission(w,b,plan)).toBeNull();}
});
