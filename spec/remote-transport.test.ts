import {it,expect} from 'vitest';
import {newAirbase} from '../public/aircraft.js';
import {freshLogistics} from '../public/logistics.js';
import {planHelicopterOrder,startHelicopterOrder,tickHelicopterOrder} from '../public/helicopter-orders.js';
import {tickSling} from '../public/helicopter-sling.js';
import {flightBase} from '../public/air-traffic.js';
import {remoteTargets,remoteReason} from '../public/remote-control-ui.js';
import {missionError,prepareMission,strikePlan,validateMission,recoverAircraft,tickMission} from '../public/bomber-mission.js';
function setup(kind='tank'){
 const b:any=newAirbase('pad','pilot',20,20,'helicopter','helipad'),p=b.aircraft;
 Object.assign(p,{state:'flying',x:40.5,y:40.5,occupant:null});
 const v:any={id:'cargo',owner:'pilot',kind,x:44.5,y:40.5,angle:0,elapsed:99,remaining:0,podX:40,podY:40,health:123,cargo:73,occupant:null};
 const w:any={width:100,height:100,terrain:Array(10000).fill(2),airbases:[b],ships:[],tanks:kind==='tank'?[v]:[],cores:[],sites:[],players:[],buildings:[],combat:{enemies:[]},logistics:freshLogistics()};
 if(kind!=='tank')w.logistics.recyclers.push(v);
 const order=(action:string,extra:any={})=>{const plan=planHelicopterOrder(w,p,{action,...extra});expect(plan.error).toBeUndefined();expect(startHelicopterOrder(p,plan.order,'order-'+action,'pilot')).toBeNull();};
 const tick=(seconds=40)=>{for(let t=0;t<seconds;t+=.05){if(p.slingOperation)tickSling(w,p,.05);tickHelicopterOrder(w,w,flightBase(w,b),.05,()=>true);}};
 return {w,b,p,v,order,tick};
}
it.each(['tank','recycler','builder'])('remotely picks up and drops the same %s without loss or duplication',kind=>{
 const {w,p,v,order,tick}=setup(kind);order('pickup',{vehicleId:v.id});tick();
 expect(p.sling.vehicle).toMatchObject({id:v.id,health:123,cargo:73});expect(p.mission.phase).toBe('holding');
 expect(kind==='tank'?w.tanks:w.logistics.recyclers).toHaveLength(0);
 order('drop',{target:{x:55.5,y:45.5}});tick();expect(p.sling).toBeNull();
 expect(kind==='tank'?w.tanks:w.logistics.recyclers).toHaveLength(1);
 expect((kind==='tank'?w.tanks:w.logistics.recyclers)[0]).toMatchObject({id:v.id,health:123,cargo:73,x:55.5,y:45.5});
});
it('lands on free ground, takes off again, and returns to a service helipad',()=>{
 const {p,order,tick}=setup();order('land',{target:{x:50.5,y:50.5}});tick();expect(p.state).toBe('parked');expect(p.fieldLanding).toEqual({x:50.5,y:50.5});
 order('move',{target:{x:55.5,y:50.5}});tick();expect(p.state).toBe('flying');expect(p.mission.phase).toBe('holding');
 order('return');tick(70);expect(p.state).toBe('parked');expect(p.fieldLanding).toBeUndefined();expect(p.baseId).toBe('pad');
});
it('rechecks a moved pickup and late occupied drop, holding safely',()=>{
 const {w,p,v,order,tick}=setup();order('pickup',{vehicleId:v.id});v.x=70;tick();expect(p.sling).toBeUndefined();expect(p.mission.reason).toContain('Hover');
 v.x=p.x;v.y=p.y;order('pickup',{vehicleId:v.id});tick();order('drop',{target:{x:55.5,y:50.5}});w.players.push({id:'blocker',x:55.5,y:50.5,body:'robot'});tick();expect(p.sling.vehicle.id).toBe(v.id);expect(p.mission.reason).toContain('occupies');
});
it('rejects invalid, occupied, loaded and unauthorized orders and lets empty helicopters remain selectable',()=>{
 const {w,p,v}=setup();p.rounds=0;p.rockets=0;expect(remoteReason(w,remoteTargets(w)[0],{id:'pilot'})).toBeNull();
 expect(planHelicopterOrder(w,p,{action:'move',target:{x:NaN,y:4}}).error).toBeTruthy();
 expect(planHelicopterOrder(w,p,{action:'pickup',vehicleId:v.id},()=>false).error).toContain('manage');
 v.occupant='crew';expect(planHelicopterOrder(w,p,{action:'pickup',vehicleId:v.id}).error).toContain('unoccupied');
 p.occupant='crew';expect(planHelicopterOrder(w,p,{action:'stop'}).error).toContain('pilot');
});
it('stops a route and holds its cargo, and aborts a return if the helipad is lost',()=>{
 const {b,p,order,tick}=setup();order('move',{target:{x:80,y:80}});tick(2);order('stop');tick(3);const pos={x:p.x,y:p.y};tick(3);expect({x:p.x,y:p.y}).toEqual(pos);
 order('return');b.destroyed=true;tick();expect(p.state).toBe('flying');expect(p.mission.reason).toContain('unavailable');
});
it('reserves a return helipad even while taking off from a field landing',()=>{
 const {w,p,order}=setup();Object.assign(p,{state:'parked',rearm:0,fieldLanding:{x:p.x,y:p.y}});
 order('return');expect(p.state).toBe('takeoff');
 const other:any=newAirbase('lost-pad','crew',70,70,'helicopter','helipad');other.destroyed=true;Object.assign(other.aircraft,{state:'flying',x:60,y:60,occupant:null});w.airbases.push(other);
 expect(planHelicopterOrder(w,other.aircraft,{action:'return'}).error).toContain('No completed, free helipad');
});
it('lets only one arriving helicopter attach a shared vehicle',()=>{
 const {w,p,v,order,tick}=setup();order('pickup',{vehicleId:v.id});
 const other:any=newAirbase('other','crew',70,70,'helicopter','helipad');Object.assign(other.aircraft,{state:'flying',x:p.x,y:p.y,occupant:null});w.airbases.push(other);
 const plan=planHelicopterOrder(w,other.aircraft,{action:'pickup',vehicleId:v.id});startHelicopterOrder(other.aircraft,plan.order,'other-order','crew');
 tick();for(let t=0;t<40;t+=.05)tickHelicopterOrder(w,w,other,.05,()=>true);
 expect(p.sling.vehicle.id).toBe(v.id);expect(other.aircraft.sling).toBeUndefined();expect(other.aircraft.mission.phase).toBe('holding');expect(w.tanks).toHaveLength(0);
});
it('allows fire support from a transport hover and the existing recall command still lands',()=>{
 const {w,b,p,order}=setup();order('stop');
 expect(missionError(w,b,'HE')).toBeNull();const plan=prepareMission(w,b,strikePlan(w,{x:65,y:50},0,'HE',p));expect(validateMission(w,b,plan)).toBeNull();
 recoverAircraft(b,'recall');for(let t=0;t<80&&p.state!=='parked';t+=.05)tickMission(w,b,.05,()=>null);
 expect(p.state).toBe('parked');
});
