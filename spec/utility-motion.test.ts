import { expect, it } from 'vitest';
import { createWorld, canStand } from '../public/world.js';
import { freshLogistics } from '../public/logistics.js';
import { recyclerStep, recyclerRouteStep, stopUtility, UTILITY_DRIVE } from '../public/recycler.js';

function fixture(kind='recycler') {
  const world:any={...createWorld(),width:40,height:40,terrain:Array(1600).fill(2),cores:[],tanks:[],ships:[],rails:[],artillery:[],airbases:[],sites:[],logistics:freshLogistics()};
  const truck:any={id:'truck',kind,x:10.5,y:20.5,angle:0,cargo:30,path:[],remaining:0};
  world.logistics.recyclers=[truck];return {world,truck};
}
it.each(['recycler','builder'])('%s accelerates, coasts to rest before working, and reverses without spinning around',kind=>{
  const {world,truck}=fixture(kind),profile=UTILITY_DRIVE[kind as keyof typeof UTILITY_DRIVE];
  recyclerStep(world,[],truck,{x:0,y:-1},.1);
  expect(truck.speed).toBeGreaterThan(0);expect(truck.speed).toBeLessThan(1);
  for(let i=0;i<25;i++)recyclerStep(world,[],truck,{x:0,y:-1},.1);
  expect(truck.driveSpeed).toBe(profile.speed);
  const y=truck.y;recyclerStep(world,[],truck,{x:0,y:0},.1);
  expect(truck.idle).toBe(0);expect(truck.y).toBeLessThan(y);
  for(let i=0;i<12;i++)recyclerStep(world,[],truck,{x:0,y:0},.1);
  expect(truck.speed).toBe(0);expect(truck.idle).toBeGreaterThan(.5);expect(y-truck.y).toBeLessThan(1.1);
  for(let i=0;i<20;i++)recyclerStep(world,[],truck,{x:0,y:1},.1);
  expect(truck.driveSpeed).toBe(-profile.reverse);expect(truck.vy).toBeGreaterThan(0);expect(truck.angle).toBeCloseTo(0);
  expect(truck.cargo).toBe(30);
});
it('slows steering at speed, clears momentum on safety stops, and loads old records without motion fields',()=>{
  const slow=fixture(),fast=fixture();fast.truck.driveSpeed=3.5;
  recyclerStep(slow.world,[],slow.truck,{x:1,y:0},.1);recyclerStep(fast.world,[],fast.truck,{x:1,y:0},.1);
  expect(slow.truck.angle).toBeGreaterThan(fast.truck.angle*1.5);
  const before={x:fast.truck.x,y:fast.truck.y};recyclerStep(fast.world,[],fast.truck,null,.1);
  expect(fast.truck).toMatchObject({...before,driveSpeed:0,speed:0,vx:0,vy:0});
  for(let i=0;i<8;i++)recyclerStep(fast.world,[],fast.truck,null,.1);
  expect(fast.truck.idle).toBeGreaterThan(.5);
  stopUtility(slow.truck);expect(slow.truck.driveSpeed).toBe(0);
});
it.each(['recycler','builder'])('%s crosses a narrow bridge and cannot coast through water or a vehicle',kind=>{
  const {world,truck}=fixture(kind);truck.angle=Math.PI/2;
  for(let y=0;y<40;y++)for(let x=12;x<=17;x++)world.terrain[y*40+x]=0;
  world.logistics.bridges=[{id:'bridge',from:{x:11,y:20},to:{x:18,y:20},elapsed:999}];
  for(let i=0;i<45;i++){recyclerStep(world,[],truck,{x:0,y:-1},.1);expect(canStand(world,[],truck.x,truck.y,undefined,.42)).toBe(true);}
  expect(truck.x).toBeGreaterThan(18.5);
  world.logistics.bridges=[];Object.assign(truck,{x:10.5,y:20.5,driveSpeed:3.5});
  for(let i=0;i<10;i++)recyclerStep(world,[],truck,{x:0,y:-1},.1);
  expect(truck.x).toBeLessThan(11.6);expect(truck.driveSpeed).toBe(0);
  world.terrain.fill(2);world.logistics.recyclers.push({id:'other',x:13,y:20.5});
  for(let i=0;i<20;i++)recyclerStep(world,[],truck,{x:0,y:-1},.1);
  expect(truck.x).toBeLessThanOrEqual(12.1);expect(truck.driveSpeed).toBe(0);
});
it('follows a one-tile L corridor without cutting the corner, parks and retains its delivery task',()=>{
  const {world,truck}=fixture();world.terrain.fill(0);Object.assign(truck,{x:10.5,y:20.5,angle:Math.PI/2});
  for(let x=10;x<=15;x++)world.terrain[20*40+x]=2;
  for(let y=15;y<=20;y++)world.terrain[y*40+15]=2;
  truck.path=[...Array.from({length:5},(_,i)=>({x:11.5+i,y:20.5})),...Array.from({length:5},(_,i)=>({x:15.5,y:19.5-i}))];
  truck.task={action:'deliver',id:'receiver'};
  for(let i=0;i<600&&truck.path.length;i++){
    recyclerRouteStep(world,[],truck,.05);
    expect(truck.blocked).not.toBe(true);expect(canStand(world,[],truck.x,truck.y,undefined,.42)).toBe(true);
  }
  expect(truck.path).toHaveLength(0);expect(Math.hypot(truck.x-15.5,truck.y-15.5)).toBeLessThan(.08);
  expect(truck).toMatchObject({speed:0,driveSpeed:0,task:{action:'deliver',id:'receiver'},cargo:30});
});

it.each(['recycler','builder'])('%s pivots without sliding, reports the rotation and then drives nose-first',kind=>{
 const {world,truck}=fixture(kind);expect(recyclerStep(world,[],truck,{x:1,y:0},.1)).toBe(true);expect(truck.x).toBe(10.5);expect(truck.y).toBe(20.5);expect(truck.angle).toBeGreaterThan(0);expect(truck.idle).toBe(0);
 truck.angle=Math.PI/2;for(let i=0;i<15;i++)recyclerStep(world,[],truck,{x:0,y:-1},.1);expect(truck.x).toBeGreaterThan(12);expect(truck.y).toBeCloseTo(20.5);
});
