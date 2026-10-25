// Overhead Ohio-class skin: a long black hull with a hemispherical bow, the sail and
// fairwater planes forward, a raised missile deck with paired silo lids and a long
// tapered stern with cruciform planes. Silo positions come from submarineTubeLocal,
// the same geometry as missile launch origins; four independent groups of six fire.
// Lids animate from the saved launch/reload countdowns (presentation only).
import { submarineTubeLocal } from './naval-scale.js';
import { SUBMARINE, submarineSiloAge } from './submarine.js';

// Tile coordinates around the hull centre, bow at negative y.
export const OHIO_LAYOUTS=Object.freeze({
 legacy:{half:.62,bow:-2.25,body:1.2,tail:2.35,tailHalf:.12,silos:24,r:.075,line:.03,
  sail:{y:-1.02,rx:.2,ry:.46,planeY:-1.12,span:.78,chord:.14},deck:{x:.44,y0:-.62,y1:1.5},
  planes:{y:1.95,span:.82,chord:.2},rudder:[1.78,2.32],hatches:[[0,-1.7]]},
 large:{half:.8,bow:-6,body:2.6,tail:6,tailHalf:.16,silos:24,r:.17,line:.045,
  sail:{y:-2.5,rx:.26,ry:.62,planeY:-2.68,span:.95,chord:.26},deck:{x:.6,y0:-1.7,y1:4.2},
  planes:{y:5.05,span:1.15,chord:.4},rudder:[4.6,5.9],hatches:[[0,-4.4],[0,-1.9]]}
});

const clamp=n=>Math.max(0,Math.min(1,n));
const ease=t=>t*t*(3-2*t);
// Lid angle: 0 closed, past 90 degrees stands open showing its pale underside.
function lidAngle(age,reduced){
 if(age===null)return 0;
 const open=SUBMARINE.count*SUBMARINE.interval+.7;
 if(reduced)return age<open?1.9:0;
 return 1.9*(age<open?ease(clamp(age/.3)):1-ease(clamp((age-open)/.7)));
}

export function drawOhioSubmarine(c,s,T,L,edge,time,reduced){
 const line=L.line*T,P=(x,y)=>[x*T,y*T];
 const oval=(x,y,rx,ry,fill,stroke)=>{c.beginPath();c.ellipse(x*T,y*T,Math.max(.001,rx*T),ry*T,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
 c.save();c.lineJoin='round';c.lineWidth=line;
 // Stern planes and rudder sit under the tapered tail.
 const p=L.planes;
 for(const side of[-1,1]){c.beginPath();c.moveTo(...P(side*.12,p.y-p.chord*.6));c.lineTo(...P(side*p.span,p.y+p.chord*.2));c.lineTo(...P(side*p.span,p.y+p.chord*.55));c.lineTo(...P(side*.12,p.y+p.chord*.5));c.closePath();c.fillStyle='#24333a';c.fill();c.strokeStyle='#5f7176';c.lineWidth=line*.5;c.stroke();}
 // Hull: round bow, parallel body, long taper to the propulsor.
 const h=L.half,b=L.bow,y1=L.body,t=L.tail,th=L.tailHalf;
 c.beginPath();c.moveTo(...P(0,b));c.bezierCurveTo(...P(h*.56,b),...P(h,b+h*.44),...P(h,b+h));c.lineTo(...P(h,y1));c.bezierCurveTo(...P(h,y1+(t-y1)*.5),...P(th+.06,t-(t-y1)*.18),...P(th,t-.08));c.quadraticCurveTo(...P(th*.6,t),...P(0,t));
 c.quadraticCurveTo(...P(-th*.6,t),...P(-th,t-.08));c.bezierCurveTo(...P(-th-.06,t-(t-y1)*.18),...P(-h,y1+(t-y1)*.5),...P(-h,y1));c.lineTo(...P(-h,b+h));c.bezierCurveTo(...P(-h,b+h*.44),...P(-h*.56,b),...P(0,b));c.closePath();
 c.fillStyle='#131d22';c.fill();c.strokeStyle=edge;c.lineWidth=line;c.stroke();
 // A soft highlight along the casing top and a faint centreline safety track.
 oval(0,(b+t)/2-.1*h,h*.32,(t-b)*.42,'#1c2a30');
 c.strokeStyle='#2f4046';c.lineWidth=line*.35;c.setLineDash([line*2,line*2]);c.beginPath();c.moveTo(...P(0,b+h*.6));c.lineTo(...P(0,L.sail.y-L.sail.ry));c.moveTo(...P(0,L.deck.y1+.1));c.lineTo(...P(0,t-.6));c.stroke();c.setLineDash([]);
 for(const[x,y]of L.hatches)oval(x,y,L.r*.55,L.r*.55,'#1a272c','#465a5e');
 // Raised missile deck (turtleback) carrying every silo.
 const d=L.deck;c.beginPath();c.moveTo(...P(-d.x*.7,d.y0));c.lineTo(...P(d.x*.7,d.y0));c.lineTo(...P(d.x,d.y0+L.r*1.6));c.lineTo(...P(d.x,d.y1-L.r*1.6));c.lineTo(...P(d.x*.7,d.y1));c.lineTo(...P(-d.x*.7,d.y1));c.lineTo(...P(-d.x,d.y1-L.r*1.6));c.lineTo(...P(-d.x,d.y0+L.r*1.6));c.closePath();
 c.fillStyle='#1b282d';c.fill();c.strokeStyle='#33454b';c.lineWidth=line*.5;c.stroke();
 const r=L.r,ages=Array.from({length:SUBMARINE.groups},(_,group)=>submarineSiloAge(s,group*SUBMARINE.count));
 for(let i=0;i<L.silos;i++){
  const age=ages[Math.floor(i/SUBMARINE.count)],theta=lidAngle(age,reduced),tube=submarineTubeLocal(s,i),side=tube.x<0?-1:1,firing=theta>0,within=i%SUBMARINE.count;
  if(!firing){
   // Closed: a shallow ring marks the silo; the hinge sits outboard.
   oval(tube.x,tube.y,r,r,'#18242a','#506367');
   c.strokeStyle='#33454b';c.lineWidth=line*.4;c.beginPath();c.moveTo(...P(tube.x+side*r*.75,tube.y-r*.45));c.lineTo(...P(tube.x+side*r*.75,tube.y+r*.45));c.stroke();
   continue;
  }
  // Open tube: the white missile cap remains until its staggered launch.
  const launched=age!==null&&age>=within*SUBMARINE.interval;
  oval(tube.x,tube.y,r,r,'#05090b','#6a7d80');
  if(!launched){oval(tube.x,tube.y,r*.78,r*.78,'#dfe3da','#aab3ab');oval(tube.x-r*.18,tube.y-r*.18,r*.28,r*.28,'#f4f6f0');}
  else if(!reduced&&age-within*SUBMARINE.interval<.6){const k=(age-within*SUBMARINE.interval)/.6;c.save();c.globalAlpha*=1-k;oval(tube.x,tube.y,r*(1+k*1.4),r*(1+k*1.4),null,'#e6efe9');c.restore();}
  // The lid swings about its outboard hinge: dark top first, then its pale underside.
  const hinge=tube.x+side*r,cos=Math.cos(theta);
  oval(hinge-side*r*cos,tube.y,Math.abs(cos)*r,r,cos>0?'#1a272c':'#d5dad2',cos>0?'#506367':'#f0f2ea');
 }
 // Forward sail with fairwater planes and retracted masts.
 const sl=L.sail;
 for(const side of[-1,1]){c.beginPath();c.moveTo(...P(side*sl.rx*.6,sl.planeY-sl.chord*.5));c.lineTo(...P(side*sl.span,sl.planeY-sl.chord*.15));c.lineTo(...P(side*sl.span,sl.planeY+sl.chord*.45));c.lineTo(...P(side*sl.rx*.6,sl.planeY+sl.chord*.5));c.closePath();c.fillStyle='#22323a';c.fill();c.strokeStyle='#6e8084';c.lineWidth=line*.5;c.stroke();}
 oval(0,sl.y,sl.rx,sl.ry,'#141f24','#8fa29f');oval(0,sl.y-sl.ry*.08,sl.rx*.6,sl.ry*.72,'#22323a');
 for(const y of[-.32,0,.3])oval(0,sl.y+y*sl.ry,sl.rx*.18,sl.rx*.22,'#3c4e53');
 // Rudder top and propulsor at the tail.
 c.strokeStyle='#5f7176';c.lineWidth=line*.9;c.beginPath();c.moveTo(...P(0,L.rudder[0]));c.lineTo(...P(0,L.rudder[1]));c.stroke();
 oval(0,t-.02,th*.9,th*.55,'#2b3b41','#7d8f8a');
 c.restore();
}
// Legacy 2 x 4 hulls fit the same 24 silos on a compact deck.
export function drawSubmarineHull(c,s,T,mine,zoom,time,reduced){
 drawOhioSubmarine(c,s,T,OHIO_LAYOUTS.legacy,mine?'#edcd89':'#91bdb7',time,reduced);
}
