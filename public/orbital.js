// Shared strike rules. Coordinates and impact times are committed once; no
// moving spacecraft, client damage authority or off-screen particle simulation.
export const ORBITAL = Object.freeze({cost:120, rows:5, columns:3, step:3.5, spacing:3.2, interval:1.35, cooldown:45, baseDelay:6, maxDelay:18, travelSpeed:25,
 radius:2.6, lethalRadius:.9, damage:220, edgeDamage:30, craterSize:7.5});
export const ORBITAL_PAYLOADS=Object.freeze({
 HE:Object.freeze({...ORBITAL,label:'Walking HE',color:'#f4c36b'}),
 INCENDIARY:Object.freeze({cost:100,label:'Incendiary curtain',color:'#ff9a54',count:7,spacing:3,radius:2.1,duration:18,cooldown:45,craterSize:4.7}),
 GAS:Object.freeze({cost:100,label:'Gas seeding',color:'#c5e69b',count:7,radius:2.8,spread:4.2,capacity:24,cooldown:45,craterSize:6.3}),
 BEAM:Object.freeze({cost:180,label:'Cutting beam',color:'#ff8e71',radius:1.25,lethalRadius:.5,damage:45,edgeDamage:15,duration:18,interval:.15,maxLength:72,minLength:2,cooldown:45}),
 HEAVY:Object.freeze({cost:300,label:'Heavy orbital bomb',color:'#ffe2ac',radius:12,lethalRadius:4,damage:1200,edgeDamage:100,craterSize:28,cooldown:60}),
 BARRAGE:Object.freeze({cost:240,label:'Sustained barrage',color:'#efaa75',count:31,duration:15,spread:10,radius:3,lethalRadius:1,damage:220,edgeDamage:30,craterSize:7.5,cooldown:60}),
 CLUSTER:Object.freeze({cost:200,label:'Cluster line',color:'#f6cf89',count:3,spacing:12,interval:1.6,radius:2.6,lethalRadius:.9,damage:220,edgeDamage:30,craterSize:7.5,cooldown:50,
  bomblet:Object.freeze({count:6,spread:4,radius:2.3,lethalRadius:.65,damage:120,edgeDamage:20,craterSize:4.5})})
});
export const orbitalProfile=value=>typeof value==='string'?ORBITAL_PAYLOADS[value]:value.profile||ORBITAL_PAYLOADS[value.payload||'HE'];
export const orbitalImpactProfile=(order,point)=>point.stage==='bomblet'?orbitalProfile(order).bomblet:orbitalProfile(order);
export const orbitalHazard=payload=>['INCENDIARY','GAS'].includes(payload);
export const orbitalBox=(points,radius)=>{const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs)-radius,y=Math.min(...ys)-radius;return{x,y,width:Math.max(...xs)+radius-x,height:Math.max(...ys)+radius-y};};
function touchesWater(world,point,radius){
 for(let y=Math.floor(point.y-radius);y<=Math.floor(point.y+radius);y++)for(let x=Math.floor(point.x-radius);x<=Math.floor(point.x+radius);x++)if(world.terrain[y*world.width+x]===0&&Math.hypot(Math.max(x-point.x,0,point.x-x-1),Math.max(y-point.y,0,point.y-y-1))<radius)return true;
 return false;
}
export const freshOrbital = () => ({sequence:0, cooldown:0, lastPosition:null, order:null});
export const orbitalState = world => world.logistics?.orbital || freshOrbital();
export const orbitalActive = state => !!state.order && state.order.points.some(p=>!p.landed);
/** @param {{x:number,y:number} | null} [end] */
export function orbitalPlan(world,target,bearing,sequence=orbitalState(world).sequence+1,payload='HE',end=null){
 if(!target||![target.x,target.y].every(Number.isFinite)||!Number.isInteger(bearing)||bearing<0||bearing>3)return {error:'Choose a starting row and a direction.'};
 const profile=ORBITAL_PAYLOADS[payload];if(!profile)return {error:'Choose an available orbital payload.'};
 const angle=bearing*Math.PI/2,dx=Math.sin(angle),dy=-Math.cos(angle),points=[];
 let seed=sequence>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 if(payload==='HE')for(let row=0;row<ORBITAL.rows;row++)for(let col=0;col<ORBITAL.columns;col++){
  const side=(col-1)*ORBITAL.spacing,forward=row*ORBITAL.step;
  points.push({x:target.x+dx*forward-dy*side+(random()-.5)*.6,y:target.y+dy*forward+dx*side+(random()-.5)*.6,row,offset:row*ORBITAL.interval+col*.12,landed:false});
 }
 if(payload==='INCENDIARY')for(let i=0;i<profile.count;i++)points.push({x:target.x+dx*i*profile.spacing,y:target.y+dy*i*profile.spacing,row:i,offset:i*.12,landed:false});
 if(payload==='GAS')for(let i=0;i<profile.count;i++){const a=(i-1)*Math.PI/3,r=i?profile.spread:0;points.push({x:target.x+Math.cos(a)*r,y:target.y+Math.sin(a)*r,row:0,offset:i*.12,landed:false});}
 if(payload==='HEAVY')points.push({...target,row:0,offset:0,landed:false});
 if(payload==='BARRAGE'){
  // Stratified disk: seeded rotation/jitter keeps a repeatable broad coverage,
  // instead of allowing every random shell to clump into one corner.
  const rotation=random()*Math.PI*2;
  for(let i=0;i<profile.count;i++){
   const a=rotation+i*Math.PI*(3-Math.sqrt(5))+(random()-.5)*.3,r=profile.spread*Math.sqrt((i+random())/profile.count);
   points.push({x:target.x+Math.cos(a)*r,y:target.y+Math.sin(a)*r,row:i,offset:i*profile.duration/(profile.count-1),landed:false});
  }
  // Shuffle positions, retaining the fixed half-second cadence: bombardment
  // visits the whole area throughout its duration rather than spiralling out.
  for(let i=points.length-1;i>0;i--){const j=Math.floor(random()*(i+1));const {x,y}=points[i];points[i].x=points[j].x;points[i].y=points[j].y;points[j].x=x;points[j].y=y;}
 }
 if(payload==='CLUSTER')for(let row=0;row<profile.count;row++){
  const x=target.x+dx*row*profile.spacing,y=target.y+dy*row*profile.spacing,offset=row*profile.interval;
  points.push({x,y,row,offset,stage:'parent',landed:false});
  const rotation=random()*Math.PI*2;
  for(let i=0;i<profile.bomblet.count;i++){
   const a=rotation+i*Math.PI*2/profile.bomblet.count+(random()-.5)*.25,r=profile.bomblet.spread*(.8+random()*.2);
   points.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r,originX:x,originY:y,row,offset:offset+.45+i*.07,stage:'bomblet',landed:false});
  }
 }
 if(payload==='BEAM'){
  if(!end||![end.x,end.y].every(Number.isFinite))return {error:'Choose a beam endpoint.'};
  const length=Math.hypot(end.x-target.x,end.y-target.y);if(length<profile.minLength||length>profile.maxLength)return {error:`Choose a beam length between ${profile.minLength} and ${profile.maxLength} tiles.`};
  const steps=Math.round(profile.duration/profile.interval);for(let i=0;i<=steps;i++)points.push({x:target.x+(end.x-target.x)*i/steps,y:target.y+(end.y-target.y)*i/steps,row:i,offset:i*profile.interval,landed:false});
 }
 if(points.some(p=>{const radius=p.stage==='bomblet'?profile.bomblet.radius:profile.radius;return p.x-radius<0||p.y-radius<0||p.x+radius>world.width||p.y+radius>world.height;}))return {error:'Keep all impact rings inside the map.'};
 if(orbitalHazard(payload)&&points.some(p=>touchesWater(world,p,profile.radius)))return {error:'Keep all fire or gas rings on land, clear of open water.'};
 const previous=orbitalState(world).lastPosition||world.orbitalOrigin||{x:world.width/2,y:world.height/2};
 const delay=Math.min(ORBITAL.maxDelay,ORBITAL.baseDelay+Math.hypot(target.x-previous.x,target.y-previous.y)/ORBITAL.travelSpeed);
 return {target:{x:target.x,y:target.y},bearing,points,delay,payload,...(payload==='BEAM'?{end:{x:end.x,y:end.y}}:{}),box:orbitalBox(points,profile.radius)};
}
export function orbitalError(world,plan){
 const state=orbitalState(world);
 if(plan.error)return plan.error;
 if(orbitalActive(state))return 'The shared orbital weapon is executing a strike.';
 if(state.cooldown>.001)return `Orbital weapon recovering / ${Math.ceil(state.cooldown)}s.`;
 const profile=orbitalProfile(plan);if(!(world.logistics?.supplies>=profile.cost))return `Need ${profile.cost} ORB.`;
 return null;
}
// A monotonic sequence prevents even an old retried request spending twice.
export function orderOrbital(world,data,caller,admit=plan=>null){
 const state=orbitalState(world);
 if(typeof data.orderId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(data.orderId))return {error:'Provide an orbital order ID.'};
 if(state.order?.id===data.orderId&&state.order.callerId===caller.id)return {duplicate:true,order:state.order};
 if(data.sequence!==state.sequence+1)return {error:'Orbital orders changed. Review the shared status and try again.'};
 if(!Object.hasOwn(ORBITAL_PAYLOADS,data.payload))return {error:'Choose an available orbital payload.'};
 const plan=orbitalPlan(world,data.target,data.bearing,data.sequence,data.payload,data.end),error=orbitalError(world,plan)||admit(plan);if(error)return {error};
 const order={...plan,id:data.orderId,sequence:data.sequence,callerId:caller.id,callerName:String(caller.name||'Scout').slice(0,32),profile:{...orbitalProfile(plan)},age:0};
 world.logistics.supplies-=orbitalProfile(plan).cost;
 world.logistics.orbital={...state,sequence:data.sequence,order,lastPosition:{...plan.target},cooldown:0};
 return {order};
}
export function tickOrbital(world,dt,hit){
 const state=world.logistics?.orbital;if(!state||dt<=0)return false;
 if(!orbitalActive(state)){if(state.cooldown<=0)return false;state.cooldown=Math.max(0,state.cooldown-dt);return true;}
 const order=state.order;order.age+=dt;
 for(const point of order.points)if(!point.landed&&order.age>=order.delay+point.offset){hit(order,point);point.landed=true;}
 if(!orbitalActive(state)){
  state.cooldown=orbitalProfile(order).cooldown;
  if(order.payload==='BEAM')state.scars=[...(state.scars||[]),{from:{...order.target},to:{...order.end}}].slice(-4);
 }
 return true;
}
