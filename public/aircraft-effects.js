import {isAirGunship} from './air-gunship.js';
import {gunshipShape,gunshipDetails,drawGunshipAim} from './air-gunship-effects.js';
import {fixedWingShape, fixedWingDetails, takeoffDust} from './fixed-wing-art.js';
import { isHelicopter, isHelipad } from './helicopter.js';
import { drawHelipad, drawHelicopter, drawHelicopterAim } from './helicopter-effects.js';
import { AIR_HULL, aircraftHealth, AIR, airbaseGate, parkingPoint, bombPattern, bombError } from './aircraft.js';
import { JET, isAttackJet, aircraftName, strafePoint, strafeError } from './attack-jet.js';
import { ConstructionEffects } from './construction-effects.js';
import { drawRuinedAirfield } from './facility-ruins.js';
let droneArt;
import { POD } from './pod.js';
import { bomberPayload, payloadProfile, bomberDive } from './bomber-payloads.js';

export function drawAirbase(c,b,T,zoom,ghost=false,valid=true){
 if(b.destroyed&&!ghost)return drawRuinedAirfield(c,b,T,zoom,isHelipad(b));
 if(isHelipad(b))return drawHelipad(c,b,T,zoom,ghost,valid);
 c.save();c.translate(b.x*T,b.y*T);if(ghost)c.globalAlpha*=.65;
 c.fillStyle='#506460';c.fillRect(0,0,AIR.width*T,AIR.height*T);c.strokeStyle=ghost?(valid?'#f4d18b':'#ef867d'):'#b8bfa7';c.lineWidth=2/zoom;c.strokeRect(0,0,AIR.width*T,AIR.height*T);
 c.fillStyle='#293f45';c.fillRect(.5*T,.5*T,3*T,9*T);c.strokeStyle='#dbd6b4';c.lineWidth=.06*T;c.strokeRect(.7*T,.7*T,2.6*T,8.6*T);
 c.setLineDash([.6*T,.5*T]);c.beginPath();c.moveTo(2*T,T);c.lineTo(2*T,9*T);c.stroke();c.setLineDash([]);
 for(const y of [1,8.4])for(let i=0;i<4;i++){c.fillStyle='#dad5b2';c.fillRect((1+i*.55)*T,y*T,.22*T,.5*T);}
 for(let i=0;i<10;i++){c.fillStyle=i<2?'#f0b86d':'#93daca';c.fillRect(.4*T,(i+.3)*T,.12*T,.15*T);c.fillRect(3.5*T,(i+.3)*T,.12*T,.15*T);}
 c.fillStyle='#233b40';c.fillRect(4*T,T,2*T,3*T);c.fillStyle='#758b8b';c.fillRect(4.1*T,1.1*T,1.8*T,2.8*T);
 c.strokeStyle='#b8c6bb';for(let y=1.3;y<3.8;y+=.35){c.beginPath();c.moveTo(4.1*T,y*T);c.lineTo(5.9*T,y*T);c.stroke();}
 c.fillStyle='#96aa98';c.fillRect(4*T,6*T,2*T,3.5*T);c.fillStyle='#f2d693';c.beginPath();c.arc(5.5*T,8.5*T,.27*T,0,Math.PI*2);c.fill();
 c.font=`bold ${10/zoom}px monospace`;c.fillStyle='#e8dfbd';c.fillText('AIRBASE / '+(!b.aircraft||['destroyed','vacant'].includes(b.aircraft.state)?'FREE RUNWAY':aircraftName(b.aircraft).toUpperCase()),0,-7/zoom);c.restore();
}
export function drawAircraft(c,p,T,zoom,mine,age=0,reduced=false,firing=0,clock=0){
 if(!p||['destroyed','vacant'].includes(p.state))return;
 if(p.state==='delivering'&&p.deliveryMethod==='factory'){
  const duration=p.assemblyDuration||60,reveal=1-p.remaining/duration;
  drawAircraft(c,{...p,state:'parked'},T,zoom,mine,0,reduced);
  droneArt ||= new ConstructionEffects(T);droneArt.tile=T;droneArt.draw(c,{cores:[]},p,3,{active:true,method:'factory',time:duration-p.remaining,reveal,droneBay:{x:Math.floor(p.x+1),y:Math.floor(p.y+1)}},zoom,reduced);
  c.save();c.fillStyle='#edcd83';c.font=`bold ${11/zoom}px monospace`;c.textAlign='center';c.fillText('ASSEMBLING '+Math.ceil(p.remaining)+'s',p.x*T,(p.y-2)*T);c.restore();return;
 }
 if(p.state==='delivering'){
  const time=POD.duration-p.remaining,fall=Math.max(0,1-time/POD.impact),open=Math.max(0,Math.min(1,(time-POD.unfold)/POD.panelDuration));
  c.save();c.translate(p.x*T,p.y*T);c.strokeStyle='#edd496';c.lineWidth=1/zoom;c.setLineDash([5/zoom,5/zoom]);c.strokeRect(-2*T,-2*T,4*T,4*T);c.setLineDash([]);
  c.fillStyle='#172b3555';c.beginPath();c.ellipse(0,0,T,T*.5,0,0,Math.PI*2);c.fill();
  if(!reduced)c.translate(fall*5*T,-fall*9*T);
  for(const side of [-1,1]){c.fillStyle='#53676e';c.strokeStyle='#e9c582';c.fillRect((side<0?-1-open:open)*T,-1.5*T,T,3*T);c.strokeRect((side<0?-1-open:open)*T,-1.5*T,T,3*T);}
  // Aircraft arrive on an existing runway/deck: folded end caps stay inside
  // that delivery apron rather than laying permanent flooring over the runway.
  for(const side of [-1,1]){const y=side<0?-1.5-.5*open:1.5;c.fillStyle='#687c7c';c.strokeStyle='#e9c582';c.fillRect(-T,y*T,2*T,.5*T*open);c.strokeRect(-T,y*T,2*T,.5*T*open);}
  if(open<1){droneArt ||= new ConstructionEffects(T);c.save();c.globalAlpha=1-open;c.scale(2,3);droneArt.box(c,Math.max(0,time-POD.impact));c.restore();}
  c.fillStyle='#efdbab';c.font=`bold ${11/zoom}px monospace`;c.textAlign='center';c.fillText(time<POD.impact?'ORBITAL AIRCRAFT':'CAPSULE OPENING',0,2*T);c.restore();return;
 }
 if(isHelicopter(p))return drawHelicopter(c,p,T,zoom,mine,reduced);
 const airborne=p.state!=='parked',advance=p.state==='flying'?Math.min(age,.1)*p.speed:0,x=p.x+Math.sin(p.angle)*advance,y=p.y-Math.cos(p.angle)*advance;
 const dive=isAttackJet(p)||isAirGunship(p)?0:bomberDive(p);
 takeoffDust(c,p,T,clock,reduced);
 c.save();c.translate(x*T,y*T);c.rotate(p.angle);
 const shape=()=>isAirGunship(p)?gunshipShape(c,T):fixedWingShape(c,T,isAttackJet(p));
 if(airborne){c.save();c.translate((.45-.35*dive)*T,(.6-.45*dive)*T);c.fillStyle='#102c3b55';shape();c.fill();c.restore();}
 // Foreshortened nose and a tightening shadow convey pitch in overhead 2D.
 // No collision altitude, extra server entities or anti-air immunity.
 if(!reduced&&dive>0){c.scale(1-.08*dive,1-.3*dive);c.strokeStyle='#dce9dc66';c.lineWidth=1/zoom;for(const side of [-1,1]){c.beginPath();c.moveTo(side*1.7*T,.7*T);c.quadraticCurveTo(side*1.9*T,1.7*T,side*2*T,(2.3+dive)*T);c.stroke();}}
 if(airborne&&!reduced){const bank=Math.max(-1,Math.min(1,p.bank||0));c.transform(1-.22*Math.abs(bank),.08*bank,0,1,0,0);}
 if(isAirGunship(p))gunshipDetails(c,p,T,zoom,mine,clock,reduced,firing);else fixedWingDetails(c,p,T,zoom,isAttackJet(p),mine,clock,reduced,firing);
 c.restore();c.save();c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';c.fillStyle='#e9dfb9';c.fillText((mine?'YOU / ':'')+aircraftName(p).toUpperCase()+' / '+p.state.toUpperCase(),x*T,(y+2.1)*T);c.fillStyle='#273539';c.fillRect((x-1)*T,(y+2.3)*T,2*T,3/zoom);c.fillStyle=aircraftHealth(p)<60?'#ef927e':'#b7dbb1';c.fillRect((x-1)*T,(y+2.3)*T,2*T*aircraftHealth(p)/AIR_HULL.health,3/zoom);c.restore();
}
export function drawBombPrediction(c,world,p,base,T,zoom,obscured=point=>false){
 if(isAirGunship(p))return drawGunshipAim(c,world,p,T,zoom);
 if(isHelicopter(p))return drawHelicopterAim(c,world,p,T,zoom);
 if(isAttackJet(p)){
  const target=strafePoint(p);c.save();c.strokeStyle=strafeError(world,p)?'#dc927e':'#f4cf83';c.lineWidth=1.5/zoom;c.setLineDash([6/zoom,5/zoom]);c.beginPath();c.moveTo(p.x*T,p.y*T);c.lineTo(target.x*T,target.y*T);c.stroke();c.setLineDash([]);
  c.beginPath();c.arc(target.x*T,target.y*T,JET.radius*T,0,Math.PI*2);c.moveTo((target.x-1)*T,target.y*T);c.lineTo((target.x+1)*T,target.y*T);c.moveTo(target.x*T,(target.y-1)*T);c.lineTo(target.x*T,(target.y+1)*T);c.stroke();
  c.fillStyle='#f4cf83';c.font=`bold ${10/zoom}px monospace`;c.fillText('HE AUTOCANNON / IMPACT',target.x*T+T,target.y*T);c.restore();return;
 }
 const profile=payloadProfile(bomberPayload(p)),points=bombPattern(p),valid=!bombError(world,p);c.save();c.strokeStyle=valid?profile.color:'#de9a8b';c.fillStyle=valid?profile.color+'17':'#df887b12';c.lineWidth=1.2/zoom;
 for(const b of points){c.beginPath();c.arc(b.x*T,b.y*T,profile.radius*T,0,Math.PI*2);c.fill();c.stroke();}
 c.setLineDash([5/zoom,5/zoom]);c.beginPath();c.moveTo(p.x*T,p.y*T);c.lineTo(points.at(-1).x*T,points.at(-1).y*T);c.stroke();
 const park=parkingPoint(base);if(!obscured(park)){c.strokeStyle='#9bdec799';c.beginPath();c.arc(park.x*T,park.y*T,AIR.landingRange*T,0,Math.PI*2);c.stroke();}c.setLineDash([]);
 c.fillStyle=profile.color;c.font=`bold ${10/zoom}px monospace`;c.fillText(profile.short.toUpperCase()+' / PREDICTED IMPACTS',points[0].x*T,points[0].y*T-profile.radius*T-5/zoom);
 const gate=airbaseGate(base);if(!obscured(gate)){c.fillStyle='#a7ddc8';c.fillText('SLOW APPROACH / AUTO LAND',gate.x*T,gate.y*T);}c.restore();
}
export function drawBombRuns(c,runs,T,elapsed,zoom){
 for(const run of runs)if(run.kind==='bomber')for(const b of run.missiles){const t=(run.age+elapsed-b.launch)/b.flight;if(b.landed||t<0||t>=1)continue;
  const x=b.originX+(b.x-b.originX)*t,y=b.originY+(b.y-b.originY)*t,height=2.5*(1-t*t);
  c.save();c.fillStyle='#17282e55';c.beginPath();c.ellipse(x*T,y*T,.13*T,.08*T,0,0,Math.PI*2);c.fill();
  c.strokeStyle='#edd49b99';c.lineWidth=1/zoom;c.beginPath();c.moveTo(x*T,(y-height)*T);c.lineTo(x*T,(y-height-.4)*T);c.stroke();
  c.translate(x*T,(y-height)*T);c.rotate(Math.atan2(b.y-b.originY,b.x-b.originX)+Math.PI/2);if(run.payload==='HEAVY')c.scale(2.6,2.6);c.fillStyle=payloadProfile(run.payload).color;c.fillRect(-.08*T,-.18*T,.16*T,.36*T);c.fillStyle='#596a60';c.fillRect(-.14*T,.1*T,.28*T,.08*T);c.restore();
 }
}
