import {shipName} from './ship.js';
import {remoteShipError} from './naval-orders.js';
import { isHelicopter } from './helicopter.js';
import { airRecords, liveAircraft } from './air-traffic.js';
import { isCruising } from './bomber-mission.js';
import { isAttackJet } from './attack-jet.js';
import { isMissile } from './missile.js';
import { gunPosition } from './rail.js';

export const remoteTargets=world=>[...(world.artillery||[]),...(world.ships||[]).filter(s=>!s.destroyed).map(s=>({...s,id:'ship:'+s.id,recordId:s.id,remoteShip:true})),...airRecords(world).filter(b=>liveAircraft(b.aircraft)&&['parked','takeoff','flying','landing'].includes(b.aircraft.state)).map(b=>({...b.aircraft,id:'air:'+b.id,remoteAir:true,recordId:b.id}))];
export const remotePoint = gun => (gun.remoteAir||gun.remoteShip)?{x:gun.x,y:gun.y}: isMissile(gun) ? {x:gun.x+2,y:gun.y+2} : gunPosition(gun);
export function remoteReason(world, gun, me) {
  if(gun.remoteShip)return remoteShipError(world,world.ships.find(s=>s.id===gun.recordId));
  if(gun.remoteAir){if(gun.kind==='air-gunship')return 'Aerial gunship / manual flight';if(gun.occupant)return 'Controlled by a pilot';if(isHelicopter(gun))return null;if(!isCruising(gun)&&gun.state!=='parked')return 'Mission in progress / wait for cruise';if(isHelicopter(gun)&&!(gun.rounds>0||gun.rockets>0))return 'Empty / recall to rearm';if(!isHelicopter(gun)&&!isAttackJet(gun)&&gun.bombCooldown>0)return 'Bomb system cooling / '+Math.ceil(gun.bombCooldown)+'s';return null;}
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
      const label=gun.remoteShip?shipName(gun):gun.remoteAir?(gun.kind==='air-gunship'?'Aerial gunship':isHelicopter(gun)?'Helicopter':isAttackJet(gun)?'Attack jet':'Bomber'):isMissile(gun)?'Missile launcher':gun.kind==='mac'?'Rail MAC':'Rail cannon',reason=remoteReason(world,gun,me);
      b.textContent=gun.remoteShip?(gun.kind==='carrier'?'CARRIER':gun.kind==='transport'?'TRANSPORT':gun.kind==='submarine'?'SUBMARINE':'GUNSHIP'):gun.remoteAir?(gun.kind==='air-gunship'?'Aerial gunship':isHelicopter(gun)?'HELI':isAttackJet(gun)?'JET':'BOMBER'):isMissile(gun)?'MISSILE':gun.kind==='mac'?'MAC':'CANNON';b.disabled=busy||!!reason;b.classList.toggle('unavailable',!!reason);
      b.title=reason||(gun.remoteAir?'Assign a strike to ':'Take control of ')+label;b.setAttribute('aria-label',label+' at '+gun.x+':'+gun.y+' / '+(reason||'Take control'));
    }
  }
  function position(world,project){
    if(layer.hidden)return;
    for(const gun of remoteTargets(world)){const b=markers.get(gun.id);if(!b)continue;const p=project(remotePoint(gun));b.style.left=p.x+'px';b.style.top=(p.y-(gun.remoteAir&&gun.state==='parked'?48:0))+'px';}
  }
  return {update,position};
}
