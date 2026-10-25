import {it,expect} from 'vitest';
import {freshLogistics} from '../public/logistics.js';
import {createWorld} from '../public/world.js';
import {planNavalOrder,tickNavalOrder,automaticNavalDefence,shipRoute} from '../public/naval-orders.js';
import {canSail,SHIP,rampClear,hull,hullCells,mooredDock,recallShipError} from '../public/ship.js';
import {createCombat} from '../public/combat.js';
import {tickMainReloads,mainMounts} from '../public/ship-armament.js';
import {missionError} from '../public/bomber-mission.js';
import {newAirbase} from '../public/aircraft.js';
const fixture=(kind='gunship')=>{
 const s:any={id:'ship',owner:'pilot',kind,x:20.5,y:40.5,angle:0,turret:0,elapsed:SHIP.duration,health:600,occupant:null,berthX:20.5,berthY:10.5,dock:{x:20.5,y:7.5,angle:0},ammo:'HE',reload:0};
 const w:any={...createWorld(),width:160,height:120,terrain:Array(160*120).fill(0),sites:[],ships:[s],tanks:[],cores:[],artillery:[],rails:[],airbases:[],logistics:{...freshLogistics(),shipyards:[]}};return {s,w};
};
function advance(w:any,s:any,seconds=120){for(let t=0;t<seconds&&s.remoteOrder.phase==='moving';t+=.05){tickNavalOrder(w,[],[],s,.05,()=>null);expect(canSail(w,s)).toBe(true);}}
it('reverses out of a bow-in berth before turning, including after restarting the order',()=>{
 let {w,s}=fixture();for(let y=0;y<w.height;y++)for(let x=50;x<w.width;x++)w.terrain[y*w.width+x]=2;
 Object.assign(s,{x:47.9,angle:Math.PI/2});const goal={x:37.9,y:39.5};
 expect(canSail(w,s)).toBe(true);const plan=planNavalOrder(w,[],[],s,{action:'move',target:goal});expect(plan.error).toBeUndefined();expect(plan.order?.path?.some(p=>p.reverse)).toBe(true);s.remoteOrder=plan.order;
 for(let i=0;i<40;i++)tickNavalOrder(w,[],[],s,.05,()=>null);expect(s.driveSpeed).toBeLessThan(0);expect(s.x).toBeLessThan(47.9);
 w=JSON.parse(JSON.stringify(w));s=w.ships[0];Object.assign(s,{speed:0,driveSpeed:0,throttle:0,rudder:0,turnRate:0});advance(w,s);
 expect(s.remoteOrder.phase).toBe('holding');expect(Math.hypot(s.x-goal.x,s.y-goal.y)).toBeLessThan(.2);
});
it('backs along the exact heading out of a narrow angled berth without rotating through land',()=>{
 const {w,s}=fixture();Object.assign(s,{x:30.5,y:30.5,angle:.6});w.terrain.fill(2);
 for(let d=0;d<10;d+=.1)for(const c of hullCells(hull({...s,x:s.x-Math.sin(s.angle)*d,y:s.y+Math.cos(s.angle)*d})))w.terrain[c.y*w.width+c.x]=0;
 const goal={x:s.x-Math.sin(s.angle)*9,y:s.y+Math.cos(s.angle)*9};
 for(let y=Math.floor(goal.y)-5;y<goal.y+5;y++)for(let x=Math.floor(goal.x)-5;x<goal.x+5;x++)w.terrain[y*w.width+x]=0;
 expect(canSail(w,s)).toBe(true);for(let h=0;h<4;h++)expect(canSail(w,s,s.x,s.y,h*Math.PI/2)).toBe(false);
 const plan=planNavalOrder(w,[],[],s,{action:'move',target:goal});expect(plan.error).toBeUndefined();expect(plan.order?.path?.[1]).toMatchObject({angle:.6,reverse:true});s.remoteOrder=plan.order;advance(w,s);
 expect(s.remoteOrder.phase).toBe('holding');expect(Math.hypot(s.x-goal.x,s.y-goal.y)).toBeLessThan(.2);
});
it('sails with inertia, stops at the destination, and preserves the order through a save',()=>{
 let {w,s}=fixture();const plan=planNavalOrder(w,[],[],s,{action:'move',target:{x:40.5,y:20.5}});expect(plan.error).toBeUndefined();s.remoteOrder={...plan.order,id:'move-id'};
 for(let t=0;t<6;t+=.05)tickNavalOrder(w,[],[],s,.05,()=>null);expect(Math.hypot(s.x-20.5,s.y-40.5)).toBeGreaterThan(1);
 w=JSON.parse(JSON.stringify(w));s=w.ships[0];advance(w,s);expect(s.remoteOrder.phase).toBe('holding');expect(Math.hypot(s.x-40.5,s.y-20.5)).toBeLessThan(.2);expect(s.speed).toBe(0);
 const p={x:s.x,y:s.y};advance(w,s,10);expect({x:s.x,y:s.y}).toEqual(p);
});
it('routes around an island using the hull and refuses an enclosed destination',()=>{
 const {w,s}=fixture();for(let y=10;y<37;y++)for(let x=27;x<32;x++)w.terrain[y*w.width+x]=2;
 const plan=planNavalOrder(w,[],[],s,{action:'move',target:{x:40.5,y:20.5}});expect(plan.error).toBeUndefined();s.remoteOrder=plan.order;advance(w,s,180);expect(s.remoteOrder.phase).toBe('holding');
 for(let y=50;y<=65;y++)for(let x=50;x<=65;x++)w.terrain[y*w.width+x]=2;expect(shipRoute(w,s,{x:57,y:57})).toBeNull();
});
it('sails to a selected shore and deploys a valid ramp for boarding',()=>{
 const {w,s}=fixture();for(let y=0;y<w.height;y++)for(let x=50;x<w.width;x++)w.terrain[y*w.width+x]=2;
 const plan=planNavalOrder(w,[],[],s,{action:'shore',target:{x:50.5,y:40.5}});expect(plan.error).toBeUndefined();s.remoteOrder=plan.order;advance(w,s,180);
 expect(s.remoteOrder.phase).toBe('holding');expect(s.ramp).toMatchObject({x:50.5,y:40.5});expect(rampClear(w,[],s,s.ramp)).toBe(true);
});
it('stops safely when a previously clear route becomes blocked or the ship is boarded',()=>{
 const {w,s}=fixture();s.remoteOrder=planNavalOrder(w,[],[],s,{action:'move',target:{x:20.5,y:10.5}}).order;
 for(let x=0;x<160;x++)for(let y=32;y<35;y++)w.terrain[y*w.width+x]=2;advance(w,s,90);expect(s.remoteOrder.phase).toBe('blocked');expect(s.y).toBeGreaterThan(35);expect(s.speed).toBe(0);
 s.remoteOrder.phase='moving';s.occupant='pilot';tickNavalOrder(w,[],[],s,.05,()=>null);expect(s.remoteOrder.phase).toBe('cancelled');
});
for(const kind of ['gunship','transport'])it('fires exactly three reloaded '+kind+' salvos at assigned targets and resumes without replay',()=>{
 let {w,s}=fixture(kind);const targets=mainMounts(s).map((_,i)=>({x:100.5,y:35.5+i*8})),plan=planNavalOrder(w,[],[],s,{action:'bombard',targets,ammo:'HE'});expect(plan.error).toBeUndefined();s.remoteOrder=plan.order;
 let c=createCombat(w),count=0,previous=0,restarted=false,firstTime=-1,lastTime=-1;
 for(let t=0;t<80&&s.remoteOrder.phase!=='complete';t+=.05){
  tickMainReloads(s,.05);c.tick(.05,[],[]);tickNavalOrder(w,[],[],s,.05,(ship:any,points:any)=>c.navalSalvo(ship,points[0],'salvo',points));
  if(s.remoteOrder.fired!==previous){expect(t-lastTime).toBeGreaterThanOrEqual(lastTime<0?0:5.9);lastTime=t;if(firstTime<0)firstTime=t;previous=s.remoteOrder.fired;count+=kind==='gunship'?9:3;
   const saved=c.checkpoint();const rounds=saved.salvos;for(const p of rounds){const index=mainMounts(s).findIndex(m=>m.id===p.mount);expect(Math.hypot(p.targetX-targets[index].x,p.targetY-targets[index].y)).toBeLessThan(3);}
   if(!restarted){w=JSON.parse(JSON.stringify(w));s=w.ships[0];c=createCombat(w,JSON.parse(JSON.stringify(saved)));restarted=true;}
  }
 }
 expect(s.remoteOrder.phase).toBe('complete');expect(s.remoteOrder.fired).toBe(3);expect(count).toBe(kind==='gunship'?27:9);expect(lastTime-firstTime).toBeGreaterThanOrEqual(11.9);
});
it('does not spend a queued salvo when shared shell capacity is unavailable',()=>{
 const {w,s}=fixture();s.remoteOrder=planNavalOrder(w,[],[],s,{action:'bombard',targets:Array(3).fill({x:40,y:40}),ammo:'HE'}).order;
 for(let i=0;i<100;i++)tickNavalOrder(w,[],[],s,.05,()=> 'Need nine free heavy-shell slots.');expect(s.remoteOrder.fired).toBe(0);expect(s.remoteOrder.remaining).toBe(3);expect(s.remoteOrder.reason).toContain('slots');
});
it('holds a carrier during reserved flight operations and requires Stop for launching a parked plane',()=>{
 const {w,s}=fixture('carrier');s.aircraft={...newAirbase('ship','pilot',20,40).aircraft,baseId:'ship',state:'parked'};
 const base={id:'ship',carrier:s,aircraft:s.aircraft};s.speed=1;
 expect(missionError(w,base)).toContain('Stop the carrier');s.speed=0;
 s.remoteOrder=planNavalOrder(w,[],[],s,{action:'move',target:{x:20.5,y:20.5}}).order;
 s.aircraft.state='takeoff';const y=s.y;for(let i=0;i<30;i++)tickNavalOrder(w,[],[],s,.05,()=>null);
 expect(s.y).toBe(y);expect(s.remoteOrder.reason).toContain('flight operations');
 s.aircraft.state='flying';advance(w,s,90);expect(s.remoteOrder.phase).toBe('holding');expect(Math.hypot(s.x-20.5,s.y-20.5)).toBeLessThan(.2);
});
it('accepts coincident turret targets and rejects incomplete, out-of-range or malformed target sets',()=>{
 const {w,s}=fixture();const valid={action:'bombard',targets:Array(3).fill({x:110.5,y:40.5}),ammo:'HE'};
 expect(planNavalOrder(w,[],[],s,valid).error).toBeUndefined();
 for(const targets of [[null,null,null],[{x:120.6,y:40.5},{x:30,y:40},{x:40,y:40}],[],[{x:21,y:41},{x:30,y:40},{x:40,y:40}]])expect(planNavalOrder(w,[],[],s,{...valid,targets}).error).toBeTruthy();
 expect(s.remoteOrder).toBeUndefined();expect(s.reload).toBe(0);
});
it('defends both broadsides independently, leaves bow/stern blind, and stops at dock or ramp',()=>{
 const {w,s}=fixture();let shots:any[]=[];const enemies=[{x:14,y:40.5,hp:60},{x:27,y:40.5,hp:60},{x:20.5,y:34,hp:60},{x:20.5,y:47,hp:60}];
 for(let i=0;i<30;i++)automaticNavalDefence(w,s,enemies,.05,(_:any,target:any)=>shots.push(target));expect(new Set(shots.map(p=>p.x))).toEqual(new Set([14,27]));
 shots=[];s.ramp={x:25,y:40};automaticNavalDefence(w,s,enemies,1,(_:any,t:any)=>shots.push(t));expect(shots).toHaveLength(0);s.ramp=null;s.berthX=s.x;s.berthY=s.y;automaticNavalDefence(w,s,enemies,1,(_:any,t:any)=>shots.push(t));expect(shots).toHaveLength(0);
 s.berthX=1;s.occupant='pilot';automaticNavalDefence(w,s,enemies,1,(_:any,t:any)=>shots.push(t));expect(shots).toHaveLength(0);
});

for(const kind of ['gunship','transport','carrier'])it('returns '+kind+' along a pier into its home berth and restores dock services',()=>{
 let {w,s}=fixture(kind);Object.assign(s,{x:36.5,y:36.5,angle:Math.PI/2,berthX:33.5,berthY:20.5,dock:{x:30.5,y:23.5,angle:0},dockStyle:'unfolding'});
 const plan=planNavalOrder(w,[],[],s,{action:'dock'});expect(plan.error).toBeUndefined();s.remoteOrder=plan.order;
 for(let i=0;i<40;i++)tickNavalOrder(w,[],[],s,.05,()=>null);
 w=JSON.parse(JSON.stringify(w));s=w.ships[0];advance(w,s,180);
 expect(s.remoteOrder.phase).toBe('docked');expect(mooredDock(w,s)).toEqual(s.dock);expect(s.speed).toBe(0);
 expect(recallShipError(w,s,[],true)).toBeNull();
});
it('rejects an occupied or ruined home berth and stops if the dock is lost en route',()=>{
 const {w,s}=fixture();s.dockDestroyed=true;expect(planNavalOrder(w,[],[],s,{action:'dock'}).error).toContain('lost');s.dockDestroyed=false;
 w.ships.push({...s,id:'visitor',x:s.berthX,y:s.berthY});expect(planNavalOrder(w,[],[],s,{action:'dock'}).error).toContain('obstructed');w.ships.pop();
 s.remoteOrder=planNavalOrder(w,[],[],s,{action:'dock'}).order;expect(s.remoteOrder).toBeDefined();s.dockDestroyed=true;
 tickNavalOrder(w,[],[],s,.05,()=>null);expect(s.remoteOrder.phase).toBe('blocked');expect(s.speed).toBe(0);
});

for(const dt of [.05,.1,.15])it('allows arrival-position tolerance when turning beside a dock at dt '+dt,()=>{
 let {w,s}=fixture();Object.assign(s,{x:24.649269256792,y:28.24845714856943,angle:-.17949931828134416,berthX:28.5,berthY:28.5,dock:{x:31.5,y:31.5,angle:-Math.PI/2},dockStyle:'unfolding'});
 for(let y=0;y<w.height;y++)for(let x=31;x<w.width;x++)w.terrain[y*w.width+x]=2;
 expect(canSail(w,s)).toBe(true);const start={x:s.x,y:s.y};
 const plan=planNavalOrder(w,[],[],s,{action:'dock'});expect(plan.error).toBeUndefined();s.remoteOrder=plan.order;
 let saved=false,backedAway=false;
 for(let t=0;t<180&&s.remoteOrder.phase==='moving';t+=dt){
  tickNavalOrder(w,[],[],s,dt,()=>null);expect(canSail(w,s)).toBe(true);
  backedAway ||= Math.hypot(s.x-start.x,s.y-start.y)>.5;
  if(!saved&&t>6){w=JSON.parse(JSON.stringify(w));s=w.ships[0];saved=true;}
 }
 expect(backedAway).toBe(true);expect(s.remoteOrder.phase).toBe('docked');expect(mooredDock(w,s)).toEqual(s.dock);
 expect(recallShipError(w,s,[],true)).toBeNull();expect(s.speed).toBe(0);
});
