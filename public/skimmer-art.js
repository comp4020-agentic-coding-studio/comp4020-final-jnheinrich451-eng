import { AA35 } from './weapons.js';
import { AERIAL } from './aerial-enemy.js';
import { airRaycast } from './aa-vehicle.js';
import { raycast } from './raycast.js';
import { isGroundEnemy } from './target-domain.js';

const airShadowOffset = (enemy, tile) => Math.max(0, enemy.height ?? AERIAL.height) * tile * .45;

// Local tile coordinates, forward along -Y. These are decorative mouth mounts,
// not additional collision bodies or separate damaging projectiles.
export const SKIMMER_SPITTERS = [
  { x: -19 / 48, y: 16.5 / 48 },
  { x: 0, y: 28.5 / 48 },
  { x: 19 / 48, y: 16.5 / 48 },
];

function mantaWing(c, side, flex) {
  c.beginPath();c.moveTo(side*5,-19);
  c.bezierCurveTo(side*18,-19,side*36,-34,side*55,-29-flex);
  c.bezierCurveTo(side*45,-16,side*39,-8,side*45,5);
  c.quadraticCurveTo(side*50,13,side*47,20);
  c.quadraticCurveTo(side*37,16,side*32,22);
  c.quadraticCurveTo(side*26,18,side*20,25);
  c.quadraticCurveTo(side*12,22,side*5,17);
  c.closePath();
}

export function drawSkimmer(c, enemy, time, tile, reduced = false, hit = 0) {
  // Keep the hittable body at its authoritative x/y. Height displaces only the
  // shadow, so manual laser aim, AA rounds and impact sparks meet the silhouette.
  const x=enemy.x*tile,y=enemy.y*tile,lift=airShadowOffset(enemy,tile);
  const phase=time*2.4+(Number(enemy.id)||0),flex=reduced?0:Math.sin(phase)*2.8;
  // Presence of the authoritative warning enables a cosmetic pulse. `time` is
  // the render clock, so it must not be compared with saved combat timestamps.
  const charge=enemy.attack?(reduced?.8:.75+.25*Math.sin(time*5)):0;
  const scale=tile/48;
  c.save();c.translate(x,y+lift);c.rotate(enemy.angle||0);c.scale(scale,scale);c.fillStyle='#1020264d';
  for(const side of [-1,1]){mantaWing(c,side,flex);c.fill();}
  c.beginPath();c.ellipse(0,2,14,31,0,0,Math.PI*2);c.fill();
  c.lineCap='round';c.lineWidth=3;c.strokeStyle='#10202636';
  c.beginPath();c.moveTo(-8,22);c.bezierCurveTo(-20,39,-3,45,-12,62);c.moveTo(0,23);c.bezierCurveTo(6,40,-6,52,1,70);c.moveTo(8,22);c.bezierCurveTo(22,37,7,48,21,61);c.stroke();c.restore();

  c.save();c.translate(x,y);c.rotate(enemy.angle||0);c.scale(scale,scale);c.lineJoin='round';c.lineCap='round';
  // Three slender, fixed tentacles: the broad wings carry the motion, not a
  // costly chain of animated tail joints.
  c.strokeStyle=hit?'#e49cb2':'#542947';c.lineWidth=4.5;
  c.beginPath();c.moveTo(-8,18);c.bezierCurveTo(-20,36,-3,45,-12,62);c.moveTo(0,20);c.bezierCurveTo(6,40,-6,52,1,70);c.moveTo(8,18);c.bezierCurveTo(22,37,7,48,21,61);c.stroke();
  c.strokeStyle=hit?'#ffe2c1':'#c66e76';c.lineWidth=1.3;
  c.beginPath();c.moveTo(-8,22);c.bezierCurveTo(-18,37,-4,45,-12,62);c.moveTo(0,24);c.bezierCurveTo(5,40,-5,52,1,70);c.moveTo(8,22);c.bezierCurveTo(20,37,8,48,21,61);c.stroke();

  // Manta membranes: one continuous swept wing per side, with soft scallops
  // instead of feathers, insect lobes or articulated legs.
  for(const side of [-1,1]){
    mantaWing(c,side,flex);c.fillStyle=hit?'#e8a3b0':'#843e56';c.strokeStyle='#3a263e';c.lineWidth=2.3;c.fill();c.stroke();
    c.fillStyle=hit?'#f0c6ad':'#b05a62';
    c.beginPath();c.moveTo(side*10,-15);c.bezierCurveTo(side*23,-18,side*39,-28,side*50,-27-flex);c.quadraticCurveTo(side*34,-13,side*33,2);c.quadraticCurveTo(side*20,-5,side*10,10);c.closePath();c.fill();
    c.strokeStyle='#c99378';c.lineWidth=1.2;
    c.beginPath();c.moveTo(side*8,-13);c.quadraticCurveTo(side*26,-16,side*48,-26-flex);c.moveTo(side*12,-8);c.quadraticCurveTo(side*28,-4,side*42,13);c.moveTo(side*10,1);c.quadraticCurveTo(side*23,8,side*27,17);c.stroke();
    c.strokeStyle='#612d4e';c.lineWidth=.9;
    c.beginPath();c.moveTo(side*29,-18);c.lineTo(side*32,-8);c.lineTo(side*38,-4);c.moveTo(side*30,3);c.lineTo(side*37,2);c.moveTo(side*21,7);c.lineTo(side*18,16);c.stroke();
  }

  // The pointed prow and raised purple carapace keep the heading obvious.
  c.fillStyle=hit?'#dea2ac':'#65344f';c.strokeStyle='#342438';c.lineWidth=2;
  c.beginPath();c.moveTo(0,-42);c.bezierCurveTo(4,-28,7,-23,12,-15);c.bezierCurveTo(18,-3,16,16,8,25);c.quadraticCurveTo(0,31,-8,25);c.bezierCurveTo(-16,16,-18,-3,-12,-15);c.bezierCurveTo(-7,-23,-4,-28,0,-42);c.closePath();c.fill();c.stroke();
  c.strokeStyle=hit?'#ffe3c1':'#c58b6e';c.lineWidth=1.4;c.beginPath();c.moveTo(0,-38);c.lineTo(0,-23);c.moveTo(-12,-6);c.quadraticCurveTo(-15,8,-7,20);c.moveTo(12,-6);c.quadraticCurveTo(15,8,7,20);c.stroke();

  // Underslung sacs peek around the trailing body. The red tubes and branching
  // veins are static; charging changes only their light and color.
  for(const mount of SKIMMER_SPITTERS){
    const sx=mount.x*48,sy=mount.y*48-3.5,side=Math.sign(sx);
    c.strokeStyle='#3b253f';c.lineWidth=5;c.beginPath();c.moveTo(side*6,5);c.quadraticCurveTo(side*14,2,sx,sy-7);c.stroke();
    c.strokeStyle=charge?'#e8b764':'#bd6973';c.lineWidth=2.2;c.stroke();
    c.fillStyle=hit?'#fff0b9':charge>.6?'#edd17b':'#bc9a53';c.strokeStyle='#632d50';c.lineWidth=1.7;
    c.beginPath();c.ellipse(sx,sy-3,6.2,8.8,side*-.15,0,Math.PI*2);c.fill();c.stroke();
    c.strokeStyle='#8f485c';c.lineWidth=.85;c.beginPath();c.moveTo(sx-2,sy-10);c.lineTo(sx+1,sy-5);c.lineTo(sx-1,sy);c.moveTo(sx+1,sy-5);c.lineTo(sx+5,sy-6);c.moveTo(sx-1,sy);c.lineTo(sx-5,sy-2);c.stroke();
    c.fillStyle='#42233b';c.beginPath();c.ellipse(sx,sy+3.5,3.4,2.4,0,0,Math.PI*2);c.fill();
    c.strokeStyle=charge?'#ffe29b':'#d6b367';c.lineWidth=1.3;c.stroke();
    if(charge){c.fillStyle=`rgba(255,222,128,${.2+charge*.6})`;c.beginPath();c.ellipse(sx-1.5,sy-5,1.5,3,0,0,Math.PI*2);c.fill();}
  }

  // Three round, bloodshot eyes remain readable as a triangle at game zoom.
  for(let i=0;i<3;i++){
    const ex=i===0?0:i===1?-8.5:8.5,ey=i===0?-15:-3,r=i===0?5.8:5.2;
    c.fillStyle='#3c233d';c.beginPath();c.arc(ex,ey,r+1.5,0,Math.PI*2);c.fill();
    c.fillStyle=hit?'#fff3dc':'#f1d79e';c.beginPath();c.arc(ex,ey,r,0,Math.PI*2);c.fill();
    c.strokeStyle='#ba4f5f';c.lineWidth=.85;c.beginPath();c.moveTo(ex-r+.5,ey-1);c.lineTo(ex-2.6,ey);c.lineTo(ex-3,ey+2.8);c.moveTo(ex+1,ey-r+.5);c.lineTo(ex+.2,ey-2);c.moveTo(ex+r-.5,ey+2);c.lineTo(ex+2.5,ey+.8);c.stroke();
    c.fillStyle='#b64f61';c.beginPath();c.arc(ex,ey-.5,2.8,0,Math.PI*2);c.fill();
    c.fillStyle='#30223b';c.beginPath();c.arc(ex,ey-.5,1.5,0,Math.PI*2);c.fill();
    c.fillStyle='#fff2ce';c.beginPath();c.arc(ex-.6,ey-1.5,.7,0,Math.PI*2);c.fill();
  }
  c.restore();
}

export function drawAAAim(c, tank, pose, solution, enemies, tile, zoom, world, buildings) {
  if(!solution)return;
  const target=enemies.find(e=>e.id===solution.targetId),air=solution.domain==='air';
  const lift=air?airShadowOffset(target||{},tile):0;
  const color=air?'#a7ecf4':'#dfc488',cross=6/zoom;
  c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.2/zoom;
  if(target){
    const x=target.x*tile,y=target.y*tile;
    c.globalAlpha=.7;c.setLineDash([5/zoom,4/zoom]);c.beginPath();c.arc(x,y,23/zoom,0,Math.PI*2);c.stroke();c.setLineDash([]);
    if(air){c.globalAlpha=.28;c.beginPath();c.moveTo(x,y);c.lineTo(x,y+lift);c.stroke();c.beginPath();c.ellipse(x,y+lift,7/zoom,3/zoom,0,0,Math.PI*2);c.stroke();}
  }
  const x=solution.x*tile,y=solution.y*tile;
  c.globalAlpha=.9;c.beginPath();c.moveTo(x-cross,y);c.lineTo(x+cross,y);c.moveTo(x,y-cross);c.lineTo(x,y+cross);c.stroke();
  c.font=`${10/zoom}px monospace`;c.textAlign='center';c.fillText(air?'AIR / LEAD':'GND',x,y-12/zoom);
  // Small diamond follows the actual barrel bearing, independent of the raw
  // cursor and soft target. It exposes traverse lag instead of hiding it.
  const range=Math.min(AA35.range,Math.hypot(solution.x-tank.x,solution.y-tank.y));
  const dx=Math.sin(pose.turret),dy=-Math.cos(pose.turret);
  const end=air?airRaycast(world,pose,dx,dy,range,enemies):raycast(world,buildings,pose,dx,dy,range,enemies.filter(isGroundEnemy));
  const tx=end.x*tile,ty=end.y*tile;
  c.strokeStyle='#f5f5dc';c.beginPath();c.moveTo(tx,ty-cross);c.lineTo(tx+cross,ty);c.lineTo(tx,ty+cross);c.lineTo(tx-cross,ty);c.closePath();c.stroke();
  c.globalAlpha=.35;c.beginPath();c.moveTo(pose.x*tile+dx*42,pose.y*tile+dy*42);c.lineTo(tx,ty);c.stroke();c.restore();
}

export function drawSkimmerAttack(c,enemy,time,tile){
  const attack=enemy.attack;if(!attack)return;
  const progress=Math.max(0,Math.min(1,(time-attack.at)/Math.max(1,attack.fireAt-attack.at))),radius=(attack.radius||AERIAL.radius)*tile;
  c.save();c.translate(attack.x*tile,attack.y*tile);c.fillStyle='#d9385033';c.strokeStyle='#ff8794';c.lineWidth=2;
  c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill();c.stroke();
  c.lineWidth=4;c.beginPath();c.arc(0,0,radius+4,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);c.stroke();
  c.beginPath();c.moveTo(-8,0);c.lineTo(8,0);c.moveTo(0,-8);c.lineTo(0,8);c.stroke();c.restore();
}

export function drawSkimmerShots(c,shots,time,tile,reduced){
  for(const shot of shots){
    if(time<shot.at)continue;
    const progress=Math.max(0,Math.min(1,(time-shot.at)/Math.max(1,shot.landAt-shot.at)));
    c.save();
    if(progress<1&&!shot.impacted){
      // Three visible outlets converge on ONE saved shot. No extra particles,
      // damage queries or client state; the launch pose never follows the flyer.
      const angle=shot.fromAngle||0,cos=Math.cos(angle),sin=Math.sin(angle);
      const hasPose=Number.isFinite(shot.fromAngle),scale=tile/48;
      for(let i=0;i<(reduced?1:SKIMMER_SPITTERS.length);i++){
        const mount=SKIMMER_SPITTERS[i],mx=hasPose&&!reduced?mount.x*tile:0,my=hasPose&&!reduced?mount.y*tile:0;
        const sx=shot.fromX*tile+mx*cos-my*sin,sy=shot.fromY*tile+mx*sin+my*cos;
        const dx=shot.x*tile-sx,dy=shot.y*tile-sy,x=sx+dx*progress,y=sy+dy*progress;
        if(!reduced){
          const tail=Math.max(0,progress-.13);
          c.lineCap='round';c.strokeStyle='#b0944f99';c.lineWidth=4*scale;
          c.beginPath();c.moveTo(sx+dx*tail,sy+dy*tail);c.lineTo(x,y);c.stroke();
        }
        c.fillStyle='#ecd278';c.strokeStyle='#873d63';c.lineWidth=1.4*scale;
        c.beginPath();c.arc(x,y,(reduced?4.5:3.5)*scale,0,Math.PI*2);c.fill();c.stroke();
        c.fillStyle='#fff1ba';c.beginPath();c.arc(x-scale,y-scale,1.2*scale,0,Math.PI*2);c.fill();
      }
    }else{
      const age=Math.max(0,time-shot.landAt)/AERIAL.impactLife;
      if(age<1){
        const radius=(shot.radius||AERIAL.radius)*tile,spread=reduced?.75:.35+age*.6;
        c.translate(shot.x*tile,shot.y*tile);c.globalAlpha=(1-age)*.65;
        c.fillStyle='#8d415c';c.beginPath();c.ellipse(0,0,radius*.42,radius*.34,0,0,Math.PI*2);c.fill();
        c.strokeStyle='#e4c46a';c.lineWidth=2;c.beginPath();c.arc(0,0,radius*spread,0,Math.PI*2);c.stroke();
        // Fixed six-lobed splash disappears with the accepted impact event. It
        // does not imply a persistent poison field or widen the damage circle.
        c.fillStyle='#d9b95d';
        for(let i=0;i<6;i++){
          const angle=i*Math.PI/3+.25,x=Math.cos(angle)*radius*spread*.65,y=Math.sin(angle)*radius*spread*.65;
          c.beginPath();c.ellipse(x,y,radius*.07,radius*.12,angle,0,Math.PI*2);c.fill();
        }
      }
    }
    c.restore();
  }
}
