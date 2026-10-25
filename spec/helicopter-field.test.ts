import {it,expect} from 'vitest';
import {newAirbase,tickAircraft,tickAirRepair,launchAircraft} from '../public/aircraft.js';
import {requestHelicopterLanding,parkedRecord,runwayAvailable,fleetCount} from '../public/air-traffic.js';
import {fieldLandingError,fieldExitPoint} from '../public/helicopter-landing.js';
import {canStand,placementError} from '../public/world.js';
import {tankPlacementError} from '../public/tank.js';
import {corePlacementError} from '../public/core.js';
import {railError} from '../public/rail.js';

function field(){
 const b:any=newAirbase('pad','pilot',20,20,'helicopter','helipad'),p=b.aircraft;
 Object.assign(p,{state:'flying',x:50.3,y:50.4,speed:0,occupant:'pilot',health:80,rounds:17,rockets:3});
 const w:any={width:100,height:100,terrain:Array(10000).fill(2),airbases:[b],ships:[],tanks:[],cores:[],sites:[],buildings:[],players:[],combat:{enemies:[]},logistics:{jobs:{},groundSupplies:400,recyclers:[]}};
 return {w,b,p};
}
it('only lands on explicit command, persists at the field position, and does not service or reserve the pad',()=>{
 const {w,b,p}=field();tickAircraft(w,b,null,3);expect(p.state).toBe('flying');
 expect(requestHelicopterLanding(w,p)).toBeNull();expect(p.fieldLanding).toEqual({x:50.5,y:50.5});
 const restored=JSON.parse(JSON.stringify(b));w.airbases=[restored];tickAircraft(w,restored,null,3);tickAircraft(w,restored,null,20);
 expect(restored.aircraft).toMatchObject({x:50.5,y:50.5,state:'parked',health:80,rounds:17,rockets:3,rearm:0,occupant:'pilot'});
 tickAirRepair(w,restored,10);expect(restored.aircraft.health).toBe(80);expect(w.logistics.groundSupplies).toBe(400);
 expect(parkedRecord(w,b)).toBeUndefined();expect(runwayAvailable(w,b)).toBe(true);expect(fleetCount(w,'helicopter')).toBe(1);
 const exit=fieldExitPoint(w,restored.aircraft);expect(exit).toEqual({x:52.5,y:50.5});
 expect(launchAircraft(restored.aircraft)).toBeNull();tickAircraft(w,restored,null,3);
 expect(restored.aircraft).toMatchObject({state:'flying',x:50.5,y:50.5,rounds:17,rockets:3});expect(restored.aircraft.fieldLanding).toBeUndefined();
});
it.each(['water','rock','edge','building','tank','recycler','enemy','robot','airfield','rail'])('rejects %s anywhere in the full landing area without reserving or spending',kind=>{
 const {w,p}=field();
 if(kind==='water'||kind==='rock')w.terrain[49*100+49]=kind==='water'?0:3;
 if(kind==='edge')p.x=.5;
 if(kind==='building')w.buildings.push({x:49,y:49});
 if(kind==='tank')w.tanks.push({id:'tank',x:49.5,y:49.5,elapsed:99});
 if(kind==='recycler')w.logistics.recyclers.push({id:'r',x:49.5,y:49.5});
 if(kind==='enemy')w.combat.enemies.push({id:'e',x:49.5,y:49.5,hp:10});
 if(kind==='robot')w.players.push({id:'friend',x:49.5,y:49.5,body:'robot'});
 if(kind==='airfield')w.airbases.push(newAirbase('runway','p',49,49));
 if(kind==='rail')w.rails=[{x:49,y:49,shape:'EW'}];
 const before=structuredClone(p);expect(requestHelicopterLanding(w,p)).toBeTruthy();expect(p).toEqual(before);
});
it('reserves landing space against a simultaneous aircraft, ground driving and construction; releases it on takeoff',()=>{
 const {w,b,p}=field(),other:any=newAirbase('second','friend',70,70,'helicopter','helipad');
 Object.assign(other.aircraft,{state:'flying',x:50.5,y:50.5});w.airbases.push(other);
 expect(requestHelicopterLanding(w,p)).toBeNull();expect(requestHelicopterLanding(w,other.aircraft)).toBeTruthy();
 expect(canStand(w,[],50.5,50.5)).toBe(false);expect(placementError(w,[],[],49,49)).toContain('helicopter');
 expect(tankPlacementError(w,[],[],50,50,'pilot')).toContain('helicopter');
 expect(corePlacementError(w,[],[],49,49,'pilot')).toContain('helicopter');
 expect(railError(w,[],50,50,'EW',5,'pilot')).toContain('helicopter');
 tickAircraft(w,b,null,3);expect(p.state).toBe('parked');expect(launchAircraft(p)).toBeNull();
 tickAircraft(w,b,null,3);expect(canStand(w,[],50.5,50.5)).toBe(true);
});
it('aborts touchdown when an enemy enters the site, retaining the pilot and aircraft',()=>{
 const {w,b,p}=field();expect(requestHelicopterLanding(w,p)).toBeNull();
 w.combat.enemies.push({id:'enemy',x:50.5,y:50.5,hp:10});tickAircraft(w,b,null,3);
 expect(p).toMatchObject({state:'flying',occupant:'pilot',health:80});expect(p.fieldLanding).toBeUndefined();
 expect(p.landingError).toContain('occupied');
});
it('ignores airborne crew and corpses, but denies a blocked field exit',()=>{
 const {w,b,p}=field();w.players=[{id:'friend',x:50.5,y:50.5,body:'aircraft'}];w.combat.enemies=[{id:'corpse',x:50.5,y:50.5,hp:0}];
 expect(fieldLandingError(w,p)).toBeNull();expect(requestHelicopterLanding(w,p)).toBeNull();tickAircraft(w,b,null,3);
 for(let y=47;y<54;y++)for(let x=47;x<54;x++)if(x<49||x>51||y<49||y>51)w.terrain[y*100+x]=0;
 expect(fieldExitPoint(w,p)).toBeUndefined();expect(p.occupant).toBe('pilot');
});
