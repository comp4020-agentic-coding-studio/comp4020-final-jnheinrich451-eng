import { CARGO_POD_DURATION, POD } from './pod.js';
import { isCurve } from './track.js';

export const isRailDelivery=p=>['rail-line','rail-crate'].includes(p.layout);
export function newRailDelivery(id,request,additions,rails){
  if(!additions.length||additions.some(r=>rails.some(t=>t.x===r.x&&t.y===r.y)))return null;
  const line=(request.length??5)===5&&['EW','NS'].includes(request.shape)&&additions.length===5;
  const corner=additions.length===1&&(isCurve(request)||['CNE','CSE','CSW','CNW'].includes(request.shape));
  const single=request.length===1&&['EW','NS'].includes(request.shape)&&additions.length===1;
  if(!line&&!corner&&!single)return null;
  const duration=line?4.45:POD.unfold+.5;
  return {...newCargoPod(id,{x:request.x,y:request.y,w:1,h:1,layout:line?'rail-line':'rail-crate',shape:request.shape}),duration,remaining:duration};
}

// A rectangular crate opens four walls, each the area of its payload floor.
// Separate from damage hitboxes (an airbase's hangar is not its full runway).
export function cargoSite(kind, x, y) {
  const dimensions = { sentry:[1,1], recycler:[1,1], builder:[1,1], factory:[2,2], outpost:[2,2], uplink:[3,3], helipad:[3,3], missile:[4,4], artillery:[3,3], mac:[3,3], airbase:[6,10] };
  const size=dimensions[kind];if(!size)return null;
  return {x:x-(['artillery','mac'].includes(kind)?1:0),y:y-(['artillery','mac'].includes(kind)?1:0),w:size[0],h:size[1],...(['artillery','mac'].includes(kind)?{overRails:true}:{})};
}
export function cargoPanels(p) {
  return [
    {x:p.x,y:p.y-p.h,w:p.w,h:p.h,side:0},
    {x:p.x+p.w,y:p.y,w:p.w,h:p.h,side:1},
    {x:p.x,y:p.y+p.h,w:p.w,h:p.h,side:2},
    {x:p.x-p.w,y:p.y,w:p.w,h:p.h,side:3},
  ];
}
export function cargoCells(p, wallsOnly=false) {
  if(p.layout==='rail-crate')return wallsOnly?[]:[{x:p.x,y:p.y}];
  if(p.layout==='rail-line')return Array.from({length:5},(_,i)=>({x:p.x+(p.shape==='EW'?i-2:0),y:p.y+(p.shape==='NS'?i-2:0)})).filter((_,i)=>!wallsOnly||i!==2);
  const cells=[];
  for(const r of [...(wallsOnly?[]:[p]),...cargoPanels(p)])for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)cells.push({x,y});
  return cells;
}
export function cargoContains(p,x,y){
  if(p.layout==='rail-crate')return Math.floor(x)===p.x&&Math.floor(y)===p.y;
  if(p.layout==='rail-line')return cargoCells(p).some(cell=>cell.x===Math.floor(x)&&cell.y===Math.floor(y));
  return (x>=p.x&&x<p.x+p.w&&y>=p.y-p.h&&y<p.y+p.h*2)||(y>=p.y&&y<p.y+p.h&&x>=p.x-p.w&&x<p.x+p.w*2);
}
export const incomingCargoAt=(world,x,y)=>(world.logistics?.cargoPods||[]).some(p=>!isRailDelivery(p)&&p.remaining>0&&cargoContains(p,x,y));
export const newCargoPod=(id,site)=>({id,...site,remaining:CARGO_POD_DURATION,duration:CARGO_POD_DURATION});
export function tickCargoPods(logistics,dt,width){
  let changed=false;
  for(const pod of logistics.cargoPods||[]){
    if(!(pod.remaining>0))continue;
    pod.remaining=Math.max(0,pod.remaining-dt);changed=true;
    if(pod.remaining<1e-8){
      pod.remaining=0;
      logistics.floors=[...new Set([...(logistics.floors||[]),...cargoCells(pod).map(c=>c.y*width+c.x)])];
    }
  }
  // The floor indices preserve completed rail bases; no lasting animation log.
  if(changed)logistics.cargoPods=logistics.cargoPods.filter(p=>!isRailDelivery(p)||p.remaining>0);
  return changed;
}
