import {it,expect} from 'vitest';
import {newAirbase,tickAircraft} from '../public/aircraft.js';
import {helicopterMotion} from '../public/helicopter.js';
import {requestHelicopterLanding} from '../public/air-traffic.js';
import {freshLogistics} from '../public/logistics.js';
import {carriedVehicles,transportVehicles} from '../public/transport.js';
import {tankRecords} from '../public/tank.js';
import {canStand} from '../public/world.js';
import {recoverAircraft,tickMission} from '../public/bomber-mission.js';
import {attachSling,beginSlingLower,slingLiftError,tickSling,loseSling} from '../public/helicopter-sling.js';
function field(kind='tank'){
 const b:any=newAirbase('pad','pilot',20,20,'helicopter','helipad'),p=b.aircraft;
 Object.assign(p,{state:'flying',x:50.5,y:50.5,occupant:'pilot'});
 const v:any={id:'load',owner:'pilot',kind:kind==='tank'?'tank':kind,x:50.5,y:50.5,angle:.7,elapsed:99,remaining:0,podX:40,podY:40,health:123,weapon:'MAGNETIC',secondary:'HEAVY_FLAME',cooldown:1.2,cargo:73,occupant:null,speed:0,guard:{targetId:'enemy'},purchase:{paid:25,pool:'groundSupplies'}};
 const w:any={width:100,height:100,terrain:Array(10000).fill(2),airbases:[b],ships:[],tanks:kind==='tank'?[v]:[],cores:[],sites:[],players:[],buildings:[],combat:{enemies:[]},logistics:freshLogistics()};
 if(kind!=='tank'){w.logistics.recyclers.push(v);w.logistics.durability['recycler:load']={health:92,max:160,armor:1};}
 return {w,b,p,v,c:{kind:kind==='tank'?'tank':'utility',vehicle:v}};
}
it.each(['tank','recycler','builder'])('suspends %s, preserves its identity, hull, equipment and cargo through restart, then releases exactly one copy',kind=>{
 const {w,p,v,c}=field(kind);expect(slingLiftError(w,p,c)).toBeNull();attachSling(w,p,c);
 expect(transportVehicles(w)).toHaveLength(0);expect(carriedVehicles(w)).toHaveLength(1);
 if(kind==='tank'){expect(tankRecords(w)[0].carrier).toBe(p);expect(w.logistics.floors).toHaveLength(5);}
 const restored=JSON.parse(JSON.stringify(w)),aircraft=restored.airbases[0].aircraft;
 tickSling(restored,aircraft,2.1);Object.assign(aircraft,{x:60.5,y:60.5});expect(beginSlingLower(restored,aircraft)).toBeNull();
 expect(canStand(restored,[],60.5,60.5)).toBe(false);expect(tickSling(restored,aircraft,2.1)).toBe(true);expect(tickSling(restored,aircraft,2.1)).toBe(false);
 const dropped=transportVehicles(restored);expect(dropped).toHaveLength(1);
 expect(dropped[0].vehicle).toMatchObject({id:v.id,x:60.5,y:60.5,health:123,weapon:'MAGNETIC',secondary:'HEAVY_FLAME',cargo:73,purchase:v.purchase,occupant:null,guard:null});
 if(kind!=='tank')expect(restored.logistics.durability['recycler:load'].health).toBe(92);
 expect(aircraft.sling).toBeNull();expect(carriedVehicles(restored)).toHaveLength(0);
});
it.each(['occupied','moving','orders','bridge','range','construction'])('rejects %s pickup without removing the vehicle',reason=>{
 const {w,p,v,c}=field('builder');
 if(reason==='occupied')v.occupant='friend';if(reason==='moving')v.speed=1;if(reason==='orders')v.task={kind:'collect'};
 if(reason==='bridge')w.logistics.bridges=[{builderId:v.id,elapsed:0,from:{x:1,y:1},to:{x:10,y:1}}];
 if(reason==='range')v.x+=10;if(reason==='construction')w.logistics.jobs[v.id]={remaining:5};
 expect(slingLiftError(w,p,c)).toBeTruthy();expect(transportVehicles(w)[0].vehicle).toBe(v);expect(p.sling).toBeUndefined();
});
it('locks hover during transfer, caps loaded speed and acceleration, and prevents landing with a load',()=>{
 const {w,b,p,c}=field();attachSling(w,p,c);tickAircraft(w,b,{x:1,y:0},1);expect(p.x).toBe(50.5);expect(p.speed).toBe(0);
 tickSling(w,p,2);helicopterMotion(w,p,{x:1,y:0},.5);expect(p.speed).toBeCloseTo(1);
 helicopterMotion(w,p,{x:1,y:1},3);expect(p.speed).toBeCloseTo(2.5);
 expect(requestHelicopterLanding(w,p)).toContain('Set down');
});
it('rejects water and late ground obstructions, retaining the same attached load',()=>{
 const {w,p,c}=field();attachSling(w,p,c);tickSling(w,p,2);
 w.terrain[50*100+50]=0;expect(beginSlingLower(w,p)).toContain('water');w.terrain[50*100+50]=2;
 expect(beginSlingLower(w,p)).toBeNull();w.combat.enemies.push({id:'enemy',x:50.5,y:50.5,hp:10});
 tickSling(w,p,2.1);expect(p.sling.vehicle.id).toBe('load');expect(w.tanks).toHaveLength(0);expect(p.slingError).toContain('occupies');
});
it.each([false,true])('permanent loss leaves land crates or recoverable sea cargo, once / water=%s',water=>{
 const {w,p,c}=field('recycler');attachSling(w,p,c);if(water)w.terrain[50*100+50]=0;
 expect(loseSling(w,p)).toBe(true);expect(loseSling(w,p)).toBe(false);
 expect(w.logistics.crates.reduce((s:number,c:any)=>s+c.amount,0)).toBe(water?0:73);
 expect(Object.values(w.logistics.recovery).reduce((sum:number,r:any)=>sum+r.amount,0)).toBe(water?85.5:12.5);
 expect(w.logistics.recyclers).toHaveLength(0);expect(w.logistics.durability['recycler:load']).toBeUndefined();expect(w.logistics.ruins.filter((r:any)=>r.id==='load')).toHaveLength(1);
});
it('a lost tank remains a wreck at the crash, retaining its original replacement site',()=>{
 const {w,p,c}=field();attachSling(w,p,c);loseSling(w,p);
 expect(w.tanks).toHaveLength(1);expect(w.tanks[0]).toMatchObject({destroyed:true,health:0,x:50.5,y:50.5,podX:40,podY:40});expect(transportVehicles(w)).toHaveLength(0);
});
it.each([false,true])('unattended loaded recovery lowers safely before landing / destroyed pad=%s',destroyed=>{
 const {w,b,p,c}=field();b.destroyed=destroyed;attachSling(w,p,c);tickSling(w,p,2);p.occupant=null;expect(recoverAircraft(b,'recovery')).toBe(true);
 for(let t=0;t<100&&p.state!=='parked';t+=.05){tickSling(w,p,.05);tickMission(w,b,.05,()=>null);}
 expect(p.state).toBe('parked');expect(p.sling).toBeNull();expect(w.tanks).toHaveLength(1);expect(w.tanks[0].health).toBe(123);
});
it('returns toward an intact helipad from open water instead of waiting forever for a nearby drop site',()=>{
 const {w,b,p,c}=field();attachSling(w,p,c);tickSling(w,p,2);p.occupant=null;
 w.terrain=w.terrain.map((_:number,i:number)=>i%100<30&&Math.floor(i/100)<30?2:0);
 expect(recoverAircraft(b,'water-return')).toBe(true);
 for(let t=0;t<100&&p.state!=='parked';t+=.1){tickSling(w,p,.1);tickMission(w,b,.1,()=>null);}
 expect(p.state).toBe('parked');expect(p.sling).toBeNull();expect(w.tanks).toHaveLength(1);
 const t=w.tanks[0];expect(w.terrain[Math.floor(t.y)*100+Math.floor(t.x)]).toBe(2);
});
