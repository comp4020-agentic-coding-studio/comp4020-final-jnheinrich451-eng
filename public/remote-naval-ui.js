import {isSubmarine,submarineAim,submarineBox,submarineTargetError,nextSubmarineGroup,submarineGroupsReady,submarineMagazineLabel} from './submarine.js';
import {depthState,diveBattery,depthError} from './submarine-depth.js';
import {SHIP,shipName,dockRects,hull,rectanglesOverlap} from './ship.js';
import {dockRecords} from './shipyard.js';
import {mainMounts} from './ship-armament.js';
import {shipStopped} from './ship-motion.js';
import {remoteShipError,returnDockError} from './naval-orders.js';
import {airfields,parkedRecord} from './air-traffic.js';
import {navalText,submarineDepthLabel} from './biome.js';
import {tileAt} from './world.js';
// How far from the hull a shore counts as near enough to ramp onto.
const REACH=14;
export function remoteNavalUI({state,api,notify,changed}){
 let id=null,mode='move',shell='HE',hover=null,busy=false,generation=0,expected=null,orderId=null,rotated=false,actionRevision=0;
 const panel=document.createElement('section');panel.id='remote-naval';panel.className='panel';panel.hidden=true;
 panel.innerHTML='<div class="command-strip"><button data-command="bombard">Fire <kbd>LMB</kbd></button><button data-command="strike">Strike <kbd>LMB</kbd></button><button data-command="move">Move <kbd>RMB</kbd></button><button data-ammo="HE">HE <kbd>1</kbd></button><button data-ammo="INCENDIARY">Burn <kbd>2</kbd></button><button data-ammo="GAS">Gas <kbd>3</kbd></button><button data-command="dock">Return <kbd>R</kbd></button><button data-command="shore"><span>Ramp</span> <kbd>G</kbd></button><button data-command="rotate"><span>6 x 8</span> <kbd>T</kbd></button><button data-command="dive">Dive <kbd>Ctrl</kbd></button><button data-command="surface">Surface <kbd>Space</kbd></button><button data-command="launch">Launch <kbd>L</kbd></button></div><p role="status"></p>';
 document.querySelector('.battlefield').append(panel);const status=panel.querySelector('p');
 const active=()=>id!==null,ship=()=>state().world?.ships?.find(s=>s.id===id),button=action=>panel.querySelector('[data-command="'+action+'"]');
 const armed=s=>!isSubmarine(s)&&mainMounts(s).length>0;
 // A tap has no second button, so touch starts on Move and picks Fire from the strip.
 const firstMode=s=>matchMedia('(pointer:coarse)').matches?'move':isSubmarine(s)?'strike':armed(s)?'bombard':'move';
 function update(){
  if(!active())return;const s=ship(),{world}=state(),error=remoteShipError(world,s);
  for(const b of panel.querySelectorAll('[data-command]')){b.disabled=busy||!!error;b.setAttribute('aria-pressed',String(b.dataset.command===mode));}
  for(const b of panel.querySelectorAll('[data-ammo]')){b.hidden=!armed(s)&&!isSubmarine(s);b.disabled=busy;b.setAttribute('aria-pressed',String(b.dataset.ammo===shell));}
  button('bombard').hidden=!armed(s);button('strike').hidden=!isSubmarine(s);button('rotate').hidden=!isSubmarine(s);
  button('bombard').title=shipStopped(s||{})?'Fire three salvos at the cursor':'The ship fires once it has stopped';
  button('dock').disabled=busy||!!returnDockError(world,s);button('dock').title=returnDockError(world,s)||'Sail to the home berth and align automatically';
  button('shore').hidden=isSubmarine(s);button('shore').querySelector('span').textContent=s?.ramp?'Stow':'Ramp';button('rotate').querySelector('span').textContent=rotated?'8 x 6':'6 x 8';
  for(const action of ['dive','surface']){button(action).hidden=!isSubmarine(s)||!!depthError(s,action);button(action).disabled=busy||!!error;}
  button('launch').hidden=s?.kind!=='carrier';
  if(s?.kind==='carrier'){const plane=parkedRecord(world,airfields(world).find(b=>b.id===s.id))?.aircraft;button('launch').disabled=busy||!!error||!shipStopped(s)||plane?.state!=='parked'||!!plane?.occupant||plane?.kind==='air-gunship';button('launch').title=plane?.kind==='air-gunship'?'Aerial gunship currently needs a pilot':'Stop the carrier, then launch its unoccupied aircraft';}
  const order=s?.remoteOrder,depth=isSubmarine(s)?submarineDepthLabel(world,depthState(s))+' / '+Math.ceil(diveBattery(s))+'s / '+submarineGroupsReady(s)+'/4 groups ready':'',progress=order?`${order.kind} / ${order.phase}${order.kind==='bombard'?' / '+order.fired+'/3 salvos':''}${order.reason?' / '+order.reason:''}`:'';
  // Modes read from the strip and the map marker, so this line only carries news.
  status.textContent=navalText(world,busy?'Sending order…':error||[depth,progress].filter(Boolean).join(' / '));status.hidden=!status.textContent;
  for(const b of panel.querySelectorAll('[data-command]'))b.title=navalText(world,b.title);
 }
 function open(next){generation++;id=next;mode=firstMode(state().world?.ships?.find(s=>s.id===next));hover=null;busy=false;actionRevision=ship()?.remoteActionRevision||0;expected=ship()?.remoteOrder?.id||null;orderId=null;panel.hidden=false;document.querySelector('.battlefield').classList.add('remote-naval-planning');update();}
 function close(){generation++;id=null;panel.hidden=true;document.querySelector('.battlefield').classList.remove('remote-naval-planning');}
 function aim(x,y){hover={x,y};}
 async function send(action,extra={}){
  const s=ship(),{world,me,connected,paused}=state(),error=!connected||paused||me?.body!=='robot'?'Use your active robot in a running room.':remoteShipError(world,s);
  if(busy||error){if(error)notify(error);return;}
  const version=generation;let result=null;busy=true;orderId ||= crypto.randomUUID();update();
  try{
   if(action==='launch')await api('aircraft/cruise',{id,fromRemote:true});
   else if(['dive','surface','strike'].includes(action))await api('ships/remote-action',{id,orderId,expected:actionRevision,action,...extra});
   else result=await api('ships/order',{id,orderId,expectedOrderId:expected,action,...extra});
   notify(action==='bombard'?'Three-salvo bombardment assigned.':action==='launch'?'Aircraft launching to cruise. Select it in Remote to attack.':'Ship order accepted.');
   // The panel stays for the next order; Esc, F or Remote leaves it.
   if(version===generation){expected=result?.order?.id??ship()?.remoteOrder?.id??null;orderId=null;actionRevision=ship()?.remoteActionRevision||0;mode=firstMode(ship());changed();}
  }catch(e){notify(navalText(world,e.message));if(version===generation){actionRevision=ship()?.remoteActionRevision||0;expected=ship()?.remoteOrder?.id||null;orderId=null;}}
  finally{if(version===generation){busy=false;update();}}
 }
 async function pick(x,y){
  if(!active()||busy)return;const s=ship();if(!s)return;
  if(mode==='strike'){const target=submarineAim(s,state().world,{x,y},rotated),error=submarineTargetError(s,state().world,target,rotated);if(error){notify(error);return;}await send('strike',{target,rotated,ammo:shell});return;}
  if(mode==='bombard'){
   const d=Math.hypot(x-s.x,y-s.y);if(d<SHIP.minRange||d>SHIP.range){notify(`Choose a target ${SHIP.minRange}–${SHIP.range} tiles from the ship.`);return;}
   if(!shipStopped(s)){notify('The ship fires once it has stopped.');return;}
   await send('bombard',{targets:mainMounts(s).map(()=>({x,y})),ammo:shell});
  }else if(mode==='move')await sail(x,y);
  else await send(mode,{target:{x,y}});
 }
 // Moving onto a dock moors there. The pier and its berth both count as the dock.
 const dockUnder=(x,y)=>dockRecords(state().world).find(yard=>!yard.dockDestroyed&&[...dockRects(yard),hull(yard,true)].some(r=>rectanglesOverlap(r,{x,y,w:.1,h:.1,angle:0})));
 function sail(x,y){const yard=dockUnder(x,y);return yard?send('dock',{dockId:yard.id}):send('move',{target:{x,y}});}
 function order(x,y){if(active()&&!busy)void sail(x,y);}
 function nearestBank(s){
  const {world}=state(),land=(x,y)=>tileAt(world,x,y)>0&&tileAt(world,x,y)!==3;
  if(hover&&Math.hypot(hover.x-s.x,hover.y-s.y)<=REACH&&land(Math.floor(hover.x),Math.floor(hover.y)))return hover;
  let best=null,distance=REACH;
  for(let y=Math.floor(s.y-REACH);y<=s.y+REACH;y++)for(let x=Math.floor(s.x-REACH);x<=s.x+REACH;x++){const d=Math.hypot(x+.5-s.x,y+.5-s.y);if(d<distance&&land(x,y)){best={x:x+.5,y:y+.5};distance=d;}}
  return best;
 }
 function ramp(){
  const s=ship();if(!active()||busy||!s||isSubmarine(s))return;orderId=null;
  if(s.ramp){void send('ramp');return;}
  const bank=nearestBank(s);if(!bank){notify(navalText(state().world,'Sail closer to a shore first.'));return;}
  void send('shore',{target:bank});
 }
 function run(command){
  if(!active())return;if(command==='rotate'){rotate();return;}if(command==='shore'){ramp();return;}
  if(['launch','dock','dive','surface'].includes(command)){orderId=null;void send(command);return;}
  mode=command;orderId=null;expected=ship()?.remoteOrder?.id||null;update();
 }
 function slot(n){const next=['HE','INCENDIARY','GAS'][n-1],s=ship();if(active()&&next&&(armed(s)||isSubmarine(s))){shell=next;update();}}
 for(const b of panel.querySelectorAll('[data-command]'))b.onclick=()=>{run(b.dataset.command);document.getElementById('world-canvas').focus({preventScroll:true});};
 for(const b of panel.querySelectorAll('[data-ammo]'))b.onclick=()=>{shell=b.dataset.ammo;update();document.getElementById('world-canvas').focus({preventScroll:true});};
 function rotate(){if(active()&&isSubmarine(ship())&&!busy){rotated=!rotated;orderId=null;update();}}
 function depth(action){if(active()&&isSubmarine(ship())){orderId=null;actionRevision=ship()?.remoteActionRevision||0;void send(action);return true;}return false;}
 function draw(c,T,zoom){
  const s=ship();if(!active()||!s)return;c.save();c.lineWidth=1/zoom;c.strokeStyle='#efd387';c.fillStyle='#efd387';c.font=`bold ${12/zoom}px monospace`;
  if(mode==='strike'&&hover){const target=submarineAim(s,state().world,hover,rotated),b=submarineBox(target,rotated);c.strokeStyle=nextSubmarineGroup(s)<0||submarineTargetError(s,state().world,target,rotated)?'#ff7777':'#efd387';c.strokeRect(b.x*T,b.y*T,b.width*T,b.height*T);c.restore();return;}
  if(armed(s)){c.setLineDash([6/zoom,5/zoom]);c.strokeStyle='#efd38766';for(const r of [SHIP.minRange,SHIP.range]){c.beginPath();c.arc(s.x*T,s.y*T,r*T,0,Math.PI*2);c.stroke();}c.setLineDash([]);c.strokeStyle='#efd387';}
  if(hover){c.beginPath();c.arc(hover.x*T,hover.y*T,9/zoom,0,Math.PI*2);c.stroke();c.fillText(mode==='bombard'?'FIRE':dockUnder(hover.x,hover.y)?'MOOR':'MOVE',hover.x*T+12/zoom,hover.y*T);}
  const o=s.remoteOrder;if(o?.path?.length){c.setLineDash([4/zoom,5/zoom]);c.beginPath();c.moveTo(s.x*T,s.y*T);for(const p of o.path.slice(o.index))c.lineTo(p.x*T,p.y*T);c.stroke();}c.restore();
 }
 return {active,open,close,update,aim,pick,order,ramp,slot,run,draw,rotate,depth,isSub:()=>active()&&isSubmarine(ship())};
}
