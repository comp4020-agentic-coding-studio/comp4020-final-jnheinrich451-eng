import { helicopterPoint, HELI_CANNON, HELI_ROCKET } from './helicopter.js';
export function drawHelipad(c,b,T,zoom,ghost,valid){
 if(b.destroyed&&!ghost){
   c.save();c.translate(b.x*T,b.y*T);c.fillStyle='#302b2b';c.fillRect(0,0,3*T,3*T);c.strokeStyle='#a66759';c.lineWidth=2/zoom;c.strokeRect(.08*T,.08*T,2.84*T,2.84*T);
   c.beginPath();c.moveTo(.4*T,.4*T);c.lineTo(2.6*T,2.6*T);c.moveTo(2.6*T,.4*T);c.lineTo(.4*T,2.6*T);c.stroke();c.fillStyle='#e9a38a';c.textAlign='center';c.font=`bold ${10/zoom}px monospace`;c.fillText('HELIPAD / DESTROYED',1.5*T,-7/zoom);c.restore();return;
 }
 c.save();c.translate(b.x*T,b.y*T);c.globalAlpha=ghost?.65:1;c.fillStyle='#30484b';c.fillRect(0,0,3*T,3*T);
 c.strokeStyle=ghost&&!valid?'#ed826d':'#d7c589';c.lineWidth=2/zoom;c.strokeRect(.08*T,.08*T,2.84*T,2.84*T);
 c.beginPath();c.arc(1.5*T,1.5*T,1.05*T,0,Math.PI*2);c.stroke();c.font=`bold ${1.15*T}px monospace`;c.textAlign='center';c.fillStyle='#c9cfb9';c.fillText('H',1.5*T,1.88*T);
 for(const x of [.15,2.7])for(const y of [.15,2.7]){c.fillStyle='#acd8ba';c.fillRect(x*T,y*T,.15*T,.15*T);}
 c.fillStyle='#efc967';c.beginPath();c.arc(2.5*T,2.5*T,.18*T,0,Math.PI*2);c.fill();c.font=`bold ${10/zoom}px monospace`;c.fillText('HELIPAD',1.5*T,-7/zoom);c.restore();
}
export function drawHelicopter(c,p,T,zoom,mine,reduced){
 const flying=p.state!=='parked',time=typeof performance==='undefined'?0:performance.now()/1000;
 c.save();c.translate(p.x*T,p.y*T);c.rotate(p.angle);
 if(flying){c.save();c.translate(.4*T,.5*T);c.fillStyle='#122a3455';c.beginPath();c.ellipse(0,0,.55*T,T,0,0,Math.PI*2);c.fill();c.restore();}
 c.strokeStyle='#84978c';c.lineWidth=.09*T;for(const x of [-.5,.5]){c.beginPath();c.moveTo(x*T,-.55*T);c.lineTo(x*T,.7*T);c.stroke();}
 c.fillStyle='#657d70';c.strokeStyle=mine?'#f5ce7b':'#bfcec0';c.lineWidth=1.3/zoom;
 c.beginPath();c.moveTo(-.12*T,.3*T);c.lineTo(-.07*T,1.6*T);c.lineTo(.07*T,1.6*T);c.lineTo(.12*T,.3*T);c.fill();c.stroke();
 c.beginPath();c.ellipse(0,-.15*T,.4*T,.8*T,0,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle='#203f4b';c.beginPath();c.ellipse(0,-.55*T,.25*T,.28*T,0,0,Math.PI*2);c.fill();
 for(const x of [-.65,.65]){c.fillStyle='#bdba88';c.fillRect((x-.13)*T,-.2*T,.26*T,.65*T);c.fillStyle='#233c40';for(let j=0;j<3;j++)c.fillRect((x-.07)*T,(-.15+j*.15)*T,.14*T,.06*T);}
 c.save();c.rotate((p.turret??p.angle)-p.angle);c.strokeStyle='#e0be79';c.lineWidth=.1*T;c.beginPath();c.moveTo(0,-.55*T);c.lineTo(0,-1.05*T);c.stroke();c.restore();
 c.save();c.rotate(flying&&!reduced?time*22:Math.PI/4);c.strokeStyle=flying?'#d6dfc580':'#b3bfaa';c.lineWidth=.12*T;c.beginPath();c.moveTo(-1.35*T,0);c.lineTo(1.35*T,0);c.moveTo(0,-1.35*T);c.lineTo(0,1.35*T);c.stroke();c.restore();
 c.strokeStyle='#bdc9b3';c.lineWidth=.06*T;c.beginPath();c.moveTo(-.35*T,1.45*T);c.lineTo(.35*T,1.45*T);c.stroke();c.restore();
 c.save();c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';c.fillStyle='#ead9a3';c.fillText((mine?'YOU / ':'')+'HELICOPTER / '+p.state.toUpperCase(),p.x*T,(p.y+1.9)*T);c.fillStyle='#29423d';c.fillRect((p.x-.8)*T,(p.y+2.1)*T,1.6*T,3/zoom);c.fillStyle='#b5d69f';c.fillRect((p.x-.8)*T,(p.y+2.1)*T,1.6*T*Math.max(0,p.health??180)/180,3/zoom);c.restore();
}
export function drawHelicopterAim(c,world,p,T,zoom){
 if(!p.target)return;c.save();c.lineWidth=1.3/zoom;
 for(const rocket of [false,true]){const q=helicopterPoint(world,p,p.target,rocket),profile=rocket?HELI_ROCKET:HELI_CANNON;c.strokeStyle=rocket?'#f1a16e':'#e9d990';c.setLineDash(rocket?[4/zoom,4/zoom]:[]);c.beginPath();c.arc(q.x*T,q.y*T,profile.radius*T,0,Math.PI*2);c.stroke();}
 c.restore();
}
