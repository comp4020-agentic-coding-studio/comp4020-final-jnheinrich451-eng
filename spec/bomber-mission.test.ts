import {recoverAircraft,unattendedAircraft,RECOVERY_GRACE} from '../public/bomber-mission.js';
import {tickAntiAir} from '../public/anti-air.js';
import {it,expect} from 'vitest';
import {newAirbase,AIR,bombError,launchError} from '../public/aircraft.js';
import {strikePlan,validateMission,assignMission,tickMission,missionActive,missionError,abortMission} from '../public/bomber-mission.js';
import {bombReleaseDuration,payloadProfile} from '../public/bomber-payloads.js';
import {createCombat} from '../public/combat.js';
import {createWorld} from '../public/world.js';
function fixture(){const b:any=newAirbase('base','owner',48,48),w:any={...createWorld(),width:128,height:96,terrain:Array(128*96).fill(2),airbases:[b],sites:[],cores:[],artillery:[],tanks:[],ships:[],rails:[]};return{b,w,p:b.aircraft};}
function run(w:any,b:any,release:(p:any)=>any,until=()=>false){for(let t=0;t<260&&missionActive(b.aircraft)&&!until();t+=.05)tickMission(w,b,.05,release);}
const release=(p:any)=>{p.bombCooldown=8;p.releaseRemaining=bombReleaseDuration(payloadProfile('HE'));return null;};
it('flies a real two-row run, retains pilot independence and returns for service',()=>{
 const {w,b,p}=fixture(),plan=strikePlan(w,{x:85,y:40},1);expect(validateMission(w,b,plan)).toBeNull();assignMission(b,plan,'test-sortie','caller');let shots=0;
 run(w,b,plane=>{expect(bombError(w,plane)).toBeNull();expect(Math.hypot(plane.x-plan.release!.x,plane.y-plan.release!.y)).toBeLessThan(1);shots++;return release(plane);});
 expect(shots).toBe(1);expect(p.mission.phase).toBe('complete');expect(p).toMatchObject({state:'parked',occupant:null,runs:2});expect(p.x).toBe(50);expect(p.y).toBe(55.5);
});
it('checks map edges and all cardinal approaches without changing the real aircraft',()=>{
 const {w,b,p}=fixture(),before=JSON.stringify(b);expect(strikePlan(w,{x:2,y:2},0).error).toBeTruthy();expect(strikePlan(w,{x:NaN,y:20},0).error).toBeTruthy();expect(strikePlan(w,{x:80,y:20},4).error).toBeTruthy();
 for(const [target,bearing] of [[{x:64,y:20},0],[{x:85,y:40},1],[{x:85,y:70},2],[{x:30,y:30},3]] as const)expect(validateMission(w,b,strikePlan(w,target,bearing))).toBeNull();expect(JSON.stringify(b)).toBe(before);
 p.occupant='pilot';expect(missionError(w,b)).toContain('Disembark');p.occupant=null;w.logistics={jobs:{base:{}}};expect(missionError(w,b)).toContain('completed');
});
it('recalls without consuming bombs and prevents manual boarding while assigned',()=>{const {w,b,p}=fixture();assignMission(b,strikePlan(w,{x:85,y:40},1),'recall-id','caller');expect(launchError(p)).toContain('reserved');tickMission(w,b,3,release);abortMission(p);let shots=0;run(w,b,()=>{shots++;});expect(shots).toBe(0);expect(p.mission.phase).toBe('complete');expect(p.mission.released).toBe(false);});
it('returns to a destroyed base and records one persistent emergency wreck',()=>{const {w,b,p}=fixture();assignMission(b,strikePlan(w,{x:85,y:40},1),'lost-base','caller');tickMission(w,b,3,release);b.destroyed=true;run(w,b,release);expect(p).toMatchObject({state:'destroyed',health:0,mission:{phase:'lost',released:false}});expect(b.wrecks).toHaveLength(1);tickMission(w,b,1,release);expect(b.wrecks).toHaveLength(1);});
it('can recover when the base is rebuilt before return and records anti-air loss',()=>{const {w,b,p}=fixture();assignMission(b,strikePlan(w,{x:85,y:40},1),'repair-base','caller');tickMission(w,b,3,release);b.destroyed=true;tickMission(w,b,.1,release);b.destroyed=false;run(w,b,release);expect(p.mission.phase).toBe('complete');assignMission(b,strikePlan(w,{x:85,y:40},1),'flak-loss','caller');p.health=1;tickAntiAir(w,[{id:1,x:p.x,y:p.y,landAt:0,sourceId:'hostile-flak'}],1,.1,()=>2);expect(p.state).toBe('destroyed');tickMission(w,b,.1,release);expect(p.mission.phase).toBe('lost');expect(b.wrecks).toHaveLength(1);});
it('checkpoints released bombs with the mission and never releases them again after restoring',()=>{
 const {w,b,p}=fixture();const combat=createCombat(w);assignMission(b,strikePlan(w,{x:85,y:40},1),'save-sortie','caller');run(w,b,plane=>combat.bombRun(plane),()=>p.mission.released);
 expect(combat.snapshot().barrages).toHaveLength(1);const saved=JSON.parse(JSON.stringify({base:b,combat:combat.checkpoint()})),nextWorld={...w,airbases:[saved.base]},next=createCombat(nextWorld,saved.combat);let repeat=0;
 run(nextWorld,saved.base,plane=>{repeat++;return next.bombRun(plane);});expect(repeat).toBe(0);expect(next.snapshot().barrages).toHaveLength(1);expect(saved.base.aircraft.mission.phase).toBe('complete');
});
it('retains accepted bombs on recall and aborts if bombardment capacity is occupied',()=>{const {w,b,p}=fixture();assignMission(b,strikePlan(w,{x:85,y:40},1),'capacity','caller');run(w,b,()=> 'Two bombardments are already in flight.');expect(p.mission).toMatchObject({phase:'complete',released:false,reason:'Two bombardments are already in flight.'});assignMission(b,strikePlan(w,{x:85,y:40},1),'after-release','caller');run(w,b,release,()=>p.mission.released);const spent=p.runs;abortMission(p);expect(p.runs).toBe(spent);expect(p.mission.released).toBe(true);});

it('recovers old unoccupied manual flights and disconnected seats after reconnect grace',()=>{
 const {w,b,p}=fixture();Object.assign(p,{state:'flying',x:85,y:60,speed:12,angle:Math.PI/2,leftBase:true,occupant:'gone'});
 expect(unattendedAircraft(b,false,RECOVERY_GRACE-1,'recovery')).toBe(false);expect(unattendedAircraft(b,true,1,'recovery')).toBe(false);expect(p.unattended).toBe(0);
 expect(unattendedAircraft(b,false,RECOVERY_GRACE,'recovery')).toBe(true);expect(p.mission.kind).toBe('recovery');let bombs=0;run(w,b,()=>{bombs++;});expect(p.state).toBe('parked');expect(bombs).toBe(0);
 delete p.mission;Object.assign(p,{kind:'attack-jet',state:'flying',x:100,y:70,angle:0,speed:12,occupant:null});expect(unattendedAircraft(b,false,.1,'orphan')).toBe(true);run(w,b,()=>{bombs++;});expect(p.state).toBe('parked');expect(bombs).toBe(0);
});
it('manual recovery is bounded when the home base is destroyed and leaves a replacement wreck',()=>{const{w,b,p}=fixture();Object.assign(p,{state:'flying',x:85,y:60,speed:12,angle:1,leftBase:true});b.destroyed=true;expect(recoverAircraft(b,'wreck-return')).toBe(true);run(w,b,release);expect(p.state).toBe('destroyed');expect(b.wrecks).toHaveLength(1);});
