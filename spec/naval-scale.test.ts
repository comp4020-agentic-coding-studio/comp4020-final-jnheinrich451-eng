import {expect,it} from 'vitest';
import {createWorld} from '../public/world.js';
import {freshLogistics} from '../public/logistics.js';
import {shipyardSite,yardFromShip,linkYard} from '../public/shipyard.js';
import {dockRects,hullCells,hull,canSail,mooredDock,sailStep,rampClear,dockFloorAt,boardingPoint,recallShipError} from '../public/ship.js';
import {shipDimensions} from '../public/naval-scale.js';
import {hullPoint} from '../public/vehicle.js';
import {mainSalvo,mainMounts,mountPoint} from '../public/ship-armament.js';
import {planNavalOrder,tickNavalOrder} from '../public/naval-orders.js';
import {driveGate,transportBow,TRANSPORT_WELL,loadError,unloadPoint} from '../public/transport.js';
import {submarineLaunchOrigin} from '../public/submarine.js';

const coast=():any=>({...createWorld(),width:160,height:128,terrain:Array.from({length:160*128},(_,i)=>i%160<80?0:2),sites:[],cores:[],ships:[],tanks:[],rails:[],artillery:[],airbases:[],logistics:freshLogistics()});
function fixture(kind='gunship'){
 const w=coast(),site=shipyardSite(w,[],[],72,60,'pilot',2);expect(site.error).toBeNull();
 const yard=yardFromShip({...site.ship,id:'yard',elapsed:4.5});w.logistics.shipyards=[yard];
 const s:any={id:'ship',kind,owner:'pilot',x:yard.berthX,y:yard.berthY,angle:yard.dock.angle,turret:yard.dock.angle,elapsed:4.5,health:300,reload:0};linkYard(s,yard);w.ships=[s];return{w,s,yard};
}
it('reserves seven shore and 84 offshore cells, a large berth and departure water',()=>{
 const {w,s,yard}=fixture();const rects=dockRects(yard);
 expect(rects.map(r=>hullCells(r).length)).toEqual([7,84]);expect(hull(s,true)).toMatchObject({w:8,h:14});
 expect(hull(s)).toMatchObject({w:4,h:12});expect(canSail(w,s)).toBe(true);
 const shore=hullCells(rects[0]);w.terrain[shore[0].y*w.width+shore[0].x]=0;
 expect(shipyardSite({...w,ships:[],logistics:freshLogistics()},[],[],72,60,'pilot',2).error).toBeTruthy();
});
it.each(['gunship','transport','carrier','submarine'])('moves and remotely returns the large %s without crossing its pier',kind=>{
 const {w,s,yard}=fixture(kind);const before=s.x;
 for(let i=0;i<30;i++)sailStep(w,s,0,1,.1);expect(s.x).toBeLessThan(before);expect(canSail(w,s)).toBe(true);
 s.x=yard.berthX-22;s.y=yard.berthY;s.angle=yard.dock.angle;s.speed=0;s.turnRate=0;s.throttle=0;s.driveSpeed=0;
 const planned=planNavalOrder(w,[],[],s,{action:'dock'});expect(planned.error).toBeUndefined();s.remoteOrder=planned.order;
 for(let i=0;i<2500&&s.remoteOrder.phase==='moving';i++){tickNavalOrder(w,[],[],s,.1,()=>null);expect(canSail(w,s)).toBe(true);}
 expect(s.remoteOrder.phase).toBe('docked');expect(mooredDock(w,s)).toBe(yard.dock);
 const saved=JSON.parse(JSON.stringify(s));expect(shipDimensions(saved)).toEqual(shipDimensions(s));
});
it('uses the actual hull edge, scaled turret origins and forward submarine tubes',()=>{
 const {s}=fixture();s.x=40;s.y=40;s.angle=0;s.turret=0;
 expect(hullPoint(s,{x:100,y:100})).toEqual({x:42,y:46});
 const mount=mainMounts(s)[0],origin=mountPoint(s,0,mount.y),shell=mainSalvo(s,{x:40,y:15},[mount])[1];
 expect(origin.y).toBeCloseTo(36.85);expect(shell.y).toBeCloseTo(origin.y-1.2);
 const sub={...s,kind:'submarine'};expect(submarineLaunchOrigin(sub,0)).toMatchObject({originX:39.66,originY:38.61});
});
it('loads a docked large transport through a pier side gate beside its forward well',()=>{
 const {w,s}=fixture('transport'),gate=driveGate(w,[],s)!;expect(gate).not.toBeNull();
 expect(dockFloorAt(w,Math.floor(gate.x),Math.floor(gate.y))).toBe(true);
 const fx=Math.sin(s.angle),fy=-Math.cos(s.angle),ahead=(gate.x-s.x)*fx+(gate.y-s.y)*fy,beside=(gate.x-s.x)*Math.cos(s.angle)+(gate.y-s.y)*Math.sin(s.angle);
 expect(ahead).toBeCloseTo(shipDimensions(s).length*TRANSPORT_WELL);expect(Math.abs(beside)).toBeGreaterThan(shipDimensions(s).width/2);
});
it('loads and unloads a docked large transport across the pier gate',()=>{
 const {w,s}=fixture('transport'),gate=driveGate(w,[],s)!,rx=Math.cos(s.angle),ry=Math.sin(s.angle),side=Math.sign((gate.x-s.x)*rx+(gate.y-s.y)*ry);
 const v:any={id:'cargo',kind:'recycler',owner:'pilot',x:gate.x+rx*side*1.5,y:gate.y+ry*side*1.5,angle:0,cargo:0,remaining:0,path:[]};w.logistics.recyclers=[v];
 expect(loadError(w,[],[],s,{kind:'utility',vehicle:v})).toBeNull();
 w.logistics.recyclers=[];s.cargo={kind:'utility',vehicle:v};const out=unloadPoint(w,[],[],s)!;
 expect(out).not.toBeNull();expect(dockFloorAt(w,Math.floor(out.x),Math.floor(out.y))).toBe(true);
});
it('plans a bow-first transport landing and rejects side and stern ramps',()=>{
 const {w,s}=fixture('transport');s.x=65;s.y=90;s.angle=-Math.PI/2;
 const planned=planNavalOrder(w,[],[],s,{action:'shore',target:{x:80,y:90}});expect(planned.error).toBeUndefined();
 const order=planned.order!,parked={...s,...order.target};expect(rampClear(w,[],parked,order.bank)).toBe(true);
 const bow=transportBow(parked),bank=order.bank!;expect((bank.x-bow.x)*Math.sin(parked.angle)-(bank.y-bow.y)*Math.cos(parked.angle)).toBeGreaterThan(0);
 expect(driveGate(w,[],{...parked,ramp:order.bank})).toEqual(order.bank);
 expect(rampClear(w,[],{...s,x:76.5,angle:0},{x:80.5,y:90})).toBe(false);
 expect(rampClear(w,[],{...s,x:74.5,y:90.5,angle:-Math.PI/2},{x:80.5,y:90.5})).toBe(false);
 expect(rampClear(w,[],{...s,x:74.5,y:90.5,angle:Math.PI/2},{x:80.5,y:90.5})).toBe(true);
});
it('keeps saved legacy dock and ship footprints when linked again',()=>{
 const w=coast(),old=shipyardSite(w,[],[],77,60,'pilot').ship!;
 const yard=yardFromShip({...old,id:'old',elapsed:4.5}),ship={...old,id:'oldship',elapsed:4.5};linkYard(ship,yard);
 expect(hull(ship)).toMatchObject({w:2,h:4});expect(dockRects(yard).map(r=>hullCells(r).length)).toEqual([3,15]);
});

it('recognizes a manually parked large carrier 0.87 tiles off centre while rejecting motion, bad angles and distant hulls',()=>{
 const {w,s,yard}=fixture('carrier');s.x+=.504932617;s.y+=.713051326;s.angle-=.028638415;
 expect(Math.hypot(s.x-yard.berthX,s.y-yard.berthY)).toBeGreaterThan(.8);expect(canSail(w,s)).toBe(true);expect(mooredDock(w,s)).toBe(yard.dock);
 expect(boardingPoint(w,s)).not.toBeNull();expect(recallShipError(w,s,[],true)).toBeNull();
 for(const patch of [{speed:.1},{turnRate:.02},{throttle:1},{angle:yard.dock.angle+Math.PI/3},{x:yard.berthX+1.6,y:yard.berthY}])expect(mooredDock(w,{...s,...patch})).toBeNull();
 const legacy={...yard,dockScale:undefined};expect(mooredDock({...w,ships:[],logistics:{...w.logistics,shipyards:[legacy]}},s)).toBeNull();
});
it('chooses another clear dock tile when the usual exit is occupied and rejects a fully blocked pier',()=>{
 const {w,s,yard}=fixture('carrier');s.occupant='pilot';
 const blocker={id:'other',x:yard.dock.x,y:yard.dock.y,life:'active'},point=boardingPoint(w,s,[],null,[blocker]);
 expect(point).not.toBeNull();expect(Math.hypot(point!.x-blocker.x,point!.y-blocker.y)).toBeGreaterThanOrEqual(.8);expect(dockFloorAt(w,Math.floor(point!.x),Math.floor(point!.y))).toBe(true);
 const blocked=dockRects(yard).flatMap(hullCells).map((p,i)=>({id:'other-'+i,x:p.x+.5,y:p.y+.5,life:'active'}));expect(boardingPoint(w,s,[],null,blocked)).toBeNull();
 expect(boardingPoint(w,s,[],null,[{...blocker,id:'pilot'}])).toEqual(yard.dock);
});
it('recognizes a replacement carrier over its old sunken wreck without spending its salvage',()=>{
 const {w,s,yard}=fixture('carrier');w.ships.push({...s,id:'old',destroyed:true,health:0});w.logistics.wrecks=[{id:'old',x:s.x,y:s.y,angle:s.angle,kind:'carrier'}];w.logistics.recovery={wreck:{id:'wreck',medium:'sea',x:s.x,y:s.y,amount:50}};
 expect(canSail(w,s)).toBe(true);expect(mooredDock(w,s)).toBe(yard.dock);expect(boardingPoint(w,s)).not.toBeNull();expect(w.logistics.recovery.wreck.amount).toBe(50);
});
