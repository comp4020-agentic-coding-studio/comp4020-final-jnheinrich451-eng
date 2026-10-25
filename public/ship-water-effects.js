// Bounded browser-only water and exhaust marks. Nothing here enters saved state:
// a short per-ship trail of recent poses (at most TRAIL.points, a few seconds) gives
// the wake its real course through turns; everything else is analytic.
import { depthState, DIVE } from './submarine-depth.js';
const clamp=n=>Math.max(0,Math.min(1,n));
const TRAIL=Object.freeze({spacing:.3,points:24,life:7000,reset:3,boil:3000,shed:1800});
// Classic Kelvin half-angle of a ship's divergent wave arms.
const KELVIN=Math.tan(19.47*Math.PI/180);
const trails=new Map();
function entry(s,time){
 let t=trails.get(s.id);
 if(!t){t={points:[],seen:time,depth:depthState(s),previous:null,changed:-Infinity};trails.set(s.id,t);}
 t.seen=time;
 if(trails.size>32)for(const[id,v]of trails)if(time-v.seen>20000)trails.delete(id);
 return t;
}
const motion=s=>clamp(Math.abs(s.driveSpeed??s.speed??0)/(s.kind==='carrier'?1.8:2.5));

export function drawShipWater(c,s,T,time,reduced,width=2,length=4){
 if(s.destroyed)return;
 const power=motion(s);
 // Previews and art studies pass no clock; they get the analytic marks only.
 if(time>0)drawWake(c,s,T,time,reduced,width,length,power);
 if(power<.02)return;
 const reverse=(s.driveSpeed||0)<0,stem=length/2,half=width*.42,phase=reduced?0:time*.00065;
 c.save();c.lineCap='round';
 // The bow parts the surface; running astern shifts the pressure wave aft.
 const dir=reverse?-1:1;
 for(const side of [-1,1]){
  c.strokeStyle='#d1ece5';c.globalAlpha=.25+.35*power;c.lineWidth=T*.045;
  c.beginPath();c.moveTo(side*.06*T,-dir*(stem-.08)*T);
  c.quadraticCurveTo(side*half*T,-dir*(stem-.3)*T,side*(half+.18)*T,-dir*(stem-1)*T);c.stroke();
 }
 // Two propeller streams remain at the stern. Astern thrust is shorter and wider.
 for(const side of [-1,1])for(let i=0;i<(reduced?2:7);i++){
  const p=(phase+i/7+(side===1?.09:0))%1,spread=.09+p*(reverse?.55:.27);
  const y=stem+.06+p*(reverse?.65:1+power*2.5),x=side*(width*.2+p*.14)+Math.sin(p*15+side)*.035;
  c.globalAlpha=(1-p)*(.16+.32*power);c.fillStyle='#b9dcd6';
  c.beginPath();c.ellipse(x*T,y*T,spread*T,(.16+p*.26)*T,side*.2,0,Math.PI*2);c.fill();
  c.globalAlpha=(1-p)*(.35+.45*power);c.strokeStyle='#eff6e8';c.lineWidth=T*.025;
  c.beginPath();c.moveTo((x-spread*.65)*T,(y-.04)*T);c.quadraticCurveTo(x*T,(y+.09)*T,(x+spread*.5)*T,(y-.08)*T);c.stroke();
 }
 c.restore();
}

// Wake along the recorded course: a widening, fading foam path behind the stern and
// Kelvin arms spreading from past bow positions, with short feathered crests.
function drawWake(c,s,T,time,reduced,width,length,power){
 const t=entry(s,time),points=t.points;
 if(points.length&&Math.hypot(s.x-points[0].x,s.y-points[0].y)>TRAIL.reset)points.length=0;
 if(power>.02&&(!points.length||Math.hypot(s.x-points[0].x,s.y-points[0].y)>=TRAIL.spacing)){
  points.unshift({x:s.x,y:s.y,angle:s.angle,time,power});if(points.length>TRAIL.points)points.length=TRAIL.points;
 }
 while(points.length&&time-points[points.length-1].time>TRAIL.life)points.pop();
 if(!points.length)return;
 const cos=Math.cos(s.angle),sin=Math.sin(s.angle),half=length/2;
 const local=(x,y)=>{const dx=x-s.x,dy=y-s.y;return[(dx*cos+dy*sin)*T,(-dx*sin+dy*cos)*T];};
 const stern=p=>[p.x-Math.sin(p.angle)*half,p.y+Math.cos(p.angle)*half],bow=p=>[p.x+Math.sin(p.angle)*half,p.y-Math.cos(p.angle)*half];
 const now={x:s.x,y:s.y,angle:s.angle,time,power};
 c.save();c.lineCap='round';c.lineJoin='round';
 // Foam: a translucent strip about the beam wide that spreads and fades with age,
 // filled in a few chunks (no stacked round caps), with thin streaks along its edges.
 const path=[now,...points].map(p=>{const[x,y]=stern(p),age=(time-p.time)/TRAIL.life;return {x,y,age,fade:(1-clamp(age))*(.3+.7*p.power),w:width*(.32+clamp(age)*.45)};});
 const edges=path.map((q,i)=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;return {l:local(q.x-dy/d*q.w/2,q.y+dx/d*q.w/2),r:local(q.x+dy/d*q.w/2,q.y-dx/d*q.w/2),fade:q.fade};});
 const chunk=reduced?8:4;
 for(let i=0;i<edges.length-1;i+=chunk){
  const part=edges.slice(i,Math.min(edges.length,i+chunk+1));
  c.globalAlpha=part[0].fade*(reduced?.18:.24);c.fillStyle='#d6ece6';c.beginPath();
  part.forEach((e,j)=>j?c.lineTo(...e.l):c.moveTo(...e.l));for(const e of part.slice().reverse())c.lineTo(...e.r);c.closePath();c.fill();
 }
 if(!reduced){c.strokeStyle='#eef7f0';c.lineWidth=T*.03;
  for(const side of['l','r'])for(let i=0;i<edges.length-1;i+=chunk){const part=edges.slice(i,Math.min(edges.length,i+chunk+1));c.globalAlpha=part[0].fade*.35;c.beginPath();part.forEach((e,j)=>j?c.lineTo(...e[side]):c.moveTo(...e[side]));c.stroke();}}
 // Kelvin arms: each past bow spreads by distance run times tan(19.47 deg).
 let run=0,last=bow(now);
 const arms=[[],[]],reach=points.slice(0,14);
 for(const p of reach){
  const b=bow(p);run+=Math.hypot(b[0]-last[0],b[1]-last[1]);last=b;
  const spread=Math.min(width*.45+run*KELVIN,width*1.6),nx=Math.cos(p.angle),ny=Math.sin(p.angle);
  for(const[i,side]of[[0,-1],[1,1]])arms[i].push({point:local(b[0]+side*nx*spread,b[1]+side*ny*spread),fade:(1-clamp((time-p.time)/(TRAIL.life*.6)))*(.3+.7*p.power),side,p});
 }
 c.strokeStyle='#e3f2ec';c.lineWidth=T*.035;
 for(const arm of arms){
  let from=local(...bow(now));
  for(const[i,a]of arm.entries()){
   c.globalAlpha=a.fade*.28;c.beginPath();c.moveTo(...from);c.lineTo(...a.point);c.stroke();from=a.point;
   // Feathered crests point back and inward from the arm, as divergent waves do.
   if(!reduced&&i%2===1){const back=a.p.angle+Math.PI+a.side*.6,l=(.3+i*.03)*T;c.globalAlpha=a.fade*.18;c.beginPath();c.moveTo(...a.point);c.lineTo(a.point[0]+Math.sin(back-s.angle)*l,a.point[1]-Math.cos(back-s.angle)*l);c.stroke();}
  }
 }
 c.restore();
}

// Dive and surfacing water from the saved depth countdown: deck vent spray and a
// boil of rising bubbles while diving, then a fading boil over the submerged hull;
// a building froth and foam ring while surfacing, then water shedding off the hull.
export function drawDiveBubbles(c,s,T,time,reduced,width=2,length=4){
 const state=depthState(s),t=entry(s,time);
 if(t.depth!==state){t.previous=t.depth;t.depth=state;t.changed=time;}
 const since=time-t.changed,k=1-clamp((s.depthRemaining||0)/DIVE.transition);
 const mode=state==='diving'?'dive':state==='surfacing'?'surface':state==='submerged'&&t.previous==='diving'&&since<TRAIL.boil?'boil':state==='surfaced'&&t.previous==='surfacing'&&since<TRAIL.shed?'shed':null;
 if(!mode||s.destroyed)return;
 const strength=mode==='dive'?1-k*.3:mode==='surface'?.45+.55*k:mode==='boil'?.7*(1-since/TRAIL.boil):.6*(1-since/TRAIL.shed);
 const seed=[...String(s.id)].reduce((a,ch)=>a*31+ch.charCodeAt(0)|0,7),rand=n=>{const v=Math.sin(n*12.9898+seed*.0137)*43758.5453;return v-Math.floor(v);};
 const spread=mode==='boil'?1.35:1;
 c.save();c.globalAlpha=1;c.lineCap='round';
 // Ballast vents blow white spray along the deck as the dive begins.
 if(mode==='dive'&&k<.4)for(let j=0;j<6;j++){
  const y=(-.3+j*.12)*length,q=k/.4,r=(.12+.45*q)*width*.4;
  c.globalAlpha=(1-q)*.55;c.fillStyle='#eef7f3';c.beginPath();c.ellipse((rand(j+90)-.5)*.2*T,y*T,r*T,r*.8*T,0,0,Math.PI*2);c.fill();
 }
 // Rising bubbles pop into rings; positions are deterministic per hull.
 const count=reduced?6:26;
 for(let j=0;j<count;j++){
  const x=(rand(j)-.5)*width*.85*spread,y=(rand(j+40)-.5)*length*.95*spread;
  const phase=reduced?.4:((time/900)+rand(j+80))%1,r=(.04+.11*phase)*(.6+rand(j+120))*T;
  c.globalAlpha=strength*(1-phase)*.85;c.strokeStyle='#e8f6f3';c.lineWidth=Math.max(1,T*.02);
  c.beginPath();c.arc(x*T,y*T,r,0,Math.PI*2);c.stroke();
  if(phase<.35){c.fillStyle='#f6fbf8';c.beginPath();c.arc(x*T-r*.3,y*T-r*.3,r*.3,0,Math.PI*2);c.fill();}
 }
 // Breaking the surface: a foam ring round the hull, then water sheeting off it.
 if(mode==='surface'&&k>.35||mode==='shed'){
  const q=mode==='surface'?(k-.35)/.65:1+since/TRAIL.shed*.4;
  c.globalAlpha=strength*.6;c.strokeStyle='#eef7f2';c.lineWidth=T*.06;c.setLineDash(reduced?[]:[T*.25,T*.12]);
  c.beginPath();c.ellipse(0,0,width*.42*(1+.15*q)*T,length*.5*(1+.04*q)*T,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
  if(!reduced)for(let j=0;j<10;j++){const y=(rand(j+160)-.5)*length*.85,side=j%2?1:-1,x=side*width*.4;c.globalAlpha=strength*.4;c.beginPath();c.moveTo(x*T,y*T);c.lineTo((x+side*(.25+.35*q))*T,(y+.1)*T);c.stroke();}
 }
 c.restore();
}

export function drawShipExhaust(c,s,T,time,reduced,funnels){
 if(reduced||s.destroyed||!(s.throttle||Math.abs(s.driveSpeed||0)>.05))return;
 const power=clamp(Math.abs(s.driveSpeed||0)/2.5),phase=time*.00024;
 c.save();
 for(const f of funnels)for(let i=0;i<5;i++){
  const p=(phase+i/5)%1;
  c.globalAlpha=(1-p)*(.10+.12*power);c.fillStyle='#263638';
  c.beginPath();c.ellipse((f.x+.12*p)*T,(f.y+p*(.9+power))*T,(.08+p*.2)*T,(.09+p*.25)*T,.2,0,Math.PI*2);c.fill();
 }
 c.restore();
}
