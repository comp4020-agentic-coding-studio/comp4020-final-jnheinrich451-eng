import { terrainColor, mountainAt, inlandWaterAt } from './terrain-rules.js';

// Pure overhead decoration. Dunes and mesas are baked with the terrain chunks;
// their drawing never supplies collision or changes the saved terrain masks.
const hash=(x,y)=>{let n=Math.imul(x+331,374761393)^Math.imul(y+197,668265263);n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;};
const TAU=Math.PI*2;
export function drawSiroccoTile(c,w,x,y,T,kind){
 const peak=mountainAt(w,x,y),h=hash(x,y);
 c.save();c.translate(x*T,y*T);c.fillStyle=terrainColor(w,x,y,kind);c.fillRect(0,0,T,T);
 const line=(p,color,width=.025)=>{c.strokeStyle=color;c.lineWidth=width*T;c.beginPath();p.forEach(([a,b],i)=>i?c.lineTo(a*T,b*T):c.moveTo(a*T,b*T));c.stroke();};
 const shape=(p,color)=>{c.fillStyle=color;c.beginPath();p.forEach(([a,b],i)=>i?c.lineTo(a*T,b*T):c.moveTo(a*T,b*T));c.closePath();c.fill();};
 if(peak){
  // Flat mesa tops, dark cliff collars and horizontal strata, not alpine peaks.
  c.beginPath();c.rect(0,0,T,T);c.clip();c.translate(-(x%5)*T,-(y%5)*T);c.scale(5,5);
  shape([[0,.55],[.15,.16],[.47,.07],[.82,.19],[1,.55],[.85,.91],[.4,.99],[.05,.82]],'#633d35');
  shape([[.04,.52],[.19,.19],[.46,.13],[.8,.23],[.92,.52],[.78,.74],[.39,.83],[.11,.72]],peak>1?'#aa6c4c':'#92573f');
  shape([[.14,.47],[.28,.25],[.48,.21],[.74,.3],[.8,.49],[.68,.64],[.36,.68],[.21,.59]],peak===3?'#d6ad7a':'#c38c60');
  line([[.13,.73],[.4,.88],[.8,.79],[.93,.59]],'#d496653b',.018);
  line([[.2,.6],[.37,.73],[.7,.69],[.83,.5]],'#efc08a77',.012);
  line([[.26,.4],[.5,.34],[.72,.42]],'#f0c89477',.008);
 }else if(kind===0&&!inlandWaterAt(w,x,y)){
  // Broad connected slip faces make the naval sand immediately distinct from
  // flat pale construction ground. Global coordinates keep crests continuous.
  c.beginPath();c.rect(0,0,T,T);c.clip();
  for(let band=Math.floor((y-1)/3);band<=Math.ceil((y+2)/3);band++){
   const ridge=[];
   for(let i=0;i<=8;i++){const q=i/8;ridge.push([q,band*3+Math.sin((x+q)*.22+band*.9)*.62-y]);}
   shape([...ridge,...ridge.slice().reverse().map(([a,b])=>[a,b+.44])],'#7f45254d');
   line(ridge,'#f1bd747a',.035);
   line(ridge.map(([a,b])=>[a,b-.09]),'#e0a55a33',.06);
  }
  if(h%5===0)line([[.15,.48],[.36,.43],[.7,.47]],'#f3ca8428',.014);
 }else if(kind===0){
  line([[.1,.34],[.35,.29],[.68,.35],[.86,.3]],'#b3eee066',.025);
  if(h%2===0)line([[.22,.73],[.5,.68],[.78,.72]],'#b4e6ce44',.018);
 }else if(kind===3){
  shape([[.09,.57],[.27,.22],[.6,.16],[.86,.49],[.75,.81],[.32,.88]],'#795843');
  shape([[.16,.5],[.3,.26],[.59,.23],[.75,.44],[.47,.51]],'#c9a77a');
  line([[.29,.65],[.53,.6],[.75,.49]],'#e5c99a66',.035);
 }else if(kind!==4){
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
