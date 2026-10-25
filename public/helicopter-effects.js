import { helicopterPoint, HELI, HELI_CANNON, HELI_ROCKET } from './helicopter.js';
// Cosmetic attitude follows authoritative velocity; no extra physics entities.
export const HELI_TILT=Math.PI*26/180;
export function helicopterTilt(p,reduced=false){
 if(reduced||p.state!=='flying')return {roll:0,pitch:0};
 const vx=p.vx||0,vy=p.vy||0,scale=HELI_TILT/HELI.speed;
 const bound=n=>Math.max(-HELI_TILT,Math.min(HELI_TILT,n));
 return {roll:bound((vx*Math.cos(p.angle)+vy*Math.sin(p.angle))*scale),pitch:bound((vx*Math.sin(p.angle)-vy*Math.cos(p.angle))*scale)};
}
export function drawHelipad(c,b,T,zoom,ghost,valid){
 if(b.destroyed&&!ghost){
   c.save();c.translate(b.x*T,b.y*T);c.fillStyle='#302b2b';c.fillRect(0,0,3*T,3*T);c.strokeStyle='#a66759';c.lineWidth=2/zoom;c.strokeRect(.08*T,.08*T,2.84*T,2.84*T);
   c.beginPath();c.moveTo(.4*T,.4*T);c.lineTo(2.6*T,2.6*T);c.moveTo(2.6*T,.4*T);c.lineTo(.4*T,2.6*T);c.stroke();c.fillStyle='#e9a38a';c.textAlign='center';c.font=`bold ${10/zoom}px monospace`;c.fillText('HELIPAD / DESTROYED',1.5*T,-7/zoom);c.restore();return;
 }
 c.save();c.translate(b.x*T,b.y*T);if(ghost)c.globalAlpha*=.65;c.fillStyle='#30484b';c.fillRect(0,0,3*T,3*T);
 c.strokeStyle=ghost&&!valid?'#ed826d':'#d7c589';c.lineWidth=2/zoom;c.strokeRect(.08*T,.08*T,2.84*T,2.84*T);
 c.beginPath();c.arc(1.5*T,1.5*T,1.05*T,0,Math.PI*2);c.stroke();c.font=`bold ${1.15*T}px monospace`;c.textAlign='center';c.fillStyle='#c9cfb9';c.fillText('H',1.5*T,1.88*T);
 for(const x of [.15,2.7])for(const y of [.15,2.7]){c.fillStyle='#acd8ba';c.fillRect(x*T,y*T,.15*T,.15*T);}
 c.fillStyle='#efc967';c.beginPath();c.arc(2.5*T,2.5*T,.18*T,0,Math.PI*2);c.fill();c.font=`bold ${10/zoom}px monospace`;c.fillText('HELIPAD',1.5*T,-7/zoom);c.restore();
}
export function drawHelicopter(c,p,T,zoom,mine,reduced){
 const flying=p.state!=='parked',time=typeof performance==='undefined'?0:performance.now()/1000;
 if(p.sling)drawSling(c,p,T,zoom,time,reduced);
 c.save();c.translate(p.x*T,p.y*T);c.rotate(p.angle);
 if(flying){c.save();c.translate(.4*T,.5*T);c.fillStyle='#122a3455';c.beginPath();c.ellipse(0,0,.55*T,T,0,0,Math.PI*2);c.fill();c.restore();}
 const {roll,pitch}=helicopterTilt(p,reduced),cr=Math.cos(roll),sr=Math.sin(roll),cp=Math.cos(pitch),sp=Math.sin(pitch);
 // Project a few layered parts into the existing overhead view. Raised parts
 // become slightly larger, so nose-up/down and left/right banks look different
 // instead of merely compressing the same flat sprite in both directions.
 const project=([x,y,z=0])=>{
   const py=y*cp-z*sp,pz=y*sp+z*cp,px=x*cr+pz*sr,height=-x*sr+pz*cr;
   const perspective=1+height*.38;
   return [px*perspective*T,py*perspective*T];
 };
 const shape=(points,fill,stroke=null,width=1.3/zoom)=>{
   c.beginPath();points.forEach((v,i)=>{const q=project(v);if(i)c.lineTo(...q);else c.moveTo(...q);});c.closePath();
   if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
 };
 const line=(points,color,width)=>{c.beginPath();points.forEach((v,i)=>{const q=project(v);if(i)c.lineTo(...q);else c.moveTo(...q);});c.strokeStyle=color;c.lineWidth=width;c.stroke();};
 const rim=mine?'#f5ce7b':'#bfcec0';
 // Heavy-lift silhouette; cosmetic only, including the wheels and ramp seam.
 for(const x of [-.55,.55]){
   shape([[x-.13,-.25,0],[x+.13,-.25,0],[x+.16,.65,0],[x-.16,.65,0]],'#52645d',rim);
   for(const y of [-.3,.58])shape([[x-.08,y,-.2],[x+.08,y,-.2],[x+.08,y+.2,-.2],[x-.08,y+.2,-.2]],'#172c32');
 }
 shape([[-.19,.5,.12],[-.08,1.65,.22],[.08,1.65,.22],[.19,.5,.12]],'#697c72',rim);
 shape([[-.43,1.35,.2],[.43,1.35,.2],[.35,1.51,.2],[-.35,1.51,.2]],'#9ba99a',rim);
 const hull=[[0,-1.05],[-.34,-.85],[-.44,-.4],[-.44,.55],[-.27,.87],[.27,.87],[.44,.55],[.44,-.4],[.34,-.85]];
 // Draw the lowered edge first, then the roof, exposing the raised side wall.
 for(let i=0;i<hull.length;i++){
   const a=hull[i],b=hull[(i+1)%hull.length];
   shape([[...a,-.08],[...b,-.08],[...b,.24],[...a,.24]],i<4?'#334e48':'#8d9f87');
 }
 shape(hull.map(([x,y])=>[x,y,.24]),'#839287',rim);
 for(const side of [-1,1])shape([[side*.035,-.96,.27],[side*.29,-.79,.27],[side*.32,-.51,.27],[side*.035,-.56,.27]],'#203f4b','#b8d0c8',.025*T);
 line([[-.25,.68,.26],[.25,.68,.26]],'#354e4c',.035*T);
 for(const x of [-.32,0,.32]){
   shape([[x-.11,-.32,.3],[x+.11,-.32,.3],[x+.12,.47,.3],[x-.12,.47,.3]],'#536963','#b3bca6',.025*T);
   line([[x-.075,-.25,.32],[x+.075,-.25,.32]],'#172e35',.1*T);
   line([[x-.075,.41,.32],[x+.075,.41,.32]],'#222f33',.12*T);
 }
 for(const x of [-.72,.72]){
   shape([[x-.13,-.2,0],[x+.13,-.2,0],[x+.13,.45,0],[x-.13,.45,0]],'#bdba88','#69765d',.025*T);
   for(let j=0;j<3;j++)line([[x-.07,-.15+j*.15,.02],[x+.07,-.15+j*.15,.02]],'#233c40',.06*T);
 }
 const aim=(p.turret??p.angle)-p.angle;
 line([[Math.sin(aim)*.55,-Math.cos(aim)*.55,.05],[Math.sin(aim)*1.05,-Math.cos(aim)*1.05,.05]],'#e0be79',.1*T);
 const tail=flying&&!reduced?time*32:Math.PI/4;
 for(let i=0;i<4;i++){const a=tail+i*Math.PI/2;line([[0,1.5,.28],[Math.cos(a)*.28,1.5+Math.sin(a)*.28,.28]],'#cad3ba',.045*T);}
 line([[0,0,.24],[0,0,.7]],'#e0d2a0',.09*T);
 const rotor=flying&&!reduced?time*22:Math.PI/4;
 for(let blade=0;blade<7;blade++){
   const a=rotor+blade*Math.PI*2/7,x=Math.cos(a),y=Math.sin(a);
   line([[x*.14,y*.14,.7],[x*1.4,y*1.4,.7]],flying?'#d6dfc580':'#3c514c',.085*T);
   line([[x*1.25,y*1.25,.7],[x*1.4,y*1.4,.7]],'#d7c98c',.085*T);
 }
 const hub=project([0,0,.7]);c.fillStyle='#ebdca9';c.beginPath();c.arc(hub[0],hub[1],.09*T,0,Math.PI*2);c.fill();c.restore();
 c.save();c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';c.fillStyle='#ead9a3';c.fillText((mine?'YOU / ':'')+'HELICOPTER / '+(p.sling?'SLING LOADED':p.state.toUpperCase()),p.x*T,(p.y+1.9)*T);c.fillStyle='#29423d';c.fillRect((p.x-.8)*T,(p.y+2.1)*T,1.6*T,3/zoom);c.fillStyle='#b5d69f';c.fillRect((p.x-.8)*T,(p.y+2.1)*T,1.6*T*Math.max(0,p.health??180)/180,3/zoom);c.restore();
}
function drawSling(c,p,T,zoom,time,reduced){
 const op=p.slingOperation,v=p.sling.vehicle,progress=op?Math.max(0,Math.min(1,1-op.remaining/2)):1;
 const sway=reduced?0:Math.sin(time*2.2)*.07*Math.min(1,(p.speed||0)/2.5);
 const lifted={x:p.x+.75+sway,y:p.y+.85},start=op?.kind==='lift'?v:lifted,end=op?.kind==='lower'?op.point:lifted;
 const q={x:start.x+(end.x-start.x)*progress,y:start.y+(end.y-start.y)*progress};
 c.save();c.translate(q.x*T,q.y*T);c.rotate(p.angle);c.scale(.8,.8);
 c.fillStyle='#182b33';c.fillRect(-.5*T,-.5*T,.17*T,T);c.fillRect(.33*T,-.5*T,.17*T,T);
 c.fillStyle=p.sling.kind==='tank'?'#b9ad80':'#839d9b';c.strokeStyle='#e1d8af';c.lineWidth=1/zoom;c.fillRect(-.34*T,-.48*T,.68*T,.96*T);c.strokeRect(-.34*T,-.48*T,.68*T,.96*T);
 if(p.sling.kind==='tank'){c.fillStyle='#d5c68d';c.fillRect(-.22*T,-.22*T,.44*T,.4*T);c.fillRect(-.055*T,-.77*T,.11*T,.6*T);}
 else{c.fillStyle=v.kind==='builder'?'#d3b26e':'#28454b';c.fillRect(-.24*T,-.32*T,.48*T,.22*T);c.strokeStyle='#c7ded2';c.strokeRect(-.22*T,.02*T,.44*T,.31*T);}
 c.restore();
 c.save();c.strokeStyle='#d2d6c7';c.lineWidth=1.3/zoom;
 for(const side of [-1,1]){c.beginPath();c.moveTo((p.x+Math.cos(p.angle)*side*.33)*T,(p.y+Math.sin(p.angle)*side*.33)*T);c.lineTo((q.x+Math.cos(p.angle)*side*.28)*T,(q.y+Math.sin(p.angle)*side*.28)*T);c.stroke();}c.restore();
}
export function drawHelicopterAim(c,world,p,T,zoom){
 if(!p.target)return;c.save();c.lineWidth=1.3/zoom;
 for(const rocket of [false,true]){const q=helicopterPoint(world,p,p.target,rocket),profile=rocket?HELI_ROCKET:HELI_CANNON;c.strokeStyle=rocket?'#f1a16e':'#e9d990';c.setLineDash(rocket?[4/zoom,4/zoom]:[]);c.beginPath();c.arc(q.x*T,q.y*T,profile.radius*T,0,Math.PI*2);c.stroke();}
 c.restore();
}
