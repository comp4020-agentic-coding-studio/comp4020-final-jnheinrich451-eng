import { clampStrike } from './strike-aim.js';
import { surfaced } from './submarine-depth.js';
import { operational } from './vehicle.js';
import { shipKind } from './ship.js';
import { fieldCapacityError } from './hazards.js';
import { submarineTubeLocal } from './naval-scale.js';

export const SUBMARINE=Object.freeze({count:6,groups:4,maxVolleys:16,width:6,height:8,interval:.25,reload:18,minRange:12,range:80,gasCapacity:9});
export const isSubmarine = ship => shipKind(ship)==='submarine';
export const submarineReloads=ship=>Array.from({length:SUBMARINE.groups},(_,i)=>{
 const value=Array.isArray(ship.siloReloads)?ship.siloReloads[i]:i===0?ship.reload:0;
 return Number.isFinite(value)?Math.max(0,value):0;
});
export function nextSubmarineGroup(ship){
 const reloads=submarineReloads(ship),start=Number.isInteger(ship.nextSiloGroup)?((ship.nextSiloGroup%SUBMARINE.groups)+SUBMARINE.groups)%SUBMARINE.groups:0;
 for(let n=0;n<SUBMARINE.groups;n++){const group=(start+n)%SUBMARINE.groups;if(reloads[group]<=.001)return group;}
 return -1;
}
export const submarineGroupsReady=ship=>submarineReloads(ship).filter(r=>r<=.001).length;
export function spendSubmarineGroup(ship,group){
 ship.siloReloads=submarineReloads(ship);ship.siloReloads[group]=SUBMARINE.reload+(SUBMARINE.count-1)*SUBMARINE.interval;
 ship.nextSiloGroup=(group+1)%SUBMARINE.groups;syncSubmarineReload(ship);
}
function syncSubmarineReload(ship){
 ship.reload=Math.min(...ship.siloReloads);
 ship.launchRemaining=Math.max(0,...ship.siloReloads.map(r=>r-SUBMARINE.reload));
}
export function tickSubmarineReloads(ship,dt){
 const reloads=submarineReloads(ship),changed=!Array.isArray(ship.siloReloads)||reloads.some(r=>r>0);
 if(!changed||!Number.isFinite(dt)||dt<0)return false;
 ship.siloReloads=reloads.map(r=>Math.max(0,r-dt));syncSubmarineReload(ship);return true;
}
export function submarineSiloAge(ship,index){
 const left=submarineReloads(ship)[Math.floor(index/SUBMARINE.count)],total=SUBMARINE.reload+(SUBMARINE.count-1)*SUBMARINE.interval;
 return left>0&&left<=total?total-left:null;
}
export const submarineMagazineLabel=ship=>submarineReloads(ship).map((r,i)=>`${i+1}:${r>.001?Math.ceil(r)+'s':'READY'}`).join(' / ');
export const submarineAim = (ship, world, target, rotated = false) => clampStrike(ship, world, target, rotated ? SUBMARINE.height : SUBMARINE.width, rotated ? SUBMARINE.width : SUBMARINE.height, SUBMARINE.range);
export function submarineBox(target,rotated=false){const width=rotated?SUBMARINE.height:SUBMARINE.width,height=rotated?SUBMARINE.width:SUBMARINE.height;return{x:target.x-width/2,y:target.y-height/2,width,height};}
export function submarineTargetError(ship,world,target,rotated=false){
 if(!target||![target.x,target.y].every(Number.isFinite))return 'Choose a missile strike area.';
 target=submarineAim(ship,world,target,rotated);
 const b=submarineBox(target,rotated);
 if(b.x<0||b.y<0||b.x+b.width>world.width||b.y+b.height>world.height)return 'Keep the whole 6 x 8 strike area inside the map.';
 const near=Math.hypot(Math.max(b.x-ship.x,0,ship.x-b.x-b.width),Math.max(b.y-ship.y,0,ship.y-b.y-b.height));
 const far=Math.max(...[b.x,b.x+b.width].flatMap(x=>[b.y,b.y+b.height].map(y=>Math.hypot(x-ship.x,y-ship.y))));
 return near<SUBMARINE.minRange||far>SUBMARINE.range+1e-8?'Keep the whole strike area 12 to 80 tiles from the submarine.':null;
}
export function submarineFireError(ship,world,target,rotated=false,barrages=[],fields=[],salvos=[]){
 if(!isSubmarine(ship)||!operational(ship))return 'Board an operational missile submarine.';
 if(nextSubmarineGroup(ship)<0)return 'All four missile groups are reloading.';
 if(!['HE','INCENDIARY','GAS'].includes(ship.ammo||'HE'))return 'Choose HE, Fire or Gas.';
 if(barrages.filter(b=>b.kind==='submarine').length>=SUBMARINE.maxVolleys)return 'Submarine missile volley capacity reached. Wait for impacts.';
 return submarineTargetError(ship,world,target,rotated)||fieldCapacityError(fields,salvos,ship.ammo||'HE',SUBMARINE.width*SUBMARINE.height);
}
export function makeSubmarineBarrage(ship,target,rotated,seed,group=0){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const box=submarineBox(target,rotated),flight=6+Math.min(1,Math.hypot(target.x-ship.x,target.y-ship.y)/SUBMARINE.range)*4;
 const missiles=Array.from({length:SUBMARINE.count},(_,i)=>{
  const col=i%2,row=Math.floor(i/2),u=(col+.5)*3-3+(random()-.5)*.8,v=(row+.5)*8/3-4+(random()-.5)*.8;
  const sector=rotated?{x:box.x+row*8/3,y:box.y+col*3,width:8/3,height:3}:{x:box.x+col*3,y:box.y+row*8/3,width:3,height:8/3};
  // Targets are committed now; later tubes resolve their origin once on launch.
  const tube=group*SUBMARINE.count+i;
  return{x:target.x+(rotated?v:u),y:target.y+(rotated?u:v),tube,...submarineLaunchOrigin(ship,tube),launchPending:i>0,sector,launch:i*SUBMARINE.interval,flight,phase:random()*Math.PI*2,craterSize:4.5*(.9+random()*.2),landed:false};
 });
 return{id:seed,owner:ship.id,kind:'submarine',group,weapon:ship.ammo||'HE',x:ship.x,y:ship.y,box,age:0,gasCapacity:SUBMARINE.gasCapacity,missiles};
}
export function submarineLaunchOrigin(ship,index){
 const {x:lx,y:ly}=submarineTubeLocal(ship,index),c=Math.cos(ship.angle),s=Math.sin(ship.angle);
 return {originX:ship.x+lx*c-ly*s,originY:ship.y+lx*s+ly*c,underwater:!surfaced(ship)};
}
