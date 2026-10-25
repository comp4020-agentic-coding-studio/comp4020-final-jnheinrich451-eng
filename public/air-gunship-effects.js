import {GUNSHIP,GUNSHIP_GUNS,gunshipWeapon,gunshipAim,gunshipFireError} from './air-gunship.js';
function polygon(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
// Four fixed, analytic exhaust plumes: no particle history or simulation work.
function engineExhaust(c,p,T,clock,reduced){
 if(!['takeoff','flying','landing'].includes(p.state))return;
 const power=Math.max(0,Math.min(1,(p.speed||0)/GUNSHIP.maxSpeed));
 c.save();c.scale(T,T);
 for(const [i,x] of [-1.85,-.95,.95,1.85].entries()){
  const pulse=reduced?1:1+.06*Math.sin(clock*23+i*1.7);
  const length=(.24+1.4*power*power)*pulse*(reduced?.65:1),width=.07+.07*power;
  const glow=c.createLinearGradient(x,.28,x,.28+length);
  glow.addColorStop(0,'#e4f7ffdc');glow.addColorStop(.18,'#80cfffaa');
  glow.addColorStop(.6,'#68bde84a');glow.addColorStop(1,'#80cfff00');
  c.fillStyle=glow;c.beginPath();c.moveTo(x-width,.28);
  c.bezierCurveTo(x-width*1.6,.28+length*.35,x-width*.4,.28+length*.8,x,.28+length);
  c.bezierCurveTo(x+width*.4,.28+length*.8,x+width*1.6,.28+length*.35,x+width,.28);
  c.closePath();c.fill();
  c.fillStyle='#fff1ca';polygon(c,[[x-width*.5,.29],[x,.29+length*.28],[x+width*.5,.29]]);c.fill();
 }
 c.restore();
}
export function gunshipShape(c,T){polygon(c,[[0,-2.4],[.25,-2.1],[.35,-.7],[2.5,-.3],[2.5,.25],[.32,.05],[.22,1.65],[1.1,1.9],[1.1,2.2],[.14,2],[0,2.5],[-.14,2],[-1.1,2.2],[-1.1,1.9],[-.22,1.65],[-.32,.05],[-2.5,.25],[-2.5,-.3],[-.35,-.7],[-.25,-2.1]].map(([x,y])=>[x*T,y*T]));}
export function gunshipDetails(c,p,T,zoom,mine,clock,reduced,firing){
 engineExhaust(c,p,T,clock,reduced);
 c.fillStyle='#8b9994';c.strokeStyle=mine?'#efd598':'#c5d1c6';c.lineWidth=1.2/zoom;gunshipShape(c,T);c.fill();c.stroke();
 c.save();c.scale(T,T);c.lineWidth=.025;c.strokeStyle='#425852';
 c.fillStyle='#b2beb1';polygon(c,[[-.14,-2.23],[.14,-2.23],[.27,-.7],[.21,1.6],[0,2.2],[-.21,1.6],[-.27,-.7]]);c.fill();c.stroke();
 c.fillStyle='#244a56';polygon(c,[[-.18,-1.98],[.18,-1.98],[.24,-1.65],[-.24,-1.65]]);c.fill();
 for(const x of [-1.85,-.95,.95,1.85]){
  c.fillStyle='#60766c';c.fillRect(x-.14,-.8,.28,1.1);c.strokeRect(x-.14,-.8,.28,1.1);
  c.fillStyle='#d0d7c2';c.beginPath();c.ellipse(x,-.82,.13,.18,0,0,Math.PI*2);c.fill();
  const spinning=p.state!=='parked';c.save();c.translate(x,-.95);c.scale(1,.24);c.rotate(spinning&&!reduced?clock*(18+p.speed):.4);
  if(spinning&&!reduced){c.fillStyle='#dce8da30';c.beginPath();c.arc(0,0,.46,0,Math.PI*2);c.fill();}
  c.strokeStyle='#dce2cb';c.lineWidth=.06;for(let i=0;i<4;i++){c.rotate(Math.PI/2);c.beginPath();c.moveTo(.06,0);c.lineTo(.44,0);c.stroke();}c.restore();
 }
 for(const [i,y] of [-.6,.25,.85].entries()){
  c.fillStyle='#263c3b';c.fillRect(-.35,y-.1,.25,.2);c.fillStyle='#c6cdb4';c.fillRect(-.7-i*.12,y-.035,.5+i*.12,.07);
 }
 c.strokeStyle='#d8dcc4';c.beginPath();c.moveTo(0,1.1);c.lineTo(0,2.25);c.stroke();
 if(firing>0){const y={'25':-.6,'40':.25,'105':.85}[gunshipWeapon(p)],length=reduced?.18:.45;c.fillStyle='#ffe8a8';polygon(c,[[-.68,y-.09],[-1.05-length,y],[-.68,y+.09]]);c.fill();}
 c.restore();
}
export function drawGunshipAim(c,world,p,T,zoom){
 const target=p.target||gunshipAim(p),profile=GUNSHIP_GUNS[gunshipWeapon(p)],angle=p.angle-Math.PI;
 c.save();c.translate(p.x*T,p.y*T);c.beginPath();c.arc(0,0,GUNSHIP.range*T,angle-GUNSHIP.arc,angle+GUNSHIP.arc);c.arc(0,0,GUNSHIP.minRange*T,angle+GUNSHIP.arc,angle-GUNSHIP.arc,true);c.closePath();c.fillStyle='#d8c37c10';c.fill();c.strokeStyle='#e3cf8b66';c.lineWidth=1/zoom;c.setLineDash([5/zoom,6/zoom]);c.stroke();c.restore();
 c.save();c.strokeStyle=gunshipFireError(world,p,target)?'#df927b':'#f2d589';c.lineWidth=1.5/zoom;c.beginPath();c.arc(target.x*T,target.y*T,profile.radius*T,0,Math.PI*2);c.moveTo((target.x-.6)*T,target.y*T);c.lineTo((target.x+.6)*T,target.y*T);c.moveTo(target.x*T,(target.y-.6)*T);c.lineTo(target.x*T,(target.y+.6)*T);c.stroke();c.font=`bold ${10/zoom}px monospace`;c.fillStyle=c.strokeStyle;c.fillText(profile.label+' / LEFT BATTERY',target.x*T+T,target.y*T);c.restore();
}
