import {it,expect} from 'vitest';
import {createWorld} from '../public/world.js';
import {newAirbase,tickAircraft,bombError,launchAircraft} from '../public/aircraft.js';
import {GUNSHIP,GUNSHIP_GUNS,gunshipFireError,gunshipAim} from '../public/air-gunship.js';
import {createCombat} from '../public/combat.js';
import {launchCruise,missionError,recoverAircraft,tickMission,missionActive} from '../public/bomber-mission.js';
import {serviceQuote,serviceError} from '../public/facility-service.js';
import {freshLogistics} from '../public/logistics.js';
function fixture(){const b:any=newAirbase('base','pilot',240,240,'air-gunship');const w:any={...createWorld(),width:512,height:512,terrain:Array(512*512).fill(2),sites:[],cores:[],ships:[],airbases:[b],tanks:[],logistics:freshLogistics()};const p=b.aircraft;Object.assign(p,{state:'flying',x:256,y:256,speed:4,angle:0,leftBase:true});return {w,b,p};}
it('flies slowly with a wider manual turn and stable throttle, then lands on an ordinary runway',()=>{
 const {w,b,p}=fixture();for(let i=0;i<40;i++)tickAircraft(w,b,{steer:0,throttle:1},.1);expect(p.speed).toBeCloseTo(8);
 const start=p.angle;for(let i=0;i<10;i++)tickAircraft(w,b,{steer:1,throttle:0},.1);expect(p.angle-start).toBeLessThan(.23);expect(p.bank).toBeGreaterThan(.7);expect(p.speed).toBe(8);
 const saved=structuredClone(b);for(let i=0;i<20;i++)tickAircraft(w,saved,null,.1);expect(saved.aircraft.speed).toBe(8);
 Object.assign(p,{x:242,y:252.6,angle:0,speed:4,bank:0});for(let i=0;i<40;i++)tickAircraft(w,b,null,.1);expect(p.state).toBe('parked');expect(launchAircraft(p)).toBeNull();expect(p.speed).toBe(GUNSHIP.minSpeed);
});
it('validates the left firing arc for every heading and rejects invalid targets before cooldown or projectile mutation',()=>{
 const {w,p}=fixture();for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){p.angle=angle;const left=gunshipAim(p);expect(gunshipFireError(w,p,left,'105')).toBeNull();expect(gunshipFireError(w,p,{x:2*p.x-left.x,y:2*p.y-left.y},'105')).toContain('left firing arc');}
 const c=createCombat(w),before=c.checkpoint();expect(c.gunshipFire(p,{x:NaN,y:0},'25')).toContain('Aim');expect(c.gunshipFire(p,gunshipAim(p),'invalid')).toContain('Choose');expect(c.checkpoint()).toEqual(before);expect(p.gunshipCooldowns).toBeUndefined();
});
it('switches between independent saved cooldowns and keeps accepted HE impacts immutable and friendly-safe',()=>{
 const {w,b,p}=fixture(),c=createCombat(w),target=gunshipAim(p);
 for(const weapon of ['25','40','105']){expect(c.gunshipFire(p,target,weapon)).toBeNull();expect(c.gunshipFire(p,target,weapon)).toContain('cooling');}
 expect(c.snapshot().salvos).toHaveLength(3);const saved=JSON.parse(JSON.stringify(b)),checkpoint=c.checkpoint();p.angle=2;target.x=300;
 const restored=createCombat(w,checkpoint);expect(restored.snapshot().salvos.every(s=>s.targetX===246&&s.targetY===256)).toBe(true);
 const friend={id:'crew',x:246,y:256,health:100,life:'active',shield:0};restored.tick(1,[],[friend]);expect(friend.health).toBe(100);expect(restored.snapshot().marks.filter(m=>m.kind==='crater')).toHaveLength(3);
 saved.aircraft.state='parked';tickAircraft(w,saved,null,.5);expect(saved.aircraft.gunshipCooldowns).toEqual({'25':0,'40':0,'105':2.5});expect(saved.aircraft.gunshipWeapon).toBe('105');
 const full=c.checkpoint();full.salvos=Array.from({length:16},(_,i)=>({...checkpoint.salvos[0],id:100+i}));const limited=createCombat(w,full);p.gunshipCooldowns={};const before=limited.checkpoint();expect(limited.gunshipFire(p,gunshipAim(p),'105')).toContain('capacity');expect(limited.checkpoint()).toEqual(before);expect(p.gunshipCooldowns).toEqual({});
});
it('uses aircraft prices, runway slots, manual orders and existing disconnected-pilot recovery',()=>{
 const {w,b,p}=fixture();p.state='parked';expect(serviceQuote('air-gunship',null).due).toBe(25);expect(serviceError(w,'airbase',b.id,'pilot','air-gunship')).toBeNull();
 expect(bombError(w,p)).toContain('side guns');expect(launchCruise(w,b,'order','pilot')).toContain('manual');expect(missionError(w,b)).toContain('manual');
 Object.assign(p,{state:'flying',x:242,y:262,angle:0,speed:4});expect(recoverAircraft(b,'recovery')).toBe(true);
 for(let i=0;i<1800&&missionActive(p);i++)tickMission(w,b,.1,()=>{throw Error('Recovery must not fire');});expect(p.state).toBe('parked');expect(p.mission.phase).toBe('complete');
});
