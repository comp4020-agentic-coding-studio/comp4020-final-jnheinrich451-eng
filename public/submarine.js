import { surfaced } from './submarine-depth.js';
import { operational } from './vehicle.js';
import { shipKind } from './ship.js';
import { MISSILE } from './missile.js';
import { fieldCapacityError } from './hazards.js';

export const SUBMARINE=Object.freeze({count:6,width:6,height:8,interval:.25,reload:18,minRange:12,range:80,gasCapacity:9});
export const isSubmarine = ship => shipKind(ship)==='submarine';
export function submarineBox(target,rotated=false){const width=rotated?SUBMARINE.height:SUBMARINE.width,height=rotated?SUBMARINE.width:SUBMARINE.height;return{x:target.x-width/2,y:target.y-height/2,width,height};}
export function submarineTargetError(ship,world,target,rotated=false){
 if(!target||![target.x,target.y].every(Number.isFinite))return 'Choose a missile strike area.';
 const b=submarineBox(target,rotated);
 if(b.x<0||b.y<0||b.x+b.width>world.width||b.y+b.height>world.height)return 'Keep the whole 6 x 8 strike area inside the map.';
 const near=Math.hypot(Math.max(b.x-ship.x,0,ship.x-b.x-b.width),Math.max(b.y-ship.y,0,ship.y-b.y-b.height));
 const far=Math.max(...[b.x,b.x+b.width].flatMap(x=>[b.y,b.y+b.height].map(y=>Math.hypot(x-ship.x,y-ship.y))));
 return near<SUBMARINE.minRange||far>SUBMARINE.range?'Keep the whole strike area 12 to 80 tiles from the submarine.':null;
}
export function submarineFireError(ship,world,target,rotated=false,barrages=[],fields=[],salvos=[]){
 if(!isSubmarine(ship)||!operational(ship))return 'Board an operational missile submarine.';
 if(!surfaced(ship))return 'Surface fully before launching missiles.';
 if(ship.reload>.001)return 'Missile tubes reloading.';
 if(!['HE','INCENDIARY','GAS'].includes(ship.ammo||'HE'))return 'Choose HE, Fire or Gas.';
 if(barrages.length>=MISSILE.maxVolleys)return 'Two missile volleys are already in flight.';
 return submarineTargetError(ship,world,target,rotated)||fieldCapacityError(fields,salvos,ship.ammo||'HE',SUBMARINE.width*SUBMARINE.height);
}
export function makeSubmarineBarrage(ship,target,rotated,seed){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const box=submarineBox(target,rotated),flight=6+Math.min(1,Math.hypot(target.x-ship.x,target.y-ship.y)/SUBMARINE.range)*4;
 const missiles=Array.from({length:SUBMARINE.count},(_,i)=>{
  const col=i%2,row=Math.floor(i/2),u=(col+.5)*3-3+(random()-.5)*.8,v=(row+.5)*8/3-4+(random()-.5)*.8;
  const sector=rotated?{x:box.x+row*8/3,y:box.y+col*3,width:8/3,height:3}:{x:box.x+col*3,y:box.y+row*8/3,width:3,height:8/3};
  // Hatches are fixed in world space at acceptance; the ship braces through the last launch.
  const lx=(col-.5)*.6,ly=(row-1)*.6+.5,c=Math.cos(ship.angle),s=Math.sin(ship.angle);
  return{x:target.x+(rotated?v:u),y:target.y+(rotated?u:v),originX:ship.x+lx*c-ly*s,originY:ship.y+lx*s+ly*c,sector,launch:i*SUBMARINE.interval,flight,phase:random()*Math.PI*2,craterSize:4.5*(.9+random()*.2),landed:false};
 });
 return{id:seed,owner:ship.id,kind:'submarine',weapon:ship.ammo||'HE',x:ship.x,y:ship.y,box,age:0,gasCapacity:SUBMARINE.gasCapacity,missiles};
}
