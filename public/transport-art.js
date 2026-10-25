// Armored transport after the USAV Coamo / LCU-2000 and the author's sketch:
// blunt bow ramp, open forward vehicle well, bridge deckhouse, then a stern
// triple turret (Des Moines style) flanked by open shielded side guns.
// Art only: the slim outline (beam: share of the saved width) stays inside the
// saved hull; callers draw the mounts at their shared positions.
import {edgePath} from './battleship-art.js';

// Starboard edge in art units (x: half of the drawn beam, y: half-length, bow -1):
// a squared ramp bow rounding out to a parallel body and a rounded transom.
const LCU_EDGE=Object.freeze([
 [[.12,-1],[.24,-1],[.36,-1]],
 [[.6,-1],[.97,-.8],[1,-.45]],
 [[1,-.1],[1,.25],[1,.6]],
 [[1,.8],[.94,.97],[.74,1]],
 [[.5,1],[.25,1],[0,1]]
]);
// Tile coordinates; y grows toward the stern. well: starboard half of the open
// vehicle well, narrowing forward with the bow; cargo: well centre (pier gate).
export const TRANSPORT_LAYOUTS=Object.freeze({
 legacy:{width:2,length:4,beam:.78,line:.03,ramp:{w:.22,y0:-1.94,y1:-1.74},anchors:{x:.5,y:-1.5,s:.06},
  well:[[.32,-1.5],[.5,-1.16],[.5,-.2]],cargo:-.8,house:[[.48,-.08,.75],[.38,0,.42]],windows:[.02,.09],yards:[{y:.52,span:.3}],
  funnels:[{x:-.2,y:.64,w:.07,h:.08},{x:.2,y:.64,w:.07,h:.08}],bitts:[[.5,1.85]]},
 large:{width:4.5,length:10,beam:.7,line:.045,ramp:{w:.5,y0:-4.85,y1:-4.3},anchors:{x:1.15,y:-3.75,s:.15},
  well:[[.75,-3.75],[1.15,-2.9],[1.15,-.5]],cargo:-2,house:[[1.15,-.2,1.9],[.92,0,1.05]],windows:[.06,.22],yards:[{y:1.25,span:.7}],
  funnels:[{x:-.5,y:1.55,w:.17,h:.2},{x:.5,y:1.55,w:.17,h:.2}],bitts:[[1.15,2.3],[1,4.5]]}
});
export const transportLayout=large=>large?TRANSPORT_LAYOUTS.large:TRANSPORT_LAYOUTS.legacy;

export function drawTransportBody(c,T,L,edge,edgeWidth=L.line*T,cargo=null){
 const w=L.width/2*L.beam*T,h=L.length/2*T,line=L.line*T,k=L.length/10;
 const box=(hw,y0,y1,fill,stroke)=>{c.beginPath();c.rect(-hw*T,y0*T,hw*2*T,(y1-y0)*T);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}};
 const poly=(points,fill,stroke)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*T,y*T):c.moveTo(x*T,y*T));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}};
 c.save();c.lineJoin='round';c.lineCap='round';
 edgePath(c,LCU_EDGE,w,h);c.fillStyle='#2b454e';c.fill();c.strokeStyle=edge;c.lineWidth=edgeWidth;c.stroke();
 edgePath(c,LCU_EDGE,w*.9,h*.97);c.fillStyle='#73847d';c.fill();
 // Bow ramp: hinged plate with treads, lowered onto the beach when landing.
 const r=L.ramp;c.lineWidth=line*.6;box(r.w,r.y0,r.y1,'#7b8d82','#c2c9b2');
 c.strokeStyle='#5a6b66';c.beginPath();for(let i=1;i<4;i++){const y=r.y0+(r.y1-r.y0)*i/4;c.moveTo(-r.w*.85*T,y*T);c.lineTo(r.w*.85*T,y*T);}c.stroke();
 c.strokeStyle='#cbbb83';c.lineWidth=line;c.beginPath();c.moveTo(-r.w*T,r.y1*T);c.lineTo(r.w*T,r.y1*T);c.stroke();
 // Bower anchors stowed on the bow flare.
 const a=L.anchors;c.strokeStyle='#3c3e37';c.lineWidth=line*.9;
 for(const side of[-1,1]){const x=side*a.x*T,y=a.y*T,s=a.s*T;c.beginPath();c.moveTo(x,y-s);c.lineTo(x,y+s);c.moveTo(x-s*.7,y+s*.3);c.quadraticCurveTo(x,y+s*1.4,x+s*.7,y+s*.3);c.stroke();}
 // Open vehicle well with deck ribs, coaming stripes and dashed pier side gates.
 const well=[...L.well,...L.well.slice().reverse().map(([x,y])=>[-x,y])],w0=L.well[0][1],w1=L.well.at(-1)[1],ww=L.well.at(-1)[0];
 c.lineWidth=line*.6;poly(well,'#233e46','#9fb0a3');
 c.save();c.clip();c.strokeStyle='#3d5560';c.beginPath();for(let y=w0+.25*k;y<w1;y+=.5*k){c.moveTo(-ww*T,y*T);c.lineTo(ww*T,y*T);}c.stroke();
 c.strokeStyle='#cbbb83';c.lineWidth=line*1.4;c.beginPath();for(const side of[-1,1]){c.moveTo(side*L.well[0][0]*T,w0*T);for(const[x,y]of L.well)c.lineTo(side*x*T,y*T);}c.stroke();c.restore();
 c.strokeStyle='#e0c77e';c.setLineDash([line,line]);c.lineWidth=line*.8;c.beginPath();
 for(const side of[-1,1]){c.moveTo(side*ww*T,(L.cargo-.6*k)*T);c.lineTo(side*ww*T,(L.cargo+.6*k)*T);}c.stroke();c.setLineDash([]);
 if(cargo){
  const y=L.cargo,tank=cargo.kind==='tank';
  box(.55*k,y-.85*k,y+.85*k,tank?'#b7ac83':'#829d9d');c.fillStyle='#253b40';for(const side of[-1,1])c.fillRect((side*.6-.1)*k*T,(y-.95*k)*T,.2*k*T,1.9*k*T);
  if(tank){box(.3*k,y-.3*k,y+.35*k,'#9c9270');box(.08*k,y-1.45*k,y-.2*k,'#d9caa0');}
 }
 // Bridge deckhouse: base level, wheelhouse with windows and wings, mast and bitts.
 const[base,bridge]=L.house;box(base[0],base[1],base[2],'#5a6d72','#a9b7a8');box(bridge[0],bridge[1],bridge[2],'#8a9c95','#c2c9b2');
 box(bridge[0]*1.3,L.windows[0],L.windows[1]+.03*k,'#8a9c95','#c2c9b2');box(bridge[0]*.9,L.windows[0],L.windows[1],'#2a3d44');
 c.strokeStyle='#d9d5ae';c.lineWidth=line*.45;c.beginPath();for(const y of L.yards){c.moveTo(-y.span*T,y.y*T);c.lineTo(y.span*T,y.y*T);}c.stroke();
 c.fillStyle='#d9d5ae';for(const y of L.yards){c.beginPath();c.arc(0,y.y*T,line*1.4,0,Math.PI*2);c.fill();}
 c.fillStyle='#45585c';for(const[x,y]of L.bitts)for(const side of[-1,1]){c.beginPath();c.arc(side*x*T,y*T,line*1.1,0,Math.PI*2);c.fill();}
 c.restore();
 return L.funnels;
}
// Des Moines style triple turret after the author's sketch, in turret units G:
// a boxy house with a chamfered face, three gun ports and short tapered barrels.
// Muzzles keep the shared salvo geometry (side x 0.13, tips 0.8 forward).
const HOUSE=Object.freeze([[-.16,-.42],[.16,-.42],[.29,-.3],[.25,.28],[-.25,.28],[-.29,-.3]]);
export function drawTripleTurret(c,G,barrels,kick=()=>0,muzzle='#273e44'){
 const poly=(points,fill,stroke)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*G,y*G):c.moveTo(x*G,y*G));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}};
 c.save();c.lineJoin='round';c.lineWidth=.022*G;
 poly(HOUSE,'#5f7173','#c2c9b2');poly(HOUSE.map(([x,y])=>[x*.82,y*.82+.02]),'#8f9c95');
 c.strokeStyle='#4c5e60';c.beginPath();c.moveTo(-.29*G,-.3*G);c.lineTo(.29*G,-.3*G);c.stroke();
 for(const side of barrels){const x=side*.13;c.beginPath();c.moveTo((x-.04)*G,-.3*G);c.lineTo((x-.04)*G,-.35*G);c.arc(x*G,-.35*G,.04*G,Math.PI,0);c.lineTo((x+.04)*G,-.3*G);c.closePath();c.fillStyle='#2e3d40';c.fill();}
 for(const side of barrels){
  const x=side*.13,k=kick(side);c.beginPath();
  c.moveTo((x-.021)*G,-.8*G+k);c.lineTo((x+.021)*G,-.8*G+k);c.lineTo((x+.03)*G,-.38*G+k);c.lineTo((x-.03)*G,-.38*G+k);c.closePath();
  c.fillStyle='#b4c0b0';c.fill();c.strokeStyle='#4c5e60';c.lineWidth=.012*G;c.stroke();
  c.fillStyle=muzzle;c.fillRect((x-.024)*G,-.8*G+k,.048*G,.05*G);
 }
 // Bloomers seal the ports and hide the recoiling barrel roots.
 c.fillStyle='#3f4c48';for(const side of barrels){c.beginPath();c.arc(side*.13*G,-.38*G,.04*G,0,Math.PI*2);c.fill();}
 c.fillStyle='#6a7b7b';c.fillRect(-.07*G,.18*G,.14*G,.06*G);
 for(const side of[-1,1]){c.beginPath();c.arc(side*.15*G,.1*G,.03*G,0,Math.PI*2);c.fill();}
 c.restore();
}
// Open single side gun: a curved front shield with the gun body exposed behind it.
// The muzzle keeps the shared side-gun tip (0.43 forward in mount units).
export function drawOpenMount(c,G,kick=0){
 c.save();c.lineCap='butt';
 c.beginPath();c.arc(0,.03*G,.1*G,0,Math.PI*2);c.fillStyle='#3f4c48';c.fill();
 c.fillStyle='#55625f';c.fillRect(-.05*G,-.06*G,.1*G,.21*G);c.strokeStyle='#a9b7a8';c.lineWidth=.012*G;c.strokeRect(-.05*G,-.06*G,.1*G,.21*G);
 c.beginPath();c.moveTo(-.17*G,.12*G);c.lineTo(-.17*G,-.02*G);c.arc(0,-.02*G,.17*G,Math.PI,0);c.lineTo(.17*G,.12*G);
 c.strokeStyle='#c2c9b2';c.lineWidth=.07*G;c.stroke();c.strokeStyle='#8d9a93';c.lineWidth=.045*G;c.stroke();
 c.fillStyle='#2e3d40';c.fillRect(-.032*G,-.215*G,.064*G,.05*G);
 c.fillStyle='#d8cca1';c.fillRect(-.02*G,-.43*G+kick,.04*G,.38*G);c.fillStyle='#4c5e60';c.fillRect(-.022*G,-.43*G+kick,.044*G,.02*G);
 c.restore();
}
