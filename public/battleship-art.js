// Iowa-inspired overhead gunship body for legacy (2 x 4) and large (4 x 12) hulls.
// Art only: the slim outline (beam: share of the saved width) stays inside the
// saved hull rectangle; callers draw the turrets at their shared mount positions.

// Starboard deck edges as cubic segments in art units (x: half of the drawn beam,
// y: half-length, bow at -1): a fine concave entry, a parallel body and a rounded
// cruiser stern. Large hulls get the long Iowa bow; legacy turrets need a fuller one.
const LONG_BOW=Object.freeze([
 [[.03,-.88],[.2,-.68],[.42,-.58]],
 [[.684,-.46],[1,-.3],[1,-.06]],
 [[1,.05],[1,.17],[1,.28]],
 [[1,.52],[.62,.83],[.46,.93]],
 [[.348,1],[.16,1],[0,1]]
]);
const SHORT_BOW=Object.freeze([
 [[.04,-.9],[.18,-.76],[.36,-.69]],
 [[.63,-.585],[1,-.42],[1,-.2]],
 [[1,-.03],[1,.13],[1,.3]],
 [[1,.5],[.65,.84],[.5,.93]],
 [[.38,1],[.18,1],[0,1]]
]);
// Tile coordinates around each hull size's own mount layout (see ship-armament.js).
// house: starboard half of the 01 level, carrying the inboard secondary mounts.
export const BATTLESHIP_LAYOUTS=Object.freeze({
 legacy:{width:2,length:4,beam:.8,line:.03,edge:SHORT_BOW,
  house:[[0,.03],[.42,.03],[.42,-.4],[.48,-.46],[1,-.46],[1,.86],[.48,.86],[.42,.8],[.42,.66],[0,.66]],
  conning:{y:.1,rx:.14,ry:.09},tower:[[.2,.05,.3],[.14,.09,.25]],director:{y:.17,w:.055,h:.04,bar:.2},
  yards:[{y:.475,span:.26}],funnels:[{x:0,y:.37,w:.12,h:.11},{x:0,y:.58,w:.11,h:.1}],aftDirector:null,
  anchors:{hawse:[.06,-1.68],wildcat:[.045,-1.55],r:.025},breakwater:null,crane:{y:1.8,boom:1.56,r:.05},bitts:[],boats:[],staff:[-1.88,-1.8]},
 large:{width:4,length:12,beam:.8,line:.045,edge:LONG_BOW,
  house:[[0,-.45],[.8,-.45],[.8,-1],[.92,-1.12],[2,-1.12],[2,2.32],[.75,2.32],[.6,2.46],[0,2.46]],
  conning:{y:-.18,rx:.34,ry:.26},tower:[[.55,-.02,1],[.4,.1,.82]],director:{y:.42,w:.16,h:.12,bar:.58},
  yards:[{y:.92,span:.7},{y:1.63,span:.55}],funnels:[{x:0,y:1.22,w:.3,h:.38},{x:0,y:2,w:.28,h:.32}],aftDirector:{y:2.42,w:.14,h:.09,bar:.38},
  anchors:{hawse:[.15,-4.6],wildcat:[.11,-4.15],r:.08},breakwater:{apex:-3.95,wing:-3.72,w:.5},crane:{y:5.15,boom:4.3,r:.13},
  bitts:[[.8,4.2],[.8,4.5],[.5,5.2]],boats:[{x:.62,y:1.6,len:.36,w:.11}],staff:[-5.6,-5.3]}
});

export function edgePath(c,edge,w,h){
 c.beginPath();c.moveTo(0,-h);
 for(const[a,b,e]of edge)c.bezierCurveTo(a[0]*w,a[1]*h,b[0]*w,b[1]*h,e[0]*w,e[1]*h);
 for(let i=edge.length-1;i>=0;i--){const[a,b]=edge[i],s=i?edge[i-1][2]:[0,-1];c.bezierCurveTo(-b[0]*w,b[1]*h,-a[0]*w,a[1]*h,-s[0]*w,s[1]*h);}
 c.closePath();
}
// The bow knuckle: a faint crease along the flare, from the stem to the shoulder.
function knucklePath(c,edge,w,h){
 for(const side of[-1,1]){c.moveTo(0,-h);for(const[a,b,e]of edge.slice(0,2))c.bezierCurveTo(side*a[0]*w,a[1]*h,side*b[0]*w,b[1]*h,side*e[0]*w,e[1]*h);}
}
const mirrored=points=>[...points,...points.slice().reverse().map(([x,y])=>[-x,y])];

export function drawBattleshipBody(c,T,L,edge,edgeWidth=L.line*T){
 const w=L.width/2*L.beam*T,h=L.length/2*T,line=L.line*T;
 const poly=(points,fill,stroke)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*T,y*T):c.moveTo(x*T,y*T));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}};
 const box=(hw,y0,y1,fill,stroke)=>poly([[-hw,y0],[hw,y0],[hw,y1],[-hw,y1]],fill,stroke);
 c.save();c.lineJoin='round';c.lineCap='round';
 edgePath(c,L.edge,w,h);c.fillStyle='#2b454e';c.fill();c.strokeStyle=edge;c.lineWidth=edgeWidth;c.stroke();
 c.beginPath();knucklePath(c,L.edge,w*.95,h*.98);c.strokeStyle='#c9d6c63d';c.lineWidth=line*.5;c.stroke();
 edgePath(c,L.edge,w*.88,h*.955);c.fillStyle='#a69d82';c.fill();
 c.save();c.clip();
 // Fore-and-aft teak planking, then the 01 level and its secondary galleries.
 c.strokeStyle='#7c7964';c.lineWidth=line*.35;c.beginPath();
 for(let x=-w;x<=w;x+=w/7){c.moveTo(x,-h);c.lineTo(x,h);}c.stroke();
 c.lineWidth=line*.55;poly(mirrored(L.house),'#6f8384','#a9b7a8');
 c.restore();
 // Forecastle: anchor chains to their wildcats, and a breakwater ahead of turret one.
 const a=L.anchors;c.lineWidth=line*.9;c.strokeStyle='#3c3e37';c.setLineDash([line*.9,line*.6]);
 c.beginPath();for(const side of[-1,1]){c.moveTo(side*a.hawse[0]*T,a.hawse[1]*T);c.lineTo(side*a.wildcat[0]*T,a.wildcat[1]*T);}c.stroke();c.setLineDash([]);
 for(const side of[-1,1]){c.beginPath();c.arc(side*a.wildcat[0]*T,a.wildcat[1]*T,a.r*T,0,Math.PI*2);c.fillStyle='#4d5a58';c.fill();}
 if(L.breakwater){const b=L.breakwater;c.beginPath();c.moveTo(-b.w*T,b.wing*T);c.lineTo(0,b.apex*T);c.lineTo(b.w*T,b.wing*T);
  c.strokeStyle='#33474d';c.lineWidth=line*2.2;c.stroke();c.strokeStyle='#cfd3bd';c.lineWidth=line*.9;c.stroke();}
 c.strokeStyle='#d9d5ae';c.lineWidth=line*.6;c.beginPath();c.moveTo(0,L.staff[0]*T);c.lineTo(0,L.staff[1]*T);c.stroke();
 // Fantail aircraft crane, boom stowed forward, and mooring bitts.
 c.fillStyle='#45585c';for(const[x,y]of L.bitts)for(const side of[-1,1]){c.beginPath();c.arc(side*x*T,y*T,line*1.1,0,Math.PI*2);c.fill();}
 const r=L.crane;c.strokeStyle='#596c6f';c.lineWidth=line*1.5;c.beginPath();c.moveTo(0,r.y*T);c.lineTo(0,r.boom*T);c.stroke();
 c.beginPath();c.arc(0,r.y*T,r.r*T,0,Math.PI*2);c.fillStyle='#3f5257';c.fill();c.strokeStyle='#b4bba1';c.lineWidth=line*.5;c.stroke();
 // Island: fire-control tower levels, armored conning tower and rangefinder directors.
 c.lineWidth=line*.5;
 for(const b of L.boats)for(const side of[-1,1]){c.beginPath();c.ellipse(side*b.x*T,b.y*T,b.w*T,b.len*T,0,0,Math.PI*2);c.fillStyle='#c9ccb6';c.fill();c.beginPath();c.ellipse(side*b.x*T,b.y*T,b.w*.55*T,b.len*.75*T,0,0,Math.PI*2);c.fillStyle='#7e8a82';c.fill();}
 const[base,upper]=L.tower;box(base[0],base[1],base[2],'#4f646b','#9eada2');box(upper[0],upper[1],upper[2],'#7d9090');
 c.beginPath();c.ellipse(0,L.conning.y*T,L.conning.rx*T,L.conning.ry*T,0,0,Math.PI*2);c.fillStyle='#2e434a';c.fill();c.strokeStyle='#a2b3a6';c.stroke();
 c.beginPath();c.ellipse(0,L.conning.y*T,L.conning.rx*.55*T,L.conning.ry*.45*T,0,0,Math.PI*2);c.fillStyle='#53686e';c.fill();
 for(const d of[L.director,L.aftDirector].filter(Boolean)){box(d.bar,d.y-d.h*.3,d.y+d.h*.3,'#c9ceb4');box(d.w,d.y-d.h,d.y+d.h,'#3a5058','#c9ceb4');}
 c.strokeStyle='#d9d5ae';c.lineWidth=line*.45;c.beginPath();for(const y of L.yards){c.moveTo(-y.span*T,y.y*T);c.lineTo(y.span*T,y.y*T);}c.stroke();
 c.restore();
 return L.funnels;
}
// Oval Iowa funnels: haze-grey casing, black cap and paired exhaust pipes.
// Drawn above the turrets, as before.
export function drawBattleshipFunnels(c,T,funnels){
 c.save();
 for(const f of funnels){
  const x=f.x*T,y=f.y*T;
  c.beginPath();c.ellipse(x,y,f.w*T,f.h*T,0,0,Math.PI*2);c.fillStyle='#9aa597';c.fill();c.strokeStyle='#283a40';c.lineWidth=f.w*.1*T;c.stroke();
  c.beginPath();c.ellipse(x,y-f.h*.08*T,f.w*.7*T,f.h*.74*T,0,0,Math.PI*2);c.fillStyle='#1b2a2f';c.fill();
  for(const dy of[-.3,.22]){c.beginPath();c.arc(x,y+f.h*dy*T,f.w*.27*T,0,Math.PI*2);c.fillStyle='#3d4b4d';c.fill();c.strokeStyle='#7d8a84';c.lineWidth=f.w*.06*T;c.stroke();}
 }
 c.restore();
}
// Iowa main turret after the author's sketch, in turret units G (barrels toward -y):
// a wide chamfered face, sides tapering aft, rangefinder ears near the rear and
// three tapered barrels in canvas blast bags. Muzzles keep the shared salvo
// geometry (side x 0.13, tips 0.8 forward); recoil slides barrels into the bags.
const TURRET=Object.freeze([[-.2,-.17],[.2,-.17],[.27,-.07],[.17,.33],[-.17,.33],[-.27,-.07]]);
export function drawIowaTurret(c,G,barrels,kick=()=>0,muzzle='#273e44'){
 const poly=(points,fill,stroke)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*G,y*G):c.moveTo(x*G,y*G));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}};
 c.save();c.lineJoin='round';c.lineWidth=.022*G;
 c.beginPath();c.arc(0,0,.32*G,0,Math.PI*2);c.fillStyle='#20363f';c.fill();c.strokeStyle='#abbaa6';c.stroke();
 for(const side of[-1,1])poly([[side*.17,.19],[side*.31,.2],[side*.29,.27],[side*.17,.28]],'#55686a','#c2c9b2');
 poly(TURRET,'#5f7173','#c2c9b2');
 poly(TURRET.map(([x,y])=>[x*.8,y*.78+.03]),'#8f9c95');
 for(const side of[-1,1])poly([[side*.19,-.13],[side*.13,-.13],[side*.13,-.07],[side*.19,-.07]],'#6a7b7b');
 c.fillStyle='#6a7b7b';c.fillRect(-.06*G,.22*G,.12*G,.06*G);
 for(const side of barrels){
  const x=side*.13,k=kick(side);c.beginPath();
  c.moveTo((x-.027)*G,-.8*G+k);c.lineTo((x+.027)*G,-.8*G+k);c.lineTo((x+.04)*G,-.2*G+k);c.lineTo((x-.04)*G,-.2*G+k);c.closePath();
  c.fillStyle='#b4c0b0';c.fill();c.strokeStyle='#4c5e60';c.lineWidth=.012*G;c.stroke();
  c.fillStyle=muzzle;c.fillRect((x-.03)*G,-.8*G+k,.06*G,.05*G);
 }
 // Blast bags cover the gun ports and the recoiling barrel roots.
 for(const side of barrels){
  const x=side*.13;poly([[x-.045,-.25],[x+.045,-.25],[x+.055,-.15],[x-.055,-.15]],'#3f4c48');
  c.strokeStyle='#7b8679';c.lineWidth=.01*G;c.beginPath();for(const y of[-.22,-.185]){c.moveTo((x-.045)*G,y*G);c.lineTo((x+.045)*G,y*G);}c.stroke();
 }
 c.restore();
}
// Iowa 5"/38 twin mount after the author's sketch, in mount units G (barrels -y):
// squared front with a sloped face plate, straight sides closing in a rounded rear
// with an access door, and two barrels through hatched gun-port shields. Muzzles
// keep the shared battery geometry (barrels 0.055 aside, tips 0.43 forward).
export function drawTwinMount(c,G,kick=()=>0){
 const box=(x0,y0,x1,y1,fill)=>{c.fillStyle=fill;c.fillRect(x0*G,y0*G,(x1-x0)*G,(y1-y0)*G);};
 c.save();c.lineJoin='round';c.lineWidth=.016*G;c.strokeStyle='#c2c9b2';
 c.beginPath();c.moveTo(-.12*G,-.14*G);c.lineTo(.12*G,-.14*G);c.lineTo(.13*G,-.13*G);c.lineTo(.13*G,.04*G);
 c.bezierCurveTo(.13*G,.13*G,.07*G,.17*G,0,.17*G);c.bezierCurveTo(-.07*G,.17*G,-.13*G,.13*G,-.13*G,.04*G);c.lineTo(-.13*G,-.13*G);c.closePath();
 c.fillStyle='#7f9089';c.fill();c.stroke();
 box(-.125,-.135,.125,-.08,'#9aa79f');c.beginPath();c.moveTo(-.13*G,-.08*G);c.lineTo(.13*G,-.08*G);c.stroke();
 c.beginPath();c.moveTo(-.035*G,.165*G);c.quadraticCurveTo(0,.12*G,.035*G,.165*G);c.strokeStyle='#4c5e60';c.stroke();
 for(const side of[-1,1]){const x=side*.055,k=kick(side);box(x-.013,-.43+k/G,x+.013,-.1+k/G,'#d8cca1');box(x-.015,-.43+k/G,x+.015,-.41+k/G,'#4c5e60');}
 // Gun-port shields cover the recoiling barrel roots.
 for(const side of[-1,1]){const x=side*.055;box(x-.025,-.15,x+.025,-.05,'#3f4c48');
  c.strokeStyle='#8a958a';c.lineWidth=.008*G;c.beginPath();for(const y of[-.1,-.075]){c.moveTo((x-.018)*G,(y+.012)*G);c.lineTo((x+.018)*G,(y-.012)*G);}c.stroke();}
 c.restore();
}
