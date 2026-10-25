import {isSubmarine,submarineAim,submarineBox,submarineTargetError,nextSubmarineGroup,submarineGroupsReady,submarineMagazineLabel} from './submarine.js';
import {depthState,diveBattery,depthError} from './submarine-depth.js';
import {SHIP,shipName} from './ship.js';
import {mainMounts} from './ship-armament.js';
import {shipStopped} from './ship-motion.js';
import {remoteShipError,returnDockError} from './naval-orders.js';
import {airfields,parkedRecord} from './air-traffic.js';
export function remoteNavalUI({state,api,notify,changed}){
 let id=null,mode='move',targets=[],hover=null,busy=false,generation=0,expected=null,orderId=null,rotated=false,actionRevision=0;
 const panel=document.createElement('section');panel.id='remote-naval';panel.className='panel';panel.hidden=true;
 panel.innerHTML='<div><strong></strong><button data-command="move">Move</button><button data-command="dock">Return to dock</button><button data-command="shore">Shore + ramp</button><button data-command="bombard">Bombard</button><select aria-label="Naval ammunition"><option value="HE">HE</option><option value="INCENDIARY">Fire</option><option value="GAS">Gas</option></select><button data-command="dive">Ctrl / Dive</button><button data-command="surface">Space / Surface</button><button data-command="strike">Missile strike</button><button data-command="rotate">R / Rotate area</button><button data-command="stop">Stop / cancel orders</button><button data-command="ramp">Retract ramp</button><button data-command="launch">Launch aircraft</button><button data-command="back">Back / Esc</button></div><p role="status"></p>';
 document.querySelector('.battlefield').append(panel);const status=panel.querySelector('p'),ammo=panel.querySelector('select');
 const active=()=>id!==null,ship=()=>state().world?.ships?.find(s=>s.id===id),button=action=>panel.querySelector('[data-command="'+action+'"]');
 function update(){
  if(!active())return;const s=ship(),{world}=state(),error=remoteShipError(world,s);
  panel.querySelector('strong').textContent=s?shipName(s):'Ship unavailable';
  for(const b of panel.querySelectorAll('button')){b.disabled=b.dataset.command!=='back'&&(busy||!!error);b.setAttribute('aria-pressed',String(b.dataset.command===mode));}
  button('bombard').hidden=isSubmarine(s)||!mainMounts(s).length;ammo.hidden=!['bombard','strike'].includes(mode);ammo.disabled=busy;
  button('bombard').disabled=busy||!!error||!shipStopped(s||{});button('bombard').title=shipStopped(s||{})?'Assign one target per turret':'Stop or wait for the ship to arrive before bombardment';
  button('dock').disabled=busy||!!returnDockError(world,s);button('dock').title=returnDockError(world,s)||'Sail to the home berth and align automatically';
  button('shore').hidden=isSubmarine(s);for(const action of ['dive','surface','strike'])button(action).hidden=!isSubmarine(s);button('rotate').hidden=!isSubmarine(s)||mode!=='strike';button('rotate').textContent='R / '+(rotated?'8 x 6':'6 x 8');
  for(const action of ['dive','surface']){button(action).disabled=busy||!!error||!!depthError(s,action);button(action).title=depthError(s,action)||'';}
  button('ramp').hidden=isSubmarine(s)||!s?.ramp;button('launch').hidden=s?.kind!=='carrier';
  if(s?.kind==='carrier'){const plane=parkedRecord(world,airfields(world).find(b=>b.id===s.id))?.aircraft;button('launch').disabled=busy||!!error||!shipStopped(s)||plane?.state!=='parked'||!!plane?.occupant||plane?.kind==='air-gunship';button('launch').title=plane?.kind==='air-gunship'?'Aerial gunship currently needs a pilot':'Stop the carrier, then launch its unoccupied aircraft';}
  const order=s?.remoteOrder,depth=isSubmarine(s)?' '+depthState(s)+' / '+Math.ceil(diveBattery(s))+'s submerged endurance / '+(submarineGroupsReady(s)+'/4 groups ready / '+submarineMagazineLabel(s))+'.':'',progress=depth+(order?` ${order.kind} / ${order.phase}${order.kind==='bombard'?' / '+order.fired+'/3 salvos':''}${order.reason?' / '+order.reason:''}.`:'');
  status.textContent=busy?'Sending order…':error||
   (mode==='strike'?'Click a missile area / R rotates / 12 to 80 tiles.':mode==='bombard'?`Click target ${targets.length+1}/${mainMounts(s).length}. Three salvos; ${SHIP.minRange}–${SHIP.range} tiles.`:
    mode==='shore'?'Click clear shore: sail there, stop and unfold the ramp.':'Click water: sail there and hold position.')+progress+' WASD moves your robot.';
 }
 function open(next){generation++;id=next;mode='move';targets=[];hover=null;busy=false;actionRevision=ship()?.remoteActionRevision||0;expected=ship()?.remoteOrder?.id||null;orderId=null;panel.hidden=false;document.querySelector('.battlefield').classList.add('remote-naval-planning');update();}
 function close(){generation++;id=null;panel.hidden=true;document.querySelector('.battlefield').classList.remove('remote-naval-planning');}
 function aim(x,y){hover={x,y};}
 async function send(action,extra={}){
  const s=ship(),{world,me,connected,paused}=state(),error=!connected||paused||me?.body!=='robot'?'Use your active robot in a running room.':remoteShipError(world,s);
  if(busy||error){if(error)notify(error);return;}
  const version=generation;busy=true;orderId ||= crypto.randomUUID();update();
  try{
   if(action==='launch')await api('aircraft/cruise',{id,fromRemote:true});
   else if(['dive','surface','strike'].includes(action))await api('ships/remote-action',{id,orderId,expected:actionRevision,action,...extra});
   else await api('ships/order',{id,orderId,expectedOrderId:expected,action,...extra});
   notify(action==='bombard'?'Three-salvo bombardment assigned.':action==='launch'?'Aircraft launching to cruise. Select it in Remote to attack.':'Ship order accepted.');
   if(version===generation){close();changed();}
  }catch(e){notify(e.message);if(version===generation){actionRevision=ship()?.remoteActionRevision||0;expected=ship()?.remoteOrder?.id||null;orderId=null;if(action==='bombard')targets=[];}}
  finally{if(version===generation){busy=false;update();}}
 }
 async function pick(x,y){
  if(!active()||busy)return;const s=ship();if(!s)return;
  if(mode==='strike'){const target=submarineAim(s,state().world,{x,y},rotated),error=submarineTargetError(s,state().world,target,rotated);if(error){notify(error);return;}await send('strike',{target,rotated,ammo:ammo.value});return;}
  if(mode==='bombard'){
   const d=Math.hypot(x-s.x,y-s.y);if(d<SHIP.minRange||d>SHIP.range){notify(`Choose a target ${SHIP.minRange}–${SHIP.range} tiles from the ship.`);return;}
   targets.push({x,y});if(targets.length===mainMounts(s).length)await send('bombard',{targets,ammo:ammo.value});else update();
  }else await send(mode,{target:{x,y}});
 }
 for(const b of panel.querySelectorAll('button'))b.onclick=()=>{
  const command=b.dataset.command;if(command==='back'){close();changed();return;}
  if(command==='rotate'){rotate();return;}
  if(['stop','ramp','launch','dock','dive','surface'].includes(command)){void send(command);return;}
  mode=command;targets=[];orderId=null;expected=ship()?.remoteOrder?.id||null;update();document.getElementById('world-canvas').focus({preventScroll:true});
 };
 function rotate(){if(active()&&mode==='strike'&&!busy){rotated=!rotated;orderId=null;update();}}
 function depth(action){if(active()&&isSubmarine(ship())){orderId=null;actionRevision=ship()?.remoteActionRevision||0;void send(action);return true;}return false;}
 function draw(c,T,zoom){
  const s=ship();if(!active()||!s)return;c.save();c.lineWidth=1/zoom;c.strokeStyle='#efd387';c.fillStyle='#efd387';c.font=`bold ${12/zoom}px monospace`;
  if(mode==='strike'&&hover){const target=submarineAim(s,state().world,hover,rotated),b=submarineBox(target,rotated);c.strokeStyle=nextSubmarineGroup(s)<0||submarineTargetError(s,state().world,target,rotated)?'#ff7777':'#efd387';c.strokeRect(b.x*T,b.y*T,b.width*T,b.height*T);c.restore();return;}
  if(mode==='bombard'){c.setLineDash([6/zoom,5/zoom]);for(const r of [SHIP.minRange,SHIP.range]){c.beginPath();c.arc(s.x*T,s.y*T,r*T,0,Math.PI*2);c.stroke();}c.setLineDash([]);}
  const points=mode==='bombard'?[...targets,...(hover?[hover]:[])]:hover?[hover]:[];
  points.forEach((p,i)=>{c.beginPath();c.arc(p.x*T,p.y*T,9/zoom,0,Math.PI*2);c.stroke();const overlaps=points.slice(0,i).filter(q=>Math.hypot(q.x-p.x,q.y-p.y)*T*zoom<20).length;c.fillText(mode==='bombard'?String(i+1):mode==='shore'?'RAMP':'MOVE',p.x*T+12/zoom,p.y*T+overlaps*14/zoom);});
  const o=s.remoteOrder;if(o?.path?.length){c.setLineDash([4/zoom,5/zoom]);c.beginPath();c.moveTo(s.x*T,s.y*T);for(const p of o.path.slice(o.index))c.lineTo(p.x*T,p.y*T);c.stroke();}c.restore();
 }
 return {active,open,close,update,aim,pick,draw,rotate,depth,isSub:()=>active()&&isSubmarine(ship())};
}
