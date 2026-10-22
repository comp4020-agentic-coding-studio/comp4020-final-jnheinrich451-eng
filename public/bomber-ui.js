import { isCarrier } from './carrier.js';
import { aircraftOption, aircraftStatus, airfieldLabel, airfieldAtRobot } from './air-support-status.js';
import { parkingPoint } from './aircraft.js';
import { isHelicopter, HELI_ROCKET } from './helicopter.js';
const gunAircraft=p=>isHelicopter(p)||isAttackJet(p);
import { airRecords, airfields, flightBase, liveAircraft, runwayAvailable } from './air-traffic.js';
import {isCruising,recoverableAircraft,missionActive,missionError,strikePlan} from './bomber-mission.js';
import {isAttackJet,JET} from './attack-jet.js';
import {BOMBER_PAYLOADS,payloadProfile} from './bomber-payloads.js';
export function bomberUI({state,api,stop,notify,overview}){
 const $=id=>document.getElementById(id),panel=$('bomber-panel');let busy=false,orderId=null,preferLanding=false,requestedBase=null;
 $('bomber-payload').replaceChildren(...Object.entries(BOMBER_PAYLOADS).map(([key,p])=>new Option(p.label,key)));
 const canOpen=()=>{const {world,me}=state();return me?.body==='robot'||world?.ships?.some(s=>s.id===me?.shipId&&isCarrier(s));};
 const active=()=>!panel.hidden,base=()=>airRecords(state().world||{}).find(b=>b.id===$('bomber-select').value);
 const preview=()=>missionActive(base()?.aircraft)&&!isCruising(base()?.aircraft)?base().aircraft.mission:strikePlan(state().world,{x:Number($('bomber-x').value),y:Number($('bomber-y').value)},Number($('bomber-bearing').value),gunAircraft(base()?.aircraft)?'HE':$('bomber-payload').value,base()?.aircraft);
 function update(){
  const {world,me,connected}=state();if(!world)return;
  const bases=airRecords(world).filter(b=>liveAircraft(b.aircraft)),ids=bases.map(b=>b.id+':'+b.aircraft.kind+':'+b.aircraft.baseId).join(',');
  $('bomber-open').disabled=!connected||me.life!=='active'||!canOpen();
  if(!active())return;
  const aircraftSelect=$('bomber-select');
  if(aircraftSelect.dataset.ids!==ids){const chosen=aircraftSelect.value;aircraftSelect.replaceChildren(...bases.map(b=>new Option('',b.id)));if(bases.some(b=>b.id===chosen))aircraftSelect.value=chosen;aircraftSelect.dataset.ids=ids;}
  bases.forEach((b,i)=>{const label=aircraftOption(world,b,i);if(aircraftSelect.options[i].text!==label)aircraftSelect.options[i].text=label;});
  const b=base(),p=b?.aircraft,m=p?.mission;
  if(m&&m.kind!=='cruise'&&panel.dataset.mission!==m.id){$('bomber-x').value=String(m.target.x);$('bomber-y').value=String(m.target.y);$('bomber-bearing').value=String(m.bearing);$('bomber-payload').value=m.payload||'HE';panel.dataset.mission=m.id;}
  const plan=preview(),profile=payloadProfile(plan.payload||$('bomber-payload').value),error=missionError(world,flightBase(world,b),gunAircraft(p)?'HE':$('bomber-payload').value);
  const destinations=airfields(world).filter(d=>runwayAvailable(world,d,p)),select=$('bomber-landing-base'),available=destinations.map(d=>d.id).join(',');
  const nearby=airfieldAtRobot(world,me),preferred=requestedBase||nearby?.id;
  if(select.dataset.ids!==available){const chosen=select.value;select.replaceChildren(...destinations.map(d=>new Option('',d.id)));if(destinations.some(d=>d.id===chosen))select.value=chosen;else if(destinations.some(d=>d.id===p?.baseId))select.value=p.baseId;select.dataset.ids=available;}
  destinations.forEach((d,i)=>{const label=airfieldLabel(d)+(d.id===nearby?.id?' / YOU ARE HERE':'');if(select.options[i].text!==label)select.options[i].text=label;});
  if(preferLanding){if(destinations.some(d=>d.id===preferred))select.value=preferred;preferLanding=false;requestedBase=null;}
  for(const id of ['bomber-x','bomber-y','bomber-bearing','bomber-payload'])$(id).disabled=(missionActive(p)&&!isCruising(p))||busy;
  $('bomber-status').textContent=isCruising(p)?'CRUISE / '+(gunAircraft(p)?p.rounds+' rounds':p.runs+' bay charges')+' / Recall to land':missionActive(p)?aircraftStatus(p)+(m.reason?' / '+m.reason:''):p?aircraftStatus(p)+' / '+(error||'Ready for orders'):'No aircraft deployed';
  $('bomber-payload').hidden=gunAircraft(p);
  const detail=isHelicopter(p)?'Ten-second cannon support / five-second rocket sweep.':gunAircraft(p)?'Finite autocannon pass / recall to refill rounds.':profile.count===1?'One heavy HE bomb / 5-tile damage radius / full load.':profile.weapon==='INCENDIARY'?'Six fire bombs / 18-second burning patches.':profile.weapon==='GAS'?'Six gas bombs / 9 shared kills until exhausted.':'Six HE bombs / 2-tile damage radius each.';
  $('bomber-message').textContent=plan.error||detail+' Rings predict damage areas. Flak can intercept the dive.';
  $('bomber-dispatch').textContent=(isCruising(p)?'Strike, then cruise / ':'Dispatch / ')+(isHelicopter(p)?'Fire support':gunAircraft(p)?'Strafe':profile.short);
  $('bomber-dispatch').disabled=busy||!connected||me.life!=='active'||me.body!=='robot'||!!error||!!plan.error;
  $('bomber-dispatch').title=me.body!=='robot'?'Return to your robot to issue strike orders.':'';
  const otherPilot=p?.occupant&&p.occupant!==me.id&&state().players?.some(v=>v.id===p.occupant);
  const destination=destinations.find(d=>d.id===select.value);
  $('bomber-recall').textContent=(missionActive(p)&&!isCruising(p)?'Abort / return to ':'Recall to ')+(destination?airfieldLabel(destination):'base');
  const recallReason=!p?'Deploy an aircraft first.':otherPilot?'Another pilot is controlling this aircraft.':['parked','delivering'].includes(p.state)?(p.state==='parked'?'Already on the ground. Select a CRUISING aircraft to call it back.':'Wait for aircraft assembly to finish.'):missionActive(p)&&['return','landing','service','emergency'].includes(m?.phase)?'Recovery already in progress / '+airfieldLabel(flightBase(world,b))+'.':!destinations.length?'No compatible free landing destination. Clear or rebuild a runway/pad; stop a carrier to use its deck.':(!missionActive(p)&&!recoverableAircraft(p))?'This aircraft cannot be recalled yet.':null;
  $('bomber-recall').disabled=busy||!connected||!!recallReason;
  $('bomber-recall').title=recallReason||'Return this aircraft to the selected landing destination.';
  $('bomber-recall-help').textContent=recallReason||(nearby&&destination?.id!==nearby.id?'Your current airbase is unavailable or another destination is selected. ':'')+'Recall reserves the selected landing space; aircraft fly back and rearm.';
 }
 function open(destinationId=null){if(!canOpen()){notify('Return to your robot to issue remote orders.');return;}stop();document.querySelector('.battlefield').classList.add('bomber-planning');panel.hidden=false;preferLanding=true;requestedBase=destinationId;update();const cruising=airRecords(state().world).find(b=>isCruising(b.aircraft));if(!isCruising(base()?.aircraft)&&cruising){$('bomber-select').value=cruising.id;preferLanding=true;requestedBase=destinationId;}overview();if(!$('bomber-x').value){$('bomber-x').value=String(Math.floor(state().world.width*.7));$('bomber-y').value=String(Math.floor(state().world.height*.45));}$('bomber-select').focus();update();}
 function close(){panel.hidden=true;document.querySelector('.battlefield').classList.remove('bomber-planning');}
 function pick(x,y){if(!active())return false;if(missionActive(base()?.aircraft)&&!isCruising(base()?.aircraft))return true;$('bomber-x').value=String(Math.floor(x)+.5);$('bomber-y').value=String(Math.floor(y)+.5);orderId=null;update();return true;}
 $('bomber-open').onclick=()=>active()?close():open();$('bomber-close').onclick=close;
 for(const id of ['bomber-select','bomber-x','bomber-y','bomber-bearing','bomber-payload'])$(id).onchange=()=>{orderId=null;if(id==='bomber-select')preferLanding=true;update();};
 $('bomber-landing-base').onchange=update;
 $('bomber-dispatch').onclick=async()=>{if(busy||!base())return;busy=true;orderId ||= crypto.randomUUID();const p=preview(),id=base().id;update();try{await api('aircraft/mission',{id,orderId,target:p.target,bearing:p.bearing,payload:p.payload});notify('Strike accepted. Your current unit remains under your control.');orderId=null;}catch(e){notify(e.message);}finally{busy=false;update();}};
 $('bomber-recall').onclick=async()=>{if(busy||!base())return;busy=true;update();try{await api('aircraft/recall',{id:base().id,landingBaseId:$('bomber-landing-base').value});notify('Aircraft returning to the selected runway. Already released bombs remain in flight.');}catch(e){notify(e.message);}finally{busy=false;update();}};
 function draw(c,T,zoom){
  const {world}=state();if(!world)return;c.save();c.lineWidth=1.4/zoom;c.font='bold '+10/zoom+'px monospace';
  for(const b of airRecords(world)){
   const m=b.aircraft.mission;if(!missionActive(b.aircraft))continue;c.fillStyle='#e7cb85';c.fillText(m.phase.toUpperCase(),b.aircraft.x*T,(b.aircraft.y+3)*T);c.strokeStyle='#eccb7a66';c.setLineDash([5/zoom,5/zoom]);c.beginPath();c.moveTo(b.aircraft.x*T,b.aircraft.y*T);const destination=flightBase(world,b),target=['return','landing','service'].includes(m.phase)?parkingPoint(destination):m.phase==='egress'?(m.egress?.[m.egressIndex]||m.cruiseCenter):m.phase==='outbound'?(m.outbound?.[m.routeIndex||0]||m.entry):isCruising(b.aircraft)?m.cruiseCenter:m.target;c.lineTo(target.x*T,target.y*T);c.stroke();}
  if(active()){const p=preview();if(!p.error){const profile=payloadProfile(p.payload),radius=isHelicopter(base()?.aircraft)?HELI_ROCKET.radius:gunAircraft(base()?.aircraft)?JET.radius:profile.radius;c.strokeStyle=profile.color;c.fillStyle=profile.color+'15';c.setLineDash([]);for(const b of p.points){c.beginPath();c.arc(b.x*T,b.y*T,radius*T,0,Math.PI*2);c.fill();c.stroke();}c.setLineDash([6/zoom,5/zoom]);c.beginPath();c.moveTo(p.entry.x*T,p.entry.y*T);c.lineTo(p.target.x*T,p.target.y*T);c.stroke();c.fillStyle=profile.color;c.fillText('APPROACH / DIVE',p.entry.x*T,p.entry.y*T);}}
  c.restore();
 }
 function drawGround(c,T){for(const b of airRecords(state().world||{})){for(const w of b.wrecks||[]){c.save();c.translate(w.x*T,w.y*T);c.rotate(w.angle);c.strokeStyle='#655b4b';c.lineWidth=.3*T;c.beginPath();c.moveTo(-T,T);c.lineTo(T,-T);c.moveTo(-T,-T);c.lineTo(T,T);c.stroke();c.restore();}}}
 return{active,update,pick,draw,drawGround,open,close};
}
