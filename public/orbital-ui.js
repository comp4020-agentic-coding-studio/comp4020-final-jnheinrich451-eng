import {ORBITAL_PAYLOADS,orbitalProfile,orbitalImpactProfile,orbitalHazard,orbitalState,orbitalActive,orbitalPlan,orbitalError} from './orbital.js';
import {fieldCapacityError} from './hazards.js';
import {descentPose,drawDescentHead,entryOffset,noteDescent} from './reentry-art.js';

// Strike shells re-enter along the planet's orbital track and stay hypersonic to
// the ground: no braking, plasma all the way down. Windows end at saved impacts.
const SHELLS={HE:{window:2,height:24,size:1,opacity:.26},INCENDIARY:{window:2,height:24,size:.9,opacity:.24},GAS:{window:2,height:24,size:.9,opacity:.22},
 HEAVY:{window:3,height:34,size:2.3,opacity:.42,linger:20000},BARRAGE:{window:1.8,height:24,size:.8,opacity:.2},CLUSTER:{window:2,height:24,size:1.2,opacity:.28}};
const BURST=.55; // a cluster casing opens this long before its own impact

export function orbitalUI({state,api,stop,notify,overview,reveal}){
 const $=id=>document.getElementById(id),panel=$('orbital-panel');
 let busy=false,pending=null,payload='HE',bearing=0,target=null,end=null,beamStart=false,shownOrder=null;
 document.querySelector('.battlefield').append(panel);panel.classList.remove('panel');panel.classList.add('orbital-aiming');
 const cards=[...document.querySelectorAll('[data-orbital-payload]')];
 const directional=()=>['HE','INCENDIARY','CLUSTER'].includes(payload);
 const active=()=>!panel.hidden;
 const allowed=()=>{const {connected,paused,me}=state();return connected&&!paused&&me?.life==='active'&&me.body==='robot'&&!me.deploying;};
 const editable=()=>active()&&allowed()&&!busy&&!orbitalActive(orbitalState(state().world));
 const plan=()=>orbitalPlan(state().world,target,bearing,undefined,payload,end);
 function planError(p){const {world,combat}=state();return orbitalError(world,p)||(orbitalHazard(p.payload)?fieldCapacityError((combat?.fields||[]).concat(combat?.aquaticClouds||[]),combat?.salvos||[],p.payload,p.box.width*p.box.height):null);}
 function update(){
  const {world,connected,paused}=state();if(!world)return;
  const s=orbitalState(world),order=s.order,executing=orbitalActive(s);
  if(executing&&shownOrder!==order.id){target={...order.target};end=order.end?{...order.end}:null;bearing=order.bearing;payload=order.payload||'HE';shownOrder=order.id;beamStart=false;}
  $('orbital-open').disabled=!allowed();
  for(const card of cards){const cost=ORBITAL_PAYLOADS[card.dataset.orbitalPayload].cost;card.querySelector('.asset-cost').textContent=cost+' ORB';card.classList.toggle('short',cost>(world.logistics?.supplies||0));card.disabled=!allowed()||busy||(executing&&card.dataset.orbitalPayload!==payload);card.setAttribute('aria-pressed',String(active()&&card.dataset.orbitalPayload===payload));}
  const label=executing?order.callerName+' / '+(order.age<order.delay?'INCOMING '+Math.ceil(order.delay-order.age)+'s':orbitalProfile(order).label.toUpperCase()+' / '+order.points.filter(p=>p.landed).length+' / '+order.points.length):s.cooldown>0?'RECOVERY / '+Math.ceil(s.cooldown)+'s':'READY';
  $('orbital-live').hidden=!executing;$('orbital-live').textContent=label;
  if(!active())return;
  const profile=ORBITAL_PAYLOADS[payload],error=planError(plan());
  $('orbital-status').textContent=profile.label+' / '+profile.cost+' ORB / '+label;
  $('orbital-instructions').textContent=executing?'Strike committed.':payload==='BEAM'?(beamStart?`LMB / tap endpoint / up to ${profile.maxLength} tiles.`:`LMB / tap start, then endpoint / ${profile.duration}s cut.`):directional()?'Aim with mouse / R rotates / LMB or tap to call strike.':payload==='BARRAGE'?'Aim area / LMB or tap / 15 seconds of bombardment.':'Aim with mouse / LMB or tap to call strike.';
  $('orbital-rotate').hidden=!directional();$('orbital-rotate').disabled=!editable()||s.cooldown>0;
  $('orbital-rotate').textContent=payload==='BEAM'?'R / Rotate':'R / '+['North','East','South','West'][bearing];
  const reason=!connected?'Reconnect to issue orders.':paused?'Campaign paused.':busy?'Calling strike...':executing||s.cooldown>0?'':error||'';
  $('orbital-reason').textContent=reason;$('orbital-reason').hidden=!reason;
 }
 function open(nextPayload){
  if($('orbital-open').disabled)return;const wasOpen=active();stop();
  if(!orbitalActive(orbitalState(state().world))){if(typeof nextPayload==='string')payload=nextPayload;beamStart=false;pending=null;}
  const w=state().world;target||={x:Math.floor(w.width/2)+.5,y:Math.floor(w.height/2)+.5};
  if(payload==='BEAM'&&!beamStart&&!orbitalActive(orbitalState(w)))end={x:target.x+12,y:target.y};
  panel.hidden=false;reveal?.();document.querySelector('.battlefield').classList.add('orbital-planning');update();overview(wasOpen);$('world-canvas').focus({preventScroll:true});
 }
 function close(){panel.hidden=true;beamStart=false;for(const card of cards)card.setAttribute('aria-pressed','false');document.querySelector('.battlefield').classList.remove('orbital-planning');}
 // Hover only moves the preview. A touch drag remains camera panning.
 function aim(x,y){
  if(!editable())return;const point={x:Math.floor(x)+.5,y:Math.floor(y)+.5};
  if(payload==='BEAM'&&beamStart)end=point;
  else{target=point;if(payload==='BEAM')end={x:target.x+Math.cos(bearing*Math.PI/2)*12,y:target.y+Math.sin(bearing*Math.PI/2)*12};}
  pending=null;update();
 }
 function rotate(){
  if(!editable()||orbitalState(state().world).cooldown>0||!directional())return;
  bearing=(bearing+1)%4;
  if(payload==='BEAM'&&end){const dx=end.x-target.x,dy=end.y-target.y;end={x:target.x-dy,y:target.y+dx};}
  pending=null;update();
 }
 async function call(){
  if(!editable())return;const p=plan(),error=planError(p);if(error){notify(error);return;}
  pending ||= {orderId:crypto.randomUUID(),sequence:orbitalState(state().world).sequence+1,target:p.target,bearing:p.bearing,payload:p.payload,end:p.end};
  busy=true;update();try{await api('orbital/strike',pending);pending=null;beamStart=false;notify('Orbital strike committed. The crew can see its countdown.');}catch(e){notify(e.message);if(/Orbital orders changed/.test(e.message))pending=null;}finally{busy=false;update();}
 }
 function pick(x,y){
  if(!active())return false;if(!editable()||orbitalState(state().world).cooldown>0)return true;
  aim(x,y);
  if(payload==='BEAM'&&!beamStart){beamStart=true;update();return true;}
  void call();return true;
 }
 $('orbital-open').onclick=()=>active()?close():open();for(const card of cards)card.onclick=()=>open(card.dataset.orbitalPayload);
 $('orbital-close').onclick=close;$('orbital-rotate').onclick=rotate;
 $('orbital-reselect').onclick=()=>$('build-mode').click();
 function drawGround(c,T){
  const w=state().world;if(!w)return;const s=orbitalState(w),o=s.order,scars=[...(s.scars||[])];
  if(o?.payload==='BEAM'&&orbitalActive(s)){const last=o.points.findLast(p=>p.landed);if(last)scars.push({from:o.target,to:last});}
  c.save();c.strokeStyle='#242321aa';c.lineWidth=T*.65;c.lineCap='round';for(const scar of scars){c.beginPath();c.moveTo(scar.from.x*T,scar.from.y*T);c.lineTo(scar.to.x*T,scar.to.y*T);c.stroke();}c.restore();
 }
 function draw(c,T,zoom,elapsed=0,reduced=false){
  const w=state().world;if(!w)return;const s=orbitalState(w),executing=orbitalActive(s),o=executing?s.order:active()?plan():null;if(!o||o.error)return;
  const profile=orbitalProfile(o),beam=o.payload==='BEAM',age=executing?o.age+elapsed:0;c.save();c.strokeStyle=profile.color;c.fillStyle=profile.color;c.lineWidth=1.3/zoom;c.font=`bold ${10/zoom}px monospace`;
  if(beam){
   c.globalAlpha=.2;c.lineWidth=profile.radius*2*T;c.beginPath();c.moveTo(o.target.x*T,o.target.y*T);c.lineTo(o.end.x*T,o.end.y*T);c.stroke();c.globalAlpha=1;c.lineWidth=1.3/zoom;
   if(executing&&age>=o.delay){const t=Math.min(1,(age-o.delay)/profile.duration),x=(o.target.x+(o.end.x-o.target.x)*t)*T,y=(o.target.y+(o.end.y-o.target.y)*t)*T;
    // The beam is invisible in vacuum: it shows where air scatters it, so the
    // column brightens toward the ground. It comes down the planet's orbital track.
    const up=entryOffset(40),sx=x+up.x*T,sy=y+up.y*T;
    if(!reduced)noteDescent(o.id+':cut',{type:'cut',x:o.target.x,y:o.target.y,to:o.end,elapsed:age-o.delay,duration:profile.duration,linger:16000,preroll:0});
    for(const [width,red,green,blue,alpha] of reduced?[[2,255,242,199,1]]:[[14,255,72,44,.16],[6,255,103,63,.6],[2,255,249,223,1]]){
     const shade=c.createLinearGradient(x,y,sx,sy);shade.addColorStop(0,`rgba(${red},${green},${blue},${alpha})`);shade.addColorStop(.3,`rgba(${red},${green},${blue},${alpha*.45})`);shade.addColorStop(1,`rgba(${red},${green},${blue},${alpha*.06})`);
     c.strokeStyle=shade;c.lineWidth=width/zoom;c.beginPath();c.moveTo(sx,sy);c.lineTo(x,y);c.stroke();
    }
    c.fillStyle='#fff0b9';c.beginPath();c.arc(x,y,(reduced?3:5)/zoom,0,Math.PI*2);c.fill();c.strokeStyle=profile.color;c.lineWidth=1.3/zoom;
   }
  }
  if(o.payload==='BARRAGE'){c.globalAlpha=.7;c.setLineDash([7/zoom,5/zoom]);c.beginPath();c.arc(o.target.x*T,o.target.y*T,(profile.spread+profile.radius)*T,0,Math.PI*2);c.stroke();c.setLineDash([]);}
  for(const p of beam?[o.target,o.end]:o.points){if(p.landed)continue;const radius=orbitalImpactProfile(o,p).radius;c.globalAlpha=executing ? .5 : o.payload==='BARRAGE'||p.stage==='bomblet'?.3:.8;c.setLineDash([4/zoom,4/zoom]);c.beginPath();c.arc(p.x*T,p.y*T,radius*T,0,Math.PI*2);c.stroke();
   const until=o.delay+p.offset-age;c.setLineDash([]);
   if(!beam&&executing&&until>=0&&!reduced){drawShell(c,o,p,until,age,T);continue;}
   if(!beam&&executing&&until>=0&&until<(p.stage==='bomblet'?.45:1.1)){
    c.globalAlpha=1;c.strokeStyle='#fff3c8';c.lineWidth=(reduced?2:o.payload==='HEAVY'?6:3)/zoom;c.beginPath();
    if(p.stage==='bomblet'){
     const t=1-until/.45,x=(p.originX+(p.x-p.originX)*t)*T,y=(p.originY+(p.y-p.originY)*t)*T-Math.sin(t*Math.PI)*T;
     c.moveTo(x,y);c.lineTo(x-(p.x-p.originX)*T*.08,y-(p.y-p.originY)*T*.08);
    }else{const h=until/1.1*16*T;c.moveTo(p.x*T-h*.12,p.y*T-h);c.lineTo(p.x*T-h*.12-2/zoom,p.y*T-h-35/zoom);}
    c.stroke();c.strokeStyle=profile.color;c.lineWidth=1.3/zoom;
   }
  }
  const first=o.target,last=beam?o.end:o.payload==='CLUSTER'?o.points.findLast(p=>p.stage==='parent'):o.payload==='HE'?o.points.at(-2):o.points.at(-1);c.globalAlpha=1;c.fillStyle=profile.color;
  if(['HE','INCENDIARY','CLUSTER','BEAM'].includes(o.payload)){c.setLineDash([7/zoom,5/zoom]);c.beginPath();c.moveTo(first.x*T,first.y*T);c.lineTo(last.x*T,last.y*T);c.stroke();c.setLineDash([]);c.save();c.translate(last.x*T,last.y*T);c.rotate(Math.atan2(last.y-first.y,last.x-first.x)+Math.PI/2);c.beginPath();c.moveTo(0,-12/zoom);c.lineTo(-5/zoom,0);c.lineTo(5/zoom,0);c.closePath();c.fill();c.restore();}
  c.fillText(executing?`${profile.label.toUpperCase()} / ${o.callerName}`:profile.label.toUpperCase(),first.x*T,(first.y-profile.radius-1)*T);c.restore();
 }
 function drawShell(c,o,p,until,age,T){
  const spec=SHELLS[o.payload]||SHELLS.HE,id=o.id+':'+o.points.indexOf(p),offset=entryOffset(spec.height);
  c.save();c.globalAlpha=1;c.translate(p.x*T,p.y*T);
  if(p.stage==='bomblet'){
   // Bomblets leave the opened casing high up and spread to their own points.
   const parent=o.points.find(q=>q.stage==='parent'&&q.row===p.row);
   if(parent){
    const opened=o.delay+parent.offset-BURST,duration=o.delay+p.offset-opened,since=age-opened;
    if(since>=0){
     const casing=descentPose('shell',1-BURST/spec.window,offset),from={x:parent.x+casing.x-p.x,y:parent.y+casing.y-p.y};
     noteDescent(id,{x:p.x,y:p.y,offset:from,curve:'shell',elapsed:since,duration,size:.45,opacity:.18,preroll:0});
     drawDescentHead(c,descentPose('shell',Math.min(1,since/duration),from),T,.45);
    }
   }
   c.restore();return;
  }
  if(until<=spec.window){
   const s=1-until/spec.window;
   noteDescent(id,{x:p.x,y:p.y,offset,curve:'shell',elapsed:s*spec.window,duration:spec.window,size:spec.size,opacity:spec.opacity,linger:spec.linger});
   drawDescentHead(c,descentPose('shell',s,offset),T,spec.size);
   const opening=age-(o.delay+p.offset-BURST);
   if(o.payload==='CLUSTER'&&opening>=0&&opening<.35){
    const casing=descentPose('shell',1-BURST/spec.window,offset),r=T*(.6+opening*5),flash=c.createRadialGradient(casing.x*T,casing.y*T,0,casing.x*T,casing.y*T,r);
    flash.addColorStop(0,`rgba(255,248,226,${.9*(1-opening/.35)})`);flash.addColorStop(1,'rgba(255,170,90,0)');
    c.globalCompositeOperation='lighter';c.fillStyle=flash;c.fillRect(casing.x*T-r,casing.y*T-r,r*2,r*2);
   }
  }
  c.restore();
 }
 return {active,update,open,close,pick,aim,rotate,draw,drawGround};
}
