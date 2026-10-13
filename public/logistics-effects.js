import { assemblyStage } from './construction-effects.js';
import { LOGISTICS_SIZE, ECONOMY, facilityTargets } from './logistics.js';

export function drawLogistics(c,world,buildings,T,zoom,reduced,driverId,construction=null,advance=0){
  const l=world.logistics;if(!l)return;
  const label=(text,x,y,color='#e8dfa8')=>{c.font=`${10/zoom}px monospace`;c.textAlign='center';const w=c.measureText(text).width;c.fillStyle='#122d29e8';c.fillRect(x*T-w/2-3,y*T-11/zoom,w+6,15/zoom);c.fillStyle=color;c.fillText(text,x*T,y*T);};
  c.save();
  for(const site of world.sites||[])if(site.state==='conquered'&&(l.salvage[site.id]??ECONOMY.salvage)>0)label('SALVAGE '+(l.salvage[site.id]??ECONOMY.salvage),site.x+1.5,site.y+3.4);
  for(const f of l.facilities){
    const size=LOGISTICS_SIZE[f.kind],x=f.x*T,y=f.y*T,s=size*T;
    const stage=assemblyStage(f.remaining,8,advance);
    c.save();if(stage.active){c.beginPath();c.rect(x,y+s*(1-stage.reveal),s,s*stage.reveal);c.clip();}
    c.fillStyle='#293e43';c.fillRect(x,y,s,s);c.strokeStyle='#adbea0';c.lineWidth=2/zoom;c.strokeRect(x+3,y+3,s-6,s-6);
    for(let i=0;i<size*3;i++){c.fillStyle=i%2?'#d3ab58':'#26373b';c.fillRect(x+i*s/(size*3),y+s-7,s/(size*3),7);}
    if(f.kind==='factory'){
      c.fillStyle='#688b8a';c.fillRect(x+s*.12,y+s*.15,s*.76,s*.55);c.fillStyle='#192b2e';
      for(let i=0;i<4;i++)c.fillRect(x+s*(.2+i*.15),y+s*.25,s*.08,s*.33);
      c.fillStyle='#dfb763';c.fillRect(x+s*.1,y+s*.74,s*.8,s*.06);
    }else{
      c.strokeStyle='#647f86';c.lineWidth=s*.07;c.beginPath();c.moveTo(x+s*.25,y+s*.8);c.lineTo(x+s*.25,y+s*.2);c.lineTo(x+s*.6,y+s*.2);c.stroke();
      const progress=f.launch>0?1-f.launch/ECONOMY.launchTime:0;
      const lift=reduced?progress*.5:progress*progress*6;
      c.save();c.translate(x+s*.57,y+s*.55-lift*T);c.globalAlpha=1-progress*.65;
      if(f.launch>0){c.fillStyle='#ffaa45';c.beginPath();c.moveTo(-s*.07,s*.25);c.lineTo(0,s*.6);c.lineTo(s*.07,s*.25);c.fill();}
      c.fillStyle='#dbdbc3';c.beginPath();c.moveTo(0,-s*.35);c.lineTo(s*.1,-s*.15);c.lineTo(s*.1,s*.25);c.lineTo(-s*.1,s*.25);c.lineTo(-s*.1,-s*.15);c.closePath();c.fill();c.fillStyle='#ae5744';c.fillRect(-s*.1,-s*.02,s*.2,s*.07);c.restore();
    }
    c.restore();construction?.draw(c,world,{x:f.x+size/2,y:f.y+size/2},size,stage,zoom,reduced,true);
    if(stage.active)label(stage.phase+' '+Math.ceil(f.remaining)+'s',f.x+size/2,f.y+size+.6);
    label(f.kind==='factory'?'FACTORY':'UPLINK / '+f.cargo+' CARGO',f.x+size/2,f.y+size+.25);
  }
  for(const r of l.recyclers){
    const stage=assemblyStage(r.remaining,4.5,advance);
    c.save();if(stage.active)c.globalAlpha=stage.reveal;
    c.save();c.translate(r.x*T,r.y*T);c.rotate(r.angle);c.fillStyle='#172d30';c.fillRect(-.43*T,-.48*T,.86*T,.96*T);
    for(const side of [-1,1])for(const axle of [-.3,.3]){c.fillStyle='#101d21';c.fillRect((side*.4-.09)*T,(axle-.15)*T,.18*T,.3*T);}
    c.fillStyle=r.kind==='builder'?'#b3bcb6':'#c39d58';c.fillRect(-.33*T,-.4*T,.66*T,.8*T);c.fillStyle='#3d656a';c.fillRect(-.23*T,-.31*T,.46*T,.25*T);
    c.fillStyle=r.cargo?'#aa6d94':'#4a5045';c.fillRect(-.25*T,.06*T,.5*T,.28*T);c.fillStyle='#adba9e';c.fillRect(-.45*T,-.54*T,.9*T,.12*T);c.restore();
    if(r.kind==='builder'){c.strokeStyle='#dab96e';c.lineWidth=4/zoom;c.beginPath();c.moveTo(r.x*T,r.y*T);c.lineTo((r.x+Math.sin(r.angle)*.55)*T,(r.y-Math.cos(r.angle)*.55)*T);c.stroke();}
    if(r.occupant){c.strokeStyle=r.occupant===driverId?'#e3bc70':'#a6ccc0';c.lineWidth=2/zoom;c.beginPath();c.arc(r.x*T,r.y*T,T*.67,0,Math.PI*2);c.stroke();}
    c.restore();construction?.draw(c,world,r,1,stage,zoom,reduced);
    label(r.remaining>0?stage.phase+' '+Math.ceil(r.remaining)+'s':r.collecting>0?'RECLAIMING '+Math.ceil(ECONOMY.collectTime-r.collecting)+'s':r.blocked?'ROUTE BLOCKED':(r.occupant===driverId?'YOU / ':r.occupant?'CREW / ':r.kind==='builder'?'BUILDER / ':'RECYCLER / ')+(r.kind==='builder'?'ENG':r.cargo),r.x,r.y+.85);
  }
  for(const box of l.crates){
    if(box.kind==='remains'){
      c.save();c.translate(box.x*T,box.y*T);c.rotate(box.angle||0);c.fillStyle='#653454';c.beginPath();c.ellipse(0,0,.55*T,.34*T,0,0,Math.PI*2);c.fill();c.fillStyle='#823c43';c.beginPath();c.ellipse(0,0,.35*T,.2*T,0,0,Math.PI*2);c.fill();c.strokeStyle='#4d2a38';c.lineWidth=.07*T;
      for(const side of [-1,1])for(const dy of [-.14,.12]){c.beginPath();c.moveTo(side*.2*T,dy*T);c.lineTo(side*.47*T,(dy+.16)*T);c.stroke();}c.restore();label('REMAINS '+box.amount,box.x,box.y+.7,'#daa6c2');
    }else{c.fillStyle='#cda463';c.fillRect((box.x-.3)*T,(box.y-.3)*T,.6*T,.6*T);c.strokeStyle='#45392d';c.strokeRect((box.x-.3)*T,(box.y-.3)*T,.6*T,.6*T);label('CARGO '+box.amount,box.x,box.y+.65);}
  }
  for(const f of facilityTargets(world,buildings)){
    const job=l.jobs[f.object.id];
    if(job){c.fillStyle='#294b5088';c.fillRect((f.x-f.w/2)*T,(f.y-f.h/2)*T,f.w*T,f.h*T);label('BUILD '+Math.ceil(job.remaining)+'s',f.x,f.y);}
    if(f.hp.health<f.hp.max){c.fillStyle='#301f23';c.fillRect((f.x-.5)*T,(f.y-f.h/2-.18)*T,T,4/zoom);c.fillStyle='#e0a36b';c.fillRect((f.x-.5)*T,(f.y-f.h/2-.18)*T,T*f.hp.health/f.hp.max,4/zoom);}
  }
  for(const b of world.airbases)if(b.destroyed)label('AIRBASE LOST / REBUILD',b.x+3,b.y+5,'#f0a48d');
  for(const s of world.ships)if(s.dockDestroyed)label('DOCK LOST / REBUILD',s.dock.x,s.dock.y,'#f0a48d');
  c.restore();
}
