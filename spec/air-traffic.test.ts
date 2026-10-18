import {it,expect} from 'vitest';
import {newAirbase,parkingPoint,launchAircraft,tickAircraft,bombError} from '../public/aircraft.js';
import {launchCruise,isCruising,unattendedAircraft,assignMission,strikePlan,validateMission,tickMission,recoverAircraft,missionError} from '../public/bomber-mission.js';
import {flightBase,parkedRecord,fleetCount,fleetCapacity,deliveryError,reserveLanding,runwayAvailable,freeAirbase} from '../public/air-traffic.js';
function fixture(){const a:any=newAirbase('a','owner',48,48),b:any=newAirbase('b','owner',85,48);b.aircraft.state='vacant';b.aircraft.health=0;return{a,b,p:a.aircraft,w:{width:128,height:96,airbases:[a,b],logistics:{jobs:{},groundSupplies:0}}};}
function advance(w:any,a:any,seconds:number,release=(p:any)=>{const e=bombError(w,p);if(!e){p.runs--;p.releaseRemaining=1.25;}return e;}){for(let t=0;t<seconds;t+=.05)tickMission(w,flightBase(w,a),.05,release);}
it('holds intentional unmanned cruise across restart without orphan recovery or automatic landing',()=>{
 const {w,a,p}=fixture();expect(launchCruise(w,a,'hold','owner')).toBeNull();advance(w,a,10);expect(isCruising(p)).toBe(true);
 expect(unattendedAircraft(a,false,100,'recovery')).toBe(false);
 const saved=JSON.parse(JSON.stringify(w));advance(saved,saved.airbases[0],180);
 expect(saved.airbases[0].aircraft).toMatchObject({state:'flying',occupant:null,mission:{phase:'cruise',id:'hold'}});
 expect(saved.airbases[0].aircraft.x).toBeGreaterThan(0);expect(saved.airbases[0].aircraft.y).toBeGreaterThan(0);
});
it('flies a strike from cruise, resumes holding with empty bays, then recalls to a different runway',()=>{
 const {w,a,b,p}=fixture();launchCruise(w,a,'hold','owner');advance(w,a,8);p.runs=1;
 const plan=strikePlan(w,{x:85,y:40},1);expect(missionError(w,a)).toBeNull();expect(validateMission(w,a,plan)).toBeNull();expect(assignMission(a,plan,'strike','owner')).toBeNull();let releases=0;
 advance(w,a,70,q=>{releases++;q.runs--;q.releaseRemaining=1.25;return null;});
 expect(releases).toBe(1);expect(p).toMatchObject({state:'flying',runs:0,mission:{phase:'cruise',released:true}});
 expect(reserveLanding(w,p,b.id)).toBeNull();recoverAircraft(flightBase(w,a),'recall');advance(w,a,70);
 expect(p).toMatchObject({...parkingPoint(b),baseId:'b',state:'parked',runs:2,occupant:null});
 expect(parkedRecord(w,b)).toBe(a);expect(parkedRecord(w,a)).toBeUndefined();expect(a.id).toBe('a');
});
it('counts flight and delivery against capacity and reserves a runway exclusively',()=>{
 const {w,a,b,p}=fixture();expect(fleetCount(w)).toBe(1);expect(fleetCapacity(w)).toBe(2);expect(deliveryError(w,b)).toBeNull();
 launchCruise(w,a,'hold','owner');advance(w,a,4);b.aircraft=newAirbase('b','friend',85,48).aircraft;
 expect(deliveryError(w,a)).toContain('capacity');expect(reserveLanding(w,p,'b')).toContain('free');
 launchAircraft(b.aircraft);tickAircraft(w,b,null,3);expect(reserveLanding(w,p,'b')).toBeNull();recoverAircraft(flightBase(w,a),'recall');
 expect(runwayAvailable(w,b,b.aircraft)).toBe(false);expect(reserveLanding(w,b.aircraft,'b')).toContain('free');
 const saved=JSON.parse(JSON.stringify(w));expect(runwayAvailable(saved,saved.airbases[1],saved.airbases[1].aircraft)).toBe(false);
 b.destroyed=true;expect(fleetCapacity(w)).toBe(1);expect(fleetCount(w)).toBe(2);expect(freeAirbase(w,p)?.id).toBe('a');
});
it('uses the destination for manual landing and does not overwrite another aircraft',()=>{
 const {w,a,b,p}=fixture();Object.assign(p,{...parkingPoint(b),baseId:'b',state:'flying',speed:6,leftBase:true,occupant:'owner'});
 tickAircraft(w,flightBase(w,a),null,.1);expect(p.state).toBe('landing');tickAircraft(w,flightBase(w,a),null,2);
 expect(p).toMatchObject({...parkingPoint(b),state:'parked',occupant:'owner'});expect(b.aircraft.state).toBe('vacant');
});
