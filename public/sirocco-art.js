import { inlandWaterAt } from './terrain-rules.js';

// Small hand-drawn details over Sirocco's smooth ground. ground-art.js paints the
// firm ground, the dunes of the sand sea, the oases and the mesas; nothing here
// supplies collision or changes the saved terrain masks.
const hash=(x,y)=>{let n=Math.imul(x+331,374761393)^Math.imul(y+197,668265263);n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;};
const TAU=Math.PI*2;
export function drawSiroccoDetail(c,w,x,y,T,kind){
 const h=hash(x,y),at=(dx,dy)=>w.terrain[(y+dy)*w.width+x+dx];
 c.save();c.translate(x*T,y*T);
 const line=(p,color,width=.025)=>{c.strokeStyle=color;c.lineWidth=width*T;c.beginPath();p.forEach(([a,b],i)=>i?c.lineTo(a*T,b*T):c.moveTo(a*T,b*T));c.stroke();};
 if(kind===0){
  // Oasis ripples stay well inside the water, clear of the rounded shoreline.
  const open=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].every(([dx,dy])=>at(dx,dy)===0);
  c.translate(((h>>5)%21-10)/60*T,((h>>9)%21-10)/60*T);
  if(open&&inlandWaterAt(w,x,y)&&h%3===0){line([[.1,.34],[.35,.29],[.68,.35],[.86,.3]],'#b3eee066',.025);if(h%2===0)line([[.22,.73],[.5,.68],[.78,.72]],'#b4e6ce44',.018);}
 }else if(kind!==3&&kind!==4){
  if(h%4===0)line([[.08,.48],[.32,.38],[.58,.45],[.88,.37]],'#f3dfb244',.018);
  if(kind===2&&h%11===0){
   line([[.12,.75],[.35,.58],[.56,.69],[.83,.57]],'#7b624638',.018);
   line([[.35,.58],[.32,.33],[.49,.19]],'#7b624638',.014);
  }
  if(h%7===0)for(let i=0;i<3;i++){c.fillStyle='#b3906a55';c.beginPath();c.ellipse(((h>>i*3)%29+8)/48*T,((h>>i*4)%25+12)/48*T,.025*T,.017*T,.4,0,TAU);c.fill();}
 }
 c.restore();
}

const palmCache=new WeakMap();
export function siroccoPalms(w){
 if(w.template!=='sirocco-v1'||!w.waterKinds)return[];
 let palms=palmCache.get(w.terrain);if(palms)return palms;
 palms=[];
 for(let y=6;y<w.height-6;y+=3)for(let x=6;x<w.width-6;x+=3){
  const i=y*w.width+x,h=hash(x,y);if(w.terrain[i]!==2||w.mountains?.[i]||h%3!==0)continue;
  let wet=false;
  for(let dy=-6;dy<=6&&!wet;dy++)for(let dx=-6;dx<=6;dx++)if(dx*dx+dy*dy<=36&&w.waterKinds[(y+dy)*w.width+x+dx]===3){wet=true;break;}
  if(wet)palms.push({x:x+.5,y:y+.5,phase:h%628/100,violet:h%5===0});
 }
 palmCache.set(w.terrain,palms);return palms;
}

// Draw after terrain and before gameplay objects. Only visible palms are drawn,
// and their canopy fades near units; it never conceals combatants or adds cover.
// Bounds are in tiles: {x0,y0,x1,y1}. Floors suppress decoration at their roots.
export function drawSiroccoPalms(c,w,T,bounds,occupants=[],floors=new Set()){
 if(w.template!=='sirocco-v1')return;
 for(const p of siroccoPalms(w)){
  if(p.x<bounds.x0-2||p.x>bounds.x1+2||p.y<bounds.y0-2||p.y>bounds.y1+2||floors.has(Math.floor(p.y)*w.width+Math.floor(p.x)))continue;
  const near=occupants.some(o=>Number.isFinite(o.x)&&Number.isFinite(o.y)&&Math.hypot(o.x-p.x,o.y-p.y)<2);
  c.save();c.translate(p.x*T,p.y*T);c.rotate(p.phase);
  c.globalAlpha=near?.14:.24;c.fillStyle='#584b3e';c.beginPath();c.ellipse(.2*T,.25*T,1.04*T,.74*T,.3,0,TAU);c.fill();
  c.globalAlpha=1;c.strokeStyle='#75583d';c.lineWidth=.14*T;c.beginPath();c.moveTo(.13*T,.25*T);c.quadraticCurveTo(-.16*T,.1*T,0,-.12*T);c.stroke();
  c.globalAlpha=near?.27:.8;
  for(let j=0;j<8;j++){
   c.save();c.rotate(j*TAU/8);
   c.fillStyle=p.violet?(j%2?'#7d6d98':'#6c527e'):(j%2?'#497e73':'#376c67');
   c.beginPath();c.moveTo(0,0);c.bezierCurveTo(.3*T,-.37*T,.72*T,-.35*T,1.02*T,-.06*T);c.bezierCurveTo(.78*T,.14*T,.42*T,.2*T,0,0);c.fill();
   c.strokeStyle=p.violet?'#c19ac1':'#96c8a0';c.lineWidth=.018*T;c.beginPath();c.moveTo(.08*T,0);c.quadraticCurveTo(.57*T,-.14*T,.95*T,-.06*T);c.stroke();c.restore();
  }
  c.fillStyle='#dbc78a';c.beginPath();c.arc(0,0,.12*T,0,TAU);c.fill();c.restore();
 }
}
