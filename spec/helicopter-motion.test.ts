import {it,expect} from 'vitest';
import {HELI,helicopterMotion} from '../public/helicopter.js';
import {helicopterTilt,HELI_TILT} from '../public/helicopter-effects.js';
const world={width:128,height:96};
const craft=()=>({x:50,y:50,vx:0,vy:0,speed:0,angle:0,state:'flying'});
it('builds speed over one second and holds the same capped speed on straight and diagonal flight',()=>{
 const p=craft();helicopterMotion(world,p,{x:1,y:0},.25);expect(p.speed).toBeCloseTo(1);expect(p.x).toBeCloseTo(50.125);
 helicopterMotion(world,p,{x:1,y:0},.75);expect(p.speed).toBeCloseTo(4);expect(p.x).toBeCloseTo(52);
 helicopterMotion(world,p,{x:1,y:0},2);expect(p.speed).toBe(4);expect(p.x).toBeCloseTo(60);
 const diagonal=craft();helicopterMotion(world,diagonal,{x:1,y:1},2);expect(diagonal.speed).toBeCloseTo(HELI.speed);expect(diagonal.x-50).toBeCloseTo(diagonal.y-50);
});
it('brakes to an exact hover with a short drift and cannot instantly reverse velocity',()=>{
 const p={...craft(),vx:4,speed:4};helicopterMotion(world,p,{x:0,y:0},.25);expect(p.vx).toBeCloseTo(2.5);
 helicopterMotion(world,p,null,1);expect(p.speed).toBe(0);expect(p.x-50).toBeCloseTo(4*4/(2*HELI.braking),2);
 const x=p.x;helicopterMotion(world,p,null,2);expect(p.x).toBe(x);
 const reverse={...craft(),vx:4,speed:4};helicopterMotion(world,reverse,{x:-1,y:0},.25);expect(reverse.vx).toBeCloseTo(2.5);
 helicopterMotion(world,reverse,{x:-1,y:0},2);expect(reverse.vx).toBe(-4);
});
it('makes a sideways turn through intermediate velocities without gaining diagonal speed',()=>{
 const p={...craft(),vx:4,speed:4};helicopterMotion(world,p,{x:0,y:-1},.1);
 expect(p.vx).toBeGreaterThan(3);expect(p.vy).toBeLessThan(0);expect(p.vy).toBeGreaterThan(-1);expect(p.speed).toBeLessThanOrEqual(4);
 helicopterMotion(world,p,{x:0,y:-1},2);expect(p.vx).toBe(0);expect(p.vy).toBe(-4);
});
it('agrees across normal server tick sizes and clears outward velocity at the map edge',()=>{
 const a=craft(),b=craft();
 for(const input of [{x:1,y:0},{x:-1,y:1},{x:0,y:0}]){
  for(let i=0;i<20;i++)helicopterMotion(world,a,input,.05);
  for(let i=0;i<10;i++)helicopterMotion(world,b,input,.1);
 }
 expect(a.x).toBeCloseTo(b.x,8);expect(a.y).toBeCloseTo(b.y,8);expect(a.speed).toBeCloseTo(b.speed,8);
 const edge={...craft(),x:127.49,vx:4,speed:4};helicopterMotion(world,edge,{x:1,y:0},.1);expect(edge.x).toBe(127.5);expect(edge.vx).toBe(0);
 helicopterMotion(world,edge,{x:-1,y:0},.1);expect(edge.x).toBeLessThan(127.5);expect(edge.vx).toBeLessThan(0);
});
it('leans in the travel direction independently of aim and levels at hover, landing or reduced effects',()=>{
 const east={...craft(),vx:4};expect(helicopterTilt(east).roll).toBeCloseTo(HELI_TILT);expect(helicopterTilt(east).pitch).toBe(0);
 const turned={...east,angle:Math.PI/2};expect(helicopterTilt(turned).roll).toBeCloseTo(0);expect(helicopterTilt(turned).pitch).toBeCloseTo(HELI_TILT);
 expect(helicopterTilt(craft())).toEqual({roll:0,pitch:0});expect(helicopterTilt(east,true)).toEqual({roll:0,pitch:0});expect(helicopterTilt({...east,state:'landing'})).toEqual({roll:0,pitch:0});
});
