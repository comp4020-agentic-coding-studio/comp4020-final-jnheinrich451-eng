import { ANTI_AIR } from './anti-air.js';
import { mountainClear, flightLineClear } from './terrain-rules.js';
import { mountainRoute } from './mountain-flight.js';

// Bounded visibility graph: all known living flak circles block transit edges;
// at most twelve nearby circles contribute detour nodes. Mountain templates use
// a bounded terrain route first, with a soft cost for exposed flak cells.
export const AIR_ROUTE = Object.freeze({ clearance: 6, loop: 8, bank: 8, circles: 12 });
export const flakZones = world => (world.sites||[]).filter(s=>s.kind==='anti-air'&&s.state==='hostile'&&(s.hp??1)>0).map(s=>({x:s.x+1.5,y:s.y+1.5,r:ANTI_AIR.range}));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function clearEdge(a,b,zones,start,end){
 for(const c of zones){
  const r=c.r+AIR_ROUTE.clearance,dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  if(a===start&&distance(a,c)<r&&((a.x-c.x)*dx+(a.y-c.y)*dy)>=0)continue;
  if(b===end&&distance(b,c)<r&&((b.x-c.x)*dx+(b.y-c.y)*dy)<=0)continue;
  const t=len?Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.y-a.y)*dy)/len)):0;
  if(Math.hypot(a.x+t*dx-c.x,a.y+t*dy-c.y)<r)return false;
 }
 return true;
}
export function flightRoute(world,from,to){
 if(world.mountains&&!flightLineClear(world,from,to,8)){
  const route=mountainRoute(world,from,to,flakZones(world));return route;
 }
 const start={x:from.x,y:from.y},end={x:to.x,y:to.y},zones=flakZones(world);
 if(clearEdge(start,end,zones,start,end))return {points:[end],limited:false};
 const near=[...zones].sort((a,b)=>distance(start,a)+distance(end,a)-distance(start,b)-distance(end,b)).slice(0,AIR_ROUTE.circles);
 const nodes=[start,end];
 for(const c of near)for(let i=0;i<8;i++){
  const a=i*Math.PI/4,r=(c.r+AIR_ROUTE.clearance+3)/Math.cos(Math.PI/8),p={x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r};
   if(p.x<12||p.y<12||p.x>world.width-12||p.y>world.height-12||!mountainClear(world,p,8)||zones.some(z=>distance(p,z)<z.r+AIR_ROUTE.clearance))continue;
  nodes.push(p);
 }
 const costs=nodes.map(()=>Infinity),parents=nodes.map(()=>-1),seen=new Set();costs[0]=0;
 for(let step=0;step<nodes.length;step++){
  let u=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(u<0||costs[i]<costs[u]))u=i;
  if(u<0||!Number.isFinite(costs[u]))break;if(u===1){const points=[];for(let i=1;i>0;i=parents[i])points.unshift(nodes[i]);return {points,limited:false};}
  seen.add(u);
  for(let v=1;v<nodes.length;v++)if(!seen.has(v)&&flightLineClear(world,nodes[u],nodes[v],8)&&clearEdge(nodes[u],nodes[v],zones,start,end)){
   const cost=costs[u]+distance(nodes[u],nodes[v]);if(cost<costs[v]){costs[v]=cost;parents[v]=u;}
  }
 }
 // No detour found within the budget. Flight remains physical and vulnerable.
 return {points:[end],limited:true};
}
/** @param {{x:number,y:number}|null} [avoid] */
export function cruiseSite(world,plane,avoid=null){
 const zones=flakZones(world),margin=22,candidates=[];
 const add=p=>{if(p.x>=margin&&p.y>=margin&&p.x<=world.width-margin&&p.y<=world.height-margin&&mountainClear(world,p,22))candidates.push(p);};
 for(const r of [32,56,88])for(let i=0;i<16;i++){const a=plane.angle+i*Math.PI/8;add({x:plane.x+Math.sin(a)*r,y:plane.y-Math.cos(a)*r});}
 for(let y=margin;y<=world.height-margin;y+=Math.max(24,(world.height-44)/8))for(let x=margin;x<=world.width-margin;x+=Math.max(24,(world.width-44)/8))add({x,y});
 const clearance=p=>Math.min(...zones.map(z=>distance(p,z)-z.r),Infinity);
 const safe=candidates.filter(p=>clearance(p)>=AIR_ROUTE.loop+AIR_ROUTE.bank+4&&(!avoid||distance(p,avoid)>=30));
 const list=safe.length?safe:candidates;
 list.sort((a,b)=>safe.length?distance(a,plane)-distance(b,plane):clearance(b)-clearance(a)||distance(a,plane)-distance(b,plane));
 return {center:list[0]||{x:world.width/2,y:world.height/2},limited:!safe.length};
}
