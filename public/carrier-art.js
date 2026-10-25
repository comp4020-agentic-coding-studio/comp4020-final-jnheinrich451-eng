// Aircraft carrier after the Ford-class plan view and the author's sketch: a hard-
// edged flight deck with a long straight port sponson that cuts diagonally to a
// narrow blunt bow, a nearly straight starboard edge and a square stern. Two axial
// bow catapults, an angled landing deck with waist catapults and arresting wires,
// deck-edge elevator platforms and a compact island far aft to starboard. Nuclear:
// no funnel or exhaust. Art only; the deck stays inside the saved hull rectangle.
// Units: x is a share of the drawn half-beam (CARRIER_BEAM of the saved half-width),
// y of the half-length (bow at -1). Port is negative x. The angled runway and deck
// spots come from carrier.js, so the drawn runways match where jets park and launch.
import {CARRIER_BEAM,ANGLED_DECK} from './carrier.js';
const DECK=Object.freeze([[-.42,-1],[.5,-1],[.64,-.4],[.74,.05],[.74,.95],[.66,1],[-.72,1],[-.94,.82],[-1,.6],[-1,-.34]]);
// Angled runway: from the stern out through the port bow slope.
const along=(t,offset=0)=>[ANGLED_DECK.x+offset+ANGLED_DECK.dx*t,1+ANGLED_DECK.dy*t];
const LANDING=Object.freeze([along(0,-ANGLED_DECK.half),along(0,ANGLED_DECK.half),along(1.3,ANGLED_DECK.half),along(1.3,-ANGLED_DECK.half)]),LANDING_LINE=Object.freeze([along(.01),along(1.2)]);
// Elevator platforms project slightly beyond the deck edge: two starboard, one port aft.
const ELEVATORS=Object.freeze([[.7,.06,.86,.2],[.7,.26,.86,.4],[-1.08,.38,-.94,.54]]);
const CATAPULTS=Object.freeze([[[-.16,-.38],[-.16,-.95]],[[.14,-.38],[.14,-.95]],[along(.45,-.1),along(.9,-.1)],[along(.5,.1),along(.95,.1)]]);
const ISLAND=Object.freeze([[.6,.45],[.88,.45],[.9,.5],[.9,.62],[.88,.66],[.6,.66]]);

export function drawFordCarrier(c,T,width,length,edge,line=.045*T){
 const hw=width/2*CARRIER_BEAM*T,hl=length/2*T,P=([x,y])=>[x*hw,y*hl];
 const poly=(points,fill,stroke)=>{c.beginPath();points.map(P).forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
 const seg=(a,b)=>{const[x0,y0]=P(a),[x1,y1]=P(b);c.moveTo(x0,y0);c.lineTo(x1,y1);};
 c.save();c.lineJoin='miter';c.lineCap='butt';c.lineWidth=line;
 c.lineWidth=line*.5;for(const[x0,y0,x1,y1]of ELEVATORS)poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],'#5d6e72','#b4bba1');
 c.lineWidth=line;poly(DECK,'#56676c',edge);
 c.save();poly(DECK);c.clip();
 // Catwalk edge: a darker inset band just inside the deck outline.
 c.save();c.scale(.95,.98);c.lineWidth=line*.8;poly(DECK,null,'#3f4f55');c.restore();
 // Angled landing area with edge lines, dashed centreline and arresting wires.
 poly(LANDING,'#4a5b61');c.strokeStyle='#e9e3ba';c.lineWidth=line*.6;c.beginPath();seg(LANDING[1],LANDING[2]);seg(LANDING[0],LANDING[3]);c.stroke();
 const[a,b]=LANDING_LINE.map(P),dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),nx=-dy/d,ny=dx/d;
 // Dashed centrelines: the angled runway and the main axial runway over the bow.
 c.setLineDash([line*3,line*2.4]);c.strokeStyle='#d9c27a';c.lineWidth=line*.7;c.beginPath();c.moveTo(...a);c.lineTo(...b);seg([0,-.3],[0,-.99]);c.stroke();c.setLineDash([]);
 c.strokeStyle='#c5cbb6';c.lineWidth=line*.5;c.beginPath();
 for(const f of[.08,.12,.16,.2]){const x=a[0]+dx*f,y=a[1]+dy*f,r=.2*hw;c.moveTo(x-nx*r,y-ny*r);c.lineTo(x+nx*r,y+ny*r);}c.stroke();
 // Bow and waist catapults, each with a raised jet-blast deflector at its start.
 c.strokeStyle='#2c3a3f';c.lineWidth=line*1.1;c.beginPath();for(const[from,to]of CATAPULTS)seg(from,to);c.stroke();
 c.strokeStyle='#d3d5b6';c.lineWidth=line*.35;c.beginPath();for(const[from,to]of CATAPULTS)seg(from,to);c.stroke();
 c.fillStyle='#8c9a92';for(const[[x,y]]of CATAPULTS){const[px,py]=P([x,y]);c.fillRect(px-.08*hw,py+.008*hl,.16*hw,.02*hl);}
 c.restore();
 // Compact island far aft on the starboard edge, with mast and radar faces.
 c.lineWidth=line*.6;poly(ISLAND,'#2c414a','#b4bba1');poly([[.64,.48],[.86,.48],[.86,.63],[.64,.63]],'#8fa6a2');
 c.fillStyle='#2c414a';for(const y of[.5,.58]){const[x,py]=P([.68,y]);c.fillRect(x,py,.13*hw,.03*hl);}
 c.strokeStyle='#d2cdab';c.lineWidth=line*.5;c.beginPath();seg([.62,.555],[.96,.555]);seg([.75,.46],[.75,.65]);c.stroke();
 c.restore();
}
