import { AIR_HULL, aircraftHealth, AIR, airbaseGate, parkingPoint, bombPattern, bombError } from './aircraft.js';
import { JET, isAttackJet, aircraftName, strafePoint, strafeError } from './attack-jet.js';
import { POD } from './pod.js';
import { bomberPayload, payloadProfile, bomberDive } from './bomber-payloads.js';

export function drawAirbase(c,b,T,zoom,ghost=false,valid=true){
 c.save();c.translate(b.x*T,b.y*T);c.globalAlpha=ghost?.65:1;
 c.fillStyle='#506460';c.fillRect(0,0,AIR.width*T,AIR.height*T);c.strokeStyle=ghost?(valid?'#f4d18b':'#ef867d'):'#b8bfa7';c.lineWidth=2/zoom;c.strokeRect(0,0,AIR.width*T,AIR.height*T);
 c.fillStyle='#293f45';c.fillRect(.5*T,.5*T,3*T,9*T);c.strokeStyle='#dbd6b4';c.lineWidth=.06*T;c.strokeRect(.7*T,.7*T,2.6*T,8.6*T);
 c.setLineDash([.6*T,.5*T]);c.beginPath();c.moveTo(2*T,T);c.lineTo(2*T,9*T);c.stroke();c.setLineDash([]);
 for(const y of [1,8.4])for(let i=0;i<4;i++){c.fillStyle='#dad5b2';c.fillRect((1+i*.55)*T,y*T,.22*T,.5*T);}
 for(let i=0;i<10;i++){c.fillStyle=i<2?'#f0b86d':'#93daca';c.fillRect(.4*T,(i+.3)*T,.12*T,.15*T);c.fillRect(3.5*T,(i+.3)*T,.12*T,.15*T);}
 c.fillStyle='#233b40';c.fillRect(4*T,T,2*T,3*T);c.fillStyle='#758b8b';c.fillRect(4.1*T,1.1*T,1.8*T,2.8*T);
 c.strokeStyle='#b8c6bb';for(let y=1.3;y<3.8;y+=.35){c.beginPath();c.moveTo(4.1*T,y*T);c.lineTo(5.9*T,y*T);c.stroke();}
 c.fillStyle='#96aa98';c.fillRect(4*T,6*T,2*T,3.5*T);c.fillStyle='#f2d693';c.beginPath();c.arc(5.5*T,8.5*T,.27*T,0,Math.PI*2);c.fill();
 c.font=`bold ${10/zoom}px monospace`;c.fillStyle='#e8dfbd';c.fillText(b.aircraft?.state==='destroyed'?'REPLACEMENT / '+Math.ceil(b.aircraft.remaining)+'s':'AIRBASE / '+(b.aircraft?aircraftName(b.aircraft).toUpperCase():'FREE RUNWAY'),0,-7/zoom);c.restore();
}
export function drawAircraft(c,p,T,zoom,mine,age=0,reduced=false){
 if(!p||['destroyed','vacant'].includes(p.state))return;
 if(p.state==='delivering'){
  const time=POD.duration-p.remaining,fall=Math.max(0,1-time/POD.impact),open=Math.max(0,Math.min(1,(time-POD.unfold)/1.4));
  c.save();c.translate(p.x*T,p.y*T);c.strokeStyle='#edd496';c.lineWidth=1/zoom;c.setLineDash([5/zoom,5/zoom]);c.strokeRect(-2*T,-2*T,4*T,4*T);c.setLineDash([]);
  c.fillStyle='#172b3555';c.beginPath();c.ellipse(0,0,T,T*.5,0,0,Math.PI*2);c.fill();
  if(!reduced)c.translate(fall*5*T,-fall*9*T);
  for(const side of [-1,1]){c.fillStyle='#53676e';c.strokeStyle='#e9c582';c.fillRect((side<0?-1-open:open)*T,-1.5*T,T,3*T);c.strokeRect((side<0?-1-open:open)*T,-1.5*T,T,3*T);}
  c.fillStyle='#efdbab';c.font=`bold ${11/zoom}px monospace`;c.textAlign='center';c.fillText(time<POD.impact?'ORBITAL AIRCRAFT':'CAPSULE OPENING',0,2*T);c.restore();return;
 }
 const airborne=p.state!=='parked',advance=p.state==='flying'?Math.min(age,.1)*p.speed:0,x=p.x+Math.sin(p.angle)*advance,y=p.y-Math.cos(p.angle)*advance;
 const dive=isAttackJet(p)?0:bomberDive(p);
 c.save();c.translate(x*T,y*T);c.rotate(p.angle);
 const shape=()=>{c.beginPath();c.moveTo(0,-1.8*T);c.lineTo(.23*T,-.5*T);c.lineTo((isAttackJet(p)?1.6:2)*T,.8*T);c.lineTo((isAttackJet(p)?1.5:1.9)*T,1.1*T);c.lineTo(.25*T,.7*T);c.lineTo(.2*T,1.4*T);c.lineTo(.7*T,1.75*T);c.lineTo(-.7*T,1.75*T);c.lineTo(-.2*T,1.4*T);c.lineTo(-.25*T,.7*T);c.lineTo((isAttackJet(p)?-1.5:-1.9)*T,1.1*T);c.lineTo((isAttackJet(p)?-1.6:-2)*T,.8*T);c.lineTo(-.23*T,-.5*T);c.closePath();};
 if(airborne){c.save();c.translate((.45-.35*dive)*T,(.6-.45*dive)*T);c.fillStyle='#102c3b55';shape();c.fill();c.restore();}
 // Foreshortened nose and a tightening shadow convey pitch in overhead 2D.
 // No collision altitude, extra server entities or anti-air immunity.
 if(!reduced&&dive>0){c.scale(1-.08*dive,1-.3*dive);c.strokeStyle='#dce9dc66';c.lineWidth=1/zoom;for(const side of [-1,1]){c.beginPath();c.moveTo(side*1.7*T,.7*T);c.quadraticCurveTo(side*1.9*T,1.7*T,side*2*T,(2.3+dive)*T);c.stroke();}}
 c.fillStyle=isAttackJet(p)?'#798d80':mine?'#afbdc3':'#7897a0';c.strokeStyle=mine?'#f4d18b':'#cbe0df';c.lineWidth=1.3/zoom;shape();c.fill();c.stroke();
 if(isAttackJet(p)){c.fillStyle='#243b3d';c.fillRect(-.07*T,-2.05*T,.14*T,.55*T);for(const x of [-.5,.5]){c.fillRect((x-.18)*T,.15*T,.36*T,.9*T);c.fillStyle='#c2ccaf';c.fillRect((x-.12)*T,.2*T,.24*T,.6*T);c.fillStyle='#243b3d';}}
 c.fillStyle='#294a5a';c.beginPath();c.ellipse(0,-.8*T,.13*T,.32*T,0,0,Math.PI*2);c.fill();
 for(const side of [-1,1]){c.fillStyle='#344c56';c.fillRect(side*.58*T-.1*T,.25*T,.2*T,.8*T);if(airborne){c.fillStyle='#e9c38e';c.fillRect(side*.58*T-.065*T,1.05*T,.13*T,.26*T);}}
 c.restore();c.save();c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';c.fillStyle='#e9dfb9';c.fillText((mine?'YOU / ':'')+(isAttackJet(p)?'ATTACK JET':'BOMBER')+' / '+p.state.toUpperCase(),x*T,(y+2.1)*T);c.fillStyle='#273539';c.fillRect((x-1)*T,(y+2.3)*T,2*T,3/zoom);c.fillStyle=aircraftHealth(p)<60?'#ef927e':'#b7dbb1';c.fillRect((x-1)*T,(y+2.3)*T,2*T*aircraftHealth(p)/AIR_HULL.health,3/zoom);c.restore();
}
export function drawBombPrediction(c,world,p,base,T,zoom,obscured=point=>false){
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
