import {terrainHash} from './vesper-world.js';
import {inlandWaterAt} from './terrain-rules.js';

// Small hand-drawn details over Vesper's smooth ground (ground-art.js paints the
// ground, water and ridges). Cached per terrain chunk; adds no simulation entities.
export function drawVesperDetail(c,w,x,y,T,kind){
 const h=terrainHash(x,y),X=x*T,Y=y*T,at=(dx,dy)=>w.terrain[(y+dy)*w.width+x+dx];
 const nearWater=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>at(dx,dy)===0),open=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].every(([dx,dy])=>at(dx,dy)===0);
 c.save();c.translate(X,Y);
 const line=(points,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([a,b],i)=>i?c.lineTo(a*T,b*T):c.moveTo(a*T,b*T));c.stroke();};
 if(kind===0){
  // Sparse, offset ripples well inside the water, clear of the rounded shoreline.
  c.translate(((h>>5)%21-10)/60*T,((h>>9)%21-10)/60*T);
  if(open&&inlandWaterAt(w,x,y)&&h%3===0){line([[.15,.37],[.4,.31],[.65,.38]],'#96c9b644');line([[.4,.7],[.65,.64],[.9,.7]],'#9acdc333');}
  else if(open&&!inlandWaterAt(w,x,y)&&h%4===0)line([[.15,.55],[.35,.48],[.62,.55]],'#9bc0cb22');
 }else if(kind!==3){
  if(nearWater&&kind!==1&&h%3===0){for(let i=0;i<5;i++){const a=.17+i*.12;line([[a,.8],[a-.03,.4-(i%2)*.15]],'#b4b794',1.5);line([[a-.07,.59],[a,.7],[a+.08,.51]],'#314d3e',1);}}
  else if(kind===2&&h%31===0){line([[.18,.7],[.74,.31]],'#344b3e',5);line([[.2,.67],[.73,.29]],'#9a9b77',2.5);line([[.4,.54],[.37,.32]],'#777f5c',2);}
  else if(kind===2&&h%11===0){for(let i=0;i<3;i++){c.fillStyle=i%2?'#a8b987':'#395a45';c.beginPath();c.ellipse((.3+i*.15)*T,(.6-i*.12)*T,.15*T,.11*T,-.4,0,Math.PI*2);c.fill();}}
  else if(h%7===0){for(let i=0;i<5;i++){c.fillStyle='#c3c5a455';c.fillRect(((h>>i*3)%29+8)/48*T,((h>>i*4)%25+12)/48*T,2,2);}}
  if(kind===1)line([[.06,.37],[.3,.31],[.61,.4],[.91,.32]],'#e0d5b433');
 }
 c.restore();
}
