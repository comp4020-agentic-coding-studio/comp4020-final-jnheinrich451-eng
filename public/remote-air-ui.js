import {helicopterOrderError} from './helicopter-orders.js';
import {transportVehicles} from './transport.js';
import {fieldLandingCells} from './helicopter-landing.js';
import { isHelicopter, HELI_ROCKET } from './helicopter.js';
const gunAircraft=p=>isHelicopter(p)||isAttackJet(p);
import { airRecords, flightBase } from './air-traffic.js';
import { isCruising, missionError, strikePlan } from './bomber-mission.js';
import { isAttackJet, JET } from './attack-jet.js';
import { BOMBER_PAYLOADS, payloadProfile } from './bomber-payloads.js';
export function remoteAirUI({state,api,notify,changed}){
 let id=null,target=null,bearing=0,payload='HE',busy=false,orderId=null,generation=0,mode='strike',expected=0,expectedMissionId=null;
 const panel=document.createElement('section');panel.id='remote-air';panel.className='panel';panel.hidden=true;
 panel.innerHTML='<div><strong id="remote-air-name"></strong><select id="remote-air-payload" aria-label="Aircraft payload"></select><button id="remote-air-rotate">R / North</button><button id="remote-air-back">Back / Esc</button></div><div id="remote-heli-actions" hidden><button data-heli="move">Move</button><button data-heli="land">Land</button><button data-heli="pickup">Pick up vehicle</button><button data-heli="drop">Set down vehicle</button><button data-heli="return">Return to helipad</button><button data-heli="stop">Stop / hover</button><button data-heli="strike">Fire support</button></div><p id="remote-air-status" role="status"></p>';
 document.querySelector('.battlefield').append(panel);
 const select=panel.querySelector('select'),status=panel.querySelector('p'),rotateButton=panel.querySelector('#remote-air-rotate');
 select.replaceChildren(...Object.entries(BOMBER_PAYLOADS).map(([key,p])=>new Option(p.label,key)));
 const active=()=>id!==null,record=()=>airRecords(state().world||{}).find(b=>b.id===id);
 const plan=()=>strikePlan(state().world,target,bearing,gunAircraft(record()?.aircraft)?'HE':payload,record()?.aircraft);
 function update(){
  if(!active())return;const {world,me,connected,paused}=state(),b=record(),heli=isHelicopter(b?.aircraft);
  panel.querySelector('#remote-heli-actions').hidden=!heli;
  for(const button of panel.querySelectorAll('[data-heli]')){button.disabled=busy||!!helicopterOrderError(b?.aircraft);button.setAttribute('aria-pressed',String(button.dataset.heli===mode));}
  rotateButton.hidden=heli&&mode!=='strike';
  if(heli&&mode!=='strike'){
   select.hidden=true;panel.querySelector('strong').textContent='HELICOPTER / TRANSPORT';
   const o=b.aircraft.mission,reason=helicopterOrderError(b.aircraft);
   status.textContent=busy?'Sending helicopter order...':reason||({move:'Click a destination to fly there and hover.',land:'Click clear land to land.',pickup:'Click an unoccupied tank, recycler or bridge builder.',drop:'Click clear land to set down the carried vehicle.'}[mode]||'Choose a helicopter order.')+(o?' '+(o.action||o.kind||'Mission')+' / '+o.phase+(o.reason?' / '+o.reason:''):'')+' WASD moves your robot.';
   return;
  }
  const reason=!connected?'Reconnect to call an attack.':paused?'Campaign paused.':me?.body!=='robot'?'Return to your robot.':!b?'Aircraft unavailable.':!isCruising(b.aircraft)&&b.aircraft.state!=='parked'?'Aircraft busy / wait for cruise.':missionError(world,flightBase(world,b),gunAircraft(b.aircraft)?'HE':payload);
  panel.querySelector('strong').textContent=isHelicopter(b?.aircraft)?'HELICOPTER / FIRE SUPPORT':isAttackJet(b?.aircraft)?'JET / STRAFING PASS':'BOMBER / STRIKE';
  select.hidden=gunAircraft(b?.aircraft);select.disabled=busy;rotateButton.disabled=busy;
  rotateButton.textContent='R / '+['North','East','South','West'][bearing];
  status.textContent=busy?'Calling aircraft…':reason||plan().error||'LMB / tap to attack · WASD moves robot · Flak avoidance is not immunity';
 }
 function open(next){generation++;id=next;mode=isHelicopter(record()?.aircraft)?'move':'strike';expected=record()?.aircraft.transportRevision||0;expectedMissionId=record()?.aircraft.mission?.id||null;target=null;orderId=null;busy=false;payload=record()?.aircraft.payload||'HE';select.value=payload;panel.hidden=false;document.querySelector('.battlefield').classList.add('remote-air-planning');update();}
 function close(){generation++;id=null;panel.hidden=true;document.querySelector('.battlefield').classList.remove('remote-air-planning');}
 function aim(x,y){if(!active()||busy)return;target={x:Math.floor(x)+.5,y:Math.floor(y)+.5};orderId=null;update();}
 function rotate(){if(!active()||busy)return;bearing=(bearing+1)%4;orderId=null;update();}
 async function pick(x,y){
  if(!active())return false;if(busy)return true;aim(x,y);if(isHelicopter(record()?.aircraft)&&mode!=='strike'){await sendTransport(mode);return true;}
  const {world,me,connected,paused}=state(),b=record(),p=plan();
  const error=!connected||paused||me.body!=='robot'?'Use your active robot in a running room.':!isCruising(b?.aircraft)&&b?.aircraft.state!=='parked'?'Wait for this aircraft to cruise.':missionError(world,flightBase(world,b),p.payload)||p.error;
  if(error){notify(error);return true;}
  const version=generation;busy=true;orderId ||= crypto.randomUUID();update();
  try{await api('aircraft/mission',{id,orderId,target:p.target,bearing,payload:p.payload,fromRemote:true});notify('Attack assigned. Aircraft will relocate to cruise afterward.');if(version===generation){close();changed();}}
  catch(e){notify(e.message);}finally{if(version===generation){busy=false;update();}}
  return true;
 }
 async function sendTransport(action){
  const p=record()?.aircraft,{world,me,connected,paused}=state();if(busy)return;
  const error=!connected||paused||me?.body!=='robot'?'Use your active robot in a running room.':helicopterOrderError(p);if(error){notify(error);return;}
  const cargo=action==='pickup'&&target?transportVehicles(world).filter(c=>Math.hypot(c.vehicle.x-target.x,c.vehicle.y-target.y)<=2).sort((a,b)=>Math.hypot(a.vehicle.x-target.x,a.vehicle.y-target.y)-Math.hypot(b.vehicle.x-target.x,b.vehicle.y-target.y))[0]:null;
  if(action==='pickup'&&!cargo){notify('Click a parked ground vehicle.');return;}
  const version=generation;busy=true;orderId ||= crypto.randomUUID();update();
  try{await api('aircraft/order',{id,action,orderId,expected,expectedMissionId,...(['move','land','drop'].includes(action)?{target}:{}),...(cargo?{vehicleId:cargo.vehicle.id}:{})});notify('Helicopter '+action+' order accepted.');if(version===generation){close();changed();}}
  catch(e){notify(e.message);if(version===generation){expected=record()?.aircraft.transportRevision||0;expectedMissionId=record()?.aircraft.mission?.id||null;orderId=null;}}
  finally{if(version===generation){busy=false;update();}}
 }
 for(const button of panel.querySelectorAll('[data-heli]'))button.onclick=()=>{mode=button.dataset.heli;orderId=null;expected=record()?.aircraft.transportRevision||0;expectedMissionId=record()?.aircraft.mission?.id||null;if(['return','stop'].includes(mode))void sendTransport(mode);else update();document.getElementById('world-canvas').focus({preventScroll:true});};
 select.onchange=()=>{payload=select.value;orderId=null;update();document.getElementById('world-canvas').focus({preventScroll:true});};rotateButton.onclick=rotate;
 panel.querySelector('#remote-air-back').onclick=()=>{close();changed();};
 function draw(c,T,zoom){
  if(!active()||!target)return;
  if(isHelicopter(record()?.aircraft)&&mode!=='strike'){
   c.save();c.strokeStyle='#efd387';c.lineWidth=1.5/zoom;c.font=(12/zoom)+'px monospace';c.fillStyle='#efd387';
   if(mode==='land')for(const q of fieldLandingCells(target))c.strokeRect(q.x*T,q.y*T,T,T);else{c.beginPath();c.arc(target.x*T,target.y*T,12/zoom,0,Math.PI*2);c.stroke();}
   c.fillText(mode.toUpperCase(),target.x*T+16/zoom,target.y*T);c.restore();return;
  }
  const p=plan();c.save();c.strokeStyle=p.error?'#ff786c':'#f0c44c';c.fillStyle='#f0c44c16';c.lineWidth=1.5/zoom;
  if(p.error){c.beginPath();c.arc(target.x*T,target.y*T,10/zoom,0,Math.PI*2);c.stroke();}
  else{const radius=isHelicopter(record()?.aircraft)?HELI_ROCKET.radius:gunAircraft(record()?.aircraft)?JET.radius:payloadProfile(p.payload).radius;for(const point of p.points){c.beginPath();c.arc(point.x*T,point.y*T,radius*T,0,Math.PI*2);c.fill();c.stroke();}c.setLineDash([5/zoom,5/zoom]);c.beginPath();c.moveTo(p.entry.x*T,p.entry.y*T);c.lineTo(p.target.x*T,p.target.y*T);c.stroke();}
  c.restore();
 }
 return {active,open,close,aim,rotate,pick,update,draw};
}
