import {ORBITAL_PAYLOADS,orbitalProfile,orbitalHazard,orbitalState,orbitalActive,orbitalPlan,orbitalError} from './orbital.js';
import {fieldCapacityError} from './hazards.js';

export function orbitalUI({state,api,stop,notify,overview,reveal}){
 const $=id=>document.getElementById(id),panel=$('orbital-panel');
 let busy=false,pending=null,payload='HE',bearing=0,target=null,end=null,beamStart=false,shownOrder=null;
 $('deployment-tray').append(panel);panel.classList.add('orbital-inline');
 const cards=[...document.querySelectorAll('[data-orbital-payload]')];
 const active=()=>!panel.hidden;
 const allowed=()=>{const {connected,paused,me}=state();return connected&&!paused&&me?.life==='active'&&me.body==='robot'&&!me.deploying;};
 const editable=()=>active()&&allowed()&&!busy&&!orbitalActive(orbitalState(state().world));
 const plan=()=>orbitalPlan(state().world,target,bearing,undefined,payload,end);
 function planError(p){const {world,combat}=state();return orbitalError(world,p)||(orbitalHazard(p.payload)?fieldCapacityError(combat?.fields||[],combat?.salvos||[],p.payload,p.box.width*p.box.height):null);}
 function update(){
  const {world,connected,paused}=state();if(!world)return;
  const s=orbitalState(world),order=s.order,executing=orbitalActive(s);
  if(executing&&shownOrder!==order.id){target={...order.target};end=order.end?{...order.end}:null;bearing=order.bearing;payload=order.payload||'HE';shownOrder=order.id;beamStart=false;}
  $('orbital-open').disabled=!allowed();
  for(const card of cards){card.disabled=!allowed()||busy||(executing&&card.dataset.orbitalPayload!==payload);card.setAttribute('aria-pressed',String(active()&&card.dataset.orbitalPayload===payload));}
  const label=executing?order.callerName+' / '+(order.age<order.delay?'INCOMING '+Math.ceil(order.delay-order.age)+'s':orbitalProfile(order).label.toUpperCase()+' / '+order.points.filter(p=>p.landed).length+' / '+order.points.length):s.cooldown>0?'RECOVERY / '+Math.ceil(s.cooldown)+'s':'READY';
  $('orbital-live').hidden=!executing;$('orbital-live').textContent=label;
  if(!active())return;
  const profile=ORBITAL_PAYLOADS[payload],error=planError(plan());
  $('orbital-status').textContent=profile.label+' / '+profile.cost+' ORB / '+label;
  $('orbital-instructions').textContent=executing?'Strike committed.':payload==='BEAM'?(beamStart?'LMB / tap endpoint to call beam.':'LMB / tap to anchor beam start; second click calls it.'):payload==='GAS'?'Aim with mouse / LMB or tap to call gas.':'Aim with mouse / R rotates / LMB or tap to call strike.';
  $('orbital-rotate').hidden=payload==='GAS'||payload==='BEAM';$('orbital-rotate').disabled=!editable()||s.cooldown>0;
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
  if(!editable()||orbitalState(state().world).cooldown>0||payload==='GAS'||payload==='BEAM')return;
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
    for(const [width,color] of reduced?[[2,'#fff2c7']]:[[14,'#ff482c22'],[6,'#ff673f99'],[2,'#fff9df']]){c.strokeStyle=color;c.lineWidth=width/zoom;c.beginPath();c.moveTo(x-2*T,y-20*T);c.lineTo(x,y);c.stroke();}
    c.fillStyle='#fff0b9';c.beginPath();c.arc(x,y,(reduced?3:5)/zoom,0,Math.PI*2);c.fill();c.strokeStyle=profile.color;c.lineWidth=1.3/zoom;
   }
  }
  for(const p of beam?[o.target,o.end]:o.points){if(p.landed)continue;c.globalAlpha=executing ? .55 : .8;c.setLineDash([4/zoom,4/zoom]);c.beginPath();c.arc(p.x*T,p.y*T,profile.radius*T,0,Math.PI*2);c.stroke();
   const until=o.delay+p.offset-age;c.setLineDash([]);
   if(!beam&&executing&&until>=0&&until<1.1){const h=until/1.1*16*T;c.globalAlpha=1;c.strokeStyle='#fff3c8';c.lineWidth=(reduced?2:3)/zoom;c.beginPath();c.moveTo(p.x*T-h*.12,p.y*T-h);c.lineTo(p.x*T-h*.12-2/zoom,p.y*T-h-35/zoom);c.stroke();c.strokeStyle=profile.color;c.lineWidth=1.3/zoom;}
  }
  const first=o.target,last=beam?o.end:o.points[o.points.length-(o.payload==='INCENDIARY'?1:2)];c.globalAlpha=1;c.fillStyle=profile.color;
  if(o.payload!=='GAS'){c.setLineDash([7/zoom,5/zoom]);c.beginPath();c.moveTo(first.x*T,first.y*T);c.lineTo(last.x*T,last.y*T);c.stroke();c.setLineDash([]);c.save();c.translate(last.x*T,last.y*T);c.rotate(Math.atan2(last.y-first.y,last.x-first.x)+Math.PI/2);c.beginPath();c.moveTo(0,-12/zoom);c.lineTo(-5/zoom,0);c.lineTo(5/zoom,0);c.closePath();c.fill();c.restore();}
  c.fillText(executing?`${profile.label.toUpperCase()} / ${o.callerName}`:profile.label.toUpperCase(),first.x*T,(first.y-profile.radius-1)*T);c.restore();
 }
 return {active,update,open,close,pick,aim,rotate,draw,drawGround};
}
