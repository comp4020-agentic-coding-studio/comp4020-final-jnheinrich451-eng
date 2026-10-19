import { mobileLaser, mobileBeam } from './mobile-laser.js';
const TAU=Math.PI*2;
const oval=(c,x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();};
export function drawLensCrawler(c,e,time,hit=0,dead=false) {
  const heavy=e.kind==='heavy-lens',m=e.airLaser,braced=['bracing','charging','firing'].includes(m?.phase);
  c.save();c.translate(e.x,e.y);c.rotate(e.angle||0);
  const w=heavy?29:18,h=heavy?31:25,gait=dead||braced?0:Math.sin(time*8+e.id)*4;
  oval(c,3,6,w+7,h+6,'#17212655');
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const y=-18+i*18,s=gait*(i%2?1:-1),spread=braced?8:0;
    c.lineCap='round';c.strokeStyle='#452039';c.lineWidth=8;
    c.beginPath();c.moveTo(side*(w-8),y);c.lineTo(side*(w+9+spread),y+7+s);c.lineTo(side*(w+13+spread),y-4+s);c.stroke();
    c.strokeStyle=dead?'#593f4a':'#d08779';c.lineWidth=2;c.stroke();
  }
  oval(c,0,6,w,h,dead?'#503343':hit?'#ecc0a1':'#913e42');
  for(let i=0;i<4;i++)oval(c,0,23-i*10,w-3,6,dead?'#3f2937':'#5d2846');
  c.rotate((m?.angle??e.angle??0)-(e.angle||0));
  const charging=m?.phase==='charging',firing=m?.phase==='firing';
  for(const [i,x]of (heavy?[0]:[-11,11]).entries()){
    const r=heavy?20:10,y=heavy?-9:-17;
    oval(c,x,y,r+4,r+5,dead?'#3c303d':'#c18c84');
    oval(c,x,y,r,r+1,dead?'#342b33':'#452245');
    oval(c,x,y,r*.72,r*.8,dead?'#292633':firing&&(heavy||m.lens===i)?'#fff3ce':charging?'#ffba99':'#c24d73');
    oval(c,x-r*.2,y-r*.3,r*.22,r*.25,dead?'#3c3440':'#ffe2c3');
    if(charging){c.strokeStyle='#ffb9a0';c.lineWidth=2;c.beginPath();c.arc(x,y,r+8,0,TAU);c.stroke();}
  }
  c.restore();
}
export function drawMobileLaserBeams(c,enemies,tile,zoom) {
  for(const e of enemies){
    const p=mobileLaser(e),m=e.airLaser;
    if(!p||e.hp<=0||!['charging','firing'].includes(m?.phase))continue;
    const firing=m.phase==='firing',ray=firing?m.beam:mobileBeam(e,m.angle,p.range);
    if(!ray)continue;
    c.save();c.lineCap='round';
    const line=(color,width)=>{c.strokeStyle=color;c.lineWidth=width/zoom;c.beginPath();c.moveTo(ray.fromX*tile,ray.fromY*tile);c.lineTo(ray.x*tile,ray.y*tile);c.stroke();};
    if(!firing){c.setLineDash([5/zoom,8/zoom]);line('#ffa4baaa',1.5);}
    else {line('#ff285355',e.kind==='heavy-lens'?16:9);line('#ff506c',e.kind==='heavy-lens'?6:3);line('#fff4d8',1.4);}
    c.restore();
  }
}
