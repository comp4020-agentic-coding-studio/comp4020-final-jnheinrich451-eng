import {terrainHash} from './vesper-world.js';
import {terrainColor,mountainAt,inlandWaterAt} from './terrain-rules.js';

// Cached per terrain chunk. Detail is deterministic and adds no simulation entities.
export function drawVesperTile(c,w,x,y,T,kind){
 const h=terrainHash(x,y),X=x*T,Y=y*T,peak=mountainAt(w,x,y),nearWater=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>w.terrain[(y+dy)*w.width+x+dx]===0);
 c.save();c.translate(X,Y);c.fillStyle=terrainColor(w,x,y,kind);c.fillRect(0,0,T,T);
 const line=(points,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([a,b],i)=>i?c.lineTo(a*T,b*T):c.moveTo(a*T,b*T));c.stroke();};
 const shape=(points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([a,b],i)=>i?c.lineTo(a*T,b*T):c.moveTo(a*T,b*T));c.closePath();c.fill();};
 if(peak){
  // Interlocking rock faces and contours form a continuous chain at survey scale.
  // Each face spans four tiles, clipped to the actual impassable ridge outline.
  c.beginPath();c.rect(0,0,T,T);c.clip();c.translate(-(x%4)*T,-(y%4)*T);c.scale(4,4);
  shape([[0,1],[.22,.42],[.53,.08],[.8,.5],[1,.72],[1,1]],'#354451');
  shape([[.08,.87],[.22,.42],[.53,.08],[.46,.68]],peak===3?'#d0d6ce':'#879697');
  shape([[.53,.08],[.8,.5],[.94,.88],[.46,.68]],peak===3?'#89999b':'#5f737c');
  line([[.05,.76],[.22,.42],[.53,.08],[.8,.5]],'#e1e0c666',1.2);
  line([[.13,.93],[.36,.76],[.7,.8],[.9,.96]],'#1f344377',1);
  if(peak===3)shape([[.36,.29],[.53,.08],[.65,.28],[.55,.23],[.47,.37],[.44,.25]],'#edf0dd');
 }else if(kind===0){
  if(inlandWaterAt(w,x,y)){line([[.15,.37],[.4,.31],[.65,.38]],'#96c9b644');line([[.4,.7],[.65,.64],[.9,.7]],'#9acdc333');}
  else if(h%3===0)line([[.15,.55],[.35,.48],[.62,.55]],'#9bc0cb22');
 }else{
  // Broad moss/moisture patches are seeded on a coarse grid, with sparse details.
  const patch=terrainHash(x>>2,y>>2)%5;c.fillStyle=['#abc39114','#304d3522','#819b591c','#506c7520','#c1bd8318'][patch];c.fillRect(0,0,T,T);
  if(kind===3){shape([[.1,.6],[.28,.23],[.64,.18],[.86,.62],[.63,.82],[.22,.83]],'#455861');line([[.17,.58],[.36,.35],[.73,.3]],'#a7b5aa');line([[.28,.7],[.53,.55],[.81,.5]],'#8a9c9855');}
  else if(nearWater&&kind!==1&&h%3===0){for(let i=0;i<5;i++){const a=.17+i*.12;line([[a,.8],[a-.03,.4-(i%2)*.15]],'#b4b794',1.5);line([[a-.07,.59],[a,.7],[a+.08,.51]],'#314d3e',1);}}
  else if(kind===2&&h%31===0){line([[.18,.7],[.74,.31]],'#344b3e',5);line([[.2,.67],[.73,.29]],'#9a9b77',2.5);line([[.4,.54],[.37,.32]],'#777f5c',2);}
  else if(kind===2&&h%11===0){for(let i=0;i<3;i++){c.fillStyle=i%2?'#a8b987':'#395a45';c.beginPath();c.ellipse((.3+i*.15)*T,(.6-i*.12)*T,.15*T,.11*T,-.4,0,Math.PI*2);c.fill();}}
  else if(h%7===0){for(let i=0;i<5;i++){c.fillStyle='#c3c5a455';c.fillRect(((h>>i*3)%29+8)/48*T,((h>>i*4)%25+12)/48*T,2,2);}}
  if(kind===1)line([[.06,.37],[.3,.31],[.61,.4],[.91,.32]],'#e0d5b433');
 }
 c.restore();
}
