import { drawCargoRing } from './unit-hud.js';
import { drawTankDust } from './tank-art.js';
import { LABEL_ZOOM } from './map-labels.js';
import { tileAt } from './world.js';
import { drawCrawler } from './effects.js';
import { drawCentipede } from './centipede-art.js';
import { airSize, isHelipad } from './helicopter.js';
import { airRecords } from './air-traffic.js';
import { assemblyStage } from './construction-effects.js';
import { LOGISTICS_SIZE, ECONOMY, facilityTargets } from './logistics.js';
import { dockRecords } from './shipyard.js';

export function drawLogistics(c,world,buildings,T,zoom,reduced,driverId,construction=null,advance=0){
  const l=world.logistics;if(!l)return;
  const cargo=id=>l.cargoPods?.some(p=>p.id===id);
  const label=(text,x,y,color='#e8dfa8')=>{if(zoom<LABEL_ZOOM)return;c.font=`${10/zoom}px monospace`;c.textAlign='center';const w=c.measureText(text).width;c.fillStyle='#122d29e8';c.fillRect(x*T-w/2-3,y*T-11/zoom,w+6,15/zoom);c.fillStyle=color;c.fillText(text,x*T,y*T);};
  c.save();
  for(const site of world.sites||[])if(site.state==='conquered'&&(l.salvage[site.id]??ECONOMY.salvage)>0)label('SALVAGE '+(l.salvage[site.id]??ECONOMY.salvage),site.x+1.5,site.y+3.4);
  for(const f of l.facilities){
    const size=LOGISTICS_SIZE[f.kind],x=f.x*T,y=f.y*T,s=size*T;
    const job=l.jobs[f.id],stage=job?jobStage(job,advance):assemblyStage(f.remaining,f.deliveryDuration||8,advance);
    c.save();if(stage.active){c.beginPath();c.rect(x,y+s*(1-stage.reveal),s,s*stage.reveal);c.clip();}
    c.fillStyle='#293e43';c.fillRect(x,y,s,s);c.strokeStyle='#adbea0';c.lineWidth=2/zoom;c.strokeRect(x+3,y+3,s-6,s-6);
    for(let i=0;i<size*3;i++){c.fillStyle=i%2?'#d3ab58':'#26373b';c.fillRect(x+i*s/(size*3),y+s-7,s/(size*3),7);}
    if(f.kind==='outpost'){
      for(let row=0;row<2;row++)for(let col=0;col<2;col++){
        c.fillStyle=row===0&&col===1?'#547b64':'#658487';c.fillRect(x+col*T+4,y+row*T+4,T-8,T-8);
        c.fillStyle='#1b333b';c.fillRect(x+col*T+T*.22,y+row*T+T*.24,T*.56,T*.44);
        c.fillStyle=row===0&&col===1?'#c2d995':'#e3b76d';c.font='bold '+10/zoom+'px monospace';c.textAlign='center';c.fillText(['CORE','RECYCLE','POWER','DRONES'][row*2+col],x+(col+.5)*T,y+(row+.55)*T);
      }
    }else if(f.kind==='factory'){
      c.fillStyle='#688b8a';c.fillRect(x+s*.12,y+s*.15,s*.76,s*.55);c.fillStyle='#192b2e';
      for(let i=0;i<4;i++)c.fillRect(x+s*(.2+i*.15),y+s*.25,s*.08,s*.33);
      c.fillStyle='#dfb763';c.fillRect(x+s*.1,y+s*.74,s*.8,s*.06);
    }else{
      // Parked only between landings; flights are drawn later by drawUplinkFlights.
      drawUplinkPad(c,f,s,x,y,T,reduced,!(f.launch>0)&&!(f.cooldown>0));
    }
    c.restore();if(!cargo(f.id)||stage.method==='factory')construction?.draw(c,world,{x:f.x+size/2,y:f.y+size/2},size,stage,zoom,reduced,true);
    if(stage.active)label(stage.phase+' '+Math.ceil(f.remaining)+'s',f.x+size/2,f.y+size+.6);
    label(f.kind==='outpost'?'OUTPOST / GROUND SUP':f.kind==='factory'?'FACTORY':f.cooldown>0?'ROCKET / '+Math.ceil(f.cooldown)+'s':'UPLINK / '+f.cargo+' CARGO',f.x+size/2,f.y+size+.25);
  }
  for(const r of l.recyclers){
    const job=l.jobs[r.id],stage=job?jobStage(job,advance):assemblyStage(r.remaining,r.deliveryDuration||4.5,advance);
    c.save();if(stage.active)c.globalAlpha=stage.reveal;
    c.save();c.translate(r.x*T,r.y*T);
    if(!stage.active){c.save();c.scale(T/32,T/32);drawTankDust(c,{angle:r.angle,speed:r.speed||0,reverse:(r.driveSpeed||0)<0,phase:(r.x*Math.sin(r.angle)-r.y*Math.cos(r.angle))*T,terrain:tileAt(world,r.x,r.y),reduced});c.restore();}
    c.rotate(r.angle);if(r.occupant===driverId){c.strokeStyle='#f0d889';c.lineWidth=1.5/zoom;c.beginPath();c.moveTo(-.13*T,-.72*T);c.lineTo(0,-.86*T);c.lineTo(.13*T,-.72*T);c.stroke();}c.fillStyle='#172d30';c.fillRect(-.43*T,-.48*T,.86*T,.96*T);
    for(const side of [-1,1])for(const axle of [-.3,.3]){c.fillStyle='#101d21';c.fillRect((side*.4-.09)*T,(axle-.15)*T,.18*T,.3*T);}
    c.fillStyle=r.kind==='builder'?'#b3bcb6':'#c39d58';c.fillRect(-.33*T,-.4*T,.66*T,.8*T);c.fillStyle='#3d656a';c.fillRect(-.23*T,-.31*T,.46*T,.25*T);
    c.fillStyle=r.cargo?'#aa6d94':'#4a5045';c.fillRect(-.25*T,.06*T,.5*T,.28*T);c.fillStyle='#adba9e';c.fillRect(-.45*T,-.54*T,.9*T,.12*T);c.restore();
    if(r.kind==='builder'){c.strokeStyle='#dab96e';c.lineWidth=4/zoom;c.beginPath();c.moveTo(r.x*T,r.y*T);c.lineTo((r.x+Math.sin(r.angle)*.55)*T,(r.y-Math.cos(r.angle)*.55)*T);c.stroke();}
    if(r.occupant===driverId&&r.kind!=='builder'){c.save();c.translate(r.x*T,r.y*T);drawCargoRing(c,r.cargo/ECONOMY.cargo,T*.67,zoom);c.restore();}
    else if(r.occupant){c.strokeStyle=r.occupant===driverId?'#e3bc70':'#a6ccc0';c.lineWidth=2/zoom;c.beginPath();c.arc(r.x*T,r.y*T,T*.67,0,Math.PI*2);c.stroke();}
    c.restore();if(!cargo(r.id)||stage.method==='factory')construction?.draw(c,world,r,1,stage,zoom,reduced);
    label(r.remaining>0?stage.phase+' '+Math.ceil(r.remaining)+'s':r.collecting>0?'RECLAIMING '+Math.ceil(ECONOMY.collectTime-r.collecting)+'s':r.blocked?'ROUTE BLOCKED':r.task?.action==='wreck'?'RECOVERING WRECK / '+Math.ceil(r.cargo):(r.occupant===driverId?'YOU / ':r.occupant?'CREW / ':r.kind==='builder'?'BUILDER / ':'RECYCLER / ')+(r.kind==='builder'?'ENG':r.cargo>=ECONOMY.cargo?'FULL':Math.ceil(r.cargo)),r.x,r.y+.85);
  }
  for(const tank of world.tanks||[]){const job=l.jobs[tank.id];if(job)construction?.draw(c,world,tank,1,jobStage(job,advance),zoom,reduced,true);}
  for(const b of airRecords(world))if(b.aircraft?.repairing)label('REPAIR / GROUND SUP',b.aircraft.x,b.aircraft.y+1.5);
  for(const box of l.crates){
    if(box.kind==='remains'){
      // Retain the creature's silhouette instead of replacing every body with a tiny oval.
      if(box.enemyKind==='centipede')drawCentipede(c,{...box,hp:0},0,T,true,0,true);
      else drawCrawler(c,{id:0,kind:box.enemyKind||'hunter',x:box.x*T,y:box.y*T,angle:box.angle||0},0,0,true);
      label('REMAINS '+box.amount,box.x,box.y+(['breaker','bulwark','heavy-lens'].includes(box.enemyKind)?1.4:1.1),'#daa6c2');
    }else{c.fillStyle='#cda463';c.fillRect((box.x-.3)*T,(box.y-.3)*T,.6*T,.6*T);c.strokeStyle='#45392d';c.strokeRect((box.x-.3)*T,(box.y-.3)*T,.6*T,.6*T);label('CARGO '+box.amount,box.x,box.y+.65);}
  }
  for(const f of facilityTargets(world,buildings)){
    const job=l.jobs[f.object.id];
    if(job&&!l.facilities.some(o=>o.id===f.object.id)&&!l.recyclers.some(o=>o.id===f.object.id)){
      if(cargo(f.object.id)&&job.method==='orbital'){label('ORBITAL '+Math.ceil(job.remaining)+'s',f.x,f.y+f.h/2+.5);continue;}
      c.fillStyle='#294b50ee';c.fillRect((f.x-f.w/2)*T,(f.y-f.h/2)*T,f.w*T,f.h*T);
      construction?.draw(c,world,{x:f.x,y:f.y},Math.min(f.w,f.h),jobStage(job,advance),zoom,reduced,true);
      label((job.method==='orbital'?'ORBITAL ':'BUILD ')+Math.ceil(job.remaining)+'s',f.x,f.y+f.h/2+.5);
    }
    if(f.hp.health<f.hp.max){c.fillStyle='#301f23';c.fillRect((f.x-.5)*T,(f.y-f.h/2-.18)*T,T,4/zoom);c.fillStyle='#e0a36b';c.fillRect((f.x-.5)*T,(f.y-f.h/2-.18)*T,T*f.hp.health/f.hp.max,4/zoom);}
  }
  const ruin=(object,name,point,size)=>{
    label(`${name} RUIN / SLOT FREE`,point.x,point.y+size/2+.35,'#f0a48d');
  };
  for(const b of world.airbases)if(b.destroyed&&!world.airbases.some(n=>!n.destroyed&&b.x+1.5>=n.x&&b.x+1.5<n.x+airSize(n).width&&b.y+1.5>=n.y&&b.y+1.5<n.y+airSize(n).height))ruin(b,isHelipad(b)?'HELIPAD':'AIRBASE',{x:b.x+(isHelipad(b)?1.5:3),y:b.y+(isHelipad(b)?1.5:5)},isHelipad(b)?3:6);
  // Empty shipyards have no vessel record, but still need wreck/repair feedback.
  for(const s of dockRecords(world))if(s.dockDestroyed)ruin(s,'DOCK',s.dock,3);
  c.restore();
}

function jobStage(job,advance){const duration=job.duration||(job.kind==='repair'?8:60);if(job.method==='orbital')return assemblyStage(job.remaining,duration,advance);return {active:true,method:'factory',droneBay:job.droneBay,time:duration-job.remaining,reveal:Math.max(0,Math.min(1,1-job.remaining/duration)),phase:job.kind==='repair'?'REBUILDING':'BUILDING'};}

// Uplink rocket, seen from directly above. The parked rocket shows its nose cone,
// fins and stage band; flights come from the saved launch/cooldown countdowns.
const RETURN_TIME=8;
const uplinkPad=(f,T)=>({x:(f.x+LOGISTICS_SIZE.uplink*.58)*T,y:(f.y+LOGISTICS_SIZE.uplink*.5)*T,r:LOGISTICS_SIZE.uplink*T*.13});
// A per-site bearing so neighbouring uplinks do not fly identical tracks.
const uplinkBearing=f=>{let h=7;for(const ch of String(f.id))h=h*31+ch.charCodeAt(0)|0;return ((h>>>0)%1000/1000-.5)*1.2+.55;};
function drawRocketTop(c,r,tilt=0,flame=0,time=0,reduced=false,legs=false){
  // Nose toward -y. Upright it is a circle seen nose-on; pitching over morphs it
  // into a side-on capsule with the nose cone forward and fins at the tail.
  const half=r*(1+tilt*2.2),side=Math.min(1,tilt*2.5),fade=c.globalAlpha;
  const body=()=>{c.beginPath();c.moveTo(-r,-half+r);c.arc(0,-half+r,r,Math.PI,0);c.lineTo(r,half-r);c.arc(0,half-r,r,0,Math.PI);c.closePath();};
  if(flame>0){
    const plume=r*(1.4+tilt*3)*flame*(reduced?1:1+Math.sin(time*.04)*.12);
    const g=c.createLinearGradient(0,half*.8,0,half*.8+plume);g.addColorStop(0,'#fff6d0');g.addColorStop(.3,'#ffb347');g.addColorStop(1,'rgba(230,90,40,0)');
    c.fillStyle=g;c.beginPath();c.moveTo(-r*.55,half*.75);c.quadraticCurveTo(0,half*.8+plume*1.15,r*.55,half*.75);c.closePath();c.fill();
  }
  if(legs)for(const a of [.785,2.356,3.927,5.498]){c.strokeStyle='#59646a';c.lineWidth=r*.16;c.beginPath();c.moveTo(Math.cos(a)*r*.6,Math.sin(a)*r*.6);c.lineTo(Math.cos(a)*r*1.7,Math.sin(a)*r*1.7);c.stroke();}
  // Fins: a cross seen from above, crossfading to side fins at the tail.
  c.fillStyle='#8c3f33';
  if(side<1){c.save();c.globalAlpha*=1-side;for(const a of [0,1.571,3.142,4.712]){c.save();c.rotate(a);c.beginPath();c.moveTo(-r*.12,r*.7);c.lineTo(-r*.08,r*1.4);c.lineTo(r*.08,r*1.4);c.lineTo(r*.12,r*.7);c.closePath();c.fill();c.restore();}c.restore();}
  if(side>0){c.save();c.globalAlpha*=side;for(const s of [-1,1]){c.beginPath();c.moveTo(s*r*.9,half-r*1.4);c.lineTo(s*r*1.55,half-r*.2);c.lineTo(s*r*1.5,half+r*.05);c.lineTo(s*r*.9,half-r*.4);c.closePath();c.fill();}
    c.strokeStyle='#8c3f33';c.lineWidth=r*.2;c.beginPath();c.moveTo(0,half-r*1.3);c.lineTo(0,half+r*.1);c.stroke();c.restore();}
  body();c.fillStyle='#e4e2d2';c.fill();c.strokeStyle='#8f968a';c.lineWidth=r*.08;c.stroke();
  // Stage band: a ring around the nose from above, a stripe across the side.
  c.save();body();c.clip();
  if(side<1){c.globalAlpha=fade*(1-side);c.strokeStyle='#ae5744';c.lineWidth=r*.18;c.beginPath();c.arc(0,0,r*.8,0,Math.PI*2);c.stroke();}
  if(side>0){c.globalAlpha=fade*side;c.fillStyle='#ae5744';c.fillRect(-r,half*.2,r*2,r*.32);c.fillStyle='#c7c6b5';c.fillRect(-r,-r*.2,r*2,r*.06);}
  c.restore();
  // Nose cone: lit from the upper left, at the centre upright and forward when pitched.
  const tipY=-half+r*(1-tilt*.9),nose=c.createRadialGradient(-r*.25,tipY+r*.1,r*.05,0,tipY+r*.4,r*(.75+tilt*.4));
  nose.addColorStop(0,'#ffffff');nose.addColorStop(1,'rgba(183,184,168,0)');
  c.save();body();c.clip();c.fillStyle=nose;c.fillRect(-r,-half,r*2,half*2);c.restore();
  c.fillStyle='#55605e';c.beginPath();c.arc(0,tipY,r*.1,0,Math.PI*2);c.fill();
}
function drawUplinkPad(c,f,s,x,y,T,reduced,parked){
  const pad=uplinkPad(f,T);
  // Flame trench, launch ring and a scorch mark.
  c.fillStyle='#1a2629';c.fillRect(pad.x-pad.r*.35,pad.y,pad.r*.7,s*.42);
  c.fillStyle='#4b5c5e';c.beginPath();c.arc(pad.x,pad.y,pad.r*2.2,0,Math.PI*2);c.fill();
  c.strokeStyle='#8e9c91';c.lineWidth=pad.r*.12;c.stroke();
  c.fillStyle='#2f3d40';c.beginPath();c.arc(pad.x,pad.y,pad.r*1.55,0,Math.PI*2);c.fill();
  c.fillStyle='#1b1d1c66';c.beginPath();c.arc(pad.x+pad.r*.2,pad.y+pad.r*.3,pad.r*1.35,0,Math.PI*2);c.fill();
  for(let i=0;i<8;i++){const a=i*Math.PI/4;c.fillStyle='#c9b77d';c.fillRect(pad.x+Math.cos(a)*pad.r*1.9-2,pad.y+Math.sin(a)*pad.r*1.9-2,4,4);}
  // Lattice gantry with a swing arm that reaches the parked rocket.
  const gx=x+s*.2,gy=y+s*.5,g=s*.12;
  c.fillStyle='#3b4b4f';c.fillRect(gx-g,gy-g,g*2,g*2);c.strokeStyle='#9aa797';c.lineWidth=s*.012;c.strokeRect(gx-g,gy-g,g*2,g*2);
  c.beginPath();c.moveTo(gx-g,gy-g);c.lineTo(gx+g,gy+g);c.moveTo(gx+g,gy-g);c.lineTo(gx-g,gy+g);c.stroke();
  c.strokeStyle='#7d8b85';c.lineWidth=s*.03;c.beginPath();c.moveTo(gx+g,gy);c.lineTo(parked?pad.x-pad.r*1.05:gx+g+s*.06,parked?gy:gy-s*.08);c.stroke();
  if(parked){
    c.save();c.translate(pad.x,pad.y);
    c.fillStyle='#0e1b1d55';c.beginPath();c.ellipse(pad.r*.5,pad.r*.45,pad.r*1.2,pad.r*1.05,0,0,Math.PI*2);c.fill();
    drawRocketTop(c,pad.r,0,0,0,reduced);c.restore();
  }
}
// Flights draw above units and aircraft: a launch arcs along a curved ground track,
// climbing toward the camera until it fades; the booster later lands on the pad.
export function drawUplinkFlights(c,world,T,zoom,reduced,advance=0){
  const time=reduced?0:performance.now(),age=Math.max(0,advance);
  for(const f of world.logistics?.facilities||[]){
    if(f.kind!=='uplink')continue;
    const launch=Math.max(0,(f.launch||0)-age),cooldown=Math.max(0,(f.cooldown||0)-age);
    const flying=launch>0,landing=!flying&&cooldown>0&&cooldown<=RETURN_TIME;if(!flying&&!landing)continue;
    const pad=uplinkPad(f,T),bearing=uplinkBearing(f),cos=Math.cos(bearing),sin=Math.sin(bearing);
    const turn=([px,py])=>[pad.x+(px*cos-py*sin)*T,pad.y+(px*sin+py*cos)*T];
    // Ground track in tiles: straight up first, then pitching over into a curve.
    const track=g=>{const b=[0,-1.6],e=[4.5,-6.5],m=1-g;return turn([2*m*g*b[0]+g*g*e[0],2*m*g*b[1]+g*g*e[1]]);};
    c.save();c.lineCap='round';
    if(flying){
      const u=Math.max(0,Math.min(1,1-launch/ECONOMY.launchTime)),g=u*u,[rx,ry]=track(g),[ax,ay]=track(Math.max(0,g-.02));
      // Liftoff smoke ring spreading off the pad.
      if(u<.45){const k=u/.45;c.globalAlpha=(1-k)*.55;c.strokeStyle='#d6dcd2';c.lineWidth=pad.r*(1.2-k*.6);c.beginPath();c.arc(pad.x,pad.y,pad.r*(1.6+k*5),0,Math.PI*2);c.stroke();}
      // Smoke trail along the track: puffs widen and thin with age.
      const steps=reduced?6:16;
      for(let i=0;i<steps;i++){
        const q=g*i/steps,[tx,ty]=track(q),age=1-i/steps;
        c.globalAlpha=(1-age*.65)*(reduced?.2:.32)*(u<.85?1:(1-u)/.15);c.fillStyle='#d8ddd5';
        c.beginPath();c.arc(tx+(reduced?0:Math.sin(i*2.1+time*.002)*pad.r*.2),ty,pad.r*(.5+age*1.8),0,Math.PI*2);c.fill();
      }
      // The rocket grows as it climbs toward the camera, then fades out.
      const scale=1+2.6*Math.pow(u,1.6),tilt=Math.min(1,Math.max(0,(u-.08)/.6))*.8;
      c.globalAlpha=u<.72?1:Math.max(0,(1-u)/.28);
      c.translate(rx,ry);c.rotate(Math.hypot(rx-ax,ry-ay)>.01?Math.atan2(rx-ax,-(ry-ay)):bearing);
      drawRocketTop(c,pad.r*scale,tilt,1,time,reduced);
    }else{
      const p=cooldown/RETURN_TIME,[ox,oy]=turn([p*p*1.6,-p*p*2.4]),scale=1+2*Math.pow(p,1.5);
      // Landing burn: glow and a dust ring on the pad as the booster settles.
      if(p<.35){const k=1-p/.35;c.globalAlpha=k*.45;c.fillStyle='#ffb35a';c.beginPath();c.arc(pad.x,pad.y,pad.r*(1.4+k*.8),0,Math.PI*2);c.fill();
        c.globalAlpha=k*.4;c.strokeStyle='#d6dcd2';c.lineWidth=pad.r*.6;c.beginPath();c.arc(pad.x,pad.y,pad.r*(2+k*2.5),0,Math.PI*2);c.stroke();}
      c.globalAlpha=p>.75?(1-p)/.25:1;c.translate(ox,oy);
      drawRocketTop(c,pad.r*scale,0,p<.6?.5:0,time,reduced,p<.25);
    }
    c.restore();
  }
}
