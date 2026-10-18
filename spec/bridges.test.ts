import { expect, it } from 'vitest';
import { bridgeError, bridgeSupplyError } from '../public/bridge.js';
import { BRIDGE, bridgeCells, bridgeCost, bridgeDuration, bridgeReady } from '../public/bridge-geometry.js';
import { createWorld, tileAt, canStand, findPath, placementError } from '../public/world.js';
import { freshLogistics } from '../public/logistics.js';
import { canSail } from '../public/ship.js';
import { railError } from '../public/rail.js';
import { bridgeFacing, planBridgeAhead } from '../public/bridge-plan.js';
import { tankPlacementError } from '../public/tank.js';

function setup(vertical=false){
  const w:any={...createWorld(),width:64,height:64,terrain:Array(64*64).fill(2),cores:[],tanks:[],ships:[],rails:[],artillery:[],airbases:[],sites:[],logistics:freshLogistics()};
  for(let i=21;i<=26;i++)for(let j=0;j<64;j++)w.terrain[(vertical?i:j)*64+(vertical?j:i)]=0;
  const b:any={id:'b',from:{x:20,y:20},to:vertical?{x:20,y:27}:{x:27,y:20},elapsed:0};
  const truck={id:'engineer',kind:'builder',x:18.5,y:18.5};w.logistics.recyclers=[truck];return {w,b,truck};
}
it('explains a ground supply shortfall even when orbital and carrier stores are funded',()=>{
  const {w}=setup();w.logistics.groundSupplies=19.53;w.logistics.supplies=391.75;w.ships=[{supplies:79}];
  expect(bridgeSupplyError(w,96)).toContain('shared ground pool has 19 (short 77)');
  expect(bridgeSupplyError(w,96)).toContain('core or outpost');
  w.logistics.groundSupplies=96;expect(bridgeSupplyError(w,96)).toBeNull();
});
it.each([false,true])('constructs two three-tile anchors and six deck rows; crossing opens only on completion (vertical=%s)',vertical=>{
  const {w,b,truck}=setup(vertical);expect(bridgeError(w,[],[],truck,b.from,b.to)).toBeNull();
  expect(bridgeCells(b).filter(c=>c.anchor)).toHaveLength(6);expect(bridgeCells(b)).toHaveLength(24);expect(bridgeCost(b)).toBe(66);
  w.logistics.bridges=[b];const p=vertical?{x:20.5,y:23.5}:{x:23.5,y:20.5};
  expect(canStand(w,[],p.x,p.y)).toBe(false);b.elapsed=bridgeDuration(b)-.01;expect(tileAt(w,p.x,p.y)).toBe(0);
  b.elapsed=bridgeDuration(b);expect(bridgeReady(b)).toBe(true);expect(canStand(w,[],p.x,p.y,null,.42)).toBe(true);
  expect(findPath(w,[],{x:18.5,y:18.5},vertical?{x:20.5,y:29.5}:{x:29.5,y:20.5})).not.toBeNull();
  expect(placementError(w,[],[],p.x|0,p.y|0)).toContain('bridge');expect(railError(w,[],p.x|0,p.y|0,vertical?'NS':'EW',1,'a')).toContain('bridges');
  expect(tankPlacementError(w,[],[],b.from.x,b.from.y,'a')).toContain('bridges');
});
it('rejects diagonal, overlong, narrow-bank, rocky and occupied spans',()=>{
  const {w,b,truck}=setup();expect(bridgeError(w,[],[],truck,b.from,{x:27,y:21})).toContain('Align');
  expect(bridgeError(w,[],[],truck,b.from,{x:60,y:20})).toContain(String(BRIDGE.maxSpan));
  w.terrain[19*64+20]=0;expect(bridgeError(w,[],[],truck,b.from,b.to)).toContain('anchors');w.terrain[19*64+20]=2;
  w.terrain[20*64+24]=3;expect(bridgeError(w,[],[],truck,b.from,b.to)).toContain('rocks');w.terrain[20*64+24]=0;
  expect(bridgeError(w,[],[{id:'enemy',x:24.5,y:20.5,hp:10}],truck,b.from,b.to)).toContain('unit');
  expect(bridgeError(w,[],[],{...truck,x:2},b.from,b.to)).toContain('Drive');
});
it.each([false,true])('crosses staggered shores from inland anchors without changing terrain (vertical=%s)',vertical=>{
  const {w,b,truck}=setup(vertical),point=(forward:number,side:number)=>vertical?{x:side,y:forward}:{x:forward,y:side};
  b.from=point(19,20);b.to=point(28,20);
  for(const [forward,side,tile] of [[21,19,1],[22,19,1],[26,21,2]]){const p=point(forward,side);w.terrain[p.y*64+p.x]=tile;}
  const original=[...w.terrain];expect(bridgeError(w,[],[],truck,b.from,b.to)).toBeNull();
  // The land part of the deck remains subject to occupancy and rock checks.
  const land=point(20,20);expect(bridgeError(w,[],[{x:land.x+.5,y:land.y+.5,hp:10}],truck,b.from,b.to)).toContain('unit');
  expect(bridgeError(w,[land],[],truck,b.from,b.to)).toContain('facilities');
  w.terrain[land.y*64+land.x]=3;expect(bridgeError(w,[],[],truck,b.from,b.to)).toContain('rocks');w.terrain=original;
  expect(bridgeCost(b)).toBe(78);expect(bridgeDuration(b)).toBeCloseTo(7.2);
  w.logistics.bridges=[b];expect(canStand(w,[],land.x+.5,land.y+.5)).toBe(false);
  b.elapsed=3;const restored=JSON.parse(JSON.stringify(w));expect(bridgeReady(restored.logistics.bridges[0])).toBe(false);
  restored.logistics.bridges[0].elapsed=bridgeDuration(b);
  for(const cell of bridgeCells(b))expect(canStand(restored,[],cell.x+.5,cell.y+.5,null,.42)).toBe(true);
  expect(findPath(restored,[],point(18.5,20.5),point(29.5,20.5))).not.toBeNull();expect(restored.terrain).toEqual(original);
});
it('requires some water and keeps clear approaches even with inland anchors',()=>{
  const {w,b,truck}=setup();w.terrain[20*64+19]=3;expect(bridgeError(w,[],[],truck,b.from,b.to)).toContain('approach');
  w.terrain.fill(2);expect(bridgeError(w,[],[],truck,b.from,b.to)).toContain('some open water');
});
it('reserves unfinished spans against ships without rewriting the original water',()=>{
  const {w,b}=setup();const ship={id:'ship',x:23.5,y:20.5,angle:0,elapsed:99};expect(canSail(w,ship)).toBe(true);
  w.logistics.bridges=[b];expect(canSail(w,ship)).toBe(false);expect(tileAt(w,23,20)).toBe(0);expect(w.terrain[20*64+23]).toBe(0);
  b.elapsed=bridgeDuration(b);expect(canSail(w,ship)).toBe(false);expect(w.terrain[20*64+23]).toBe(0);
});

it.each([0,1,2,3])('finds a valid shore crossing in facing direction %s without endpoint input',bearing=>{
  const {w,truck}=setup(bearing%2===0);
  Object.assign(truck,bearing===0?{x:20.5,y:29.5}:bearing===3?{x:29.5,y:20.5}:{x:18.5,y:18.5});
  const p=planBridgeAhead(w,[],[],truck,bearing);expect(p.error).toBeNull();
  expect(bridgeError(w,[],[],truck,p.from,p.to)).toBeNull();
  expect(Math.sign(p.to!.x-p.from!.x)).toBe([0,1,0,-1][bearing]);expect(Math.sign(p.to!.y-p.from!.y)).toBe([-1,0,1,0][bearing]);
  expect(bridgeFacing(bearing*Math.PI/2)).toBe(bearing);
});
it('finds a nearby parallel corridor when the builder is at a jagged shoreline',()=>{
  const {w,truck}=setup();truck.x=20.5;truck.y=20.5;w.terrain[21*64+20]=0;
  const p=planBridgeAhead(w,[],[],truck,1);expect(p.error).toBeNull();expect(p.shift).not.toBe(0);
  expect(bridgeError(w,[],[],truck,p.from,p.to)).toBeNull();
});
it('reports blocked or missing shores without planning through rocks, structures or units',()=>{
  const {w,truck}=setup();
  for(let y=0;y<w.height;y++)w.terrain[y*64+24]=3;
  expect(planBridgeAhead(w,[],[],truck,1).error).toContain('Rocks');
  for(let y=0;y<w.height;y++)w.terrain[y*64+24]=0;
  const barrier=Array.from({length:64},(_,y)=>({x:24,y}));
  expect(planBridgeAhead(w,barrier,[],truck,1).error).toContain('facilities');
  expect(planBridgeAhead(w,[],barrier.map(p=>({x:p.x+.5,y:p.y+.5,hp:10})),truck,1).error).toContain('unit');
  expect(planBridgeAhead(w,[],[],truck,3).error).toContain('No suitable');
  w.terrain.fill(0);expect(planBridgeAhead(w,[],[],truck,1).error).toContain('No room');
});
