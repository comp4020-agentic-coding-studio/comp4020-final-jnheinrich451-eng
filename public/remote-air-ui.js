import { isHelicopter, HELI_ROCKET } from './helicopter.js';
const gunAircraft=p=>isHelicopter(p)||isAttackJet(p);
import { airRecords, flightBase } from './air-traffic.js';
import { isCruising, missionError, strikePlan } from './bomber-mission.js';
import { isAttackJet, JET } from './attack-jet.js';
import { BOMBER_PAYLOADS, payloadProfile } from './bomber-payloads.js';
export function remoteAirUI({state,api,notify,changed}){
 let id=null,target=null,bearing=0,payload='HE',busy=false,orderId=null,generation=0;
 const panel=document.createElement('section');panel.id='remote-air';panel.className='panel';panel.hidden=true;
 panel.innerHTML='<div><strong id="remote-air-name"></strong><select id="remote-air-payload" aria-label="Aircraft payload"></select><button id="remote-air-rotate">R / North</button><button id="remote-air-back">Back / Esc</button></div><p id="remote-air-status" role="status"></p>';
 document.querySelector('.battlefield').append(panel);
 const select=panel.querySelector('select'),status=panel.querySelector('p'),rotateButton=panel.querySelector('#remote-air-rotate');
 select.replaceChildren(...Object.entries(BOMBER_PAYLOADS).map(([key,p])=>new Option(p.label,key)));
 const active=()=>id!==null,record=()=>airRecords(state().world||{}).find(b=>b.id===id);
 const plan=()=>strikePlan(state().world,target,bearing,gunAircraft(record()?.aircraft)?'HE':payload,record()?.aircraft);
 function update(){
  if(!active())return;const {world,me,connected,paused}=state(),b=record();
  const reason=!connected?'Reconnect to call an attack.':paused?'Campaign paused.':me?.body!=='robot'?'Return to your robot.':!b?'Aircraft unavailable.':!isCruising(b.aircraft)?'Aircraft busy / wait for cruise.':missionError(world,flightBase(world,b),gunAircraft(b.aircraft)?'HE':payload);
  panel.querySelector('strong').textContent=isHelicopter(b?.aircraft)?'HELICOPTER / FIRE SUPPORT':isAttackJet(b?.aircraft)?'JET / STRAFING PASS':'BOMBER / STRIKE';
  select.hidden=gunAircraft(b?.aircraft);select.disabled=busy;rotateButton.disabled=busy;
  rotateButton.textContent='R / '+['North','East','South','West'][bearing];
  status.textContent=busy?'Calling aircraft…':reason||plan().error||'LMB / tap to attack · WASD moves robot · Flak avoidance is not immunity';
 }
 function open(next){generation++;id=next;target=null;orderId=null;busy=false;payload=record()?.aircraft.payload||'HE';select.value=payload;panel.hidden=false;document.querySelector('.battlefield').classList.add('remote-air-planning');update();}
 function close(){generation++;id=null;panel.hidden=true;document.querySelector('.battlefield').classList.remove('remote-air-planning');}
 function aim(x,y){if(!active()||busy)return;target={x:Math.floor(x)+.5,y:Math.floor(y)+.5};orderId=null;update();}
 function rotate(){if(!active()||busy)return;bearing=(bearing+1)%4;orderId=null;update();}
 async function pick(x,y){
  if(!active())return false;if(busy)return true;aim(x,y);
  const {world,me,connected,paused}=state(),b=record(),p=plan();
  const error=!connected||paused||me.body!=='robot'?'Use your active robot in a running room.':!isCruising(b?.aircraft)?'Wait for this aircraft to cruise.':missionError(world,flightBase(world,b),p.payload)||p.error;
  if(error){notify(error);return true;}
  const version=generation;busy=true;orderId ||= crypto.randomUUID();update();
  try{await api('aircraft/mission',{id,orderId,target:p.target,bearing,payload:p.payload,fromRemote:true});notify('Attack assigned. Aircraft will relocate to cruise afterward.');if(version===generation){close();changed();}}
  catch(e){notify(e.message);}finally{if(version===generation){busy=false;update();}}
  return true;
 }
 select.onchange=()=>{payload=select.value;orderId=null;update();document.getElementById('world-canvas').focus({preventScroll:true});};rotateButton.onclick=rotate;
 panel.querySelector('#remote-air-back').onclick=()=>{close();changed();};
 function draw(c,T,zoom){
  if(!active()||!target)return;const p=plan();c.save();c.strokeStyle=p.error?'#ff786c':'#f0c44c';c.fillStyle='#f0c44c16';c.lineWidth=1.5/zoom;
  if(p.error){c.beginPath();c.arc(target.x*T,target.y*T,10/zoom,0,Math.PI*2);c.stroke();}
  else{const radius=isHelicopter(record()?.aircraft)?HELI_ROCKET.radius:gunAircraft(record()?.aircraft)?JET.radius:payloadProfile(p.payload).radius;for(const point of p.points){c.beginPath();c.arc(point.x*T,point.y*T,radius*T,0,Math.PI*2);c.fill();c.stroke();}c.setLineDash([5/zoom,5/zoom]);c.beginPath();c.moveTo(p.entry.x*T,p.entry.y*T);c.lineTo(p.target.x*T,p.target.y*T);c.stroke();}
  c.restore();
 }
 return {active,open,close,aim,rotate,pick,update,draw};
}
