import { COLONY_DEPTH, COLONY_HEIGHT, projectColonyPoint } from './colony-view.js';
import { machineCells, machinePorts, industryWorking, industryMotion } from './colony-industry.js';

// These are painted in world coordinates, just like the greenhouse. Only the
// small moving parts are drawn each frame; the white chassis live in the cache.
const TAU=Math.PI*2;
const M={ink:'#52616a',dark:'#44525a',shade:'#bdc8c6',side:'#d2dcd7',white:'#f0f2eb',light:'#fffef2',gold:'#bc9a5c',violet:'#aaa0bc',glass:'#9ec8c6',cyan:'#b6e4df'};
const D=[[0,-1],[1,0],[0,1],[-1,0]];
const pt=(x,y,z=0)=>{const p=projectColonyPoint(x,y,z);return[p.x,p.y];};
const dirOf=item=>((Number(item.dir??item.direction??1)%4)+4)%4;
// Footprint edge in tiles from the top-left tile: outlets and belts are one
// tile, the warehouse three, every other machine two.
const sizeOf=kind=>kind==='outlet'||kind==='belt'?1:kind==='warehouse'?3:2;
const CARDBOARD='#d9bf92',TAPE='#c39a63';
// Fixed mounts shared by the cached chassis and the parts that move over it
// (offsets from a two-tile machine's centre, in tiles).
const PRESS_Y=.20,FAN_Y=-.12,ENGINE_Y=.55,FLY_X=.13,FLY_Z=.82,FLY_R=.19,CRANK=.11,ROD=.34,MOUTH=-.42;
export const INDUSTRY_ART_BOUNDS={processor:[-.18,-.75,2.45,2.6],generator:[-.18,-1.10,2.45,2.95],outlet:[-.26,-.55,1.55,1.6],belt:[-.08,-.16,1.18,1.15],collector:[-.18,-1.05,2.45,2.9],warehouse:[-.22,-.95,3.44,3.65]};
export const isIndustryArt=kind=>Object.hasOwn(INDUSTRY_ART_BOUNDS,kind);
function line(c,points,color=M.ink,width=.025){c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function poly(c,points,fill,stroke=M.ink,width=.022){c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
const line3=(c,p,color,width)=>line(c,p.map(v=>pt(...v)),color,width);
const poly3=(c,p,fill,stroke,width)=>poly(c,p.map(v=>pt(...v)),fill,stroke,width);
/** @param {any} c @param {number} x @param {number} y @param {number} rx @param {number} ry @param {string|null} fill @param {string|null} [stroke] @param {number} [width] */
function ellipse(c,x,y,rx,ry,fill,stroke=null,width=.02){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function box(c,x,y,hx,hy,z,height,fill=M.white,edge=.08){
  const e=Math.min(edge,hx*.4,hy*.4),o=[[-hx+e,-hy],[hx-e,-hy],[hx,-hy+e],[hx,hy-e],[hx-e,hy],[-hx+e,hy],[-hx,hy-e],[-hx,-hy+e]];
  for(let i=0;i<8;i++){const a=o[i],b=o[(i+1)%8];poly3(c,[[x+a[0],y+a[1],z],[x+b[0],y+b[1],z],[x+b[0],y+b[1],z+height],[x+a[0],y+a[1],z+height]],i===4?M.shade:i<4?M.dark:M.side,M.ink,.018);}
  poly3(c,o.map(([dx,dy])=>[x+dx,y+dy,z+height]),fill,M.ink);
  line3(c,[[x-hx+e,y-hy+.025,z+height+.01],[x+hx-e,y-hy+.025,z+height+.01]],M.light,.03);
}
function panel(c,x,y,z,w,h,fill=M.dark){poly3(c,[[x-w/2,y,z],[x+w/2,y,z],[x+w/2,y,z+h],[x-w/2,y,z+h]],fill,M.ink,.017);}
function vent(c,x,y,z,w,h){panel(c,x,y,z,w,h);for(let i=0;i<4;i++)line3(c,[[x-w*.38,y+.01,z+(i+.5)*h/4],[x+w*.38,y+.01,z+(i+.5)*h/4]],M.shade,.023);}
function arrow(c,x,y,dir,size,color,z=0){const[dX,dY]=D[dir],pX=-dY,pY=dX;line3(c,[[x-dX*size,y-dY*size,z],[x+dX*size,y+dY*size,z]],color,.036);line3(c,[[x+dX*size*.25+pX*size*.65,y+dY*size*.25+pY*size*.65,z],[x+dX*size,y+dY*size,z],[x+dX*size*.25-pX*size*.65,y+dY*size*.25-pY*size*.65,z]],color,.036);}
function feet(c,x,y,size){for(const dx of[-size,size])for(const dy of[-size,size])box(c,x+dx,y+dy,.14,.14,.015,.10,M.dark,.05);}
function socket(c,m,port,color){
  const size=sizeOf(m.kind),cx=m.x+size/2,cy=m.y+size/2;
  const dx=Math.max(-1,Math.min(1,port.x+.5-cx)),dy=Math.max(-1,Math.min(1,port.y+.5-cy));
  const ex=Math.abs(port.x+.5-cx)>size/2?cx+Math.sign(dx)*(size/2-.03):port.x+.5;
  const ey=Math.abs(port.y+.5-cy)>size/2?cy+Math.sign(dy)*(size/2-.03):port.y+.5;
  box(c,ex,ey,Math.abs(dx)===1?.075:.23,Math.abs(dy)===1?.075:.23,.10,.15,M.dark,.025);
  const[pX,pY]=pt(ex,ey,.27);ellipse(c,pX,pY,.075,.045,color);
}
function base(c,m){const s=m.kind==='outlet'?1:2,x=m.x+s/2,y=m.y+s/2;ellipse(c,x+.08,(y+.16)*COLONY_DEPTH,s*.49,s*.35,'#52685627');feet(c,x,y,s*.39);box(c,x,y,s*.46,s*.46,.10,.12,M.dark);box(c,x,y,s*.45,s*.45,.22,.22,M.white);}
function processor(c,m){
  const x=m.x+1,y=m.y+1;base(c,m);
  box(c,x,y,.82,.76,.44,.33,M.white,.12);
  // Large glass inspection lid, broad hinges and a packing bench.
  box(c,x-.24,y-.07,.47,.52,.77,.075,M.dark,.08);
  poly3(c,[[x-.67,y-.54,.86],[x+.17,y-.54,.86],[x+.17,y+.39,.86],[x-.67,y+.39,.86]],'#93b8ad',M.ink,.022);
  const[bx,by]=pt(x-.25,y-.06,.88);ellipse(c,bx,by,.34,.34*COLONY_DEPTH,'#d2dfb9','#698b7c',.024);ellipse(c,bx,by,.23,.23*COLONY_DEPTH,'#9db78d');
  for(const dy of[-.48,.34])box(c,x-.73,y+dy,.075,.13,.79,.075,M.white,.025);
  line3(c,[[x-.59,y-.49,.90],[x-.59,y+.30,.90]],'#f3fff099',.035);
  // The bench's conveyor slats travel while the processor works (processorParts),
  // so the cache holds only the bench bed, its rails, the hopper and the press gantry.
  box(c,x+.53,y,.18,.59,.78,.09,M.shade,.05);
  line3(c,[[x+.37,y-.20,.875],[x+.37,y+.56,.875]],M.dark,.03);line3(c,[[x+.69,y-.20,.875],[x+.69,y+.56,.875]],M.dark,.03);
  box(c,x+.53,y-.34,.22,.12,.87,.30,M.white,.04);
  panel(c,x+.53,y-.21,.94,.27,.13,M.violet);
  for(const dx of[-.165,.165])box(c,x+.53+dx,y+PRESS_Y,.03,.035,.87,.55,M.dark,.012);
  box(c,x+.53,y+PRESS_Y,.20,.045,1.37,.06,M.dark,.02);
  line3(c,[[x+.35,y+PRESS_Y+.046,1.40],[x+.71,y+PRESS_Y+.046,1.40]],M.gold,.026);
  vent(c,x-.43,y+.777,.49,.47,.19);panel(c,x+.16,y+.784,.51,.36,.16,M.violet);
  line3(c,[[x-.16,y+.785,.48],[x+.37,y+.785,.48]],M.gold,.035);
  const[lx,ly]=pt(x+.59,y+.785,.60);ellipse(c,lx,ly,.057,.046,M.shade);
  arrow(c,x+.52,y+.34,dirOf(m),.15,M.gold,.91);
}
function generator(c,m){
  const x=m.x+1,y=m.y+1;base(c,m);
  box(c,x,y,.79,.74,.44,.17,M.white,.10);
  const tx=x-.15,ty=y-.11,rx=.46,ry=.44;
  const[bottomX,bottomY]=pt(tx,ty,.67),[topX,topY]=pt(tx,ty,1.66);
  // A translucent culture tank with fixed botanical forms behind the bubbles.
  poly(c,[[bottomX-rx,bottomY],[topX-rx,topY],[topX+rx,topY],[bottomX+rx,bottomY]],'#9dbb91',M.ink,.023);
  ellipse(c,bottomX,bottomY,rx,ry*COLONY_DEPTH,'#a4ba8e',M.ink);
  for(const dx of[-.23,.04,.24]){
    const z=dx<0?1.25:1.42;line3(c,[[tx+dx,ty,.68],[tx+dx+.03,ty,z]],'#6f9472',.037);
    const[px,py]=pt(tx+dx,ty,z);ellipse(c,px-.07,py,.11,.055,'#c6d7a5');ellipse(c,px+.07,py-.10,.095,.05,'#d8deb0');
  }
  ellipse(c,topX,topY,rx,ry*COLONY_DEPTH,'#c9dacf',M.ink,.025);
  ellipse(c,topX,topY-.04,rx*.86,ry*.77*COLONY_DEPTH,M.white,M.ink,.02);
  const[capX,capY]=pt(tx,ty,1.76);ellipse(c,capX,capY,.16,.12,M.violet,M.ink);
  for(const dx of[-.41,.41])line3(c,[[tx+dx,ty,.69],[tx+dx,ty,1.66]],M.white,.055);
  line3(c,[[tx-.29,ty-.04,.85],[tx-.29,ty-.04,1.49]],'#f3ffe2a6',.043);
  box(c,x+.55,y+.03,.18,.44,.60,.46,M.white,.06);
  // Cooling fan shroud on the cabinet roof (its blades turn in generatorParts) and two gold vents.
  const[fx,fy]=pt(x+.55,y+FAN_Y,1.065);ellipse(c,fx,fy,.155,.155*COLONY_DEPTH,M.shade,M.ink,.02);ellipse(c,fx,fy,.125,.125*COLONY_DEPTH,'#3d4a51');
  for(const dy of[.17,.31])line3(c,[[x+.41,y+dy,1.07],[x+.69,y+dy,1.07]],M.gold,.035);
  // The feed engine on the front deck: a horizontal cylinder and the flywheel's
  // bearing post. Piston rod, crank and wheel are drawn per frame.
  box(c,x+MOUTH-.165,y+ENGINE_Y,.165,.08,.61,FLY_Z+.07-.61,M.white,.035);
  for(const dx of[-.28,-.165,-.05])line3(c,[[x+MOUTH+dx,y+ENGINE_Y+.082,.65],[x+MOUTH+dx,y+ENGINE_Y+.082,FLY_Z+.03]],M.shade,.028);
  const[sx,sy]=pt(x+MOUTH,y+ENGINE_Y,FLY_Z);ellipse(c,sx,sy,.032,.05,M.dark,M.ink,.012);
  box(c,x+FLY_X,y+ENGINE_Y-.07,.045,.035,.61,FLY_Z-.61,M.dark,.015);
  vent(c,x-.40,y+.746,.48,.40,.16);panel(c,x+.21,y+.75,.47,.37,.19,M.dark);
  const[ex,ey]=pt(x+.21,y+.76,.565);poly(c,[[ex+.03,ey-.10],[ex-.065,ey+.01],[ex+.005,ey+.01],[ex-.025,ey+.10],[ex+.075,ey-.025],[ex+.005,ey-.025]],'#c8d4a7',null);
  box(c,x-.60,y-.54,.11,.10,.63,.28,M.gold,.03);
}
function outlet(c,m){
  const x=m.x+.5,y=m.y+.5;base(c,m);
  box(c,x,y,.32,.31,.44,.20,M.white,.07);
  box(c,x-.05,y-.04,.23,.21,.64,.08,M.dark,.035);
  poly3(c,[[x-.22,y-.20,.73],[x+.12,y-.20,.73],[x+.12,y+.10,.73],[x-.22,y+.10,.73]],'#9caf8a',null);
  // The arm is drawn with its task phase, separate from this cached chassis.
  box(c,x,y,.10,.10,.64,.15,M.violet,.03);
  vent(c,x-.12,y+.315,.47,.23,.12);panel(c,x+.18,y+.317,.47,.12,.13,M.violet);
  arrow(c,x+.17,y-.15,dirOf(m),.10,M.gold,.69);
}
function collector(c,m){
  const x=m.x+1,y=m.y+1;base(c,m);
  box(c,x,y,.80,.76,.44,.26,M.white,.11);
  // A graphite drum carries the round turntable; the crane arm itself turns
  // every frame (collectorArm), so only its pivot post lives in the cache.
  box(c,x-.12,y-.06,.44,.42,.70,.08,M.dark,.14);
  const[tx,ty]=pt(x-.12,y-.06,.79);ellipse(c,tx,ty,.42,.42*COLONY_DEPTH,M.shade,M.ink,.024);ellipse(c,tx,ty,.33,.33*COLONY_DEPTH,M.white,M.ink,.02);
  for(let i=0;i<8;i++){const a=i*TAU/8,ux=Math.cos(a),uy=Math.sin(a);line3(c,[[x-.12+ux*.34,y-.06+uy*.34,.80],[x-.12+ux*.40,y-.06+uy*.40,.80]],M.gold,.028);}
  box(c,x-.12,y-.06,.10,.10,.79,.12,M.dark,.03);
  // Side cabinet with louvres, a violet readout and the front service strip.
  box(c,x+.56,y+.02,.17,.50,.70,.22,M.white,.05);
  for(let i=0;i<5;i++)line3(c,[[x+.42,y-.36+i*.19,.93],[x+.70,y-.36+i*.19,.93]],M.dark,.035);
  panel(c,x+.56,y+.53,.72,.30,.14,M.violet);
  vent(c,x-.40,y+.777,.49,.42,.17);panel(c,x+.19,y+.784,.51,.34,.14,M.dark);
  line3(c,[[x-.16,y+.785,.48],[x+.37,y+.785,.48]],M.gold,.035);
  const[lx,ly]=pt(x+.59,y+.785,.60);ellipse(c,lx,ly,.057,.046,'#d9b47a',M.ink,.015);
}
// One stored box: a tan cardboard material crate with its tape stripe, or a
// white product box with a violet band on the front and a violet lid label.
function stackBox(c,x,y,z,product){
  const hx=.16,hy=.135,h=.235;
  box(c,x,y,hx,hy,z,h,product?M.white:CARDBOARD,.03);
  if(product){
    line3(c,[[x-hx+.012,y+hy+.006,z+h*.46],[x+hx-.012,y+hy+.006,z+h*.46]],M.violet,.055);
    poly3(c,[[x-.06,y-.075,z+h+.006],[x+.06,y-.075,z+h+.006],[x+.06,y+.025,z+h+.006],[x-.06,y+.025,z+h+.006]],M.violet,null);
  }else{
    line3(c,[[x,y-hy,z+h+.006],[x,y+hy,z+h+.006]],TAPE,.045);
    line3(c,[[x,y+hy+.006,z+h],[x,y+hy+.006,z]],TAPE,.045);
  }
}
// A marked floor yard with its pile: three boxes per row, each row rising one
// box and stepping back a little, so nine boxes fill the yard.
function yard(c,x,y,z,product,count){
  const hw=.52,hd=.50,color=product?M.violet:TAPE;
  poly3(c,[[x-hw,y-hd,z],[x+hw,y-hd,z],[x+hw,y+hd,z],[x-hw,y+hd,z]],product?'#aaa0bc1f':'#c39a6324',color,.028);
  for(const sx of[-1,1])for(const sy of[-1,1])line3(c,[[x+sx*hw,y+sy*(hd-.17),z+.002],[x+sx*hw,y+sy*hd,z+.002],[x+sx*(hw-.17),y+sy*hd,z+.002]],color,.05);
  line3(c,[[x-.16,y-hd+.14,z+.002],[x+.16,y-hd+.14,z+.002]],color,.04);
  const n=Math.max(0,Math.min(9,Math.floor(Number(count)||0)));
  for(let i=0;i<n;i++){const row=Math.floor(i/3),col=i%3;stackBox(c,x+(col-1)*.34+(row%2?.025:-.025),y+.12-row*.08,z+row*.235,product);}
}
// The storehouse: a 3 x 3 floor with a shed roof over the back bay, two low
// side walls, an open loading front toward the camera, the office at the
// front-right corner and two yards (materials left, products right). Like the
// other chassis the front always faces the camera; `dir` paints the lane arrow.
function warehouse(c,m){
  const x=m.x+1.5,y=m.y+1.5,f=.112,stacks=m.stacks||{};
  ellipse(c,x+.10,(y+.18)*COLONY_DEPTH,1.55,1.12,'#52685627');
  box(c,x,y,1.46,1.46,0,.07,M.dark,.10);box(c,x,y,1.42,1.42,.07,.042,'#e4e7df',.10);
  // Centre lane from the loading front to the back bay, with the direction arrow.
  poly3(c,[[x-.22,y-1.30,f],[x+.22,y-1.30,f],[x+.22,y+1.42,f],[x-.22,y+1.42,f]],'#d3d8d0',null);
  for(let i=0;i<5;i++)line3(c,[[x,y-1.15+i*.5,f+.002],[x,y-.88+i*.5,f+.002]],'#f7f6ea',.04);
  arrow(c,x,y+.95,dirOf(m),.15,M.gold,f+.004);
  yard(c,x-.76,y+.25,f+.002,false,stacks.materials);
  yard(c,x+.76,y+.25,f+.002,true,stacks.products);
  // Loading lip with hazard dashes along the open front, stopping at the office.
  line3(c,[[x-1.30,y+1.40,f+.003],[x+.74,y+1.40,f+.003]],M.dark,.07);
  for(let i=0;i<6;i++)line3(c,[[x-1.22+i*.34,y+1.40,f+.005],[x-1.06+i*.34,y+1.40,f+.005]],M.gold,.04);
  // Walls: the back wall sits under the roof, the side walls stop short of the front.
  box(c,x,y-1.36,1.44,.08,f,.85,M.white,.03);
  for(const sx of[-1,1]){
    box(c,x+sx*1.37,y-.45,.07,.90,f,.85,M.white,.03);
    box(c,x+sx*1.37,y-.50,.08,.08,f,.918,M.dark,.03);
    box(c,x+sx*1.37,y+1.32,.08,.08,f,.42,M.dark,.03);
  }
  // Office with a violet window and a white sign carrying the violet band.
  box(c,x+1.12,y+1.08,.30,.28,f,.55,M.white,.05);
  panel(c,x+1.02,y+1.364,f+.16,.26,.24,M.violet);
  line3(c,[[x+.84,y+1.365,f+.50],[x+1.40,y+1.365,f+.50]],M.gold,.03);
  box(c,x+1.12,y+1.26,.32,.05,.662,.16,M.white,.02);
  line3(c,[[x+.86,y+1.316,.742],[x+1.38,y+1.316,.742]],M.violet,.06);
  // Shed roof over the back bay: graphite fascia, white deck, two glass
  // skylights, a centre rib and a gold eave line.
  poly3(c,[[x-1.5,y-.5,.94],[x+1.5,y-.5,.94],[x+1.5,y-.5,1.02],[x-1.5,y-.5,1.02]],M.dark,M.ink,.018);
  poly3(c,[[x-1.5,y-1.52,1.20],[x+1.5,y-1.52,1.20],[x+1.5,y-.5,1.02],[x-1.5,y-.5,1.02]],M.white,M.ink);
  for(const sx of[-1,1])poly3(c,[[x+sx*.35,y-1.35,1.17],[x+sx*1.25,y-1.35,1.17],[x+sx*1.25,y-.65,1.046],[x+sx*.35,y-.65,1.046]],'#9ec8c6b0',M.ink,.018);
  line3(c,[[x,y-1.50,1.206],[x,y-.52,1.026]],M.shade,.04);
  line3(c,[[x-1.45,y-.52,1.03],[x+1.45,y-.52,1.03]],M.gold,.035);
  panel(c,x-1.05,y-.49,.95,.34,.06,M.violet);
}

// A harvest stroke starts once its first snapshot can have arrived (a tick is a
// quarter second), so the arm leaves its watch pose from where it is.
const HARVEST_HOLD=.18;
/** @param {number} phase */
const harvestStroke=phase=>Math.max(0,Math.min(1,(phase-HARVEST_HOLD)/(1-HARVEST_HOLD)));
// Claw opening (0 shut .. 1 wide) through a stroke: open on the way out, shut
// on the crop at full reach, carry it home shut and let go over the hopper.
/** @param {number} p */
const harvestGrip=p=>p<.3?.5+p/.3*.5:p<.48?1-(p-.3)/.18:p<.74?0:p<.86?(p-.74)/.12:1-(p-.86)/.14*.5;
// The harvester's arm. Outside a stroke an enabled outlet with a bed keeps a
// calm watch on the shared room clock (`clock`): it sweeps across the bed,
// dips toward the crop at each end and flexes its claw, with a faint cyan
// sensor spot on the soil. A harvest blends that watch out and back in through
// its own reach, so neither end of the stroke jumps. Returns the stroke.
/** @param {any} c @param {any} m @param {number} [phase] @param {number|null} [clock] */
function outletArm(c,m,phase=0,clock=null){
  const x=m.x+.5,y=m.y+.5,[bx,by]=D[(dirOf(m)+2)%4],p=harvestStroke(phase);
  const h=Math.sin(Math.PI*p)**2,g=Math.sin(Math.PI*p),watch=clock===null?0:(1-Math.cos(clock*TAU/3.2))/2;
  const yaw=(clock===null?0:Math.sin(clock*TAU/6.4)*.34)*(1-h),reach=watch*.18*(1-h)+h;
  const open=(.45+watch*.45)*(1-g)+harvestGrip(p)*g;
  const dx=bx*Math.cos(yaw)-by*Math.sin(yaw),dy=bx*Math.sin(yaw)+by*Math.cos(yaw);
  const elbow=.23+reach*.12,tip=.41+reach*.55,z=1.0+reach*.17,tz=.84-reach*.13,px=x+dx*tip,py=y+dy*tip;
  if(clock!==null&&h<.98){
    const a0=c.globalAlpha,sx=x+dx*1.05,sy=y+dy*1.05,[gx,gy]=pt(sx,sy,.2);
    c.globalAlpha=a0*(1-h)*(.30+watch*.25);line3(c,[[px,py,tz-.1],[sx,sy,.2]],M.cyan,.018);ellipse(c,gx,gy,.13,.13*COLONY_DEPTH,M.cyan);c.globalAlpha=a0;
  }
  line3(c,[[x,y,.68],[x+dx*elbow,y+dy*elbow,z],[px,py,tz]],M.dark,.10);
  line3(c,[[x-.014,y-.01,.70],[x+dx*elbow-.014,y+dy*elbow-.01,z+.02],[px-.014,py-.01,tz+.02]],M.white,.064);
  const[ax,ay]=pt(x+dx*elbow,y+dy*elbow,z+.02);ellipse(c,ax,ay,.075,.06,M.violet,M.ink);
  // Two gold fingers hinge open from the wrist.
  const spread=.025+open*.085;
  for(const side of[-1,1])line3(c,[[px-dy*.03*side,py+dx*.03*side,tz],[px-dy*spread*side+dx*.09,py+dx*spread*side+dy*.09,tz-.11]],M.gold,.034);
  if(m.harvestMotion&&p>.45&&p<.78)cargo(c,m.harvestMotion.crop,px,py,tz-.15,.40);
  return p;
}
// Browser-only drive memory for the processor and generator. Their saved work
// phase moves in quarter-second snapshot steps, and a generator topping off a
// full reserve stalls between them, so these parts integrate their own speed:
// `work` eases toward 1 while the machine works and 0 otherwise, `creep` toward
// 1 while it is enabled. Both follow the room clock, so starts and stops spin
// up and down without a jump and a paused room holds them. Keyed by machine
// id; nothing here is saved or sent. Reduced motion bypasses it (all zero).
const drives=new Map(),STILL=Object.freeze({work:0,creep:0,workSpeed:0});
/** @param {any} m @param {number} time @param {boolean} working @param {boolean} live @param {boolean} reduced */
function driveOf(m,time,working,live,reduced){
  if(reduced)return STILL;
  const t=Number(time)||0,id=String(m.id);let d=drives.get(id);
  if(!d){const seed=[...id].reduce((h,ch)=>(h*31+ch.charCodeAt(0))%997,7)/997*8;d={time:t,work:seed,creep:seed,workSpeed:working?1:0,creepSpeed:live?1:0};drives.set(id,d);}
  const dt=Math.max(0,Math.min(.1,t-d.time)),k=1-Math.exp(-dt*3);d.time=t;
  d.workSpeed+=((working?1:0)-d.workSpeed)*k;d.creepSpeed+=((live?1:0)-d.creepSpeed)*k;
  d.work+=d.workSpeed*dt;d.creep+=d.creepSpeed*dt;
  return d;
}
// Food processor: slats run toward the bench front, the mixer turns in its
// bowl and the press stamps the packing line while it works. A waiting
// processor's mixer only creeps; slats and press rest.
/** @param {any} c @param {any} m @param {number} x @param {number} y @param {boolean} working @param {number} time @param {boolean} reduced @param {boolean} live */
function processorParts(c,m,x,y,working,time,reduced,live){
  const d=driveOf(m,time,working,live,reduced),a0=c.globalAlpha,run=4*.366*d.work;
  for(let i=0;i<4;i++){
    const u=(i+run)%4,sy=y-.20+u*.19;
    c.globalAlpha=a0*Math.max(0,Math.min(1,u/.3,(4-u)/.3));
    line3(c,[[x+.39,sy,.885],[x+.67,sy,.885]],M.dark,.042);line3(c,[[x+.39,sy-.024,.89],[x+.67,sy-.024,.89]],M.light,.016);
  }
  c.globalAlpha=a0;arrow(c,x+.52,y+.34,dirOf(m),.15,M.gold,.91);
  const mx=x-.25,my=y-.06,z=.91,a=TAU*(.73*d.work+.07*d.creep);
  for(let i=0;i<3;i++){const angle=a+i*TAU/3,end=[mx+Math.cos(angle)*.25,my+Math.sin(angle)*.25,z];line3(c,[[mx,my,z],end],M.ink,.085);line3(c,[[mx,my,z],end],M.white,.052);}
  const[hx,hy]=pt(mx,my,z+.01);ellipse(c,hx,hy,.075,.055,M.gold,M.ink);
  const load=Object.entries(m.output||{}).find(([,n])=>n>0);
  if(load)cargo(c,load[0],x+.53,y+.21,.91,.8);
  else if(m.job)cargo(c,'provisions',x+.53,y-.13+(reduced?.35:Math.min(1,(m.job.elapsed||0)/(m.job.seconds||12)))*.55,.91,.7);
  // The press stamps about once a second; its stroke grows and shrinks with
  // the drive's speed, so it rises home when a batch finishes.
  const zb=1.30-Math.sin(Math.PI*((1.1*d.work)%1))**2*d.workSpeed*.27,py=y+PRESS_Y;
  line3(c,[[x+.53,py,1.37],[x+.53,py,zb+.08]],M.ink,.07);line3(c,[[x+.522,py,1.37],[x+.522,py,zb+.08]],M.light,.03);
  box(c,x+.53,py,.125,.075,zb,.08,M.dark,.03);poly3(c,[[x+.43,py-.05,zb+.082],[x+.63,py-.05,zb+.082],[x+.63,py+.05,zb+.082],[x+.43,py+.05,zb+.082]],M.violet,null);
  line3(c,[[x+.42,py+.077,zb+.012],[x+.64,py+.077,zb+.012]],M.gold,.034);
  if(working){
    // Steam from the roof stack: each puff grows and fades as it rises .6 tiles over 1.4 s.
    const n=reduced?1:4;
    for(let i=0;i<n;i++){
      const t=reduced?.4:(time/1.4+i/4)%1,[sx,sy]=pt(x+.53+(reduced?0:Math.sin(t*6+i)*.04),y-.34,1.2+t*.6);
      c.globalAlpha=a0*(reduced?.3:(1-t)*.5);ellipse(c,sx,sy,.06+t*.10,.045+t*.07,M.light);
    }
    c.globalAlpha=a0;
  }
}
// Bio-generator: bubbles rise in the culture tank, the cabinet fan turns and
// the feed engine's flywheel drives its piston while it generates. A waiting
// generator's bubbles drift and its fan idles; the engine rests.
/** @param {any} c @param {any} m @param {number} x @param {number} y @param {boolean} working @param {number} time @param {boolean} reduced @param {boolean} live */
function generatorParts(c,m,x,y,working,time,reduced,live){
  const d=driveOf(m,time,working,live,reduced),a0=c.globalAlpha;
  for(let i=0;i<5;i++){
    const t=(.48*d.work+.09*d.creep+i*.2+(i%2)*.05)%1,[px,py]=pt(x-.15+Math.sin(i*2.7)*.24+Math.sin(t*8+i)*.018,y-.09,.78+t*.68);
    c.globalAlpha=a0*Math.max(0,Math.min(1,t/.08,(1-t)/.12));ellipse(c,px,py,.027+(i%3)*.005,.035+(i%3)*.004,working?'#eef3cbb5':'#dce5bb77');
  }
  c.globalAlpha=a0;
  // Four swept fan blades under the roof shroud.
  const fan=TAU*(1.44*d.work+.15*d.creep),[fx,fy]=pt(x+.55,y+FAN_Y,1.075),at=(/** @type {number} */r,/** @type {number} */b)=>[fx+Math.cos(b)*r,fy+Math.sin(b)*r*COLONY_DEPTH];
  for(let i=0;i<4;i++){const b=fan+i*TAU/4;poly(c,[at(.028,b-.5),at(.115,b-.12),at(.115,b+.32),at(.028,b+.5)],M.white,M.ink,.012);}
  ellipse(c,fx,fy,.032,.026,M.gold,M.ink,.012);
  // Feed engine: crank pin on the flywheel, connecting rod and piston rod.
  const th=TAU*.96*d.work,cx=x+FLY_X,ey=y+ENGINE_Y,pinX=cx+Math.cos(th)*CRANK,pinZ=FLY_Z+Math.sin(th)*CRANK;
  const head=pinX-Math.sqrt(ROD*ROD-(pinZ-FLY_Z)**2);
  line3(c,[[x+MOUTH,ey,FLY_Z],[head,ey,FLY_Z]],M.ink,.055);line3(c,[[x+MOUTH,ey,FLY_Z+.012],[head,ey,FLY_Z+.012]],M.light,.02);
  box(c,head,ey,.035,.05,FLY_Z-.045,.09,M.dark,.012);
  // The flywheel stands upright, so its face is squashed by the camera's height factor.
  const[wx,wy]=pt(cx,ey+.02,FLY_Z),rim=(/** @type {number} */r,/** @type {string} */fill,stroke=M.ink,width=.012)=>{c.beginPath();c.ellipse(wx,wy,r,r*COLONY_HEIGHT,0,0,TAU);c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=width;c.stroke();};
  rim(FLY_R,M.dark,M.ink,.022);rim(FLY_R*.86,M.gold,M.gold,.001);rim(FLY_R*.74,'#73848a','#73848a',.001);
  for(let i=0;i<4;i++){const b=th+i*TAU/4;line3(c,[[cx,ey+.03,FLY_Z],[cx+Math.cos(b)*FLY_R*.74,ey+.03,FLY_Z+Math.sin(b)*FLY_R*.74]],M.white,.04);}
  rim(.03,M.gold);
  line3(c,[[head,ey+.05,FLY_Z],[pinX,ey+.05,pinZ]],M.ink,.045);line3(c,[[head,ey+.05,FLY_Z+.008],[pinX,ey+.05,pinZ+.008]],M.violet,.022);
  const[kx,ky]=pt(pinX,ey+.06,pinZ);ellipse(c,kx,ky,.026,.022,M.gold,M.ink,.01);
  if(working){
    // Two wisps shimmer up from the top cap and the energy lamp pulses.
    const tx=x-.15,ty=y-.11;
    for(let i=0;i<2;i++){
      const t=reduced?.3+i*.3:(time/1.6+i*.5)%1,sway=reduced?0:Math.sin(time*2.6+i*2.1+t*4)*.07;
      const[vx,vy]=pt(tx+sway,ty,1.82+t*.5);
      c.globalAlpha=a0*(reduced?.28:(1-t)*.42);ellipse(c,vx,vy,.045+t*.05+(reduced?0:Math.sin(time*9+i)*.008),.07+t*.09,'#f4f8e4');
    }
    const[gx,gy]=pt(x-.60,y-.54,.93);
    c.globalAlpha=a0*(reduced?.55:.35+.3*Math.sin(time*TAU*1.2));ellipse(c,gx,gy,.11,.08,'#ffe9a8');
    c.globalAlpha=a0;ellipse(c,gx,gy,.05,.04,'#fff4cf');
  }
}
// The crane turns on the turntable toward its crate, reaches out over the
// first half of the task and draws back over the second. The crate itself is
// the renderer's; only the arm and claw are painted here.
function collectorArm(c,state,m,phase=0,working=false,reduced=false){
  const x=m.x+1,y=m.y+1,px=x-.12,py=y-.06,task=m.task;
  const crate=task?(state&&state.crates||[]).find(k=>k.id===task.crateId):null;
  let bearing=Math.atan2(D[dirOf(m)][1],D[dirOf(m)][0]),reach=0,span=1.1;
  if(crate){
    const dx=crate.x+.5-px,dy=crate.y+.5-py;bearing=Math.atan2(dy,dx);span=Math.min(4,Math.max(.6,Math.hypot(dx,dy)));
    if(working&&!reduced)reach=Math.sin(Math.PI*Math.max(0,Math.min(1,phase)));
  }
  const ux=Math.cos(bearing),uy=Math.sin(bearing);
  const elbowD=.26+reach*span*.42,elbowZ=1.22+reach*.28,tipD=.52+reach*(span-.52),tipZ=1.0-reach*.78;
  const ex=px+ux*elbowD,ey=py+uy*elbowD,tx=px+ux*tipD,ty=py+uy*tipD;
  line3(c,[[px,py,.92],[ex,ey,elbowZ],[tx,ty,tipZ]],M.ink,.11);
  line3(c,[[px-.012,py-.01,.94],[ex-.012,ey-.01,elbowZ+.02],[tx-.012,ty-.01,tipZ+.02]],M.gold,.07);
  const[jx,jy]=pt(ex,ey,elbowZ+.02);ellipse(c,jx,jy,.07,.055,M.dark,M.ink);
  const spread=.07+(reach>.6?.035:0);
  for(const side of[-1,1])line3(c,[[tx-uy*spread*side,ty+ux*spread*side,tipZ],[tx-uy*spread*side*.5+ux*.06,ty+ux*spread*side*.5+uy*.06,tipZ-.14]],M.dark,.035);
}

export function drawIndustryBase(c,m){
  if(m.kind==='processor')processor(c,m);else if(m.kind==='generator')generator(c,m);else if(m.kind==='outlet')outlet(c,m);else if(m.kind==='collector')collector(c,m);else if(m.kind==='warehouse')warehouse(c,m);
  const ports=machinePorts(m);for(const[key,p]of Object.entries(ports))socket(c,m,p,key==='input'?M.cyan:key==='byproduct'?'#a9c087':M.gold);
}

const itemColor=id=>({sundrop:'#edb451',moonberry:'#b49ac8',cloudmelon:'#bed28c',provisions:'#d6ba83',biomass:'#91ad79'})[id]||M.gold;
function cargo(c,item,x,y,z=.13,scale=1){
  box(c,x,y,.15*scale,.13*scale,z,.16*scale,itemColor(item),.025);
  line3(c,[[x,y-.13*scale,z+.17*scale],[x,y+.13*scale,z+.17*scale]],M.light,.035*scale);
  if(item==='biomass'){const[px,py]=pt(x,y,z+.18*scale);ellipse(c,px-.04*scale,py,.06*scale,.027*scale,'#e1e7b5');}
}

export function drawIndustryMotion(c,state,m,time,reduced){
  const s=sizeOf(m.kind),x=m.x+s/2,y=m.y+s/2,{active:working,phase}=industryMotion(state,m,time,reduced);
  // Processor and generator parts run on their drive (driveOf); the outlet arm
  // follows its saved harvest stroke and keeps watch on the room clock. A
  // disabled machine settles still, and reduced motion holds every part still.
  const live=m.enabled!==false&&!reduced;
  if(m.kind==='processor')processorParts(c,m,x,y,working,time,reduced,live);
  else if(m.kind==='generator')generatorParts(c,m,x,y,working,time,reduced,live);
  else if(m.kind==='outlet'){
    // An outlet keeps watch only over a bed it is attached to.
    const watching=live&&(state?.beds||[]).some((/** @type {any} */bed)=>bed.id===m.bedId),stroke=outletArm(c,m,phase,watching?time:null);
    const load=Object.entries(m.output||{}).find(([,n])=>n>0);if(load&&(!working||stroke>=.78))cargo(c,load[0],x-.05,y-.04,.73,.60);
  }else if(m.kind==='collector'){
    collectorArm(c,state,m,phase,working,reduced);
  }
  // The warehouse lamp sits on the office front; two-tile machines carry theirs
  // on the service strip and the outlet on its small panel.
  const[lx,ly]=pt(...(s===3?[x+1.30,y+1.366,.50]:s===2?[x+.59,y+.785,.60]:[x+.18,y+.32,.54]));
  // Working lamps blink to warm white at 2 Hz; reduced motion holds the working tone.
  const blink=working&&!reduced&&(time*2)%1<.5;
  const tone=m.enabled===false?'#84918a':working?(m.kind==='collector'?'#e9b566':'#dbe8b1'):m.kind==='collector'?'#b89a6c':m.job?'#e2c18a':'#a7c7bd';
  ellipse(c,lx,ly,s===1?.026:.052,s===1?.022:.042,blink?'#fff6dc':tone);
}

// Resolve the incoming edge once per frame. This is bounded by the saved belt
// limit, and requires no pathfinding, textures, particles or simulation state.
export function industryBeltInputs(state){
  const industry=state.industry,inputs=new Map();if(!industry)return inputs;
  const belts=new Map(industry.belts.map(b=>[`${b.x}:${b.y}`,b]));
  for(const b of industry.belts){
    const opposite=(dirOf(b)+2)%4,order=[opposite,...[0,1,2,3].filter(d=>d!==opposite&&d!==dirOf(b))];
    for(const d of order){const[dx,dy]=D[d],from=belts.get(`${b.x+dx}:${b.y+dy}`);if(from&&dirOf(from)===(d+2)%4){inputs.set(b.id,d);break;}}
  }
  for(const m of industry.machines)for(const[key,p]of Object.entries(machinePorts(m))){
    if(key==='input')continue;const b=belts.get(`${p.x}:${p.y}`);if(!b||inputs.has(b.id))continue;
    const s=m.kind==='outlet'?1:2,dx=m.x+s/2-(b.x+.5),dy=m.y+s/2-(b.y+.5);
    inputs.set(b.id,Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0);
  }
  return inputs;
}
function beltPath(b,input,progress){const out=dirOf(b),[ix,iy]=D[input??(out+2)%4],[ox,oy]=D[out],t=Math.max(0,Math.min(1,progress));return t<.5?[b.x+.5+ix*(.5-t),b.y+.5+iy*(.5-t)]:[b.x+.5+ox*(t-.5),b.y+.5+oy*(t-.5)];}
export function drawIndustryBeltBase(c,b,input){
  const x=b.x+.5,y=b.y+.5,out=dirOf(b),incoming=input??(out+2)%4,[ix,iy]=D[incoming],[ox,oy]=D[out];
  box(c,x,y,.47,.47,.015,.045,M.shade,.06);
  c.save();c.translate(x,y*COLONY_DEPTH);c.scale(1,COLONY_DEPTH);
  const path=[[ix*.5,iy*.5],[0,0],[ox*.5,oy*.5]];
  line(c,path,M.dark,.73);line(c,path,M.white,.65);line(c,path,'#67756c',.49);
  c.restore();
}
function beltTreads(c,b,input,phase,moving=false){
  const x=b.x+.5,y=b.y+.5,out=dirOf(b),incoming=input??(out+2)%4,stub={x:-.5,y:-.5,dir:out};
  c.save();c.translate(x,y*COLONY_DEPTH);c.scale(1,COLONY_DEPTH);
  for(let i=0;i<7;i++){
    const t=((i+.5)/7+phase)%1,[px,py]=beltPath(stub,incoming,t),dir=t<.5?(incoming+2)%4:out,[dx,dy]=D[dir];
    line(c,[[px-dy*.19,py+dx*.19],[px+dy*.19,py-dx*.19]],moving?'#f1f1e3':'#a0ab91',.045);
  }
  if(moving){
    // A soft sheen travels with the treads: one wider translucent bar on the leading tread.
    const t=(.5/7+phase)%1,[px,py]=beltPath(stub,incoming,t),dir=t<.5?(incoming+2)%4:out,[dx,dy]=D[dir],a0=c.globalAlpha;
    c.globalAlpha=a0*.38;line(c,[[px-dy*.2,py+dx*.2],[px+dy*.2,py-dx*.2]],M.light,.13);c.globalAlpha=a0;
  }
  c.restore();arrow(c,x,y,out,.13,'#ddd9b0',.075);
}
export function drawIndustryBeltCargo(c,state,b,input,time,reduced){
  const motion=industryMotion(state,b,time,reduced);beltTreads(c,b,input,motion.phase,motion.active);
  if(!b.item)return;const progress=reduced?b.progress:Math.min(1,b.progress+(industryWorking(state,b)?Math.min(.3,Math.max(0,time-(state.time||0)))/.6:0));
  const[x,y]=beltPath(b,input,progress);cargo(c,b.item,x,y,.085,.95);
}
export function drawIndustryPorts(c,m,valid=true){
  const size=sizeOf(m.kind),cx=m.x+size/2,cy=m.y+size/2;
  const ports=m.kind==='belt'?{output:{x:m.x+D[dirOf(m)][0],y:m.y+D[dirOf(m)][1]}}:machinePorts(m);
  c.save();c.font='.14px "IBM Plex Mono",monospace';c.textAlign='center';
  for(const[key,p]of Object.entries(ports)){
    const color=valid?(key==='input'?'#508987':key==='byproduct'?'#668546':'#987343'):'#ad6d58';
    const x=p.x+.5,y=p.y+.5,dx=x-cx,dy=y-cy;
    const dir=Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0;
    poly3(c,[[p.x+.08,p.y+.08,.035],[p.x+.92,p.y+.08,.035],[p.x+.92,p.y+.92,.035],[p.x+.08,p.y+.92,.035]],'#fffcef88',color,.025);
    arrow(c,x,y,key==='input'?(dir+2)%4:dir,.18,color,.04);
    const[px,py]=pt(x,y+.37,.05);c.fillStyle=color;c.fillText(key==='input'?'IN':key==='byproduct'?'BIO':'OUT',px,py);
  }c.restore();
}
export function drawIndustryPlacement(c,placement){
  const m={...placement,dir:dirOf(placement)},valid=!m.error,cells=machineCells(m.kind,m.x,m.y);
  c.save();c.globalAlpha=.48;
  if(m.kind==='belt'){drawIndustryBeltBase(c,m);beltTreads(c,m,undefined,0);}else{drawIndustryBase(c,m);if(m.kind==='outlet')outletArm(c,m);else if(m.kind==='collector')collectorArm(c,null,m);}
  c.restore();
  for(const cell of cells)poly3(c,[[cell.x+.025,cell.y+.025,.02],[cell.x+.975,cell.y+.025,.02],[cell.x+.975,cell.y+.975,.02],[cell.x+.025,cell.y+.975,.02]],valid?'#eff9e331':'#edb29e55',valid?'#fffef0':'#b6745e',.045);
  drawIndustryPorts(c,m,valid);
  const size=sizeOf(m.kind),[px,py]=pt(m.x+size/2,m.y,-.02);
  c.font='.21px "IBM Plex Sans",sans-serif';c.textAlign='center';c.fillStyle=valid?'#466453':'#905c4c';c.fillText(valid?'Place here · R rotate':'Blocked',px,py-.23);
}

// A small white quadrotor hovering `z` tiles above world point (x, y), about
// .7 tiles across. Graphite body with a violet visor, four arms with rotor
// discs that blur with `time` (held still when motion is reduced), a soft
// ground shadow that shrinks with height, and with `carrying` a cardboard
// crate hanging below the body on two short cables.
export function drawIndustryDrone(c,x,y,z,carrying,time,reduced){
  const lift=Math.max(0,Number(z)||0),t=Number(time)||0,a0=c.globalAlpha,shrink=1/(1+lift*.35);
  c.globalAlpha=a0*(.55+.45*shrink);ellipse(c,x+.05,(y+.08)*COLONY_DEPTH,.30*shrink,.22*shrink,'#4f66552b');c.globalAlpha=a0;
  if(carrying){
    const sway=reduced?0:Math.sin(t*2.2)*.015,cx=x+sway,cz=lift-.60,hx=.15,hy=.125,h=.20;
    for(const sx of[-1,1])line3(c,[[x+sx*.09,y,lift-.01],[cx+sx*.09,y,cz+h]],M.ink,.014);
    box(c,cx,y,hx,hy,cz,h,CARDBOARD,.03);
    line3(c,[[cx,y-hy,cz+h+.006],[cx,y+hy,cz+h+.006]],TAPE,.045);
    line3(c,[[cx,y+hy+.006,cz+h],[cx,y+hy+.006,cz]],TAPE,.045);
  }
  const arms=[[-1,-1],[1,-1],[-1,1],[1,1]];
  for(const[sx,sy]of arms){
    line3(c,[[x+sx*.09,y+sy*.06,lift+.06],[x+sx*.22,y+sy*.18,lift+.08]],M.ink,.05);
    line3(c,[[x+sx*.09,y+sy*.06,lift+.065],[x+sx*.22,y+sy*.18,lift+.085]],M.white,.028);
  }
  box(c,x,y,.14,.11,lift,.09,M.dark,.04);
  poly3(c,[[x-.09,y-.06,lift+.096],[x+.09,y-.06,lift+.096],[x+.09,y+.06,lift+.096],[x-.09,y+.06,lift+.096]],M.white,null);
  const[vx,vy]=pt(x,y+.115,lift+.045);ellipse(c,vx,vy,.03,.022,M.violet,M.ink,.01);ellipse(c,vx-.008,vy-.006,.011,.008,'#e6e0f2');
  for(let i=0;i<4;i++){
    const[sx,sy]=arms[i],[hx,hy]=pt(x+sx*.22,y+sy*.18,lift+.10),r=.12;
    ellipse(c,hx,hy,.035,.027,M.dark,M.ink,.012);
    const[dx,dy]=pt(x+sx*.22,y+sy*.18,lift+.125);
    ellipse(c,dx,dy,r,r*COLONY_DEPTH,'#ffffff3a','#ffffff8c',.012);
    const spin=reduced?.9*sx+.5*sy:t*(sx*sy>0?23:-23)+i*1.3;
    for(const half of[0,Math.PI/2]){const a=spin+half;line(c,[[dx-Math.cos(a)*r,dy-Math.sin(a)*r*COLONY_DEPTH],[dx+Math.cos(a)*r,dy+Math.sin(a)*r*COLONY_DEPTH]],reduced?'#f6f6ee':'#f6f6eeb3',.022);}
  }
}
