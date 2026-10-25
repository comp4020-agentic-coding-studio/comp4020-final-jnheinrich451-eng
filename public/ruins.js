// Ruins are saved presentation only: no AI, collision, capacity or repair jobs.
export function rememberRuin(world, id, kind, x, y, angle=0) {
  const ruins=world.logistics.ruins ||= [];
  if(!ruins.some(r=>r.id===id))ruins.push({id,kind,x,y,angle});
}

export function drawRuinMarkers(c,world,T,zoom){
  c.save();
  for(const r of world.logistics?.ruins||[]){
    if(r.kind==='tank'&&world.tanks?.some(t=>t.id===r.id))continue;
    c.save();c.translate(r.x*T,r.y*T);c.rotate(r.angle||0);
    if(['tank','recycler','builder','bomber','attack-jet','air-gunship','helicopter'].includes(r.kind))drawVehicleRuin(c,T,r.kind);
    else{c.fillStyle='#303936';c.strokeStyle='#9b7159';c.lineWidth=.06*T;
    c.fillRect(-.45*T,-.35*T,.9*T,.7*T);
    c.beginPath();c.moveTo(-.5*T,-.4*T);c.lineTo(.5*T,.4*T);c.moveTo(.5*T,-.4*T);c.lineTo(-.5*T,.4*T);c.stroke();}c.restore();
    if(zoom>.45){c.font=`${9/zoom}px monospace`;c.textAlign='center';c.fillStyle='#d1ac85';c.fillText(r.kind.toUpperCase()+' RUIN',r.x*T,(r.y+.7)*T);}
  }
  c.restore();
}

// Cracked plating and exposed frame use the same visual language as facilities.
export function drawVehicleRuin(c,T,kind='tank'){
 c.save();c.fillStyle='#18262175';c.beginPath();c.ellipse(0,0,.65*T,.7*T,.3,0,Math.PI*2);c.fill();
 c.fillStyle='#292e2b';c.strokeStyle='#6e7262';c.lineWidth=.025*T;
 for(const [x,y,w,h,a] of [[-.42,-.42,.31,.55,-.1],[.09,-.4,.31,.44,.15],[-.3,.15,.5,.3,-.2]]){
  c.save();c.translate(x*T,y*T);c.rotate(a);c.fillRect(0,0,w*T,h*T);c.strokeRect(0,0,w*T,h*T);c.restore();
 }
 c.strokeStyle='#af8362';c.lineWidth=.035*T;c.beginPath();c.moveTo(-.32*T,-.3*T);c.lineTo(.3*T,.29*T);c.moveTo(.3*T,-.31*T);c.lineTo(-.31*T,.28*T);c.stroke();
 if(kind==='tank'){c.fillStyle='#3e443a';c.fillRect(-.19*T,-.18*T,.38*T,.33*T);c.save();c.rotate(.6);c.fillStyle='#7d7b61';c.fillRect(-.045*T,-.53*T,.09*T,.35*T);c.restore();}
 c.fillStyle='#101c1a';for(const [x,y,r] of [[-.4,.25,.07],[.36,.03,.08],[-.16,-.39,.09],[.14,.42,.06]]){c.beginPath();c.arc(x*T,y*T,r*T,0,Math.PI*2);c.fill();}
 c.restore();
}
