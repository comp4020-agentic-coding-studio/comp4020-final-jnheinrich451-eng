import { airborne, hurtAircraft } from './aircraft.js';
import { turnTurret, angleDelta } from './turret.js';

export const MOBILE_LASERS = Object.freeze({
  'twin-lens': Object.freeze({ range:18, charge:1.2, burst:2, cooldown:4, track:Math.PI/12, dps:24, speed:1.4, brace:.35 }),
  'heavy-lens': Object.freeze({ range:30, charge:2, burst:2.5, cooldown:7, track:Math.PI/36, dps:48, speed:.55, brace:.6 }),
});
export const mobileLaser = e => MOBILE_LASERS[e.kind];
export function cancelMobileLaser(e) {
  const m=e.airLaser, p=mobileLaser(e); if(!m||!p)return;
  if(['bracing','charging','firing'].includes(m.phase)) { m.phase='cooling';m.remaining=p.cooldown; }
  m.beam=null;m.targetId=null;
}
const bearing=(e,p)=>Math.atan2(p.x-e.x,e.y-p.y);
export function mobileBeam(e, angle, range, lens=0) {
  const offset=e.kind==='twin-lens'?(lens? .18:-.18):0;
  const x=e.x+Math.cos(angle)*offset,y=e.y+Math.sin(angle)*offset;
  return {fromX:x,fromY:y,x:x+Math.sin(angle)*range,y:y-Math.cos(angle)*range};
}
// Shared server state. No projectile entities or ray march through ground tiles:
// like spore flak, these elevated beams target airborne hulls above ground cover.
export function tickMobileLaser(e, planes, dt, now, clear, emit=event=>{}) {
  const p=mobileLaser(e);if(!p)return;
  const m=e.airLaser ||= {phase:'watching',remaining:0,angle:e.angle||0,targetId:null,beam:null,hitIds:[],patrol:0};
  e.attack=null;e.targetId=null;e.path=[];
  if(e.hp<=0){cancelMobileLaser(e);m.phase='silent';return;}
  if(['bracing','charging','firing'].includes(m.phase)&&Math.hypot(e.x-m.anchorX,e.y-m.anchorY)>.001)cancelMobileLaser(e);
  const live=planes.filter(a=>airborne(a)&&Math.hypot(a.x-e.x,a.y-e.y)<=p.range);
  let target=live.find(a=>a.id===m.targetId);
  if(['bracing','charging','firing'].includes(m.phase)&&!target)cancelMobileLaser(e);
  if(m.phase==='watching') {
    target=live.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y)||a.id.localeCompare(b.id))[0];
    if(target){Object.assign(m,{phase:'bracing',remaining:p.brace,targetId:target.id,anchorX:e.x,anchorY:e.y,angle:bearing(e,target),hitIds:[]});return;}
  }
  if(m.phase==='bracing'||m.phase==='charging') {
    // Freeze the warning bearing while charging. Pilots can start evading now.
    m.remaining=Math.max(0,m.remaining-dt);
    if(m.remaining<=1e-8){
      m.phase=m.phase==='bracing'?'charging':'firing';m.remaining=m.phase==='charging'?p.charge:p.burst;
      if(m.phase==='firing')emit({event:'enemy.weapon.launched',kind:'system',sourceId:String(e.id),weapon:e.kind.toUpperCase(),targetId:m.targetId});
    }
    return;
  }
  if(m.phase==='firing') {
    const active=Math.min(dt,m.remaining),start=m.angle,end=turnTurret(start,bearing(e,target),active,p.track);
    // Sample a bounded angular sweep: a fast crossing receives only the fraction
    // of this tick intersected. Two alternating lenses share this single budget.
    const exposure=new Map();
    for(let i=0;i<8;i++){
      const angle=start+angleDelta(start,end)*(i+.5)/8;
      const lens=Math.floor((p.burst-m.remaining+active*(i+.5)/8)/.16)%2;
      const ray=mobileBeam(e,angle,p.range,lens),dx=Math.sin(angle),dy=-Math.cos(angle);
      const hits=live.map(a=>{const x=a.x-ray.fromX,y=a.y-ray.fromY;return {a,along:x*dx+y*dy,side:Math.abs(x*dy-y*dx)};})
        .filter(h=>h.along>=0&&h.along<=p.range&&h.side<=.6).sort((a,b)=>a.along-b.along);
      if(hits[0])exposure.set(hits[0].a,(exposure.get(hits[0].a)||0)+active/8);
    }
    m.angle=end;m.lens=Math.floor((p.burst-m.remaining+active)/.16)%2;m.beam=mobileBeam(e,end,p.range,m.lens);
    for(const [a,time]of exposure)if(hurtAircraft(a,p.dps*time)&&!m.hitIds.includes(a.id)){
      m.hitIds.push(a.id);emit({event:'enemy.weapon.hit',kind:'system',sourceId:String(e.id),targetId:a.id,weapon:e.kind.toUpperCase(),hp:a.health});
    }
    m.remaining=Math.max(0,m.remaining-active);
    if(m.remaining<=1e-8){m.phase='cooling';m.remaining=p.cooldown;m.beam=null;m.targetId=null;}
    return;
  }
  if(m.phase==='cooling'){m.remaining=Math.max(0,m.remaining-dt);if(m.remaining<=1e-8)m.phase='watching';}
  // Short, collision-checked local repositioning, never cross-map pursuit.
  const home=e.rally||{x:e.homeX??(m.homeX??=e.x),y:e.homeY??(m.homeY??=e.y)};
  const angle=(Number(e.id)||0)*2.4+m.patrol*Math.PI/2;
  const goal={x:home.x+Math.cos(angle)*3,y:home.y+Math.sin(angle)*3};
  const distance=Math.hypot(goal.x-e.x,goal.y-e.y);
  if(distance<.2){m.patrol++;return;}
  const step=Math.min(.2,p.speed*dt,distance),x=e.x+(goal.x-e.x)/distance*step,y=e.y+(goal.y-e.y)/distance*step;
  if(clear(x,y)){e.angle=bearing(e,{x,y});e.x=x;e.y=y;}else m.patrol++;
}
