import {it,expect} from 'vitest';
import {CARRIER,prepareCarrier,carrierField,carrierFields,deckLocked,syncCarrierDeck,tickCarrierService,spotPoint,spotAngle,angledOffset,wingId} from '../public/carrier.js';
import {airfields,airRecords,fleetCapacity,fleetCount,flightBase,runwayAvailable,reserveLanding,deliveryError} from '../public/air-traffic.js';
import {newAirbase,launchAircraft,tickAircraft} from '../public/aircraft.js';
import {launchCruise,tickMission,recoverAircraft} from '../public/bomber-mission.js';
import {shipSite,SHIP,sailStep,hull,recallShipError} from '../public/ship.js';
import {mainMounts,tickMainReloads} from '../public/ship-armament.js';
import {freshLogistics} from '../public/logistics.js';
import {hurtVehicle} from '../public/vehicle.js';
import {createCombat} from '../public/combat.js';
function fixture(){
 const w:any={width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128>=21&&i%128<70?0:2),ships:[],airbases:[],tanks:[],cores:[],rails:[],artillery:[],sites:[],logistics:freshLogistics()};
 const s:any={...shipSite(w,[],[],23,35,'owner','carrier','unfolding').ship,id:'carrier',elapsed:SHIP.duration,health:CARRIER.health,deckSupplies:0,speed:0};prepareCarrier(s);w.ships=[s];return{w,s};
}
it('contributes two fleet slots and locks the physical deck during landing and launch',()=>{
 const {w,s}=fixture(),b:any=newAirbase('land','owner',80,40);w.airbases=[b];expect(s.kind).toBe('carrier');expect(hull(s)).toMatchObject({w:3,h:5});expect(fleetCapacity(w)).toBe(3);
 Object.assign(b.aircraft,{state:'flying',speed:6,leftBase:true});expect(reserveLanding(w,b.aircraft,s.id)).toBeNull();recoverAircraft(flightBase(w,b),'return');
 expect(deckLocked(w,s)).toBe(true);expect(sailStep(w,s,1,1,.1)).toBe(false);expect(runwayAvailable(w,carrierField(s),s.aircraft)).toBe(false);
 Object.assign(b.aircraft,{state:'parked',mission:{phase:'complete'},x:s.x,y:s.y,rearm:0});expect(deckLocked(w,s)).toBe(false);
 expect(sailStep(w,s,0,1,.2)).toBe(true);syncCarrierDeck(w,s);expect(b.aircraft).toMatchObject(spotPoint(s,0));expect(b.aircraft.angle).toBe(s.angle);
 expect(launchAircraft(b.aircraft,s.angle)).toBeNull();expect(deckLocked(w,s)).toBe(true);expect(b.aircraft.angle).toBe(s.angle);
 s.speed=1;expect(runwayAvailable(w,carrierField(s),b.aircraft)).toBe(false);
 expect(recallShipError(w,s,[],true)).toContain('aircraft');
});
it('recovers a visitor to the current carrier heading and resumes cruise from its deck',()=>{
 const {w,s}=fixture(),b:any=newAirbase('land','owner',80,40);w.airbases=[b];Object.assign(b.aircraft,{state:'flying',x:s.x+15,y:s.y+15,speed:6,leftBase:true,runs:0});
 expect(reserveLanding(w,b.aircraft,s.id)).toBeNull();recoverAircraft(flightBase(w,b),'return');
 for(let t=0;t<100;t+=.05)tickMission(w,flightBase(w,b),.05,()=>null);
 expect(b.aircraft).toMatchObject({state:'parked',baseId:s.id,runs:0,angle:s.angle,...spotPoint(s,0)});
 expect(launchCruise(w,flightBase(w,b),'cruise','owner')).toBeNull();for(let t=0;t<5;t+=.05)tickMission(w,flightBase(w,b),.05,()=>null);
 expect(b.aircraft.mission.phase).toBe('cruise');expect(fleetCount(w)).toBe(1);
});
it('transfers GND without duplication, repairs from onboard stores and respects damage delay',()=>{
 const {w,s}=fixture();w.logistics.groundSupplies=100;s.health=500;
 const p:any={...newAirbase('p','owner',0,0).aircraft,health:100,baseId:s.id};
 tickCarrierService(w,s,[p],1,true);expect(w.logistics.groundSupplies).toBe(90);expect(s.deckSupplies).toBe(6);expect(s.health).toBe(510);expect(p.health).toBe(110);
 hurtVehicle(s,10);tickCarrierService(w,s,[p],1,false);expect(s.health).toBe(500);expect(p.health).toBe(120);expect(s.deckSupplies).toBe(4);
 s.speed=1;tickCarrierService(w,s,[p],1,true);expect(w.logistics.groundSupplies).toBe(90);expect(s.deckSupplies).toBe(4);
 s.speed=0;s.repairDelay=0;s.deckSupplies=1;tickCarrierService(w,s,[p],1,false);expect(s.health).toBe(505);expect(s.deckSupplies).toBe(0);expect(p.health).toBe(120);
});
it('sinking loses parked aircraft and stores, preserves airborne identities, and blocks excess production',()=>{
 const {w,s}=fixture(),a:any=newAirbase('land','owner',80,40);w.airbases=[a];a.aircraft.baseId=s.id;a.aircraft.mission={phase:'complete'};s.deckSupplies=50;
 s.aircraft={...newAirbase(s.id,'owner',0,0).aircraft,state:'flying',speed:6};hurtVehicle(s,1000);syncCarrierDeck(w,s);
 expect(a.aircraft.state).toBe('destroyed');expect(a.wrecks).toHaveLength(1);expect(s.aircraft.state).toBe('flying');expect(s.deckSupplies).toBe(0);expect(fleetCapacity(w)).toBe(1);expect(fleetCount(w)).toBe(1);expect(deliveryError(w,a)).toContain('capacity');
 const saved=JSON.parse(JSON.stringify(w));expect(airRecords(saved).find(b=>b.id===s.id)?.aircraft.state).toBe('flying');expect(airfields(saved)).toHaveLength(3);
 prepareCarrier(s);expect(s.aircraft.state).toBe('flying');
});
it('has secondary guns only and keeps empty main reloads finite',()=>{
 const {w,s}=fixture();expect(mainMounts(s)).toEqual([]);tickMainReloads(s,1);expect(s.reload).toBe(0);
 const combat=createCombat(w);expect(combat.navalSalvo(s,{x:s.x+10,y:s.y})).toContain('side guns');
 const target={x:s.x+Math.cos(s.angle)*5,y:s.y+Math.sin(s.angle)*5};s.starboardTurret=Math.PI/2;
 expect(combat.navalSecondary(s,target,[]).fired).toBe(1);expect(combat.navalSecondary(s,target,[]).fired).toBe(0);
});

it('rejects aircraft exchange on a moving deck even with a parked aircraft',()=>{
 const {w,s}=fixture();s.aircraft={...newAirbase(s.id,'owner',0,0).aircraft,baseId:s.id,rearm:0};s.speed=1;
 expect(deliveryError(w,carrierField(s))).toContain('Stop the carrier');s.speed=0;expect(deliveryError(w,carrierField(s))).toBeNull();
});

it('parks one heavy aircraft and one attack jet on two spots with their own runways',()=>{
 const {w,s}=fixture(),[a,b]=carrierFields(s);expect([a.id,b.id]).toEqual([s.id,wingId(s)]);expect(spotPoint(s,0)).not.toEqual(spotPoint(s,1));
 expect(fleetCapacity(w)).toBe(2);Object.assign(s.aircraft,{...newAirbase(s.id,'owner',0,0).aircraft,id:'bomber',baseId:s.id,...spotPoint(s,0),angle:s.angle,rearm:0});
 expect(deliveryError(w,b,'bomber')).toContain('already has its');expect(deliveryError(w,b,'air-gunship')).toContain('already has its');expect(deliveryError(w,b,'attack-jet')).toBeNull();
 const jet=Object.assign(s.wing.aircraft,{...newAirbase(wingId(s),'owner',0,0,'attack-jet').aircraft,id:'jet',baseId:wingId(s),...spotPoint(s,1),angle:s.angle,rearm:0});
 expect(fleetCount(w)).toBe(2);expect(deckLocked(w,s)).toBe(false);expect(deliveryError(w,a,'attack-jet')).toContain('already has its');
 // Deck A launches over the bow; deck B uses the angled runway, turned toward port.
 expect(angledOffset(s)).toBeGreaterThan(.15);expect(b.angle).toBeCloseTo(s.angle-angledOffset(s));expect(a.angle).toBe(s.angle);
 syncCarrierDeck(w,s);expect(jet.angle).toBeCloseTo(spotAngle(s,1));
 expect(launchAircraft(s.aircraft,a.angle)).toBeNull();expect(launchAircraft(jet,b.angle)).toBeNull();expect(jet.angle).toBeCloseTo(s.angle-angledOffset(s));
 // Recovery on deck B proceeds while deck A is still launching.
 Object.assign(jet,{state:'flying',speed:4,leftBase:true,mission:{phase:'complete'},...spotPoint(s,1)});
 tickAircraft(w,flightBase(w,s.wing),null,.05);expect(jet.state).toBe('landing');expect(s.aircraft.state).toBe('takeoff');
 for(let t=0;t<5;t+=.05)tickAircraft(w,flightBase(w,s.wing),null,.05);expect(jet).toMatchObject({state:'parked',baseId:wingId(s),...spotPoint(s,1),angle:spotAngle(s,1)});
 s.aircraft.state='vacant';expect(recallShipError(w,s,[],true)).toContain('aircraft');
 const saved=JSON.parse(JSON.stringify(w));expect(airRecords(saved).find(r=>r.id===wingId(s))?.aircraft.id).toBe('jet');
});
