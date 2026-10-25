// Overhead, client-only heavy-tank art. Gameplay geometry stays in tank.js.
function polygon(c, points, fill, stroke) {
  c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.closePath(); c.fillStyle=fill; c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=.8;c.stroke();}
}

export function drawTankDust(c,{angle,speed,reverse=false,phase=0,terrain,reduced=false}) {
  if(reduced||speed<.12||![1,2].includes(terrain))return;
  const strength=Math.min(1,speed/3),direction=reverse?-1:1;
  c.save();c.rotate(angle);c.fillStyle=terrain===1?'#d5c398':'#a69e75';
  // Ten analytic puffs at most: no accumulating particles or server state.
  for(const side of [-1,1])for(let i=0;i<5;i++){
    const age=((phase*.045+i/5+(side===1?.1:0))%1+1)%1;
    c.globalAlpha=(1-age)*strength*(terrain===1?.26:.14);
    c.beginPath();c.ellipse(side*(13+age*7),direction*(15+age*(12+strength*22)),
      2+age*7,3+age*9,side*.25,0,Math.PI*2);c.fill();
  }
  c.restore();
}

export function drawHeavyTank(c,{angle=0,turret=angle,mine=false,travel=0,turn=0,
  recoil={x:0,y:0,barrel:0},secondaryRecoil=0,weapon='HE',reduced=false}={}) {
  const armor=mine?'#a89970':'#64766a',light=mine?'#d0c393':'#a3b29d',dark=mine?'#6a6850':'#3b5148';
  c.save();c.translate(recoil.x,recoil.y);c.rotate(angle);
  c.fillStyle='#10282255';c.fillRect(-13,-16,31,39);
  for(const side of [-1,1]){
    c.fillStyle='#252e29';c.fillRect(side===-1?-16:10,-18,6,36);
    const offset=reduced?0:((travel+side*turn*13)%4+4)%4;
    c.save();c.beginPath();c.rect(side===-1?-16:10,-18,6,36);c.clip();
    c.strokeStyle='#7d8170';c.lineWidth=1;
    for(let y=-22+offset;y<20;y+=4){c.beginPath();c.moveTo(side===-1?-16:10,y);c.lineTo(side===-1?-10:16,y);c.stroke();}
    c.restore();
  }
  polygon(c,[[-10,-19],[10,-19],[13,-12],[13,16],[8,19],[-8,19],[-13,16],[-13,-12]],armor,light);
  // Sloped glacis, side skirts and the rear engine grille.
  polygon(c,[[-10,-18],[10,-18],[11,-9],[-11,-9]],light,dark);
  c.fillStyle=dark;c.fillRect(-12,-7,3,22);c.fillRect(9,-7,3,22);
  c.fillStyle='#303d34';c.fillRect(-7,9,14,7);
  c.strokeStyle='#9a9b7e';c.lineWidth=.7;
  for(let x=-6;x<=6;x+=2){c.beginPath();c.moveTo(x,10);c.lineTo(x,15);c.stroke();}
  c.fillStyle='#e5dbac';c.fillRect(-10,-17,3,2);c.fillRect(7,-17,3,2);
  c.fillStyle='#a8755b';c.fillRect(-10,16,3,2);c.fillRect(7,16,3,2);
  if(mine){c.strokeStyle='#f0d889';c.lineWidth=1.5;c.beginPath();c.moveTo(-4,-23);c.lineTo(0,-27);c.lineTo(4,-23);c.stroke();}
  c.rotate(turret-angle);
  c.fillStyle='#263a32';c.beginPath();c.arc(0,0,9,0,Math.PI*2);c.fill();
  // Long cannon, recoiling inside a fixed mantlet.
  c.fillStyle=dark;c.fillRect(-2,-29+recoil.barrel,4,24);
  c.fillStyle=light;c.fillRect(-1.5,-27+recoil.barrel,1,18);
  c.fillStyle=weapon==='MAGNETIC'?'#9ed5d8':'#414d40';c.fillRect(-3,-29+recoil.barrel,6,3);
  c.fillStyle=armor;c.fillRect(-3,-18+recoil.barrel,6,3);
  polygon(c,[[-5,-11],[5,-11],[11,-5],[9,8],[5,10],[-7,9],[-11,-3]],armor,light);
  polygon(c,[[-5,-10],[-10,-3],[-8,4],[-3,0]],light);
  polygon(c,[[5,-10],[10,-4],[8,4],[3,0]],dark);
  c.fillStyle=dark;c.fillRect(-3,-12,6,5);
  c.fillStyle='#36483c';c.beginPath();c.arc(-2,3,3.2,0,Math.PI*2);c.fill();
  c.strokeStyle=light;c.lineWidth=.8;c.stroke();
  c.fillStyle=light;c.fillRect(-3,1,2,1);c.fillRect(4,5,3,2);
  c.fillStyle='#283c32';c.fillRect(6,-13+secondaryRecoil,2,13);c.fillRect(5,-1,4,4);
  c.strokeStyle=dark;c.beginPath();c.moveTo(-6,7);c.lineTo(-8,14);c.stroke();
  c.restore();
}
