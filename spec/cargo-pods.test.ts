import { expect, it } from 'vitest';
import { cargoSite, cargoCells, cargoContains, incomingCargoAt, newCargoPod, newRailDelivery, tickCargoPods } from '../public/cargo-pods.js';
import { cargoPlacementError } from '../public/cargo-placement.js';
import { createWorld, canStand, tileAt, placementError } from '../public/world.js';
import { freshLogistics } from '../public/logistics.js';
import { tankPodCells, tankArrivalPosition, TANK } from '../public/tank.js';

const flat=():any=>({...createWorld(),width:128,height:96,terrain:Array(128*96).fill(2),cores:[],tanks:[],ships:[],artillery:[],airbases:[],rails:[],sites:[],logistics:freshLogistics()});
it.each(['EW','NS','CNE','CSE','CSW','CNW','NE','SE','SW','NW'])('delivers a new %s piece with one metal base and no unfolding panels or collision reservations',shape=>{
  const rail={x:30,y:30,shape},pod=newRailDelivery('corner',{...rail,length:1},[rail],[])!;
  expect(pod.layout).toBe('rail-crate');expect(cargoCells(pod)).toEqual([{x:30,y:30}]);expect(cargoCells(pod,true)).toEqual([]);
  expect(cargoContains(pod,30.5,30.5)).toBe(true);expect(cargoContains(pod,31.5,30.5)).toBe(false);
  const w=flat();w.logistics.cargoPods=[pod];w.logistics.floors=[100];
  expect(incomingCargoAt(w,30.5,30.5)).toBe(false);
  tickCargoPods(w.logistics,1,128);const saved=JSON.parse(JSON.stringify(w.logistics));
  expect(saved.cargoPods[0].remaining).toBeCloseTo(1.25);
  tickCargoPods(saved,2,128);expect(saved.cargoPods).toEqual([]);expect(saved.floors).toEqual([100,30*128+30]);
  expect(newRailDelivery('retry',rail,[],[rail])).toBeNull();
  expect(newRailDelivery('upgrade',rail,[rail],[{...rail,shape:'EW'}])).toBeNull();
});
it.each(['EW','NS'])('saves exactly five %s rail floor tiles and retires the finished animation',shape=>{
  const w=flat(),pod={id:'rail',x:30,y:30,w:1,h:1,layout:'rail-line',shape,remaining:4.45,duration:4.45};
  w.logistics.cargoPods=[pod];
  const cells=cargoCells(pod);expect(cells).toHaveLength(5);
  expect(cells).toContainEqual({x:30+(shape==='EW'?2:0),y:30+(shape==='NS'?2:0)});
  expect(cargoContains(pod,31.5,31.5)).toBe(false);
  expect(incomingCargoAt(w,30.5,30.5)).toBe(false); // Presentation does not change rail admission.
  tickCargoPods(w.logistics,2,128);const saved=JSON.parse(JSON.stringify(w.logistics));
  expect(saved.cargoPods[0].remaining).toBeCloseTo(2.45);
  tickCargoPods(saved,3,128);expect(saved.cargoPods).toHaveLength(0);
  expect(saved.floors.sort((a:number,b:number)=>a-b)).toEqual(cells.map(c=>c.y*128+c.x).sort((a,b)=>a-b));
});
it.each([['helipad',45],['missile',80],['airbase',300],['outpost',20],['recycler',5]] as const)('matches every preview cell to the %s reservation', (kind,count)=>{
  const p=cargoSite(kind,30,30)!;const cells=cargoCells(p);
  expect(cells).toHaveLength(count);expect(new Set(cells.map(c=>`${c.x}:${c.y}`)).size).toBe(count);
  for(let y=15;y<60;y++)for(let x=15;x<60;x++)expect(cargoContains(p,x+.5,y+.5)).toBe(cells.some(c=>c.x===x&&c.y===y));
});
it('keeps tank rollout on its five-tile footprint',()=>{
  expect(tankPodCells(20,20)).toHaveLength(5);
  const p=tankArrivalPosition({podX:20,podY:20,elapsed:TANK.duration});
  expect(tankPodCells(20,20)).toContainEqual(expect.objectContaining({x:Math.floor(p.x),y:Math.floor(p.y)}));
});
it('rejects obstructed walls, including water, occupied machinery, vehicles and the map edge',()=>{
  const w=flat(),p=cargoSite('helipad',30,30)!;
  expect(cargoPlacementError(w,[],[],p)).toBeNull();
  w.terrain[28*128+30]=0;expect(cargoPlacementError(w,[],[],p)).toContain('water');w.terrain[28*128+30]=2;
  expect(cargoPlacementError(w,[{x:30,y:28}],[],p)).toContain('occupied');
  w.logistics.recyclers.push({x:30.5,y:28.5});expect(cargoPlacementError(w,[],[],p)).toContain('close');
  expect(cargoPlacementError(flat(),[],[],cargoSite('helipad',1,1))).toContain('inside');
});
it('allows cannon pod flooring over its track but rejects occupied machinery',()=>{
  const w=flat(),p=cargoSite('artillery',30,30)!;
  w.rails=[{x:28,y:30,shape:'EW'},{x:32,y:30,shape:'EW'}];
  expect(cargoPlacementError(w,[],[],p)).toBeNull();
  expect(cargoPlacementError(w,[{x:32,y:30}],[],p)).toContain('occupied');
  expect(cargoPlacementError(w,[],[],cargoSite('helipad',30,30))).toContain('railway');
});
it('reserves incoming walls and preserves walkable floors across serialization without terrain mutation',()=>{
  const w=flat();w.logistics.cargoPods=[newCargoPod('pad',cargoSite('helipad',30,30))];
  expect(incomingCargoAt(w,30.5,28.5)).toBe(true);expect(canStand(w,[],30.5,28.5)).toBe(false);
  expect(placementError(w,[],[],30,28)).toContain('pod');
  tickCargoPods(w.logistics,1,128);const saved=JSON.parse(JSON.stringify(w));
  expect(saved.logistics.cargoPods[0].remaining).toBeCloseTo(2.6);
  tickCargoPods(saved.logistics,3,128);
  expect(saved.logistics.floors).toHaveLength(45);expect(canStand(saved,[],30.5,28.5)).toBe(true);expect(tileAt(saved,30,28)).toBe(4);expect(saved.terrain[28*128+30]).toBe(2);
  tickCargoPods(saved.logistics,10,128);expect(saved.logistics.floors).toHaveLength(45);
});
