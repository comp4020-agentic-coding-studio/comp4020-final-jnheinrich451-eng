import { runwayPoint, runwaySize } from './runway.js';
// Static, deterministic wreckage: no particles, timers or extra saved entities.
// Coordinates are centred rectangles, matching dock geometry and runway bounds.
export function drawRuinedSlab(c,rect,T,zoom,metal=false){
  c.save();c.translate(rect.x*T,rect.y*T);c.rotate(rect.angle||0);
  const w=rect.w*T,h=rect.h*T;
  c.fillStyle=metal?'#303c3d':'#414440';c.fillRect(-w/2,-h/2,w,h);
  c.strokeStyle='#775c49';c.lineWidth=Math.min(T*.08,2/zoom);c.strokeRect(-w/2+2,-h/2+2,w-4,h-4);
  c.beginPath();c.rect(-w/2,-h/2,w,h);c.clip();
  const cols=Math.ceil(rect.w),rows=Math.ceil(rect.h);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const n=(row*7+col*11+Math.round(rect.x)*3+Math.round(rect.y)*5)%17;
    const x=-w/2+(col+.5)*w/cols+(metal?0:(n%5-2)*.12*T),y=-h/2+(row+.5)*h/rows+(metal?0:(n%7-3)*.09*T);
    c.save();c.translate(x,y);c.rotate(metal?(n%5-2)*.09:n*.7);
    if(metal||n%3===0){c.fillStyle=n%3?'#18292be6':'#252725b8';c.beginPath();c.ellipse(0,0,(metal?.42:.48+n*.023)*T,(metal?.34:.3+n*.014)*T,n,0,Math.PI*2);c.fill();}
    if(metal){
      c.fillStyle=n%2?'#536063':'#626760';c.strokeStyle='#8f8170';c.lineWidth=.025*T;
      c.beginPath();c.moveTo(-.43*T,-.4*T);c.lineTo(.4*T,-.38*T);c.lineTo(.18*T,-.08*T);c.lineTo(-.12*T,.02*T);c.lineTo(-.4*T,.36*T);c.closePath();c.fill();c.stroke();
      c.strokeStyle='#b39870';c.beginPath();c.moveTo(-.32*T,-.3*T);c.lineTo(.16*T,-.28*T);c.stroke();
    }
    c.strokeStyle='#141f22';c.lineWidth=(metal?.055:.025)*T;c.beginPath();c.moveTo(-.48*T,.15*T);c.lineTo(-.12*T,-.08*T);c.lineTo(.08*T,.09*T);c.lineTo(.42*T,-.22*T);c.stroke();
    c.fillStyle='#938777';c.fillRect(.21*T,.21*T,.13*T,.07*T);c.fillStyle='#171f21';c.fillRect(-.3*T,.3*T,.18*T,.09*T);
    c.restore();
  }
  // A bent diagonal girder remains readable even at satellite zoom.
  if(metal){c.strokeStyle='#171f22';c.lineWidth=.16*T;c.beginPath();c.moveTo(-w*.4,h*.28);c.lineTo(-w*.08,-h*.1);c.lineTo(w*.4,-h*.33);c.stroke();c.strokeStyle='#8e8170';c.lineWidth=.045*T;c.stroke();}
  c.restore();
}

// One strip at a time: a double airbase ruins as two runways, as it stood.
export function drawRuinedAirfield(c,b,T,zoom,helipad=false){
  const strip=helipad?{width:3,height:3}:runwaySize({turned:b.turned}),across=helipad?3:6;
  drawRuinedSlab(c,{x:b.x+strip.width/2,y:b.y+strip.height/2,w:strip.width,h:strip.height},T,zoom);
  c.save();c.strokeStyle='#9b7159';c.lineWidth=.12*T;
  // Closed-runway crosses replace the landing lights and healthy markings.
  for(const y of helipad?[1.5]:[2,7.5]){const p=helipad?{x:b.x+1.5,y:b.y+y}:runwayPoint(b,2,y),x=p.x*T,v=p.y*T,r=.65*T;c.beginPath();c.moveTo(x-r,v-r);c.lineTo(x+r,v+r);c.moveTo(x+r,v-r);c.lineTo(x-r,v+r);c.stroke();}
  c.restore();
  if(!helipad)drawRuinedSlab(c,{...runwayPoint(b,5,2.5),w:b.turned?3:2,h:b.turned?2:3},T,zoom,true);
}
