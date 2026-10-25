import { CoreEffects } from './core-effects.js';
import { POD } from './pod.js';
import { cargoCells } from './cargo-pods.js';

const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
export class CargoEffects extends CoreEffects {
  metal(c,w,h){
    const T=this.tile;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)c.drawImage(this.panel,0,0,T,T,x*T,y*T,T,T);
    c.strokeStyle='#d8b46d';c.lineWidth=2;c.strokeRect(1,1,w*T-2,h*T-2);
  }
  previewCargo(c,p,valid,zoom){
    c.save();c.fillStyle=valid?'#dfc98730':'#f1866740';c.strokeStyle=valid?'#f5d995':'#ffa78b';c.lineWidth=1/zoom;
    for(const cell of cargoCells(p)){c.fillRect(cell.x*this.tile,cell.y*this.tile,this.tile,this.tile);c.strokeRect(cell.x*this.tile+1,cell.y*this.tile+1,this.tile-2,this.tile-2);}
    c.restore();
  }
  drawCargo(c,p,time,zoom,reduced){
    const T=this.tile,open=smooth((time-POD.unfold)/POD.panelDuration),projected=Math.sin(open*Math.PI/2);
    c.save();c.translate((p.x+p.w/2)*T,(p.y+p.h/2)*T);
    if(time>=POD.impact){
      for(let side=0;side<4;side++){
        const w=side%2?p.h:p.w,h=side%2?p.w:p.h;
        if(projected>0){
          c.save();c.rotate(side*Math.PI/2);c.translate(-w*T/2,-h*T/2);
          const age=time-POD.unfold-POD.panelDuration;
          const bounce=!reduced&&age>=0&&age<.25?Math.sin(age*55)*(1-age/.25)*3:0;
          c.save();c.translate(0,-h*T*projected+bounce);c.scale(1,projected);this.metal(c,w,h);c.restore();
          c.fillStyle='#bac0ad';c.fillRect(0,-2,w*T,4);
          if(!reduced&&age>=0&&age<.65)this.dust(c,w*T/2,-h*T,age,.65,6,side,Math.min(1.5,w*.35));
          c.restore();
        }
      }
      c.save();c.translate(-p.w*T/2,-p.h*T/2);this.metal(c,p.w,p.h);c.restore();
      if(!reduced&&time-POD.impact<.7)this.dust(c,0,0,time-POD.impact,.7,12,7,Math.min(2,Math.sqrt(p.w*p.h)*.4));
    }
    if(open<1){
      const fall=time<POD.impact?1-clamp(time/POD.impact)**2:0;
      c.save();c.globalAlpha=1-open;
      if(!reduced){c.translate(fall*5*T,-fall*9*T);c.scale(1+fall*.3,1+fall*.3);}
      c.scale(p.w/3,p.h/3);this.box(c,Math.max(0,time-POD.impact));c.restore();
    }
    c.restore();
  }
  cargoShake(p,time,camera,reduced,enabled){
    if(reduced||!enabled)return {x:0,y:0};
    const distance=Math.hypot((p.x+p.w/2)*this.tile-camera.x,(p.y+p.h/2)*this.tile-camera.y)*camera.zoom;
    let strength=0;
    for(const [at,power] of [[POD.impact,6],...(p.layout==='rail-crate'?[]:[[POD.unfold+POD.panelDuration,4]]),...(p.layout==='rail-line'?[[POD.unfold+2*POD.panelDuration,4]]:[])]){
      const age=time-at;if(age>=0&&age<.3)strength+=power*(1-age/.3);
    }
    strength*=Math.max(0,1-distance/700)*Math.min(1.5,Math.sqrt(p.w*p.h)/2);
    return {x:Math.sin(time*119)*strength,y:Math.cos(time*97)*strength*.65};
  }
}
export const cargoTime=(p,advance=0)=>p.remaining>0?Math.min(p.duration-.001,p.duration-p.remaining+Math.min(.1,Math.max(0,advance))):p.duration;
