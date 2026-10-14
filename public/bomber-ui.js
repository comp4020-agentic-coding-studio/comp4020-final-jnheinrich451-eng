import {missionActive,missionError,strikePlan} from './bomber-mission.js';
import {isAttackJet} from './attack-jet.js';
export function bomberUI({state,api,stop,notify,overview}){
 const $=id=>document.getElementById(id),panel=$('bomber-panel');let busy=false,orderId=null;
 const active=()=>!panel.hidden,base=()=>state().world?.airbases.find(b=>b.id===$('bomber-select').value);
 const preview=()=>missionActive(base()?.aircraft)?base().aircraft.mission:strikePlan(state().world,{x:Number($('bomber-x').value),y:Number($('bomber-y').value)},Number($('bomber-bearing').value));
 function update(){
  const {world,me,connected}=state();if(!world)return;
  const bases=world.airbases.filter(b=>!isAttackJet(b.aircraft)),ids=bases.map(b=>b.id).join(',');
  $('bomber-open').disabled=!connected||me.life!=='active'||me.body==='orbital';
  if(!active())return;
  if($('bomber-select').dataset.ids!==ids){const chosen=$('bomber-select').value;$('bomber-select').replaceChildren(...bases.map((b,i)=>new Option('Bomber '+(i+1)+' / base '+b.x+':'+b.y,b.id)));if(bases.some(b=>b.id===chosen))$('bomber-select').value=chosen;$('bomber-select').dataset.ids=ids;}
  const b=base(),p=b?.aircraft,m=p?.mission,error=missionError(world,b),plan=preview();
  if(m&&panel.dataset.mission!==m.id){$('bomber-x').value=String(m.target.x);$('bomber-y').value=String(m.target.y);$('bomber-bearing').value=String(m.bearing);panel.dataset.mission=m.id;}
  for(const id of ['bomber-x','bomber-y','bomber-bearing'])$(id).disabled=missionActive(p);
  $('bomber-status').textContent=m?m.phase.toUpperCase()+(m.reason?' / '+m.reason:'')+' / '+(m.released?'Bombs released':'Bombs retained'):error||'READY / One HE run, then return and rearm';
  $('bomber-message').textContent=plan.error||'Click/tap the map or enter coordinates. Six HE bombs; the marked strip is a prediction. Flak can intercept.';
  $('bomber-dispatch').disabled=busy||!connected||me.life!=='active'||!!error||!!plan.error;
  $('bomber-recall').disabled=busy||!connected||!missionActive(p)||['return','landing','service','emergency'].includes(m?.phase);
 }
 function open(){stop();document.querySelector('.battlefield').classList.add('bomber-planning');panel.hidden=false;update();overview();if(!$('bomber-x').value){$('bomber-x').value=String(Math.floor(state().world.width*.7));$('bomber-y').value=String(Math.floor(state().world.height*.45));}$('bomber-select').focus();update();}
 function close(){panel.hidden=true;document.querySelector('.battlefield').classList.remove('bomber-planning');}
 function pick(x,y){if(!active())return false;if(missionActive(base()?.aircraft))return true;$('bomber-x').value=String(Math.floor(x)+.5);$('bomber-y').value=String(Math.floor(y)+.5);orderId=null;update();return true;}
 $('bomber-open').onclick=()=>active()?close():open();$('bomber-close').onclick=close;
 for(const id of ['bomber-select','bomber-x','bomber-y','bomber-bearing'])$(id).onchange=()=>{orderId=null;update();};
 $('bomber-dispatch').onclick=async()=>{if(busy||!base())return;busy=true;orderId ||= crypto.randomUUID();const p=preview(),id=base().id;update();try{await api('aircraft/mission',{id,orderId,target:p.target,bearing:p.bearing});notify('Bomber dispatched. Your current unit remains under your control.');orderId=null;}catch(e){notify(e.message);}finally{busy=false;update();}};
 $('bomber-recall').onclick=async()=>{if(busy||!base())return;busy=true;update();try{await api('aircraft/recall',{id:base().id});notify('Bomber returning. Already released bombs remain in flight.');}catch(e){notify(e.message);}finally{busy=false;update();}};
 function draw(c,T,zoom){
  const {world}=state();if(!world)return;c.save();c.lineWidth=1.4/zoom;c.font='bold '+10/zoom+'px monospace';
  for(const b of world.airbases){
   const m=b.aircraft.mission;if(!missionActive(b.aircraft))continue;c.fillStyle='#e7cb85';c.fillText(m.phase.toUpperCase(),b.aircraft.x*T,(b.aircraft.y+3)*T);c.strokeStyle='#eccb7a66';c.setLineDash([5/zoom,5/zoom]);c.beginPath();c.moveTo(b.aircraft.x*T,b.aircraft.y*T);c.lineTo(m.target.x*T,m.target.y*T);c.stroke();}
  if(active()){const p=preview();if(!p.error){c.strokeStyle='#f4d087';c.fillStyle='#f4d08715';c.setLineDash([]);for(const b of p.points){c.beginPath();c.arc(b.x*T,b.y*T,2*T,0,Math.PI*2);c.fill();c.stroke();}c.setLineDash([6/zoom,5/zoom]);c.beginPath();c.moveTo(p.entry.x*T,p.entry.y*T);c.lineTo(p.target.x*T,p.target.y*T);c.stroke();c.fillStyle='#f4d087';c.fillText('APPROACH',p.entry.x*T,p.entry.y*T);}}
  c.restore();
 }
 function drawGround(c,T){for(const b of state().world?.airbases||[]){for(const w of b.wrecks||[]){c.save();c.translate(w.x*T,w.y*T);c.rotate(w.angle);c.strokeStyle='#655b4b';c.lineWidth=.3*T;c.beginPath();c.moveTo(-T,T);c.lineTo(T,-T);c.moveTo(-T,-T);c.lineTo(T,T);c.stroke();c.restore();}}}
 return{active,update,pick,draw,drawGround,open,close};
}
