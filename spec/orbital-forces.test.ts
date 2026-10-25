import { it, expect } from 'vitest';
import { newAirbase, deliverAircraft, launchAircraft, tickAircraft, bombError, parkingPoint } from '../public/aircraft.js';
import { JET, strafePoint } from '../public/attack-jet.js';
import { createCombat } from '../public/combat.js';
import { makeSite } from '../public/conquest.js';
import { shipSite, dockRects, hullCells, canSail, dockAt, SHIP, sailStep } from '../public/ship.js';
import { POD } from '../public/pod.js';
const world=():any=>({width:128,height:96,terrain:Array(128*96).fill(2),spawn:{x:10,y:10},airbases:[],ships:[],tanks:[],rails:[],cores:[],artillery:[],sites:[],fronts:[]});

it('resumes orbital aircraft delivery and preserves the requested model through loss and servicing',()=>{
 const w=world(),base=newAirbase('base','a',40,50);
 expect(deliverAircraft(base,'attack-jet')).toBeNull();expect(launchAircraft(base.aircraft)).toContain('delivery');
 tickAircraft(w,base,null,1);const saved=JSON.parse(JSON.stringify(base));tickAircraft(w,saved,null,POD.duration-1);
 expect(saved.aircraft).toMatchObject({kind:'attack-jet',state:'parked',rounds:90});
 saved.aircraft.occupant='pilot';expect(deliverAircraft(saved,'bomber')).toContain('disembark');saved.aircraft.occupant=null;
 Object.assign(saved.aircraft,{state:'destroyed',remaining:.2,health:0});tickAircraft(w,saved,null,.2);
 expect(saved.aircraft).toMatchObject({kind:'attack-jet',rounds:90,health:180,state:'parked'});
 Object.assign(saved.aircraft,{rounds:0,rearm:.1});tickAircraft(w,saved,null,.1);expect(saved.aircraft.rounds).toBe(0);
 expect(deliverAircraft(saved,'bomber')).toBeNull();expect(saved.aircraft.kind).toBe('bomber');
});

it('commits forward HE impacts and ammunition, respects cooldown/caps, and cannot use bomber weapons',()=>{
 const w=world(),base=newAirbase('base','a',40,50,'attack-jet'),p:any=base.aircraft;
 Object.assign(p,{state:'flying',...parkingPoint(base),angle:0,speed:6});w.airbases=[base];
 const point=strafePoint(p),site=makeSite('anti-air','site',Math.floor(point.x)-1,Math.floor(point.y)-1);w.sites=[site];
 const c=createCombat(w);expect(c.bombRun(p)).toContain('autocannon');expect(c.strafe(p)).toBeNull();expect(p.rounds).toBe(90);
 expect(c.strafe(p)).toContain('reloading');expect(p.rounds).toBe(90);
 const saved=c.checkpoint();expect(saved.salvos[0]).toMatchObject({targetX:point.x,targetY:point.y,kind:'strafe'});
 p.angle=Math.PI/2;const resumed=createCombat(w,saved);resumed.tick(.3,[]);expect(w.sites[0].hp).toBeLessThan(site.maxHp);expect(p.health).toBe(180);
 expect(resumed.snapshot().impacts[0].radius).toBe(JET.radius);
 p.rounds=0;expect(resumed.strafe(p)).toBeNull();p.rounds=90;
 const full=c.checkpoint();full.salvos=Array.from({length:JET.maxRounds},()=>({...saved.salvos[0]}));full.cooldowns=[];
 expect(createCombat(w,full).strafe(p)).toContain('capacity');expect(p.rounds).toBe(90);
 expect(bombError(w,p)).toContain('autocannon');
});

it('keeps a replacement at its saved berth even if the opposite side becomes available',()=>{
 const w=world();w.terrain=w.terrain.map((_:any,i:number)=>i%128>=64?2:0);
 const first=shipSite(w,[],[],61,48,'a','gunship','unfolding').ship!;
 const blocked=[{x:first.berthX,y:first.berthY}];
 const alternate=shipSite(w,[],blocked,61,48,'a','gunship','unfolding').ship!;
 expect(alternate.berthY).not.toBe(first.berthY);
 const replacement=shipSite(w,[],[],61,48,'a','gunship','unfolding',alternate).ship!;
 expect(replacement.berthY).toBe(alternate.berthY);
 expect(shipSite(w,[],[{x:alternate.berthX,y:alternate.berthY}],61,48,'a','gunship','unfolding',alternate).error).toBeTruthy();
});

it.each([0,1,2,3])('reserves a three-tile shore and 3x5 water dock, leaving the ship free to sail: coast %s',rotation=>{
 const w=world();
 const ground=(x:number,y:number)=>rotation===0?x>=64:rotation===1?y>=48:rotation===2?x<64:y<48;
 w.terrain=w.terrain.map((_:any,i:number)=>ground(i%128,Math.floor(i/128))?2:0);
 const point=([{x:61,y:48},{x:64,y:45},{x:66,y:48},{x:64,y:50}])[rotation];
 const placed=shipSite(w,[],[],point.x,point.y,'a','gunship','unfolding');expect(placed.error).toBeNull();const s:any={...placed.ship,id:'ship',elapsed:SHIP.duration};
 const rects=dockRects(s);expect(hullCells(rects[0])).toHaveLength(3);expect(hullCells(rects[1])).toHaveLength(15);
 const before=[...w.terrain];w.ships=[s];expect(canSail(w,s)).toBe(true);
 for(const cell of rects.flatMap(hullCells))expect(dockAt(w,cell.x,cell.y)).toBe(true);
 expect(canSail(w,s,rects[1].x,rects[1].y,s.angle)).toBe(false);
 const start={x:s.x,y:s.y};for(let i=0;i<60;i++)expect(sailStep(w,s,0,1,.05)).toBe(true);expect(Math.hypot(s.x-start.x,s.y-start.y)).toBeGreaterThan(2);expect(w.terrain).toEqual(before);
 expect(shipSite(w,[],[],point.x,point.y,'b','submarine','unfolding').error).toBeTruthy();
 w.ships=[];const shore=hullCells(rects[0])[0];expect(shipSite(w,[shore],[],point.x,point.y,'a','gunship','unfolding').error).toBeTruthy();
});
