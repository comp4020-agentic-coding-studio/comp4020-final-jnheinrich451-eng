import { canStand } from './world.js';

export const NAVIGATION = Object.freeze({ perTick: 1024, perRequest: 256, nodes: 4096, jobs: 32 });
const cell = p => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
const metric = (p, goals) => Math.min(...goals.map(g => Math.abs(p.x-g.x)+Math.abs(p.y-g.y)));
function push(heap, value) {
  let i=heap.length; heap.push(value);
  while(i){const p=(i-1)>>1;if(heap[p].f<=value.f)break;heap[i]=heap[p];i=p;}heap[i]=value;
}
function pop(heap) {
  const first=heap[0],last=heap.pop();if(!heap.length)return first;
  let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;return first;
}

// Incremental A*: sparse records, no map-sized array per enemy. Search jobs are
// disposable; only actual enemy positions/paths belong in campaign checkpoints.
export function createEnemyNavigator(world) {
  const jobs=new Map();let buildings=[],blocked=()=>false,remaining=0,time=0,walk=new Map(),expanded=0;
  const id=(x,y)=>y*world.width+x;
  function pass(x,y,ignoreHazards=false){
    if(x<0||y<0||x>=world.width||y>=world.height)return false;
    const key=id(x,y)*2+Number(ignoreHazards);if(!walk.has(key))walk.set(key,canStand(world,buildings,x+.5,y+.5)&&(ignoreHazards||!blocked(x+.5,y+.5)));return walk.get(key);
  }
  function begin(list,avoid,now){
    buildings=list;blocked=avoid;remaining=NAVIGATION.perTick;expanded=0;time=now;walk=new Map();
    for(const[key,job]of jobs)if(now-job.used>5000)jobs.delete(key);
  }
  function route(key,start,points,ignoreHazards=false){
    const origin=cell(start),goals=points.map(cell).filter(p=>pass(p.x,p.y,ignoreHazards));
    if(!goals.length){jobs.delete(key);return {status:'blocked',path:[]};}
    const signature=Number(ignoreHazards)+':'+goals.map(p=>id(p.x,p.y)).sort((a,b)=>a-b).join(',');
    let job=jobs.get(key);
    if(!job||job.signature!==signature||job.start!==id(origin.x,origin.y)){
      if(jobs.size>=NAVIGATION.jobs&&!jobs.has(key))jobs.delete(jobs.keys().next().value);
      const first=id(origin.x,origin.y),record={...origin,id:first,g:0,f:metric(origin,goals),parent:null};
      job={signature,start:first,heap:[record],records:new Map([[first,record]]),closed:new Set(),used:time};jobs.set(key,job);
    }
    job.used=time;const goalIds=new Set(goals.map(p=>id(p.x,p.y)));let allowance=Math.min(remaining,NAVIGATION.perRequest);
    while(job.heap.length&&allowance>0){
      const current=pop(job.heap);allowance--;remaining--;expanded++;
      if(job.closed.has(current.id))continue;
      if(goalIds.has(current.id)){
        const path=[];for(let p=current;p.parent!==null;p=job.records.get(p.parent))path.push({x:p.x+.5,y:p.y+.5});
        jobs.delete(key);return {status:'found',path:path.reverse()};
      }
      job.closed.add(current.id);
      for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const x=current.x+dx,y=current.y+dy,next=id(x,y);if(!pass(x,y,ignoreHazards)||job.closed.has(next))continue;
        const g=current.g+1;if((job.records.get(next)?.g??Infinity)<=g)continue;
        if(job.records.size>=NAVIGATION.nodes){jobs.delete(key);return {status:'limited',path:[]};}
        const record={x,y,id:next,g,f:g+metric({x,y},goals),parent:current.id};job.records.set(next,record);push(job.heap,record);
      }
    }
    if(!job.heap.length){jobs.delete(key);return {status:'blocked',path:[]};}
    return {status:'pending',path:[]};
  }
  return {begin,route,forget:key=>jobs.delete(key),stats:()=>({expanded,remaining,jobs:jobs.size,nodes:[...jobs.values()].reduce((n,j)=>n+j.records.size,0)})};
}
