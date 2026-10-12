import { expect, it } from 'vitest';
import { bridgeError } from '../public/bridge.js';
import { BRIDGE, bridgeCells, bridgeCost, bridgeDuration, bridgeReady } from '../public/bridge-geometry.js';
import { createWorld, tileAt, canStand, findPath, placementError } from '../public/world.js';
import { freshLogistics } from '../public/logistics.js';
import { canSail } from '../public/ship.js';
import { railError } from '../public/rail.js';
import { tankPlacementError } from '../public/tank.js';

function setup(vertical=false){
  const w:any={...createWorld(),width:64,height:64,terrain:Array(64*64).fill(2),cores:[],tanks:[],ships:[],rails:[],artillery:[],airbases:[],sites:[],logistics:freshLogistics()};
  for(let i=21;i<=26;i++)for(let j=0;j<64;j++)w.terrain[(vertical?i:j)*64+(vertical?j:i)]=0;
  const b:any={id:'b',from:{x:20,y:20},to:vertical?{x:20,y:27}:{x:27,y:20},elapsed:0};
  const truck={id:'engineer',kind:'builder',x:18.5,y:18.5};w.logistics.recyclers=[truck];return {w,b,truck};
}
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
it('rejects diagonal, overlong, narrow-bank, land-filled and occupied spans',()=>{
  const {w,b,truck}=setup();expect(bridgeError(w,[],[],truck,b.from,{x:27,y:21})).toContain('Align');
  expect(bridgeError(w,[],[],truck,b.from,{x:60,y:20})).toContain(String(BRIDGE.maxSpan));
  w.terrain[19*64+20]=0;expect(bridgeError(w,[],[],truck,b.from,b.to)).toContain('anchors');w.terrain[19*64+20]=2;
  w.terrain[20*64+24]=2;expect(bridgeError(w,[],[],truck,b.from,b.to)).toContain('open water');w.terrain[20*64+24]=0;
  expect(bridgeError(w,[],[{id:'enemy',x:24.5,y:20.5,hp:10}],truck,b.from,b.to)).toContain('unit');
  expect(bridgeError(w,[],[],{...truck,x:2},b.from,b.to)).toContain('Drive');
});
it('reserves unfinished spans against ships without rewriting the original water',()=>{
  const {w,b}=setup();const ship={id:'ship',x:23.5,y:20.5,angle:0,elapsed:99};expect(canSail(w,ship)).toBe(true);
  w.logistics.bridges=[b];expect(canSail(w,ship)).toBe(false);expect(tileAt(w,23,20)).toBe(0);expect(w.terrain[20*64+23]).toBe(0);
  b.elapsed=bridgeDuration(b);expect(canSail(w,ship)).toBe(false);expect(w.terrain[20*64+23]).toBe(0);
});
