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
 panel.innerHTML='<div class="command-strip"><strong id="remote-air-name"></strong><button data-heli="strike">Fire <kbd>LMB</kbd></button><span id="remote-air-attack" class="strip-label">Strike <kbd>LMB</kbd></span><button data-heli="move">Move <kbd>RMB</kbd></button><button data-heli="land">Land <kbd>G</kbd></button><button data-heli="sling"><span>Sling</span> <kbd>V</kbd></button><button data-heli="return">Return <kbd>R</kbd></button><button data-payload="HE">Carpet <kbd>1</kbd></button><button data-payload="HEAVY">Heavy <kbd>2</kbd></button><button data-payload="INCENDIARY">Burn <kbd>3</kbd></button><button data-payload="GAS">Gas <kbd>4</kbd></button><button id="remote-air-rotate"><span>North</span> <kbd>R</kbd></button></div><p id="remote-air-status" role="status"></p>';
 document.querySelector('.battlefield').append(panel);
 const status=panel.querySelector('p'),rotateButton=panel.querySelector('#remote-air-rotate');
 const active=()=>id!==null,record=()=>airRecords(state().world||{}).find(b=>b.id===id);
 const plan=()=>strikePlan(state().world,target,bearing,gunAircraft(record()?.aircraft)?'HE':payload,record()?.aircraft);
 function update(){
  if(!active())return;const {world,me,connected,paused}=state(),b=record(),heli=isHelicopter(b?.aircraft);
  for(const button of panel.querySelectorAll('[data-heli]')){button.hidden=!heli;button.disabled=busy||!!helicopterOrderError(b?.aircraft);button.setAttribute('aria-pressed',String(button.dataset.heli===mode));}
  panel.querySelector('[data-heli="sling"] span').textContent=b?.aircraft?.sling?'Drop':'Lift';
  panel.querySelector('#remote-air-attack').hidden=heli;rotateButton.hidden=heli;
  for(const button of panel.querySelectorAll('[data-payload]')){button.hidden=heli||gunAircraft(b?.aircraft);button.disabled=busy;button.setAttribute('aria-pressed',String(button.dataset.payload===payload));}
  panel.querySelector('strong').textContent=heli?'HELICOPTER':isAttackJet(b?.aircraft)?'JET':'BOMBER';
  if(heli&&mode!=='strike'){
   const o=b.aircraft.mission,reason=helicopterOrderError(b.aircraft),live=o&&o.phase!=='complete'?(o.action||o.kind||'Mission')+' / '+o.phase+(o.reason?' / '+o.reason:''):'';
   status.textContent=busy?'Sending helicopter order...':reason||live;status.hidden=!status.textContent;
   return;
  }
  const reason=!connected?'Reconnect to call an attack.':paused?'Campaign paused.':me?.body!=='robot'?'Return to your robot.':!b?'Aircraft unavailable.':!isCruising(b.aircraft)&&b.aircraft.state!=='parked'?'Aircraft busy / wait for cruise.':missionError(world,flightBase(world,b),gunAircraft(b.aircraft)?'HE':payload);
  rotateButton.disabled=busy;rotateButton.querySelector('span').textContent=['North','East','South','West'][bearing];
  status.textContent=busy?'Calling aircraft…':reason||plan().error||'';status.hidden=!status.textContent;
 }
 function open(next){generation++;id=next;mode=isHelicopter(airRecords(state().world||{}).find(b=>b.id===next)?.aircraft)&&matchMedia('(pointer:coarse)').matches?'move':'strike';expected=record()?.aircraft.transportRevision||0;expectedMissionId=record()?.aircraft.mission?.id||null;target=null;orderId=null;busy=false;payload=record()?.aircraft.payload||'HE';panel.hidden=false;document.querySelector('.battlefield').classList.add('remote-air-planning');update();}
 function close(){generation++;id=null;panel.hidden=true;document.querySelector('.battlefield').classList.remove('remote-air-planning');}
 function aim(x,y){if(!active()||busy)return;target={x:Math.floor(x)+.5,y:Math.floor(y)+.5};orderId=null;update();}
 function rotate(){if(!active()||busy)return;bearing=(bearing+1)%4;orderId=null;update();}
 async function pick(x,y){
  if(!active())return false;if(busy)return true;aim(x,y);if(isHelicopter(record()?.aircraft)&&mode!=='strike'){await sendTransport(mode==='sling'?slingAction():mode);return true;}
  const {world,me,connected,paused}=state(),b=record(),p=plan();
  const error=!connected||paused||me.body!=='robot'?'Use your active robot in a running room.':!isCruising(b?.aircraft)&&b?.aircraft.state!=='parked'?'Wait for this aircraft to cruise.':missionError(world,flightBase(world,b),p.payload)||p.error;
  if(error){notify(error);return true;}
  const version=generation;busy=true;orderId ||= crypto.randomUUID();update();
  try{await api('aircraft/mission',{id,orderId,target:p.target,bearing,payload:p.payload,fromRemote:true});notify('Attack assigned. Aircraft will relocate to cruise afterward.');if(version===generation){orderId=null;changed();}}
  catch(e){notify(e.message);}finally{if(version===generation){busy=false;update();}}
  return true;
 }
 async function sendTransport(action){
  const p=record()?.aircraft,{world,me,connected,paused}=state();if(busy)return;
  const error=!connected||paused||me?.body!=='robot'?'Use your active robot in a running room.':helicopterOrderError(p);if(error){notify(error);return;}
  const cargo=action==='pickup'&&target?transportVehicles(world).filter(c=>Math.hypot(c.vehicle.x-target.x,c.vehicle.y-target.y)<=2).sort((a,b)=>Math.hypot(a.vehicle.x-target.x,a.vehicle.y-target.y)-Math.hypot(b.vehicle.x-target.x,b.vehicle.y-target.y))[0]:null;
  if(action==='pickup'&&!cargo){notify('Click a parked ground vehicle.');return;}
  const version=generation;busy=true;orderId ||= crypto.randomUUID();update();
  try{const result=await api('aircraft/order',{id,action,orderId,expected,expectedMissionId,...(['move','land','drop'].includes(action)?{target}:{}),...(cargo?{vehicleId:cargo.vehicle.id}:{})});notify('Helicopter '+action+' order accepted.');if(version===generation){orderId=null;expected+=1;expectedMissionId=result?.order?.id??null;changed();}}
  catch(e){notify(e.message);if(version===generation){expected=record()?.aircraft.transportRevision||0;expectedMissionId=record()?.aircraft.mission?.id||null;orderId=null;}}
  finally{if(version===generation){busy=false;update();}}
 }
 const slingAction=()=>record()?.aircraft?.sling?'drop':'pickup';
 // A snapshot older than our own accepted order must not roll the revision back.
 const refresh=()=>{orderId=null;const revision=record()?.aircraft.transportRevision||0;if(revision>=expected){expected=revision;expectedMissionId=record()?.aircraft.mission?.id||null;}};
 function order(x,y){if(active()&&!busy&&isHelicopter(record()?.aircraft)){aim(x,y);refresh();void sendTransport('move');}}
 function heli(action){
  if(!active()||busy||!isHelicopter(record()?.aircraft))return;refresh();
  if(action==='return'){void sendTransport('return');return;}
  if(!target){notify('Point at the place first.');return;}
  void sendTransport(action==='sling'?slingAction():action);
 }
 function slot(n){const next=Object.keys(BOMBER_PAYLOADS)[n-1],b=record()?.aircraft;if(active()&&next&&!isHelicopter(b)&&!gunAircraft(b)){payload=next;orderId=null;update();}}
 for(const button of panel.querySelectorAll('[data-heli]'))button.onclick=()=>{const action=button.dataset.heli;refresh();if(action==='return')void sendTransport(action);else{mode=action;update();}document.getElementById('world-canvas').focus({preventScroll:true});};
 for(const button of panel.querySelectorAll('[data-payload]'))button.onclick=()=>{payload=button.dataset.payload;orderId=null;update();document.getElementById('world-canvas').focus({preventScroll:true});};
 rotateButton.onclick=rotate;
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
 return {active,open,close,aim,rotate,pick,order,heli,slot,isHeli:()=>active()&&isHelicopter(record()?.aircraft),update,draw};
}
