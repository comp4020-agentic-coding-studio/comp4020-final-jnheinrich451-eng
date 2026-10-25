import {mountainClear,flightLineClear} from './terrain-rules.js';

// Coarse, bounded routing for immutable mountain masks. Flak remains a separate
// combat risk. Routes are recomputed from saved positions after a restart.
export function mountainRoute(w,from,to,zones=[]){
 if(flightLineClear(w,from,to,8))return {points:[{x:to.x,y:to.y}],limited:false,blocked:false};
 if(!mountainClear(w,to))return {points:[],limited:true,blocked:true};
 const step=8,cols=Math.ceil(w.width/step),rows=Math.ceil(w.height/step),nodes=cols*rows;
 const point=id=>({x:(id%cols)*step+4,y:Math.floor(id/cols)*step+4});
 const costs=new Float64Array(nodes).fill(Infinity),parent=new Int32Array(nodes).fill(-1),closed=new Uint8Array(nodes),open=[];
 for(let y=Math.max(0,Math.floor(from.y/step)-3);y<Math.min(rows,Math.floor(from.y/step)+4);y++)for(let x=Math.max(0,Math.floor(from.x/step)-3);x<Math.min(cols,Math.floor(from.x/step)+4);x++){
  const id=y*cols+x,p=point(id);if(!mountainClear(w,p,8)||!flightLineClear(w,from,p))continue;costs[id]=Math.hypot(p.x-from.x,p.y-from.y);open.push(id);
 }
 let goal=-1;
 for(let visited=0;open.length&&visited<4096;visited++){
  let best=0,score=Infinity;for(let i=0;i<open.length;i++){const p=point(open[i]),f=costs[open[i]]+Math.hypot(p.x-to.x,p.y-to.y);if(f<score){score=f;best=i;}}
  const id=open.splice(best,1)[0];if(closed[id])continue;closed[id]=1;const p=point(id);
  if(Math.hypot(p.x-to.x,p.y-to.y)<28&&flightLineClear(w,p,to)){goal=id;break;}
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
   const x=id%cols+dx,y=Math.floor(id/cols)+dy,n=y*cols+x;if(x<1||y<1||x>=cols-1||y>=rows-1||closed[n])continue;
   const q=point(n),risk=zones.some(z=>Math.hypot(q.x-z.x,q.y-z.y)<z.r+6)?5:1,cost=costs[id]+Math.hypot(dx,dy)*step*risk;if(cost>=costs[n]||!flightLineClear(w,p,q,8))continue;
   costs[n]=cost;parent[n]=id;open.push(n);
  }
 }
 if(goal<0)return {points:[],limited:true,blocked:true};
 const raw=[{x:to.x,y:to.y}];for(let at=goal;at>=0;at=parent[at])raw.unshift(point(at));
 const exposed=(a,b)=>zones.some(z=>{const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((z.x-a.x)*dx+(z.y-a.y)*dy)/n)):0;return Math.hypot(a.x+t*dx-z.x,a.y+t*dy-z.y)<z.r+6;});
 // Retain both turning clearance and flak detours when smoothing the grid path.
 const points=[];let current=from,index=0,limited=false;while(index<raw.length){let far=index;for(let i=index+1;i<raw.length;i++){if(flightLineClear(w,current,raw[i],8)&&!exposed(current,raw[i]))far=i;}limited ||=exposed(current,raw[far]);points.push(raw[far]);current=raw[far];index=far+1;}
 return {points,limited,blocked:false};
}
const routes=new WeakMap();
export function mountainWaypoint(w,p,target){
 if(!w.mountains||flightLineClear(w,p,target,8))return target;
 let r=routes.get(p);if(!r||r.mask!==w.mountains||Math.hypot(r.target.x-target.x,r.target.y-target.y)>4){r={...mountainRoute(w,p,target),mask:w.mountains,target:{...target},index:0};routes.set(p,r);}
 if(r.blocked)return {x:p.x,y:p.y};
 while(r.index<r.points.length-1&&Math.hypot(p.x-r.points[r.index].x,p.y-r.points[r.index].y)<3)r.index++;
 return r.points[r.index]||target;
}
// Try a full physical arc before choosing which side to turn toward. Sampling
// and candidate count are fixed; there is no world search on each flight tick.
export function mountainSteer(w,p){
 if(!w.mountains)return null;
 const speed=Math.max(4,p.speed),turn=10.8/speed,look=speed/turn+10;
 const end={x:p.x+Math.sin(p.angle)*look,y:p.y-Math.cos(p.angle)*look};
 if(flightLineClear(w,p,end,2)){delete p.mountainSide;return null;}
 const score=side=>{let x=p.x,y=p.y,a=p.angle,n=0;for(let t=0;t<Math.PI/turn;t+=.2){a+=side*turn*.2;const next={x:x+Math.sin(a)*speed*.2,y:y-Math.cos(a)*speed*.2};if(next.x<1||next.y<1||next.x>w.width-1||next.y>w.height-1||!flightLineClear(w,{x,y},next,1.5))break;x=next.x;y=next.y;n++;}return n;};
 const left=score(-1),right=score(1);p.mountainSide=left===right?(p.mountainSide||1):left>right?-1:1;return p.mountainSide;
}
