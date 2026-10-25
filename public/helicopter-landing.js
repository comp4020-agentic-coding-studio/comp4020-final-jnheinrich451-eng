import { canStand, tileAt } from './world.js';
import { airbaseAt, railCorridor, fieldHelicopterBlocks } from './footprints.js';

// A saved, grid-aligned 3 x 3 rotor-clearance area. This is gameplay geometry,
// independent of the cosmetic rotor animation and aircraft's original helipad.
export const fieldLandingPoint = p => ({x:Math.floor(p.x)+.5,y:Math.floor(p.y)+.5});
export const fieldLandingCells = point => Array.from({length:9},(_,i)=>({x:Math.floor(point.x)-1+i%3,y:Math.floor(point.y)-1+Math.floor(i/3)}));
const live = o => o.life!=='disabled' && (o.hp===undefined||o.hp>0) && !o.destroyed;
const ground = o => !['aircraft','ship','orbital'].includes(o.body) && !o.aircraftId && !o.shipId;
export function fieldLandingError(world,p,point=fieldLandingPoint(p),buildings=world.buildings||[],people=world.players||[]){
  if(![point.x,point.y].every(Number.isFinite))return 'Choose clear ground inside the map.';
  // Ignore this aircraft's own reservation while revalidating touchdown.
  const filtered={...world,airbases:(world.airbases||[]).map(b=>b.aircraft?.id===p.id?{...b,aircraft:null}:b)};
  for(const {x,y} of fieldLandingCells(point)){
    if(x<0||y<0||x>=world.width||y>=world.height)return 'Keep the whole 3 x 3 landing area inside the map.';
    if(tileAt(world,x,y)===0)return 'Water below / find a clear 3 x 3 land area.';
    if(airbaseAt(world,x,y)||railCorridor(world,x,y)||!canStand(filtered,buildings,x+.5,y+.5,null,.49))return 'Landing area obstructed / clear all nine tiles.';
    if(fieldHelicopterBlocks(filtered,x+.5,y+.5,.49))return 'Another helicopter has reserved this landing area.';
  }
  const occupants=[...people,...(world.combat?.enemies||[]),...(world.logistics?.recyclers||[])];
  if(occupants.some(o=>o.id!==p.occupant&&live(o)&&ground(o)&&Math.abs(o.x-point.x)<2&&Math.abs(o.y-point.y)<2))return 'Landing area occupied / wait for ground units to clear.';
  return null;
}
export function fieldExitPoint(world,p,buildings=world.buildings||[],people=world.players||[]){
  const occupants=[...people,...(world.combat?.enemies||[]),...(world.logistics?.recyclers||[])];
  // Exit outside the reserved rotor area; never teleport back to the home pad.
  return [[2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,2],[2,-2],[-2,-2]].map(([x,y])=>({x:p.x+x,y:p.y+y})).find(q=>canStand(world,buildings,q.x,q.y)&&!occupants.some(o=>o.id!==p.occupant&&live(o)&&ground(o)&&Math.hypot(o.x-q.x,o.y-q.y)<.8));
}

// Bounded emergency search, used only when no usable helipad remains.
export function emergencyLandingPoint(world,p){
  for(let radius=0;radius<=16;radius+=2)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const q=fieldLandingPoint({x:p.x+dx*radius,y:p.y+dy*radius});
    if(!fieldLandingError(world,p,q))return q;
  }
  return null;
}
