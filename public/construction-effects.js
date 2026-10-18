import { CoreEffects } from './core-effects.js';
import { POD } from './pod.js';
import { constructionCores } from './construction.js';

const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
// Presentation only. Completion always comes from the saved server countdown.
export function assemblyStage(remaining,duration,advance=0){
  const active=remaining>0;
  const time=active?Math.min(duration-.001,Math.max(0,duration-remaining+Math.min(.1,Math.max(0,advance)))):duration;
  const opened=POD.unfold+POD.panelDuration;
  const reveal=active?smooth((time-opened)/Math.max(.001,duration-opened)) :1;
  return {active,time,reveal,phase:!active?'READY':time<POD.impact?'INBOUND':time<POD.unfold?'LANDED':time<opened?'UNFOLDING':'DEPLOYING'};
}

// Reuses core capsule art, with short cosmetic panels inside the reserved footprint.
// At most three drones per active site; no server bodies, physics or pathfinding.
export class ConstructionEffects extends CoreEffects {
  constructor(tile){super(tile,1);}
  draw(c,world,point,size,stage,zoom,reduced,drones=false){
    if(!stage.active)return;
    const T=this.tile,t=stage.time;
    if(stage.method==='factory'){
      c.save();c.translate(point.x*T,point.y*T);
      const bay=stage.droneBay||{x:Math.floor(point.x),y:Math.floor(point.y)},x=(bay.x-point.x)*T,y=(bay.y-point.y)*T;
      c.fillStyle='#18353a';c.fillRect(x,y,T,T);c.strokeStyle='#8edccc';c.lineWidth=2/zoom;c.strokeRect(x+2,y+2,T-4,T-4);
      c.fillStyle='#567e80';c.fillRect(x+T*.12,y+T*.15,T*.76,T*.45);
      for(let i=0;i<3;i++){c.fillStyle='#d6c384';c.fillRect(x+T*(.2+i*.23),y+T*.24,T*.13,T*.25);}
      c.fillStyle='#b7dfd5';c.font='bold '+9/zoom+'px monospace';c.textAlign='center';c.fillText('DRONES',x+T/2,y+T*.84);
      this.workers(c,world,point,size,{...stage,time:stage.time+POD.unfold+2,source:{x:bay.x+.5,y:bay.y+.5}},reduced);
      c.fillStyle='#17373c';c.fillRect(-size*T/2,(size/2+.14)*T,size*T,.06*T);c.fillStyle='#aaddc0';c.fillRect(-size*T/2,(size/2+.14)*T,size*T*stage.reveal,.06*T);
      c.restore();return;
    }
    c.save();c.translate(point.x*T,point.y*T);
    c.strokeStyle='#dabf78';c.lineWidth=1/zoom;c.setLineDash([5/zoom,5/zoom]);
    c.strokeRect(-size*T/2,-size*T/2,size*T,size*T);c.setLineDash([]);
    if(t<POD.impact){
      const fall=1-(t/POD.impact)**2;
      c.fillStyle='#11272b55';c.beginPath();c.ellipse(0,0,T*.65,T*.45,0,0,Math.PI*2);c.fill();
      if(!reduced){c.translate(fall*4*T,-fall*7*T);c.strokeStyle='#ffc07999';c.lineWidth=.14*T;c.beginPath();c.moveTo(0,0);c.lineTo(fall*T,-fall*2*T);c.stroke();c.scale(1+fall*.6,1+fall*.6);}
      this.box(c,0);
    }else{
      const open=smooth((t-POD.unfold)/POD.panelDuration),edge=Math.min(size*.46,.85)*T;
      for(let side=0;side<4;side++){
        c.save();c.rotate(side*Math.PI/2);c.translate(0,-edge*open);
        c.fillStyle='#607778';c.fillRect(-T*.32,-T*.08,T*.64,T*.16);
        c.strokeStyle='#d8bd7e';c.strokeRect(-T*.32,-T*.08,T*.64,T*.16);c.restore();
      }
      if(open<1){c.save();c.globalAlpha=1-open;this.box(c,t-POD.impact);c.restore();}
      if(!reduced&&t-POD.impact<.85)this.dust(c,0,0,t-POD.impact,.85,8,2,.5);
      // Orbital cargo arrives assembled; only factory builds use worker drones.
      // A steady progress edge remains visible with reduced effects.
      c.fillStyle='#17373c';c.fillRect(-size*T/2,(size/2+.14)*T,size*T,.06*T);
      c.fillStyle='#aaddc0';c.fillRect(-size*T/2,(size/2+.14)*T,size*T*stage.reveal,.06*T);
    }
    c.restore();
  }
  workers(c,world,point,size,stage,reduced){
    const T=this.tile,t=stage.time;
    const source=stage.source||constructionCores(world).map(p=>({x:p.x+1.5,y:p.y+1.5}))
      .sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0];
    for(let i=0;i<(reduced?1:3);i++){
      const phase=t*1.2+i*2.1,angle=reduced?i*2:phase;
      const target={x:Math.cos(angle)*size*.42*T,y:Math.sin(angle)*size*.42*T};
      const arriving=smooth((t-POD.unfold-i*.12)/1.2),returning=smooth((stage.reveal-.94)/.06);
      const fraction=arriving*(1-returning);
      const from=source?{x:(source.x-point.x)*T,y:(source.y-point.y)*T}:{x:0,y:0};
      const x=from.x+(target.x-from.x)*fraction,y=from.y+(target.y-from.y)*fraction;
      c.save();c.translate(x,y);
      c.fillStyle='#102b3244';c.beginPath();c.ellipse(0,T*.15,T*.2,T*.12,0,0,Math.PI*2);c.fill();
      c.fillStyle='#adc4b8';c.fillRect(-T*.12,-T*.13,T*.24,T*.26);c.strokeStyle='#273f47';c.lineWidth=2;c.strokeRect(-T*.12,-T*.13,T*.24,T*.26);
      c.fillStyle='#ebbe70';c.fillRect(-T*.07,-T*.06,T*.14,T*.08);
      for(const side of [-1,1]){c.strokeStyle='#9bb1af';c.beginPath();c.moveTo(side*T*.1,0);c.lineTo(side*T*.22,T*.07);c.stroke();}
      if(arriving>.98&&returning<.1){c.strokeStyle='#9fe9e0';c.lineWidth=1;c.beginPath();c.moveTo(0,T*.13);c.lineTo(-target.x*.12,T*.2-target.y*.12);c.stroke();if(!reduced){c.fillStyle='#ffe6a1';for(let n=0;n<3;n++){const p=(t*3+n/3)%1;c.fillRect(Math.sin(n*3+phase)*T*.2*p,T*(.2-p*.22),2,2);}}}
      c.restore();
    }
  }
}
