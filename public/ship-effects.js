import { depthState, diveBattery, DIVE } from './submarine-depth.js';
import { SHIP, hull, hullCells, shipName, shipKind } from './ship.js';
import { MAIN_MOUNTS, SIDE_MOUNTS } from './ship-armament.js';
import { hullPoint } from './vehicle.js';
import { CoreEffects } from './core-effects.js';
const clamp=n=>Math.max(0,Math.min(1,n));
export class ShipEffects extends CoreEffects {
  ramp(c,ship,point,zoom,preview=false) {
    if(!point)return;
    const T=this.tile,start=hullPoint(ship,point),dx=point.x-start.x,dy=point.y-start.y,length=Math.hypot(dx,dy)*T;
    c.save();c.translate(start.x*T,start.y*T);c.rotate(Math.atan2(dy,dx));
    c.strokeStyle=preview?'#bceac799':'#e3c489';c.fillStyle='#546f70';c.lineWidth=2/zoom;
    if(preview){c.setLineDash([5/zoom,4/zoom]);c.strokeRect(0,-T*.21,length,T*.42);}
    else{c.fillRect(0,-T*.21,length,T*.42);c.strokeRect(0,-T*.21,length,T*.42);c.lineWidth=1;for(let x=4;x<length;x+=T*.18){c.beginPath();c.moveTo(x,-T*.17);c.lineTo(x,T*.17);c.stroke();}}
    c.restore();c.save();c.strokeStyle=preview?'#bceac7':'#e3c489';c.lineWidth=1.5/zoom;c.strokeRect((point.x-.38)*T,(point.y-.38)*T,.76*T,.76*T);
    c.fillStyle='#123b3bdf';c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';const label=preview?'G / SHORE RAMP':'RAMP / E',width=c.measureText(label).width;c.fillRect(point.x*T-width/2-3,(point.y+.95)*T,width+6,15/zoom);c.fillStyle='#e6e5bc';c.fillText(label,point.x*T,(point.y+.95)*T+11/zoom);c.restore();
  }
  preview(c,site,x,y,zoom) {
    const T=this.tile,s=site.ship;
    c.save();c.lineWidth=1/zoom;c.strokeStyle=s?'#b8ece4':'#ffab86';c.fillStyle=s?'#9eddd42e':'#e7876540';
    if(s)for(const cell of hullCells(hull(s,true))){c.fillRect(cell.x*T,cell.y*T,T,T);c.strokeRect(cell.x*T+1,cell.y*T+1,T-2,T-2);}
    else{c.fillRect(x*T,y*T,T,T);c.strokeRect(x*T,y*T,T,T);}
    if(s){this.dock(c,s,zoom,true);c.fillStyle='#d4f1e6';c.font=`bold ${11/zoom}px monospace`;c.textAlign='center';c.fillText('ORBITAL SHIP / WATER CRADLE',s.x*T,(s.y-3.5)*T);}
    c.restore();
  }
  dock(c,s,zoom,preview=false) {
    const T=this.tile,d=s.dock,dx=s.berthX-d.x,dy=s.berthY-d.y,length=Math.hypot(dx,dy),end={x:s.berthX-dx/length*SHIP.length/2,y:s.berthY-dy/length*SHIP.length/2};
    c.save();c.lineCap='butt';c.strokeStyle='#162f36';c.lineWidth=T*.55;c.beginPath();c.moveTo(d.x*T,d.y*T);c.lineTo(end.x*T,end.y*T);c.stroke();
    c.strokeStyle='#7c9390';c.lineWidth=T*.4;c.stroke();
    c.strokeStyle='#d4bb7c';c.lineWidth=2;for(let i=0;i<=length-SHIP.length/2;i+=.3){const x=(d.x+dx/length*i)*T,y=(d.y+dy/length*i)*T;c.beginPath();c.moveTo(x-dy/length*T*.2,y+dx/length*T*.2);c.lineTo(x+dy/length*T*.2,y-dx/length*T*.2);c.stroke();}
    c.fillStyle='#516f72';c.fillRect((d.x-.45)*T,(d.y-.45)*T,T*.9,T*.9);c.strokeStyle='#ead29c';c.strokeRect((d.x-.4)*T,(d.y-.4)*T,T*.8,T*.8);
    c.fillStyle='#eef0d4';c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';c.fillText(preview?'BOARDING POINT':'DOCK',d.x*T,(d.y+.85)*T);
    c.translate(s.berthX*T,s.berthY*T);c.rotate(d.angle);c.strokeStyle='#baded055';c.lineWidth=1/zoom;c.setLineDash([6/zoom,7/zoom]);c.strokeRect(-1.2*T,-2.2*T,2.4*T,4.4*T);c.setLineDash([]);
    c.beginPath();c.moveTo(-.3*T,-2.6*T);c.lineTo(0,-2.9*T);c.lineTo(.3*T,-2.6*T);c.stroke();c.restore();
  }
  drawPod(c,s,time,reduced) {
    const T=this.tile;c.save();c.translate(s.berthX*T,s.berthY*T);c.rotate(s.dock.angle);
    if(time<SHIP.impact){const p=clamp(time/SHIP.impact),fall=1-p*p;c.fillStyle=`rgba(8,32,39,${.1+p*.25})`;c.beginPath();c.ellipse(0,0,T*(1.8-p*.4),T*(2.8-p*.4),0,0,Math.PI*2);c.fill();c.translate(fall*5*T,-fall*9*T);
      if(!reduced){c.strokeStyle='#c2ebea66';c.lineWidth=20;c.beginPath();c.moveTo(0,0);c.lineTo(fall*2*T,-fall*4*T);c.stroke();}
      c.scale((1+fall)*2/3,(1+fall)*4/3);this.box(c,0);c.restore();return;}
    const age=time-SHIP.impact;
    if(age<1.4){for(let i=0;i<(reduced?2:5);i++){const p=clamp(age/1.4);c.strokeStyle=`rgba(201,242,236,${(1-p)*.5})`;c.lineWidth=3*(1-p)+1;c.beginPath();c.ellipse(0,0,T*(1.1+p*(1.7+i*.25)),T*(2.1+p*(1.7+i*.25)),0,0,Math.PI*2);c.stroke();}}
    for(let side=0;side<4;side++){const p=clamp((time-SHIP.unfold-side*SHIP.stagger)/SHIP.panelDuration);c.save();const horizontal=side%2===0;
      c.translate(horizontal?0:(side===1?1:-1)*(1+.35*p)*T,horizontal?(side===0?-1:1)*(2+.35*p)*T:0);
      c.fillStyle='#405f66';c.fillRect(horizontal?-1.3*T:-.18*T,horizontal?-.18*T:-2.25*T,horizontal?2.6*T:.36*T,horizontal?.36*T:4.5*T);c.strokeStyle='#88bab7';c.lineWidth=2;c.strokeRect(horizontal?-1.3*T:-.18*T,horizontal?-.18*T:-2.25*T,horizontal?2.6*T:.36*T,horizontal?.36*T:4.5*T);c.restore();}
    if(time<SHIP.exit){const fade=1-clamp((time-SHIP.unfold)/1.8);c.save();c.globalAlpha=fade;c.scale(2/3,4/3);this.box(c,age);c.restore();}c.restore();
  }
}
export function drawShip(c,s,T,mine,zoom,time,reduced,recoil=()=>0) {
  if(shipKind(s)==='submarine'){drawSubmarine(c,s,T,mine,zoom,time,reduced);return;}
  c.save();c.translate(s.x*T,s.y*T);c.rotate(s.angle);
  if(s.speed>.05){c.strokeStyle='#b9ebe184';c.lineWidth=2;c.beginPath();c.moveTo(-.75*T,1.6*T);c.quadraticCurveTo(-1.2*T,2.4*T,-1.5*T,3.5*T);c.moveTo(.75*T,1.6*T);c.quadraticCurveTo(1.2*T,2.4*T,1.5*T,3.5*T);c.stroke();if(!reduced)for(let i=0;i<4;i++){const p=(time*.0007+i/4)%1;c.globalAlpha=(1-p)*.3;c.beginPath();c.ellipse(0,(2+p*2)*T,(.5+p*.7)*T,.18*T,0,0,Math.PI*2);c.stroke();}c.globalAlpha=1;}
  c.fillStyle='#102e37';c.beginPath();c.moveTo(0,-2*T);c.lineTo(.93*T,-1.05*T);c.lineTo(T,1.5*T);c.quadraticCurveTo(T,2*T,.6*T,2*T);c.lineTo(-.6*T,2*T);c.quadraticCurveTo(-T,2*T,-T,1.5*T);c.lineTo(-.93*T,-1.05*T);c.closePath();c.fill();c.strokeStyle=mine?'#ecc987':'#86b5b4';c.lineWidth=3;c.stroke();
  c.fillStyle='#607c7e';c.beginPath();c.moveTo(0,-1.75*T);c.lineTo(.72*T,-.9*T);c.lineTo(.73*T,1.62*T);c.lineTo(-.73*T,1.62*T);c.lineTo(-.72*T,-.9*T);c.closePath();c.fill();
  c.strokeStyle='#a8b9a7';c.lineWidth=1;c.stroke();
  c.fillStyle='#304c57';c.fillRect(-.36*T,-.35*T,.72*T,.7*T);c.fillStyle='#a3bdb0';c.fillRect(-.3*T,-.3*T,.6*T,.22*T);
  c.strokeStyle='#c5d9c5';c.lineWidth=2;c.beginPath();c.moveTo(0,-.1*T);c.lineTo(0,.32*T);c.moveTo(-.2*T,.1*T);c.lineTo(.2*T,.1*T);c.stroke();
  for(const m of MAIN_MOUNTS){
    c.save();c.translate(0,m.y*T);c.rotate((s[m.key]??s.turret)-s.angle);
    c.fillStyle='#1b3540';c.beginPath();c.arc(0,0,T*.36,0,Math.PI*2);c.fill();c.fillStyle='#d1c395';c.fillRect(-.29*T,-.3*T,.58*T,.56*T);c.strokeStyle='#ecdeb5';c.strokeRect(-.29*T,-.3*T,.58*T,.56*T);
    for(const side of [-1,1]){const kick=recoil(s.id+':'+m.id+':'+side,s.ammo);c.fillStyle='#344f58';c.fillRect((side*.13-.045)*T,-.8*T+kick,.09*T,.68*T);c.fillStyle=s.ammo==='GAS'?'#b2d48b':s.ammo==='INCENDIARY'?'#ef9f5a':'#bedcdb';c.fillRect((side*.13-.065)*T,-.8*T+kick,.13*T,.12*T);}
    c.restore();
  }
  for(const m of SIDE_MOUNTS){
    c.save();c.translate(m.x*T,0);c.rotate(s[m.key]??m.center);c.fillStyle='#29434b';c.beginPath();c.arc(0,0,T*.2,0,Math.PI*2);c.fill();c.strokeStyle='#bed5c0';c.lineWidth=1.5;c.stroke();
    c.fillStyle='#96b5a9';c.fillRect(-.12*T,-.17*T,.24*T,.27*T);c.fillStyle='#dbc694';c.fillRect(-.045*T,-.43*T+recoil(s.id+':'+m.id,'NAVAL_APCR'),.09*T,.33*T);c.restore();
  }
  c.restore();
  c.save();c.fillStyle='#193934dd';c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';const label=mine?'YOU / COASTAL GUNSHIP':s.occupant?'GUNSHIP / OCCUPIED':'COASTAL GUNSHIP',w=c.measureText(label).width;c.fillRect(s.x*T-w/2-5,s.y*T+2.4*T,w+10,16/zoom);c.fillStyle='#e5d8ac';c.fillText(label,s.x*T,s.y*T+2.4*T+11/zoom);c.restore();
}
function drawSubmarine(c,s,T,mine,zoom,time,reduced){
 const state=depthState(s),remaining=s.depthRemaining||0;
 const depth=state==='submerged'?1:state==='diving'?1-remaining/DIVE.transition:state==='surfacing'?remaining/DIVE.transition:0;
 c.save();c.translate(s.x*T,s.y*T);c.rotate(s.angle);
 if(depth>0){c.strokeStyle='#9cd9df';c.globalAlpha=.45;c.lineWidth=1.5/zoom;c.setLineDash([4/zoom,5/zoom]);c.beginPath();c.ellipse(0,0,1.3*T,2.3*T,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
   if(!reduced&&state!=='submerged')for(let i=0;i<6;i++){const phase=(time*.0006+i/6)%1;c.globalAlpha=(1-phase)*.55;c.beginPath();c.arc(Math.sin(i*4.1)*T,(i/6-.5)*3*T,Math.max(1,phase*.4*T),0,Math.PI*2);c.stroke();}
 }c.restore();
 c.save();c.translate(s.x*T,s.y*T);c.rotate(s.angle);
 c.globalAlpha=1-depth*.65;
 if(s.speed>.05&&depth<.5){c.strokeStyle='#b9ebe177';c.lineWidth=2;c.beginPath();c.moveTo(-.65*T,1.5*T);c.lineTo(-T,3*T);c.moveTo(.65*T,1.5*T);c.lineTo(T,3*T);c.stroke();}
 c.fillStyle='#18323e';c.strokeStyle=mine?'#edcd89':'#91bdb7';c.lineWidth=2.5;c.beginPath();c.ellipse(0,0,T,2*T,0,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle='#4d6970';c.beginPath();c.ellipse(0,0,.67*T,1.72*T,0,0,Math.PI*2);c.fill();
 c.fillStyle='#233f49';c.fillRect(-.25*T,-1.14*T,.5*T,.7*T);c.strokeStyle='#adcec4';c.strokeRect(-.25*T,-1.14*T,.5*T,.7*T);c.lineWidth=2;c.beginPath();c.moveTo(0,-.8*T);c.lineTo(0,-1.35*T);c.lineTo(.23*T,-1.35*T);c.stroke();
 for(let i=0;i<6;i++){const x=(i%2-.5)*.6*T,y=(Math.floor(i/2)-1)*.6*T+.5*T;c.fillStyle=s.launchRemaining>0?'#171f23':s.reload>0?'#53666a':'#b2c6b0';c.fillRect(x-.2*T,y-.2*T,.4*T,.4*T);c.strokeStyle=s.launchRemaining>0?'#efbc71':'#819f98';c.lineWidth=1.5;c.strokeRect(x-.2*T,y-.2*T,.4*T,.4*T);if(s.launchRemaining>0&&!reduced){c.globalAlpha=.4+.25*Math.sin(time*.02+i);c.fillStyle='#ffc27a';c.fillRect(x-.12*T,y-.12*T,.24*T,.24*T);c.globalAlpha=1;}}
 c.restore();c.save();c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';const label=(mine?'YOU / ':'')+shipName(s).toUpperCase()+' / '+state.toUpperCase()+(depth>0?' / '+Math.ceil(diveBattery(s))+'s':''),w=c.measureText(label).width;c.fillStyle='#163737dd';c.fillRect(s.x*T-w/2-4,(s.y+2.35)*T,w+8,16/zoom);c.fillStyle='#e5d8ac';c.fillText(label,s.x*T,(s.y+2.35)*T+11/zoom);c.restore();
}
