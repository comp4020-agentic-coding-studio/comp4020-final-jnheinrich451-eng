import { isHelicopter } from './helicopter.js';
import { airRecords, liveAircraft } from './air-traffic.js';
import { isCruising } from './bomber-mission.js';
import { isAttackJet } from './attack-jet.js';
import { isMissile } from './missile.js';
import { gunPosition } from './rail.js';

export const remoteTargets=world=>[...(world.artillery||[]),...airRecords(world).filter(b=>liveAircraft(b.aircraft)&&['takeoff','flying','landing'].includes(b.aircraft.state)).map(b=>({...b.aircraft,id:'air:'+b.id,remoteAir:true,recordId:b.id}))];
export const remotePoint = gun => gun.remoteAir?{x:gun.x,y:gun.y}: isMissile(gun) ? {x:gun.x+2,y:gun.y+2} : gunPosition(gun);
export function remoteReason(world, gun, me) {
  if(gun.remoteAir){if(gun.occupant)return 'Controlled by a pilot';if(!isCruising(gun))return 'Mission in progress / wait for cruise';if(isHelicopter(gun)?!(gun.rounds>0||gun.rockets>0):isAttackJet(gun)?gun.rounds<=0:gun.runs<=0)return 'Empty / recall to rearm';return null;}
  if(world.logistics?.jobs?.[gun.id])return 'Construction in progress';
  if(gun.operator&&gun.operator!==me.id)return 'Operated by another scout';
  return null;
}
// Screen-sized markers remain selectable when the actual platform is tiny.
// They show known friendly equipment, never reveal hostile units through fog.
export function remoteControlUI({choose}) {
  const layer=document.createElement('div');layer.id='remote-markers';layer.hidden=true;
  layer.setAttribute('role','group');layer.setAttribute('aria-label','Remote facilities');
  document.querySelector('.battlefield').append(layer);
  const markers=new Map();
  function update(world,me,active,busy){
    layer.hidden=!active;if(!active)return;
    const ids=new Set(remoteTargets(world).map(g=>g.id));
    for(const [id,b] of markers)if(!ids.has(id)){b.remove();markers.delete(id);}
    for(const gun of remoteTargets(world)){
      let b=markers.get(gun.id);
      if(!b){b=document.createElement('button');b.className='remote-marker';b.dataset.remoteId=gun.id;b.onclick=()=>choose(gun.id);layer.append(b);markers.set(gun.id,b);}
      const label=gun.remoteAir?(isHelicopter(gun)?'Helicopter':isAttackJet(gun)?'Attack jet':'Bomber'):isMissile(gun)?'Missile launcher':'Rail cannon',reason=remoteReason(world,gun,me);
      b.textContent=gun.remoteAir?(isHelicopter(gun)?'HELI':isAttackJet(gun)?'JET':'BOMBER'):isMissile(gun)?'MISSILE':'CANNON';b.disabled=busy||!!reason;b.classList.toggle('unavailable',!!reason);
      b.title=reason||(gun.remoteAir?'Assign a strike to ':'Take control of ')+label;b.setAttribute('aria-label',label+' at '+gun.x+':'+gun.y+' / '+(reason||'Take control'));
    }
  }
  function position(world,project){
    if(layer.hidden)return;
    for(const gun of remoteTargets(world)){const b=markers.get(gun.id);if(!b)continue;const p=project(remotePoint(gun));b.style.left=p.x+'px';b.style.top=p.y+'px';}
  }
  return {update,position};
}
