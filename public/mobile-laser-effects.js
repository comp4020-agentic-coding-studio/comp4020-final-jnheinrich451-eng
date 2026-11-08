import { mobileLaser, mobileBeam } from './mobile-laser.js';
import { drawEnemyCrawler, lensMuzzle } from './enemy-art.js';
// Lens bodies are drawn by enemy-art.js; this keeps the older entry point.
export function drawLensCrawler(c,e,time,hit=0,dead=false,reduced=false) {
  c.save();c.translate(e.x,e.y);c.rotate(e.angle||0);drawEnemyCrawler(c,e,time,hit,dead,reduced);c.restore();
}
// The server's ray decides hits; the visible beam starts at the drawn aperture
// so it leaves the barrel rather than the body centre.
export function drawMobileLaserBeams(c,enemies,tile,zoom) {
  for(const e of enemies){
    const p=mobileLaser(e),m=e.airLaser;
    if(!p||e.hp<=0||!['charging','firing'].includes(m?.phase))continue;
    const firing=m.phase==='firing',ray=firing?m.beam:mobileBeam(e,m.angle,p.range);
    if(!ray)continue;
    const from=lensMuzzle(e,tile,firing&&e.kind==='twin-lens'?(m.lens||0):null);
    c.save();c.lineCap='round';
    const line=(color,width)=>{c.strokeStyle=color;c.lineWidth=width/zoom;c.beginPath();c.moveTo(from.x,from.y);c.lineTo(ray.x*tile,ray.y*tile);c.stroke();};
    if(!firing){c.setLineDash([5/zoom,8/zoom]);line('#ffa4baaa',1.5);}
    else {line('#ff285355',e.kind==='heavy-lens'?16:9);line('#ff506c',e.kind==='heavy-lens'?6:3);line('#fff4d8',1.4);}
    c.restore();
  }
}
