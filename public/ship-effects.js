import { drawSubmarineHull } from './submarine-art.js';
import {drawCapitalShip} from './naval-art.js';
import {BATTLESHIP_LAYOUTS,drawBattleshipBody,drawBattleshipFunnels,drawIowaTurret,drawTwinMount} from './battleship-art.js';
import {largeHull,largeDock,dockDimensions,shipDimensions} from './naval-scale.js';
import {TRANSPORT_LAYOUTS,drawTransportBody,drawTripleTurret,drawOpenMount} from './transport-art.js';
import {drawFordCarrier} from './carrier-art.js';
import { depthState, diveBattery, DIVE } from './submarine-depth.js';
import { SHIP, hull, hullCells, shipName, shipKind, dockRects, dockComplete } from './ship.js';
import { mainMounts, mainBarrels, SIDE_MOUNTS, secondaryMounts, secondaryAngle } from './ship-armament.js';
import { hullPoint } from './vehicle.js';
import { CoreEffects } from './core-effects.js';
import { drawRuinedSlab } from './facility-ruins.js';
import { drawShipWater, drawShipExhaust, drawDiveBubbles } from './ship-water-effects.js';
const clamp=n=>Math.max(0,Math.min(1,n));
// Gunship and transport art is narrower than the saved hull; start drawn ramps
// at the painted side so they visibly touch it. Ends keep the saved length.
function drawnHullPoint(ship,point){
  const p=hullPoint(ship,point),kind=shipKind(ship),layouts=kind==='gunship'?BATTLESHIP_LAYOUTS:kind==='transport'?TRANSPORT_LAYOUTS:null;
  if(!layouts)return p;
  const half=shipDimensions(ship).width/2,beam=layouts[largeHull(ship)?'large':'legacy'].beam,rx=Math.cos(ship.angle),ry=Math.sin(ship.angle),lateral=(p.x-ship.x)*rx+(p.y-ship.y)*ry;
  if(Math.abs(lateral)<half-.01)return p;
  const inset=Math.sign(lateral)*half*(1-beam);return {x:p.x-rx*inset,y:p.y-ry*inset};
}
// Shore-facing wall, three roof leaves, then the ocean-facing wall.
export const dockPanelPhases=Object.freeze([{start:2.05,rows:1,offset:0},{start:2.4,rows:3,offset:1},{start:2.95,rows:1,offset:4}]);
export class ShipEffects extends CoreEffects {
  ramp(c,ship,point,zoom,preview=false) {
    if(!point)return;
    const T=this.tile,start=drawnHullPoint(ship,point),dx=point.x-start.x,dy=point.y-start.y,length=Math.hypot(dx,dy)*T;
    c.save();c.translate(start.x*T,start.y*T);c.rotate(Math.atan2(dy,dx));
    c.strokeStyle=preview?'#bceac799':'#e3c489';c.fillStyle='#546f70';c.lineWidth=2/zoom;
    if(preview){c.setLineDash([5/zoom,4/zoom]);c.strokeRect(0,-T*.21,length,T*.42);}
    else{c.fillRect(0,-T*.21,length,T*.42);c.strokeRect(0,-T*.21,length,T*.42);c.lineWidth=1;for(let x=4;x<length;x+=T*.18){c.beginPath();c.moveTo(x,-T*.17);c.lineTo(x,T*.17);c.stroke();}}
    c.restore();
    if(!preview&&ship.rampGun){const g=ship.rampGun;c.save();c.translate(point.x*T,point.y*T);c.rotate(g.angle||0);c.fillStyle=g.destroyed?'#423c3b':'#344b4d';c.fillRect(-.3*T,-.3*T,.6*T,.6*T);c.strokeStyle=g.destroyed?'#7f6752':'#dcc68c';c.lineWidth=2/zoom;c.strokeRect(-.3*T,-.3*T,.6*T,.6*T);if(!g.destroyed){c.fillStyle='#d9cbaa';c.fillRect(-.12*T,-.2*T,.24*T,.36*T);c.fillStyle='#778f91';c.fillRect(-.04*T,-.68*T,.08*T,.5*T);}c.restore();}
    c.save();c.strokeStyle=preview?'#bceac7':'#e3c489';c.lineWidth=1.5/zoom;c.strokeRect((point.x-.38)*T,(point.y-.38)*T,.76*T,.76*T);
    c.fillStyle='#123b3bdf';c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';const label=preview?'G / SHORE RAMP':ship.rampGun?.destroyed?'RAMP / SENTRY LOST':'RAMP / SENTRY / E',width=c.measureText(label).width;c.fillRect(point.x*T-width/2-3,(point.y+.95)*T,width+6,15/zoom);c.fillStyle='#e6e5bc';c.fillText(label,point.x*T,(point.y+.95)*T+11/zoom);c.restore();
  }
  vehicleRamp(c,ship,point,zoom){
    if(!point)return;
    const T=this.tile,start=drawnHullPoint(ship,point),dx=start.x-point.x,dy=start.y-point.y;
    c.save();c.translate(point.x*T,point.y*T);c.rotate(Math.atan2(dy,dx));
    c.fillStyle='#526d70';c.fillRect(0,-T,Math.hypot(dx,dy)*T,2*T);
    c.strokeStyle='#e8c778';c.lineWidth=2/zoom;c.strokeRect(0,-T,Math.hypot(dx,dy)*T,2*T);
    c.beginPath();c.moveTo(-.3*T,-.2*T);c.lineTo(0,0);c.lineTo(-.3*T,.2*T);c.stroke();c.restore();
    c.save();c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';c.fillStyle='#ecd597';c.fillText(ship.cargo?'VEHICLE ABOARD / K OFF':ship.occupant?'HELM OCCUPIED':'DRIVE ON',point.x*T,(point.y+.9)*T);c.restore();
  }
  preview(c,site,x,y,zoom) {
    const T=this.tile,s=site.ship;
    c.save();c.lineWidth=1/zoom;c.strokeStyle=s&&!site.error?'#b8ece4':'#ffab86';c.fillStyle=s&&!site.error?'#9eddd42e':'#e7876540';
    if(s)for(const cell of [...hullCells(hull(s,true)),...dockRects(s).flatMap(hullCells)]){c.fillRect(cell.x*T,cell.y*T,T,T);c.strokeRect(cell.x*T+1,cell.y*T+1,T-2,T-2);}
    else{c.fillRect(x*T,y*T,T,T);c.strokeRect(x*T,y*T,T,T);}
    if(s){this.dock(c,s,zoom,true);c.fillStyle='#d4f1e6';c.font=`bold ${11/zoom}px monospace`;c.textAlign='center';c.fillText('ORBITAL SHIP / WATER CRADLE',s.x*T,(s.y-3.5)*T);}
    c.restore();
  }
  dock(c,s,zoom,preview=false) {
    if(s.dockDestroyed&&!preview){
      const rects=dockRects(s);
      if(!rects.length){
        const dx=s.berthX-s.dock.x,dy=s.berthY-s.dock.y,length=Math.hypot(dx,dy),span=Math.max(.5,length-SHIP.length/2);
        rects.push({x:s.dock.x,y:s.dock.y,w:.9,h:.9,angle:s.dock.angle},
          {x:s.dock.x+dx/Math.max(length,.001)*span/2,y:s.dock.y+dy/Math.max(length,.001)*span/2,w:.55,h:span,angle:Math.atan2(dx,-dy)});
      }
      for(const rect of rects)drawRuinedSlab(c,rect,this.tile,zoom,true);
      return;
    }
    if(s.dockStyle==='unfolding'){this.unfoldingDock(c,s,zoom,preview||dockComplete(s)?SHIP.duration:s.elapsed,preview);return;}
    const T=this.tile,d=s.dock,dx=s.berthX-d.x,dy=s.berthY-d.y,length=Math.hypot(dx,dy),end={x:s.berthX-dx/length*SHIP.length/2,y:s.berthY-dy/length*SHIP.length/2};
    c.save();c.lineCap='butt';c.strokeStyle='#162f36';c.lineWidth=T*.55;c.beginPath();c.moveTo(d.x*T,d.y*T);c.lineTo(end.x*T,end.y*T);c.stroke();
    c.strokeStyle='#7c9390';c.lineWidth=T*.4;c.stroke();
    c.strokeStyle='#d4bb7c';c.lineWidth=2;for(let i=0;i<=length-SHIP.length/2;i+=.3){const x=(d.x+dx/length*i)*T,y=(d.y+dy/length*i)*T;c.beginPath();c.moveTo(x-dy/length*T*.2,y+dx/length*T*.2);c.lineTo(x+dy/length*T*.2,y-dx/length*T*.2);c.stroke();}
    c.fillStyle='#516f72';c.fillRect((d.x-.45)*T,(d.y-.45)*T,T*.9,T*.9);c.strokeStyle='#ead29c';c.strokeRect((d.x-.4)*T,(d.y-.4)*T,T*.8,T*.8);
    c.fillStyle='#eef0d4';c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';c.fillText(preview?'BOARDING POINT':s.dockDestroyed?'DOCK RUIN / SLOT FREE':'DOCK / E',d.x*T,(d.y+.85)*T);
    c.translate(s.berthX*T,s.berthY*T);c.rotate(d.angle);c.strokeStyle='#baded055';c.lineWidth=1/zoom;c.setLineDash([6/zoom,7/zoom]);c.strokeRect(-1.2*T,-2.2*T,2.4*T,4.4*T);c.setLineDash([]);
    c.beginPath();c.moveTo(-.3*T,-2.6*T);c.lineTo(0,-2.9*T);c.lineTo(.3*T,-2.6*T);c.stroke();c.restore();
  }
  drawPod(c,s,time,reduced) {
    if(s.dockStyle==='unfolding'){
      const T=this.tile;
      if(time<SHIP.impact){
        const fall=1-clamp(time/SHIP.impact)**2;c.save();c.translate(s.dock.x*T,s.dock.y*T);
        c.fillStyle='#112b3855';c.beginPath();c.ellipse(0,0,T*.6,T*.35,0,0,Math.PI*2);c.fill();if(!reduced)c.translate(fall*5*T,-fall*9*T);
        if(!reduced){c.strokeStyle='#f3d89b77';c.lineWidth=T*.3;c.beginPath();c.moveTo(0,0);c.lineTo(fall*2*T,-fall*3*T);c.stroke();}
        c.scale(1/3,1/3);this.box(c,0);c.restore();
      }else if(time<SHIP.impact+.7&&!reduced){
        const a=(time-SHIP.impact)/.7;c.save();c.strokeStyle=`rgba(226,206,162,${1-a})`;c.lineWidth=3;c.beginPath();c.ellipse(s.dock.x*T,s.dock.y*T,T*(.5+a*1.4),T*(.3+a*.7),0,0,Math.PI*2);c.stroke();c.restore();
      }
      if(time>=SHIP.exit&&time<SHIP.duration){c.save();c.strokeStyle='#c0e5de88';c.lineWidth=3;c.beginPath();c.ellipse(s.berthX*T,s.berthY*T,T*(1+(time-SHIP.exit)),T*(2+(time-SHIP.exit)),s.angle,0,Math.PI*2);c.stroke();c.restore();}
      return;
    }
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
  unfoldingDock(c,s,zoom,time,preview=false){
    const T=this.tile;if(time<SHIP.impact&&!preview)return;
    const size=dockDimensions(s),phases=largeDock(s)?[{start:2.05,rows:3,offset:0},{start:2.4,rows:6,offset:3},{start:2.95,rows:3,offset:9}]:dockPanelPhases;
    const spread=clamp((time-SHIP.impact)/.7);
    c.save();c.translate(s.dock.x*T,s.dock.y*T);c.rotate(s.dock.angle);
    const panel=(x,y,w,h)=>{c.fillStyle='#4a6369';c.fillRect(x*T,y*T,w*T,h*T);if(h<.15)return;c.strokeStyle='#b5bca0';c.lineWidth=1/zoom;c.strokeRect((x+.06)*T,(y+.06)*T,(w-.12)*T,(h-.12)*T);c.fillStyle='#d5bb7d';c.fillRect((x+.09)*T,(y+.1)*T,Math.max(.04,w-.18)*T,.06*T);};
    panel(-.5-spread*(size.width-1)/2,-.5,1+spread*(size.width-1),1);
    for(const phase of phases){
      const progress=clamp((time-phase.start)/.45),open=Math.sin(progress*progress*(3-2*progress)*Math.PI/2);if(!open)continue;
      // A roof leaf folds as one rigid plate; seams keep its tile scale legible.
      for(let row=0;row<phase.rows;row++)for(let col=0;col<size.width;col++)panel(col-size.width/2,-.5-phase.offset-(row+1)*open,1,open);
    }
    c.fillStyle='#edd5a4';c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';c.fillText(preview?`SHORE CAPSULE / ${size.width} x ${size.length} DOCK`:time<SHIP.exit?'DOCK UNFOLDING':s.dockDestroyed?'DOCK RUIN / SLOT FREE':'DOCK / E',0,T);
    c.restore();
    if(time>=SHIP.exit){c.save();c.strokeStyle='#c6e6cd88';c.setLineDash([6/zoom,6/zoom]);c.translate(s.berthX*T,s.berthY*T);c.rotate(s.dock.angle);c.strokeRect((-size.berthWidth/2+.1)*T,(-size.berthLength/2+.1)*T,(size.berthWidth-.2)*T,(size.berthLength-.2)*T);c.restore();}
  }
  dockShake(s,time,camera,reduced,enabled){
    if(reduced||!enabled)return {x:0,y:0};
    let strength=0;
    for(const [at,power] of [[SHIP.impact,7],[SHIP.impact+.7,3],...dockPanelPhases.map(p=>[p.start+.45,p.rows===3?5:3])]){
      const age=time-at;if(age>=0&&age<.3)strength+=power*(1-age/.3);
    }
    strength*=Math.max(0,1-Math.hypot(s.dock.x*this.tile-camera.x,s.dock.y*this.tile-camera.y)*camera.zoom/700);
    return {x:Math.sin(time*119)*strength,y:Math.cos(time*97)*strength*.65};
  }
}
export function drawShip(c,s,T,mine,zoom,time,reduced,recoil=()=>0) {
  if(largeHull(s)){drawCapitalShip(c,s,T,mine,zoom,time,reduced,recoil);return;}
  if(shipKind(s)==='carrier'){drawCarrier(c,s,T,mine,zoom,time,reduced,recoil);return;}
  if(shipKind(s)==='submarine'){drawSubmarine(c,s,T,mine,zoom,time,reduced);return;}
  const battleship=shipKind(s)==='gunship';
  c.save();c.translate(s.x*T,s.y*T);c.rotate(s.angle);
  drawShipWater(c,s,T,time,reduced);
  if(battleship)drawBattleshipBody(c,T,BATTLESHIP_LAYOUTS.legacy,mine?'#ecc987':'#86b5b4',3);
  else drawTransportBody(c,T,TRANSPORT_LAYOUTS.legacy,mine?'#ecc987':'#86b5b4',3,s.cargo);
  for(const m of mainMounts(s)){
    c.save();c.translate(0,m.y*T);c.rotate((s[m.key]??s.turret)-s.angle);
    (battleship?drawIowaTurret:drawTripleTurret)(c,T,mainBarrels(s),side=>recoil(s.id+':'+m.id+':'+side,s.ammo),s.ammo==='GAS'?'#b2d48b':s.ammo==='INCENDIARY'?'#ef9f5a':'#bedcdb');
    c.restore();
  }
  for(const m of secondaryMounts(s)){
    c.save();c.translate(m.x*T,(m.y||0)*T);c.rotate(secondaryAngle(s,m));
    if(battleship)drawTwinMount(c,T,side=>recoil(s.id+':'+m.id+':'+side,'NAVAL_APCR'));else drawOpenMount(c,T,recoil(s.id+':'+m.id,'NAVAL_APCR'));
    c.restore();
  }
  const funnels=(battleship?BATTLESHIP_LAYOUTS:TRANSPORT_LAYOUTS).legacy.funnels;
  drawBattleshipFunnels(c,T,funnels);
  drawShipExhaust(c,s,T,time,reduced,funnels);
  c.restore();
  c.save();c.fillStyle='#193934dd';c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';const label=(mine?'YOU / ':'')+shipName(s).toUpperCase()+(s.cargo?' / LOADED':s.occupant&&!mine?' / OCCUPIED':''),w=c.measureText(label).width;c.fillRect(s.x*T-w/2-5,s.y*T+2.4*T,w+10,16/zoom);c.fillStyle='#e5d8ac';c.fillText(label,s.x*T,s.y*T+2.4*T+11/zoom);c.restore();
}
function drawSubmarine(c,s,T,mine,zoom,time,reduced){
 const state=depthState(s),remaining=s.depthRemaining||0;
 const depth=state==='submerged'?1:state==='diving'?1-remaining/DIVE.transition:state==='surfacing'?remaining/DIVE.transition:0;
 c.save();c.translate(s.x*T,s.y*T);c.rotate(s.angle);
 if(depth>0){c.strokeStyle='#9cd9df';c.globalAlpha=.45;c.lineWidth=1.5/zoom;c.setLineDash([4/zoom,5/zoom]);c.beginPath();c.ellipse(0,0,1.05*T,2.55*T,0,0,Math.PI*2);c.stroke();c.setLineDash([]);}
 c.restore();
 c.save();c.translate(s.x*T,s.y*T);c.rotate(s.angle);
 c.globalAlpha=1-depth*.65;
 if(depth<.5)drawShipWater(c,s,T,time,reduced);
 drawSubmarineHull(c,s,T,mine,zoom,time,reduced);
 drawDiveBubbles(c,s,T,time,reduced,2,4);
 c.restore();c.save();c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';const label=(mine?'YOU / ':'')+shipName(s).toUpperCase()+' / '+state.toUpperCase()+(depth>0?' / '+Math.ceil(diveBattery(s))+'s':''),w=c.measureText(label).width;c.fillStyle='#163737dd';c.fillRect(s.x*T-w/2-4,(s.y+2.35)*T,w+8,16/zoom);c.fillStyle='#e5d8ac';c.fillText(label,s.x*T,(s.y+2.35)*T+11/zoom);c.restore();
}

function drawCarrier(c,s,T,mine,zoom,time,reduced,recoil){
 c.save();c.translate(s.x*T,s.y*T);c.rotate(s.angle);
 drawShipWater(c,s,T,time,reduced,3,5);
 drawFordCarrier(c,T,3,5,mine?'#edce89':'#9ac3c0');
 for(const m of SIDE_MOUNTS){c.save();c.translate(m.x*T,0);c.rotate(s[m.key]??m.center);c.fillStyle='#adc0aa';c.fillRect(-.15*T,-.15*T,.3*T,.3*T);c.fillStyle='#dec88e';c.fillRect(-.045*T,-.5*T+recoil(s.id+':'+m.id,'NAVAL_APCR'),.09*T,.4*T);c.restore();}
 if(s.repairing&&!reduced){c.strokeStyle='#a3e7d2';c.lineWidth=1/zoom;for(let i=0;i<3;i++){const a=time*.002+i*2.1,x=Math.cos(a)*T,y=Math.sin(a)*2*T;c.strokeRect(x-.09*T,y-.09*T,.18*T,.18*T);}}
 c.restore();c.save();c.font='bold '+10/zoom+'px monospace';c.textAlign='center';c.fillStyle='#e5dbb2';c.fillText((mine?'YOU / ':'')+'CARRIER / '+Math.floor(s.deckSupplies||0)+' GND',s.x*T,(s.y+3)*T);c.restore();
}
