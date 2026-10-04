import { hullHealth, VEHICLE, vehicleKind } from './vehicle.js';
const seen=new Map();
export function drawVehicleState(c,v,T,zoom,now,reduced) {
 const kind=vehicleKind(v),health=hullHealth(v),max=VEHICLE[kind],r=kind==='ship'?2.7:.8;
 let memo=seen.get(v.id);if(!memo||memo.hurt!==(v.hurt||0)){memo={hurt:v.hurt||0,at:memo&&v.hurt>memo.hurt?now:-10000};seen.set(v.id,memo);}
 c.save();c.translate(v.x*T,v.y*T);
 if(v.destroyed){
  c.rotate(v.angle||0);c.fillStyle=kind==='ship'?'#193b42aa':'#262e28cc';c.strokeStyle='#78837c';c.lineWidth=2;
  c.beginPath();c.moveTo(-T*(kind==='ship'?.8:.35),-T*(kind==='ship'?1.6:.4));c.lineTo(T*.6,-T*.35);c.lineTo(T*.45,T*(kind==='ship'?1.6:.4));c.lineTo(-T*.6,T*.3);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#dc956f';c.beginPath();c.moveTo(-T*.3,-T*.3);c.lineTo(T*.3,T*.3);c.moveTo(T*.3,-T*.3);c.lineTo(-T*.3,T*.3);c.stroke();
  if(kind==='ship'){c.strokeStyle='#a5cec655';c.beginPath();c.ellipse(0,0,1.2*T,2.2*T,0,0,Math.PI*2);c.stroke();}
  c.restore();c.save();c.translate(v.x*T,v.y*T);c.fillStyle='#edbd93';c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';c.fillText(kind==='ship'?'SUNK / RECOVERY SIGNAL':'TANK WRECK',0,r*T);c.restore();return;
 }
 const w=(kind==='ship'?70:36)/zoom,y=-r*T;
 c.fillStyle='#172923';c.fillRect(-w/2,y,w,5/zoom);c.fillStyle=health/max>.4?'#a6d9b7':'#f29267';c.fillRect(-w/2,y,w*Math.min(1,health/max),5/zoom);
 const flash=Math.max(0,1-(now-memo.at)/400);
 if(flash){c.strokeStyle=`rgba(255,147,102,${flash})`;c.lineWidth=3/zoom;c.beginPath();c.arc(0,0,T*(kind==='ship'?2.3:.7),0,Math.PI*2);c.stroke();}
 if(health/max<.4){c.fillStyle='#252e32aa';for(let i=0;i<(reduced?1:3);i++){const p=reduced?.5:(now/1700+i/3)%1;c.globalAlpha=(1-p)*.55;c.beginPath();c.arc(T*.25+p*10,-T*.4-p*35,6+p*12,0,Math.PI*2);c.fill();}}
 c.restore();
}
export function drawSwimmer(c,e,time,T,reduced,hit=0) {
 c.save();c.translate(e.x*T,e.y*T);c.rotate(e.angle||0);
 const wave=reduced?0:Math.sin(time*8+e.id)*5;
 c.strokeStyle='#a3dcd277';c.lineWidth=2;c.beginPath();c.ellipse(0,9,23,11,0,0,Math.PI);c.stroke();
 c.fillStyle=hit?'#ffc7ae':e.burnUntil?'#614341':'#ae454e';
 c.beginPath();c.moveTo(0,-22);c.quadraticCurveTo(16,-16,13,7);c.lineTo(18+wave,24);c.lineTo(0,15);c.lineTo(-18-wave,24);c.lineTo(-13,7);c.quadraticCurveTo(-16,-16,0,-22);c.fill();
 c.fillStyle='#df7965';for(const side of [-1,1]){c.beginPath();c.moveTo(side*9,-9);c.lineTo(side*(26+wave),8);c.lineTo(side*8,6);c.fill();}
 c.fillStyle='#ffde9b';c.fillRect(-7,-16,4,5);c.fillRect(3,-16,4,5);c.restore();
}
