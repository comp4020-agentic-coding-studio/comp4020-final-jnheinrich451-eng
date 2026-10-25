import {it,expect} from 'vitest';
import {createWorld} from '../public/world.js';
import {createCombat} from '../public/combat.js';
import {newAirbase,bombPattern,bombError} from '../public/aircraft.js';
import {strikePlan,assignMission,tickMission,missionActive,validateMission,abortMission} from '../public/bomber-mission.js';
import {bomberDive} from '../public/bomber-payloads.js';
import {TYPE_LIMIT,insideField,contactField} from '../public/hazards.js';

function fixture(payload='HE'){
 const b:any=newAirbase('base','pilot',48,48),w:any={...createWorld(),width:128,height:96,terrain:Array(128*96).fill(2),airbases:[b],sites:[],cores:[],artillery:[],tanks:[],ships:[],rails:[]};
 Object.assign(b.aircraft,{state:'flying',x:60,y:40,speed:6,angle:Math.PI/2,payload});return{w,b,p:b.aircraft};
}
const advance=(c:ReturnType<typeof createCombat>,seconds:number)=>{for(let t=0;t<seconds;t+=.1)c.tick(.1,[]);};

it('heavy HE commits one large impact, starts a shared cooldown and separates damage from crater artwork',()=>{
 const {w,p}=fixture('HEAVY'),c=createCombat(w),point=bombPattern(p)[0];
 w.sites.push({id:'near',kind:'alert',x:point.x+9,y:point.y-1,hp:500,state:'hostile'},{id:'outside',kind:'alert',x:point.x+10.2,y:point.y-1,hp:500,state:'hostile'});
 expect(c.bombRun(p)).toBeNull();expect(p.bombCooldown).toBe(14);expect(c.snapshot().barrages[0].missiles).toHaveLength(1);
 c.snapshot().barrages[0].profile.radius=90;expect(c.snapshot().barrages[0].profile.radius).toBe(10);
 const saved=c.checkpoint();p.payload='GAS';const restored=createCombat(w,saved);
 const robot={id:'friend',...point,life:'active',health:100,shield:0};restored.tick(1.9,[],[robot]);
 expect(restored.snapshot().impacts).toHaveLength(1);expect(restored.snapshot().impacts[0]).toMatchObject({weapon:'HE',radius:10});
 expect(restored.snapshot().marks.find((m:any)=>m.kind==='crater').size).toBe(24);
 expect(w.sites.find((s:any)=>s.id==='near').hp).toBeLessThan(500);expect(w.sites.find((s:any)=>s.id==='outside').hp).toBe(500);expect(robot.health).toBe(100);
 expect(c.bombRun(p)).toContain('cooling');
});

it.each(['INCENDIARY','GAS'])('%s reserves one bounded field, restores in-flight patches and preserves friendly immunity',payload=>{
 const {w,p}=fixture(payload),c=createCombat(w);expect(c.bombRun(p)).toBeNull();expect(p.bombCooldown).toBe(12);
 const saved=c.checkpoint(),restored=createCombat(w,saved);expect(restored.snapshot().fields).toHaveLength(1);expect(restored.snapshot().fields[0].pending).toBe(12);
 p.payload='HE';advance(restored,4.5);const state=restored.snapshot(),field=state.fields[0];expect(field.weapon).toBe(payload);expect(field.pending).toBe(0);expect(field.sectors).toHaveLength(12);
 expect(state.impacts.every((i:any)=>i.weapon===payload&&i.minorBlast)).toBe(true);expect(state.marks.filter((m:any)=>m.kind==='crater')).toHaveLength(12);
 const point=field.sectors[0];expect(insideField(field,point.x,point.y)).toBe(true);expect(insideField(field,point.x,point.y+1.81)).toBe(false);
 const robot={id:'friendly',x:point.x,y:point.y,life:'active',health:100,shield:0};restored.tick(.1,[],[robot]);expect(robot.health).toBe(100);
 if(payload==='INCENDIARY'){advance(restored,19);expect(restored.snapshot().fields).toHaveLength(0);}
 else{expect(field.capacity).toBe(18);for(let i=0;i<18;i++)expect(contactField([field],{...point,hp:60})).toBe(field);expect(contactField([field],{...point,hp:60})).toBeNull();advance(restored,30);expect(restored.snapshot().fields[0].capacity).toBe(18);}
});

it('rejects unknown payloads, cooling bomb systems, edge impacts and full hazard capacity without spending a load',()=>{
 const {w,p}=fixture('HEAVY'),c=createCombat(w);p.runs=0;p.bombCooldown=1;expect(c.bombRun(p)).toContain('cooling');expect(p.bombCooldown).toBe(1);p.bombCooldown=0;
 p.runs=2;p.x=114;expect(bombError(w,p)).toContain('inside');p.x=60;p.payload='UNKNOWN';expect(c.bombRun(p)).toContain('supported');
 expect(strikePlan(w,{x:85,y:40},1,'UNKNOWN').error).toBeTruthy();
 p.payload='GAS';const saved=c.checkpoint();saved.fields=Array.from({length:TYPE_LIMIT},(_,i)=>({id:100+i,weapon:'GAS',x:10,y:10,radius:.5,capacity:1}));
 const full=createCombat(w,saved);expect(full.bombRun(p)).toContain('Field limit');expect(p.runs).toBe(2);expect(full.snapshot().barrages).toHaveLength(0);
 p.payload='HEAVY';expect(full.bombRun(p)).toBeNull();
});

it.each(['HEAVY','INCENDIARY','GAS'])('%s flies a dive before a once-only release, matches the planned footprint and returns',payload=>{
 const {w,b,p}=fixture(payload);p.state='parked';p.speed=0;const plan=strikePlan(w,{x:85,y:40},1,payload);expect(validateMission(w,b,plan)).toBeNull();assignMission(b,plan,'payload-mission','caller');
 let c=createCombat(w),shots=0,dived=false;let maxDive=0;
 for(let t=0;t<260&&missionActive(p);t+=.05){
  tickMission(w,b,.05,(plane:any)=>{expect(dived).toBe(true);shots++;const error=c.bombRun(plane);const run=c.snapshot().barrages[0];expect(run.payload).toBe(payload);expect(run.missiles.length).toBe(plan.points!.length);run.missiles.forEach((m:any,i:number)=>expect(Math.hypot(m.x-plan.points![i].x,m.y-plan.points![i].y)).toBeLessThan(.8));c=createCombat(w,c.checkpoint());return error;});
  dived ||= p.mission.phase==='dive';maxDive=Math.max(maxDive,bomberDive(p));
 }
 expect(maxDive).toBeGreaterThan(.8);expect(shots).toBe(1);expect(p).toMatchObject({state:'parked',runs:2,mission:{phase:'complete',payload,released:true}});expect(bomberDive(p)).toBe(0);
});

it('recall during the dive retains both charges and starts no field',()=>{
 const {w,b,p}=fixture('GAS');p.state='parked';p.speed=0;assignMission(b,strikePlan(w,{x:85,y:40},1,'GAS'),'dive-recall','caller');
 const c=createCombat(w);for(let t=0;t<120&&p.mission.phase!=='dive';t+=.05)tickMission(w,b,.05,(plane:any)=>c.bombRun(plane));expect(p.mission.phase).toBe('dive');abortMission(p);
 for(let t=0;t<150&&missionActive(p);t+=.05)tickMission(w,b,.05,(plane:any)=>c.bombRun(plane));expect(p.runs).toBe(2);expect(p.mission.released).toBe(false);expect(c.snapshot().fields).toHaveLength(0);
});
