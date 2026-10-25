import {AQUATIC,isSpitter} from './aquatic-profile.js';
const TAU=Math.PI*2;
const oval=(c,x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();};
export function drawAquaticBody(c,site,time,reduced){
 const dead=site.state==='conquered',pulse=dead||reduced?1:1+Math.sin(time/450)*.05;
 oval(c,0,.1,1.55,1.3,dead?'#293b3c':'#254b48');oval(c,0,0,1.22,1.05,dead?'#454842':'#566044');
 for(let i=0;i<7;i++){const a=i*TAU/7,x=Math.cos(a)*.82,y=Math.sin(a)*.7;oval(c,x,y,.4*pulse,.32*pulse,dead?'#44433e':'#8c8a55');oval(c,x-.05,y-.06,.25,.18,dead?'#30362f':'#bad585');oval(c,x+.02,y+.07,.13,.09,'#283d36');}
 oval(c,0,0,.55,.52,'#344138');oval(c,0,0,.35,.32,dead?'#24312d':'#b0ce72');
 for(const x of [-.6,0,.6]){oval(c,x,.9,.24,.2,'#283e3e');oval(c,x,.9,.14,.09,dead?'#394a46':'#c4d8a0');}
 if(!dead&&time-site.hitAt<300){c.globalAlpha=.25;oval(c,0,0,1.2,1,'#f7e1b9');c.globalAlpha=1;}
}
export function drawBileSpitter(c,e,time,T,reduced,hit=0){
 c.save();c.translate(e.x*T,e.y*T);c.rotate(e.angle||0);c.scale(T,T);
 const pulse=reduced?1:1+Math.sin(time*4+e.id)*.04;
 oval(c,.08,.12,.65,.8,'#163c4277');oval(c,0,0,.48,.66,'#2d514b');
 for(const side of [-1,1])for(let i=0;i<3;i++){c.strokeStyle='#98b19b';c.lineWidth=.08;c.beginPath();c.moveTo(side*.3,(i-1)*.3);c.lineTo(side*(.6+(reduced?0:Math.sin(time*6+i)*.05)),(i-1)*.4+.18);c.stroke();}
 oval(c,0,.18,.34*pulse,.38*pulse,e.attack?'#dfec9c':'#9dad60');oval(c,0,-.45,.25,.28,'#6d8762');oval(c,0,-.66,.14,.12,e.attack?'#ddeb89':'#263e3a');
 if(hit){c.globalAlpha=Math.min(.6,hit);oval(c,0,0,.48,.66,'#fff0b3');}c.restore();
}
export function drawAquaticFields(c,combat,T,zoom,time,reduced){
 for(const f of combat.aquaticClouds||[]){
  if(time>=f.expiresAt)continue;const warning=time<f.activeAt;
  c.save();c.translate(f.x*T,f.y*T);c.lineWidth=1.5/zoom;c.strokeStyle=warning?'#eff09e':'#b6d78a';c.fillStyle=warning?'#c9dc5920':'#96b45d32';
  c.setLineDash(warning?[6/zoom,4/zoom]:[]);c.beginPath();c.arc(0,0,f.radius*T,0,TAU);c.fill();c.stroke();c.setLineDash([]);
  if(!warning)for(let i=0;i<7;i++){const a=i*2.4+(reduced?0:time/8000),r=f.radius*T*.5;oval(c,Math.cos(a)*r,Math.sin(a)*r,f.radius*T*.33,f.radius*T*.24,'#aaca7330');}
  const label=warning?(f.kind==='vent'?'POISON VENT / ':'BILE IMPACT / ')+Math.max(0,(f.activeAt-time)/1000).toFixed(1)+'s':'TOXIC / KEEP CLEAR';
  c.font=`${10/zoom}px monospace`;c.textAlign='center';c.fillStyle='#e5efb6';c.fillText(label,0,-f.radius*T-5/zoom);c.restore();
 }
 // The windup is visible before projectile/field capacity is committed.
 for(const e of combat.enemies||[])if(isSpitter(e)&&e.attack){const p=e.attack;c.save();c.strokeStyle='#eef39e';c.lineWidth=1.5/zoom;c.setLineDash([4/zoom,3/zoom]);c.beginPath();c.arc(p.x*T,p.y*T,AQUATIC.blastRadius*T,0,TAU);c.stroke();c.restore();}
}
