import {it,expect} from 'vitest';
import {createWorld} from '../public/world.js';
import {newAirbase,airbaseError,tickAircraft,launchAircraft,hurtAircraft} from '../public/aircraft.js';
import {HELI,HELI_ROCKET,helicopterFireError,spendHelicopterShot} from '../public/helicopter.js';
import {requestHelicopterLanding,fleetCapacity,fleetCount,newAircraftError,reserveLanding,freeAirbase} from '../public/air-traffic.js';
import {createCombat} from '../public/combat.js';
import {freshLogistics} from '../public/logistics.js';
import {airbaseAt,hangarBlocks} from '../public/footprints.js';
import {serviceError,serviceQuote} from '../public/facility-service.js';
import {assignMission,prepareMission,strikePlan,validateMission,tickMission,isCruising,recoverAircraft} from '../public/bomber-mission.js';
const field=()=>{const b:any=newAirbase('pad','pilot',30,30,'helicopter','helipad');const w:any={...createWorld(),width:128,height:96,terrain:Array(128*96).fill(2),sites:[],airbases:[b],ships:[],tanks:[],cores:[],artillery:[],rails:[],logistics:freshLogistics()};return {w,b,p:b.aircraft};};
it('reserves exactly a 3x3 helipad and separates rotorcraft fleet capacity',()=>{
 const {w,b,p}=field();expect(airbaseAt(w,32,32)).toBe(true);expect(airbaseAt(w,33,32)).toBe(false);expect(hangarBlocks(w,34,32)).toBe(false);
 expect(fleetCapacity(w)).toBe(0);expect(fleetCapacity(w,'helicopter')).toBe(1);expect(fleetCount(w,'helicopter')).toBe(1);
 const runway:any=newAirbase('runway','pilot',60,40);runway.aircraft.state='vacant';w.airbases.push(runway);
 expect(reserveLanding(w,p,'runway')).toMatch(/runway/);expect(freeAirbase(w,p)?.id).toBe(b.id);
 expect(newAircraftError(w,runway,'pilot','helicopter')).toMatch(/helipad/);
 expect(serviceError(w,'airbase',b.id,'pilot','bomber')).toMatch(/helipad/);
 expect(serviceQuote('helicopter',null).cost).toBeLessThan(serviceQuote('bomber',null).cost);
});
it('validates water, edge and the full pad footprint before deployment',()=>{
 const {w}=field();expect(airbaseError(w,[],[],10,10,'pilot','helipad')).toBeNull();w.terrain[12*128+12]=0;
 expect(airbaseError(w,[],[],10,10,'pilot','helipad')).toBeTruthy();expect(airbaseError(w,[],[],127,10,'pilot','helipad')).toBeTruthy();
});
it('hovers, strafes independently of aim, brakes and lands at a compatible pad',()=>{
 const {w,b,p}=field();expect(launchAircraft(p)).toBeNull();tickAircraft(w,b,null,2.1);expect(p.state).toBe('flying');expect(p.speed).toBe(0);
 for(let t=0;t<2;t+=.05)tickAircraft(w,b,{x:1,y:0,target:{x:31.5,y:10}},.05);
 expect(p.x).toBeGreaterThan(37);expect(p.y).toBeCloseTo(31.5);expect(p.speed).toBeLessThanOrEqual(HELI.speed);
 for(let t=0;t<2;t+=.05)tickAircraft(w,b,null,.05);expect(p.speed).toBeLessThan(.01);
 Object.assign(p,{x:31.5,y:31.5,vx:0,vy:0,speed:0,leftBase:true});tickAircraft(w,b,null,.05);expect(p.state).toBe('flying');expect(requestHelicopterLanding(w,p)).toBeNull();expect(p.state).toBe('landing');tickAircraft(w,b,null,2.1);expect(p.state).toBe('parked');
 p.rockets=0;p.rounds=0;tickAircraft(w,b,null,8.1);expect(p.rockets).toBe(40);expect(p.rounds).toBe(120);
});
it('sweeps new rockets while preserving previous trajectories, ammo and cooldown across restoration',()=>{
 const {w,b,p}=field();Object.assign(p,{state:'flying',x:50,y:50,turret:0});const combat=createCombat(w),a={x:50,y:10},z={x:90,y:50};
 expect(combat.helicopterFire(p,a,true)).toBeNull();const first=structuredClone(combat.snapshot().salvos[0]);
 expect(combat.helicopterFire(p,a,true)).toMatch(/cycling/);tickAircraft(w,b,null,.26);p.turret=Math.PI/2;
 expect(combat.helicopterFire(p,z,true)).toBeNull();const shells=combat.snapshot().salvos;expect(shells[0]).toEqual(first);expect(shells[1].targetX).toBe(62);expect(first.targetY).toBe(38);
 expect(p.rockets).toBe(38);const restored:any=JSON.parse(JSON.stringify(b));expect(helicopterFireError(w,restored.aircraft,z,true)).toMatch(/cycling/);
 tickAircraft(w,restored,null,5);expect(helicopterFireError(w,restored.aircraft,z,true)).toMatch(/cooling/);tickAircraft(w,restored,null,8.1);expect(helicopterFireError(w,restored.aircraft,z,true)).toBeNull();
});
it('caps each rocket window and rejects invalid targets without spending ammunition',()=>{
 const {w,b,p}=field();p.state='flying';const target={x:31.5,y:10};let shots=0;
 for(let t=0;t<5.5;t+=.01){if(!helicopterFireError(w,p,target,true)){spendHelicopterShot(p,true);shots++;}tickAircraft(w,b,null,.01);}
 expect(shots).toBe(20);expect(p.rockets).toBe(20);expect(p.rocketRecovery).toBeGreaterThan(0);
 const combat=createCombat(w);expect(combat.helicopterFire(p,{x:NaN,y:1})).toBeTruthy();expect(p.rounds).toBe(120);expect(combat.snapshot().salvos).toHaveLength(0);
});
it('shares bounded HE effects and remains vulnerable to anti-air damage',()=>{
 const {w,p}=field();Object.assign(p,{state:'flying',x:50,y:50,turret:Math.PI/2});const combat=createCombat(w);
 expect(combat.helicopterFire(p,{x:55,y:50},true)).toBeNull();combat.tick(HELI_ROCKET.flight+.1,[],[]);
 expect(combat.snapshot().impacts.some(i=>i.weapon==='HE'&&i.x===55)).toBe(true);
 expect(hurtAircraft(p,180)).toBe(true);expect(p.state).toBe('destroyed');expect(combat.helicopterFire(p,{x:55,y:50},true)).toBeTruthy();
});
it('performs finite remote support and relocates to a different holding area',()=>{
 const {w,b,p}=field();Object.assign(p,{state:'flying',x:40,y:40,leftBase:true,mission:{id:'cruise',kind:'cruise',phase:'cruise',elapsed:0,cruiseCenter:{x:40,y:40}}});
 const plan=prepareMission(w,b,strikePlan(w,{x:75,y:45},1,'HE',p));expect(validateMission(w,b,plan)).toBeNull();assignMission(b,plan,'support','pilot');
 const combat=createCombat(w);let sawEgress=false;
 for(let t=0;t<120&&!(p.mission.released&&isCruising(p));t+=.05){combat.tick(.05,[],[]);tickMission(w,b,.05,(q:any,target:any,rocket:boolean)=>combat.helicopterFire(q,target,rocket));sawEgress ||= p.mission.phase==='egress';}
 expect(sawEgress).toBe(true);expect(isCruising(p)).toBe(true);expect(p.rounds).toBeLessThan(120);expect(p.rockets).toBe(20);expect(Math.hypot(p.x-75,p.y-45)).toBeGreaterThan(25);
});
it('recovers unattended helicopters onto clear ground if their pad is unavailable',()=>{
 const {w,b,p}=field();Object.assign(p,{state:'flying',x:60,y:50,leftBase:true});b.destroyed=true;expect(recoverAircraft(b,'return')).toBe(true);
 for(let t=0;t<125&&p.state!=='parked';t+=.1)tickMission(w,b,.1,()=>null);
 expect(p.state).toBe('parked');expect(p.fieldLanding).toBeTruthy();expect(p.health).toBe(180);expect(p.rearm).toBe(0);expect(b.wrecks||[]).toHaveLength(0);
});
