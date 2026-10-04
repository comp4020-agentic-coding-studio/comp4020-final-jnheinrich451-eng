import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { shipSite, boardingPoint, shoreRampSite, sailStep } from '../public/ship.js';
import { requestDepth, tickDepth, depthState, diveBattery, resetDepth } from '../public/submarine-depth.js';
import { submarineFireError } from '../public/submarine.js';
import { swimStep } from '../public/naval.js';
import { createCombat } from '../public/combat.js';
function fixture(){
 const w:any={...createWorld(),width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128<64?0:2),ships:[],cores:[],tanks:[],rails:[],artillery:[]};
 const s:any={...shipSite(w,[],[],60,20,'a','submarine').ship!,id:'sub',elapsed:4.5,health:300};w.ships.push(s);return{w,s};
}
it('migrates legacy surface defaults; times transitions, exhaustion and recharge without a permanent escape',()=>{
 const {s}=fixture();expect(depthState(s)).toBe('surfaced');expect(diveBattery(s)).toBe(30);
 expect(requestDepth(s,'dive')).toBeNull();tickDepth(s,1);expect(s.depth).toBe('diving');
 requestDepth(s,'dive');expect(s.depthRemaining).toBe(1);tickDepth(s,1);expect(s.depth).toBe('submerged');
 tickDepth(s,29);expect(s.diveBattery).toBe(1);tickDepth(s,1);expect(s.depth).toBe('surfacing');
 expect(requestDepth(s,'dive')).toContain('Finish');tickDepth(s,2);expect(s.depth).toBe('surfaced');
 expect(requestDepth(s,'dive')).toContain('Recharge');tickDepth(s,5);expect(s.diveBattery).toBe(10);
 expect(requestDepth(s,'dive')).toBeNull();tickDepth(s,2);expect(s.depth).toBe('submerged');
 tickDepth(s,100);expect(s.depth).toBe('surfaced');expect(s.diveBattery).toBe(30);
 requestDepth(s,'dive');tickDepth(s,.5);requestDepth(s,'surface');expect(s.depth).toBe('surfacing');
 resetDepth(s);expect(s).toMatchObject({depth:'surfaced',depthRemaining:0,diveBattery:30});
});
it('requires surface access for missiles and boarding, rejects diving while anchored or launching, and still sails underwater',()=>{
 const {w,s}=fixture();expect(boardingPoint(w,s)).toBeTruthy();s.ramp={};expect(requestDepth(s,'dive')).toContain('ramp');delete s.ramp;
 s.launchRemaining=.1;expect(requestDepth(s,'dive')).toContain('launching');s.launchRemaining=0;
 expect(requestDepth(s,'bogus')).toContain('Choose');expect(requestDepth({...s,kind:'gunship'},'dive')).toContain('submarine');
 requestDepth(s,'dive');
 for(const dt of [1,1,1]){tickDepth(s,dt);expect(boardingPoint(w,s)).toBeNull();expect(shoreRampSite(w,[],[],s)).toBeNull();expect(submarineFireError(s,w,{x:90,y:20})).toContain('Surface');}
 expect(sailStep(w,s,0,1,.5)).toBe(true);expect(createCombat(w).contact(s)).toContain('Surface');
 requestDepth(s,'surface');expect(submarineFireError(s,w,{x:90,y:20})).toContain('Surface');tickDepth(s,2);expect(submarineFireError(s,w,{x:90,y:20})).toBeNull();
});
it('cancels a swimmer windup and path on lost detection, retargets a visible ally and reacquires on surfacing',()=>{
 const {w,s}=fixture(),e:any={x:s.x-3,y:s.y,hp:60,targetId:s.id,path:[],reroute:0};
 swimStep(w,e,[s],[],0,.1);expect(e.attack?.targetId).toBe(s.id);
 requestDepth(s,'dive');swimStep(w,e,[s],[],1000,.1);expect(s.health).toBe(265); // transitions are vulnerable
 e.nextAttack=0;swimStep(w,e,[s],[],1100,.1);expect(e.attack).toBeTruthy();tickDepth(s,2);
 const before={x:e.x,y:e.y};swimStep(w,e,[s],[],1200,.1);expect(e.attack).toBeNull();expect(e.path).toEqual([]);expect(e.targetId).toBeUndefined();expect(e.behavior).toBe('searching');expect(e).toMatchObject(before);
 const ally={...s,id:'ally',kind:'gunship',x:45,y:20};w.ships.push(ally);swimStep(w,e,w.ships,[],1300,.1);expect(e.targetId).toBe('ally');
 requestDepth(s,'surface');swimStep(w,e,[s],[],4000,.1);expect(e.targetId).toBe(s.id);expect(s.health).toBe(265);
});
it('existing shore sentries engage swimmers and defend a surfaced berth without friendly damage',()=>{
 function run(defended:boolean){const {w,s}=fixture(),c=createCombat(w);expect(c.contact(s)).toBeNull();
  const buildings=defended?[{id:'north',x:64,y:17,weapon:'HEAVY_FLAME'},{id:'south',x:64,y:23,weapon:'HEAVY_FLAME'}]:[];
  for(let i=0;i<400;i++)c.tick(.1,buildings);
  return{health:s.health,kills:c.snapshot().kills};
 }
 const exposed=run(false),protectedBerth=run(true);expect(exposed.health).toBe(0);expect(protectedBerth.kills).toBe(3);expect(protectedBerth.health).toBeGreaterThan(exposed.health);
});
