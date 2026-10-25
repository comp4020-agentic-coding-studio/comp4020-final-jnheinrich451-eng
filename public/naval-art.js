import {shipDimensions,shipArtScale,navalWeaponScale} from './naval-scale.js';
import {mainMounts,mainBarrels,secondaryMounts,secondaryAngle} from './ship-armament.js';
import {drawShipWater,drawShipExhaust,drawDiveBubbles} from './ship-water-effects.js';
import {depthState,diveBattery,DIVE} from './submarine-depth.js';
import {BATTLESHIP_LAYOUTS,drawBattleshipBody,drawBattleshipFunnels,drawIowaTurret,drawTwinMount} from './battleship-art.js';
import {TRANSPORT_LAYOUTS,drawTransportBody,drawTripleTurret,drawOpenMount} from './transport-art.js';
import {drawFordCarrier} from './carrier-art.js';
import {OHIO_LAYOUTS,drawOhioSubmarine} from './submarine-art.js';

// Large-hull art uses the same saved dimensions and mount positions as navigation.
// All surface effects are analytic and bounded, with no simulation particles.
export function drawCapitalShip(c,s,T,mine,zoom,time,reduced,recoil=()=>0){
 const d=shipDimensions(s),half=d.width/2,bow=-d.length/2,stern=d.length/2,scale=shipArtScale(s),gunScale=navalWeaponScale(s);
 const sub=s.kind==='submarine',carrier=s.kind==='carrier',transport=s.kind==='transport';
 const state=sub?depthState(s):null,remaining=s.depthRemaining||0,depth=state==='submerged'?1:state==='diving'?1-remaining/DIVE.transition:state==='surfacing'?remaining/DIVE.transition:0;
 const polygon=(points,fill,stroke)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*T,y*T):c.moveTo(x*T,y*T));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}};
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x*T,y*T,w*T,h*T);};
 c.save();c.translate(s.x*T,s.y*T);c.rotate(s.angle);
 if(depth<.5)drawShipWater(c,s,T,time,reduced,d.width,d.length);
 c.globalAlpha=1-depth*.65;c.lineWidth=.045*T;
 const edge=mine?'#d9c28c':'#a1c1b7';
 if(sub){
  drawOhioSubmarine(c,s,T,OHIO_LAYOUTS.large,edge,time,reduced);
  drawDiveBubbles(c,s,T,time,reduced,d.width,d.length);
 }else if(carrier)drawFordCarrier(c,T,d.width,d.length,edge);
 else if(transport)drawTransportBody(c,T,TRANSPORT_LAYOUTS.large,edge,undefined,s.cargo);
 else drawBattleshipBody(c,T,BATTLESHIP_LAYOUTS.large,edge);
 if(!sub){
  for(const m of mainMounts(s)){
   c.save();c.translate(0,m.y*scale.y*T);c.rotate((s[m.key]??s.turret??s.angle)-s.angle);
   const G=T*gunScale;
   (transport?drawTripleTurret:drawIowaTurret)(c,G,mainBarrels(s),side=>recoil(s.id+':'+m.id+':'+side,s.ammo));
   c.restore();
  }
  for(const m of secondaryMounts(s)){
   c.save();c.translate(m.x*scale.x*T,(m.y||0)*scale.y*T);c.rotate(secondaryAngle(s,m));const G=T*gunScale;
   if(transport)drawOpenMount(c,G,recoil(s.id+':'+m.id,'NAVAL_APCR'));
   else if(!carrier)drawTwinMount(c,G,side=>recoil(s.id+':'+m.id+':'+side,'NAVAL_APCR'));
   else{c.fillStyle='#334c53';c.strokeStyle='#b4c3aa';c.lineWidth=.025*G;c.beginPath();c.arc(0,0,.19*G,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#92aa9c';c.fillRect(-.13*G,-.17*G,.26*G,.3*G);
    c.fillStyle='#d8cca1';c.fillRect(-.025*G,-.43*G+recoil(s.id+':'+m.id,'NAVAL_APCR'),.05*G,.33*G);}
   c.restore();
  }
  // The nuclear carrier has no funnel or exhaust.
  const funnels=carrier?[]:transport?TRANSPORT_LAYOUTS.large.funnels:BATTLESHIP_LAYOUTS.large.funnels;
  drawBattleshipFunnels(c,T,funnels);
  drawShipExhaust(c,s,T,time,reduced,funnels);
 }
 c.restore();
 c.save();c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';
 const names={gunship:'COASTAL GUNSHIP',transport:'ARMORED TRANSPORT',carrier:'AIRCRAFT CARRIER',submarine:'MISSILE SUBMARINE'};
 const label=(mine?'YOU / ':'')+(names[s.kind]||names.gunship)+(sub?' / '+state.toUpperCase()+(depth>0?' / '+Math.ceil(diveBattery(s))+'s':''):carrier?' / '+Math.floor(s.deckSupplies||0)+' GND':s.cargo?' / LOADED':'');
 const y=(s.y+Math.hypot(d.width,d.length)/2+.5)*T,w=c.measureText(label).width;c.fillStyle='#193934dd';c.fillRect(s.x*T-w/2-4,y,w+8,16/zoom);c.fillStyle='#e5d8ac';c.fillText(label,s.x*T,y+11/zoom);c.restore();
}
