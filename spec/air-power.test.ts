import {it,expect} from 'vitest';
import {createWorld} from '../public/world.js';
import {createCombat} from '../public/combat.js';
import {newAirbase,bombPattern,tickAircraft,launchError} from '../public/aircraft.js';
import {payloadProfile} from '../public/bomber-payloads.js';
import {missionError,strikePlan} from '../public/bomber-mission.js';
import {JET,JET_GUN,jetBurstPoints} from '../public/attack-jet.js';
import {fieldArea} from '../public/hazards.js';
function fixture(kind='bomber'){
 const b:any=newAirbase('base','pilot',180,180,kind),w:any={...createWorld(),width:384,height:384,terrain:Array(384*384).fill(2),sites:[],ships:[],tanks:[],cores:[],airbases:[b]};
 Object.assign(b.aircraft,{x:192,y:192,angle:0,speed:6,state:'flying',runs:0,rounds:0});return {b,w,p:b.aircraft};
}
it('allows empty legacy fixed-wing loads, shares bomb cooldown across types and restores it without free refills',()=>{
 const {w,b,p}=fixture(),c=createCombat(w);p.payload='HEAVY';expect(c.bombRun(p)).toBeNull();expect(p.bombCooldown).toBe(14);
 const accepted=c.checkpoint(),saved=JSON.parse(JSON.stringify(b));p.payload='GAS';expect(c.bombRun(p)).toContain('cooling');
 const restored=createCombat(w,accepted);expect(restored.snapshot().barrages[0]).toMatchObject({payload:'HEAVY',profile:{radius:10,damage:600,craterSize:24}});
 saved.aircraft.state='parked';saved.aircraft.rearm=8;expect(launchError(saved.aircraft)).toBeNull();tickAircraft(w,saved,null,7);expect(saved.aircraft.bombCooldown).toBe(7);expect(saved.aircraft.rearm).toBe(0);
 tickAircraft(w,saved,null,7);Object.assign(saved.aircraft,{state:'flying',payload:'GAS'});expect(restored.bombRun(saved.aircraft)).toBeNull();
 expect(restored.snapshot().barrages[0].payload).toBe('HEAVY');
});
it('places two simultaneous rows of six over exactly twice the old strip length at both speeds and all headings',()=>{
 const {p,w}=fixture();
 for(const speed of [6,12])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  Object.assign(p,{speed,angle});const points=bombPattern(p);expect(points).toHaveLength(12);
  expect(points[0].launch).toBe(0);expect(points[11].launch).toBe(2.5);
  for(let i=0;i<12;i+=2){expect(points[i].launch).toBe(points[i+1].launch);expect(Math.hypot(points[i].x-points[i+1].x,points[i].y-points[i+1].y)).toBeCloseTo(2.4);}
  expect(Math.hypot(points[10].x-points[0].x,points[10].y-points[0].y)).toBeCloseTo(speed*1.25*2);
 }
 expect(strikePlan(w,{x:192,y:192},0,'HE',p).points).toHaveLength(12);
});
it('bounds rapid fire, rejects whole bursts atomically and keeps accepted impacts immutable across restore',()=>{
 const {w,p}=fixture('attack-jet'),c=createCombat(w);expect(c.strafe(p,true)).toBeNull();expect(p.rounds).toBe(0);expect(c.snapshot().salvos).toHaveLength(3);expect(c.strafe(p,true)).toContain('reloading');
 expect(c.strafe(p)).toBeNull();const saved=c.checkpoint(),points=jetBurstPoints(p);p.angle=1;
 const restored=createCombat(w,saved);expect(restored.snapshot().salvos.slice(0,3).map(s=>({x:s.targetX,y:s.targetY}))).toEqual(points);
 const friend={id:'friend',...points[1],health:100,life:'active',shield:0};restored.tick(.05,[],[friend]);expect(restored.snapshot().impacts).toHaveLength(3);expect(friend.health).toBe(100);
 expect(restored.snapshot().marks.filter(m=>m.kind==='crater').every(m=>m.size===JET_GUN.craterSize)).toBe(true);
 const full=createCombat(w);const state=full.checkpoint();state.salvos=Array.from({length:JET.maxRounds-2},(_,i)=>({...saved.salvos[0],id:100+i}));const limited=createCombat(w,state),before=limited.checkpoint();expect(limited.strafe(p,true)).toContain('capacity');expect(limited.checkpoint()).toEqual(before);
});
it('allows another cruise strike with zero old ammunition while helicopter reserves still apply',()=>{
 for(const kind of ['bomber','attack-jet','helicopter']){
  const {w,b,p}=fixture(kind);p.rockets=0;p.mission={kind:'cruise',phase:'cruise'};
  if(kind==='helicopter')expect(missionError(w,b)).toContain('Empty');else expect(missionError(w,b)).toBeNull();
 }
 expect(payloadProfile('HEAVY')).toMatchObject({radius:10,damage:600,cooldown:14});
});

it('admits a full-speed diagonal hazard strip and restores its conservative area budget',()=>{
 const {w,p}=fixture();Object.assign(p,{payload:'GAS',angle:Math.PI/4,speed:12});const c=createCombat(w);
 expect(c.bombRun(p)).toBeNull();const saved=c.checkpoint(),field=saved.fields[0];
 expect(field.box.width*field.box.height).toBeGreaterThan(512);expect(fieldArea(field)).toBeCloseTo(12*Math.PI*1.8**2);
 const restored=createCombat(w,saved);restored.tick(5,[]);expect(restored.snapshot().fields[0].sectors).toHaveLength(12);expect(fieldArea(restored.snapshot().fields[0])).toBe(fieldArea(field));
 p.bombCooldown=0;p.releaseRemaining=0;expect(restored.bombRun(p)).toBeNull();restored.tick(5,[]);
 p.bombCooldown=0;p.releaseRemaining=0;expect(restored.bombRun(p)).toContain('area limit');expect(p.bombCooldown).toBe(0);
 const legacy={...field};delete legacy.reservedArea;expect(fieldArea(legacy)).toBe(field.box.width*field.box.height);
});
