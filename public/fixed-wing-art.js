// Original overhead silhouettes inspired by XB-70 / A-10 proportions.
// All exhaust, condensation and dust are bounded analytic canvas effects.
const clamp=n=>Math.max(0,Math.min(1,n));
function polygon(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
export function fixedWingShape(c,T,jet){
 const points=jet?[[0,-1.85],[.18,-1.5],[.22,-.35],[1.65,-.12],[1.65,.36],[.26,.25],[.19,1.25],[.75,1.35],[.75,1.65],[.12,1.6],[0,1.8],[-.12,1.6],[-.75,1.65],[-.75,1.35],[-.19,1.25],[-.26,.25],[-1.65,.36],[-1.65,-.12],[-.22,-.35],[-.18,-1.5]]:
 [[0,-2.25],[.13,-1.75],[.18,-.95],[.68,-.62],[.66,-.42],[.2,-.55],[.3,-.13],[1.95,1.4],[1.9,1.7],[.72,1.45],[-.72,1.45],[-1.9,1.7],[-1.95,1.4],[-.3,-.13],[-.2,-.55],[-.66,-.42],[-.68,-.62],[-.18,-.95],[-.13,-1.75]];
 polygon(c,points.map(([x,y])=>[x*T,y*T]));
}
export function fixedWingDetails(c,p,T,zoom,jet,mine,clock,reduced,firing=0){
 const airborne=p.state!=='parked',speed=clamp((p.speed||0)/12),bank=Math.abs(p.bank||0);
 c.fillStyle=jet?'#929e96':'#edf1e8';c.strokeStyle=mine?'#f2d38e':'#b8cec8';c.lineWidth=1.2/zoom;fixedWingShape(c,T,jet);c.fill();c.stroke();
 c.save();c.scale(T,T);c.lineWidth=.018;c.strokeStyle=jet?'#485b56':'#899b99';
 // Wing spars, control surfaces and a narrow raised fuselage spine.
 for(const side of [-1,1]){c.beginPath();c.moveTo(side*.28,jet?-.15:.08);c.lineTo(side*(jet?1.55:1.72),jet?.18:1.35);c.stroke();
  c.beginPath();c.moveTo(side*.45,jet?.25:1.3);c.lineTo(side*(jet?1.52:1.83),jet?.25:1.55);c.stroke();
  if(jet){for(const x of [.55,.9,1.25]){c.fillStyle='#344a49';c.fillRect(side*x-.045,-.07,.09,.55);c.fillStyle='#cdd6c1';c.fillRect(side*x-.025,.05,.05,.22);}}
 }
 c.fillStyle=jet?'#b1bcb0':'#fafbf0';polygon(c,[[-.09,-1.9],[.09,-1.9],[.22,.85],[.13,1.4],[-.13,1.4],[-.22,.85]]);c.fill();c.stroke();
 c.fillStyle='#294b58';polygon(c,[[-.09,-1.72],[.09,-1.72],[.14,-1.3],[0,-1.16],[-.14,-1.3]]);c.fill();c.strokeStyle='#b6e2dd';c.beginPath();c.moveTo(0,-1.7);c.lineTo(0,-1.2);c.stroke();
 if(jet){
  for(const side of [-1,1]){c.fillStyle='#465d59';c.fillRect(side*.48-.19,.62,.38,.86);c.fillStyle='#b0bdb4';c.fillRect(side*.48-.14,.65,.28,.68);c.fillStyle='#213a3b';c.beginPath();c.ellipse(side*.48,.64,.16,.1,0,0,Math.PI*2);c.fill();
   c.fillStyle='#d8ddd0';polygon(c,[[side*.62,1.65],[side*.73,.99],[side*.79,1.56]]);c.fill();c.stroke();}
  c.fillStyle='#263e41';c.fillRect(-.075,-2.01,.15,.34);
 }else{
  c.fillStyle='#b1c0b8';c.fillRect(-.62,.65,1.24,.84);c.strokeRect(-.62,.65,1.24,.84);
  for(const side of [-1,1]){c.fillStyle='#f5f7e9';polygon(c,[[side*.52,1.4],[side*.62,.63],[side*.8,1.38]]);c.fill();c.stroke();
   c.fillStyle='#b9c8c3';polygon(c,[[side*1.58,1.1],[side*1.94,1.42],[side*1.9,1.7]]);c.fill();c.stroke();}
 }
 const ports=jet?[-.48,.48]:[-.5,-.3,-.1,.1,.3,.5],rear=jet?1.5:1.49;
 for(const [i,x] of ports.entries()){
  c.fillStyle='#203a40';c.fillRect(x-.075,rear-.09,.15,.14);
  if(airborne){const flicker=reduced?0:.07*Math.sin(clock*23+i*1.7),length=(jet?.18:.3)+speed*(jet?.4:.8)+flicker;
   c.fillStyle=jet?'#cbdac265':'#7ecce9aa';polygon(c,[[x-.065,rear],[x+.065,rear],[x+.04,rear+length*.5],[x,rear+length],[x-.04,rear+length*.5]]);c.fill();
   c.fillStyle='#fff0c8bb';polygon(c,[[x-.03,rear],[x+.03,rear],[x,rear+length*.5]]);c.fill();
  }
 }
 // Condensation appears only during a bank, and never allocates particles.
 if(airborne&&!reduced&&bank>.12){c.strokeStyle=`rgba(222,245,232,${bank*.36})`;c.lineWidth=.04+bank*.03;
  for(const side of [-1,1])for(const origin of [{x:.12,y:-1.55},{x:jet?1.57:1.84,y:jet?.14:1.36}]){c.beginPath();c.moveTo(side*origin.x,origin.y);c.quadraticCurveTo(side*(origin.x+.1),origin.y+.5,side*(origin.x+.12),origin.y+.65+speed*.9);c.stroke();}}
 if(jet&&firing>0){const length=reduced?.18:.3+.24*(.5+.5*Math.sin(clock*90));c.fillStyle=reduced?'#f3d39c88':'#ffe3a5';polygon(c,[[-.09,-2],[0,-2-length],[.09,-2],[0,-2.08]]);c.fill();}
 c.restore();
}
export function takeoffDust(c,p,T,clock,reduced){
 if(p.state!=='takeoff'||reduced)return;
 c.save();c.translate(p.x*T,p.y*T);c.rotate(p.angle);
 const progress=clamp(1-p.remaining/2);
 for(let i=0;i<8;i++){const phase=(progress*2+i/8)%1;c.globalAlpha=(1-phase)*.13;c.fillStyle='#d5cfb1';c.beginPath();c.ellipse(Math.sin(i*2.4)*T*(.25+phase),(.5+phase*3)*T,(.2+phase*.7)*T,(.15+phase*.4)*T,0,0,Math.PI*2);c.fill();}c.restore();
}
