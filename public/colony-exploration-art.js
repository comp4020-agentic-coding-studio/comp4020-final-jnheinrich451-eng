import { projectColonyPoint, COLONY_DEPTH } from './colony-view.js';
const point=(x,y,z=0)=>{const p=projectColonyPoint(x,y,z);return[p.x,p.y];};
const circle=(c,x,y,z,rx,ry,color)=>{c.beginPath();c.ellipse(...point(x,y,z),rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();};
const line=(c,points,color,width=.03)=>{c.beginPath();c.moveTo(...point(...points[0]));for(const p of points.slice(1))c.lineTo(...point(...p));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
export function drawRegionDiscovery(c,d,{known=false,selected=false,time=0,reduced=false,near=false}={}){
  const{x,y}=d;c.save();
  circle(c,x,y,0,1.2,.65,'#526f4d13');
  if(d.kind==='flower'){
    for(let i=0;i<7;i++){const a=i*2.4,dx=Math.cos(a)*.65,dy=Math.sin(a)*.5,z=.55+(i%3)*.15;line(c,[[x+dx,y+dy,0],[x+dx,y+dy,z]],'#758c60',.04);circle(c,x+dx-.12,y+dy,z*.45,.2,.07,'#8fab75');for(let j=0;j<5;j++){const q=j*Math.PI*2/5;circle(c,x+dx+Math.cos(q)*.13,y+dy+Math.sin(q)*.08,z,.14,.10,'#eac1b1');}circle(c,x+dx,y+dy,z+.02,.06,.04,'#f4e4b8');}
  }else if(d.kind==='reed'){
    circle(c,x,y,0,1.1,.50,'#bacbb8');for(let i=0;i<9;i++){const dx=Math.sin(i*2.3)*.7,dy=Math.cos(i*2.3)*.25,z=.85+(i%4)*.12,sway=reduced?0:Math.sin(time*.8+i)*.035;line(c,[[x+dx,y+dy,0],[x+dx+sway,y+dy,z]],'#7a9c7c',.035);line(c,[[x+dx+sway,y+dy,z],[x+dx+sway,y+dy,z+.18]],'#d6d5b3',.08);}
  }else if(d.kind==='mineral'){
    for(let i=0;i<5;i++){const dx=Math.cos(i*2.3)*.7,dy=Math.sin(i*2.3)*.5,z=.4+i%3*.15;c.beginPath();c.moveTo(...point(x+dx-.35,y+dy,0));c.lineTo(...point(x+dx-.22,y+dy,z));c.lineTo(...point(x+dx+.16,y+dy,z+.13));c.lineTo(...point(x+dx+.36,y+dy+.1,0));c.closePath();c.fillStyle=i%2?'#c6b1ac':'#ddd0bb';c.fill();c.strokeStyle='#a29685';c.lineWidth=.025;c.stroke();line(c,[[x+dx-.23,y+dy,z*.7],[x+dx+.25,y+dy,z*.6]],'#f4dbc4',.05);}
  }else if(d.kind==='landmark'){
    line(c,[[x-1.1,y-.15,.27],[x+1.1,y+.15,.27]],'#967f65',.55);line(c,[[x-1.03,y-.17,.44],[x+.95,y+.08,.44]],'#bd9f7e',.12);circle(c,x+1.08,y+.15,.27,.25,.20,'#dec6a3');circle(c,x+1.08,y+.15,.27,.14,.10,'#77705a');for(let i=0;i<4;i++)circle(c,x-.65+i*.35,y-.05,.55,.18,.07,'#9eb38a');
  }else if(d.kind==='shoal'||d.id.includes('silverfin')){
    circle(c,x,y,0,1.0,.57,'#a3c5bd');circle(c,x,y,.01,.8,.43,'#8db8b5');for(let i=0;i<5;i++){const a=i*1.4+(reduced?0:time*.18);circle(c,x+Math.cos(a)*.5,y+Math.sin(a)*.35,.03,.15,.045,'#d6e4ce');}
  }else{
    for(let i=0;i<3;i++){circle(c,x+Math.sin(i*2)*.6,y+Math.cos(i*2)*.3,0,.45,.25,'#9fb389');circle(c,x+Math.sin(i*2)*.6,y+Math.cos(i*2)*.3,.2,.3,.18,'#e0b9ac');}
    for(let i=0;i<5;i++){const a=i*1.25+(reduced?0:time*.25),dx=Math.cos(a)*.8,dy=Math.sin(a)*.4,z=.8+(i%2)*.25,w=reduced?.09:.05+Math.abs(Math.sin(time*4+i))*.07;circle(c,x+dx-w,y+dy,z,w,.055,'#eff3d9');circle(c,x+dx+w,y+dy,z,w,.055,'#e0d8ca');}
  }
  const z=1.7;c.beginPath();const [px,py]=point(x,y,z);c.moveTo(px,py-.10);c.lineTo(px+.11,py);c.lineTo(px,py+.10);c.lineTo(px-.11,py);c.closePath();c.fillStyle=known?'#8da580':'#f7edca';c.fill();c.strokeStyle=known?'#637d5c':'#a68e58';c.lineWidth=.025;c.stroke();
  if(selected||near){c.font='.25px "IBM Plex Sans",sans-serif';c.textAlign='center';const width=c.measureText(d.name).width+.32;c.fillStyle='#f5f6e7e8';c.beginPath();c.roundRect(px-width/2,py-.57,width,.33,.06);c.fill();c.fillStyle='#3b5544';c.fillText(d.name,px,py-.33);}
  c.restore();
}
export function drawRegionLanding(c,world){
  if(!world.regionId||world.regionId==='home')return;const{x,y}=world.spawn;
  circle(c,x,y,0,1.1,.70,'#e5dfc877');
  c.save();c.strokeStyle='#fcf7dfaa';c.lineWidth=.04;c.setLineDash([.2,.14]);c.beginPath();c.ellipse(x,y*COLONY_DEPTH,1.25,.83,0,0,Math.PI*2);c.stroke();c.restore();
  line(c,[[x-1.3,y-.8,0],[x-1.3,y-.8,.9]],'#697c71',.05);circle(c,x-1.3,y-.8,.95,.12,.07,'#dfbf72');
}
