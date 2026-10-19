// Server-side interpretation of game commands, not a client keystroke recorder.
import { airRecords } from './public/air-traffic.js';
import { shipKind } from './public/ship.js';
const compass=['north','north-east','east','south-east','south','south-west','west','north-west'];
const direction=(x,y)=>!Number.isFinite(x)||!Number.isFinite(y)?'invalid':Math.hypot(x,y)<.001?'stop':compass[(Math.round(Math.atan2(x,-y)/(Math.PI/4))+8)%8];
const bearing=a=>Number.isFinite(a)?compass[(Math.round(a/(Math.PI/4))%8+8)%8]:null;
const names={HE:'HE cannon',MAGNETIC:'magnetic cannon',APCR:'machine gun',NAVAL_APCR:'side guns',FLAME:'flamethrower',HEAVY_FLAME:'heavy flamethrower',LASER:'laser rifle',INCENDIARY:'incendiary',GAS:'gas',HEAVY:'heavy HE',BEAM:'beam',cannon:'autocannon',rockets:'rocket pods'};
const knownWeapon=w=>typeof w==='string'&&Object.hasOwn(names,w);
const weaponName=w=>knownWeapon(w)?names[w]:'unknown weapon';
const airType=p=>['bomber','attack-jet','helicopter'].includes(p?.kind)?p.kind:'bomber';
export function controlledUnit(world,player,bodyType){
 const p=airRecords(world).map(b=>b.aircraft).find(p=>p?.occupant===player.id);
 const ship=(world.ships||[]).find(s=>s.occupant===player.id),tank=(world.tanks||[]).find(t=>t.occupant===player.id);
 const truck=world.logistics?.recyclers?.find(r=>r.occupant===player.id),gun=(world.artillery||[]).find(g=>g.operator===player.id);
 const object=p||ship||tank||truck||gun||player;
 const unitType=p?airType(p):ship?shipKind(ship):tank?'tank':truck?truck.kind==='builder'?'bridge-builder':'recycler':gun?gun.kind==='missile'?'missile-launcher':'rail-cannon':bodyType==='rover'?'tank':bodyType;
 return {object,unitType,unitId:object.id,bodyType,unitState:p?(p.mission&&!['complete','lost'].includes(p.mission.phase)?p.mission.phase:p.state):ship?.depth||player.life||'active',controlMode:gun?'remote':'direct'};
}
export const unitMetadata=({object,...metadata})=>metadata;
export function describeCommand(action,data,world,unit,equipment={}){
 const result={...unitMetadata(unit)},parts=[],obj=unit.object;
 const isShip=['gunship','submarine','carrier','transport'].includes(unit.unitType),fixedWing=['bomber','attack-jet'].includes(unit.unitType);
 const shot=(w,payload=false)=>{result.weapon=knownWeapon(w)?w:'unknown';return payload&&w==='HE'?'HE':weaponName(w);};
 if(action==='input'||action==='artillery/command'){
  if(![data.x,data.y].every(Number.isFinite))return {...result,direction:'invalid',command:'invalid movement input'};
  if(isShip||fixedWing){
   result.throttle=data.y<0?(fixedWing?'accelerate':'forward'):data.y>0?(fixedWing?'decelerate':'reverse'):'neutral';
   result.rotation=data.x<0?'left':data.x>0?'right':'none';
   parts.push(result.throttle==='neutral'?'throttle neutral':result.throttle, result.rotation==='none'?'hold heading':'turn '+result.rotation);
  }else{result.direction=direction(data.x,data.y);parts.push(result.direction==='stop'?'stop movement':'move '+result.direction);}
  const target=data.target,aim=target&&Number.isFinite(target.x)&&Number.isFinite(target.y)?Math.atan2(target.x-obj.x,obj.y-target.y):data.aim;
  const aimDirection=bearing(aim);if(aimDirection){result.aimDirection=aimDirection;parts.push('aim '+aimDirection);}
 }else if(action==='artillery/input'){
  if(![data.traverse,data.elevate].every(Number.isFinite))return {...result,command:'invalid cannon input'};
  result.rotation=data.traverse<0?'left':data.traverse>0?'right':'none';parts.push('traverse '+result.rotation,data.elevate<0?'lower barrel':data.elevate>0?'raise barrel':'hold elevation');
 }else if(action==='artillery/rotate'){result.rotation=data.rotated===true?'across':'along';parts.push('rotate strike area '+result.rotation);}
 else if(action==='navigate'){result.direction=direction(data.x-obj.x,data.y-obj.y);parts.push('navigate '+result.direction);}
 else if(action==='fire'){const w=data.weapon??(unit.bodyType==='robot'?'FLAME':equipment.weapon||obj.weapon||'HE');parts.push((w==='MAGNETIC'?'charge ':'fire ')+shot(w));}
 else if(action==='artillery/fire'){const w=obj.ammo||'HE';parts.push(unit.unitType==='missile-launcher'?'launch missiles / '+shot(w,true):'fire rail cannon / '+shot(w,true));}
 else if(action==='ships/fire'){parts.push(unit.unitType==='submarine'?'launch missiles / '+shot(obj.ammo||'HE',true):'fire naval '+(data.mode==='salvo'?'salvo':'volley')+' / '+shot(obj.ammo||'HE',true));}
 else if(action==='ships/secondary')parts.push('fire '+shot('NAVAL_APCR'));
 else if(action==='aircraft/helicopter-fire')parts.push('fire '+shot(data.weapon));
 else if(action==='aircraft/bomb')parts.push('drop '+shot(data.payload||obj.payload||'HE',true)+' bombs');
 else if(action==='aircraft/strafe')parts.push('fire '+shot('cannon'));
 else if(['aircraft/mission','aircraft/recall','aircraft/cruise','aircraft/board'].includes(action)){
  const record=airRecords(world).find(b=>b.id===data.id||b.aircraft?.id===data.id);
  if(record){result.targetId=record.aircraft.id;result.targetType=airType(record.aircraft);}
  parts.push(({ 'aircraft/mission':'order air strike','aircraft/recall':'recall aircraft','aircraft/cruise':'launch cruise','aircraft/board':'board aircraft'})[action]);
  if(action==='aircraft/mission')parts.push(shot(data.payload||'HE',true));
 }else if(action==='orbital/strike')parts.push('call orbital strike / '+shot(data.payload,true));
 else if(action==='artillery/control')parts.push(data.release?'release remote control':'take remote control');
 else if(action.endsWith('/board'))parts.push('board vehicle');
 else if(action.endsWith('/exit'))parts.push(unit.unitType==='helicopter'&&obj.state!=='parked'?'request helicopter landing':'disembark');
 else if(action==='charge/cancel')parts.push('cancel magnetic charge');
 else if(action==='tank-weapon'||action==='sentry-mode'||action.endsWith('/ammo')||action==='aircraft/payload')parts.push('select '+shot(data.weapon||data.ammo||data.payload));
 else if(action==='ships/depth')parts.push(data.action==='dive'?'submerge':data.action==='surface'?'surface':'change depth');
 else parts.push(action.replaceAll('/',' / '));
 result.command=parts.join('; ');
 const target=data.target||(['navigate','fire','ships/fire','ships/secondary'].includes(action)?data:null);
 if(target&&Number.isFinite(target.x)&&Number.isFinite(target.y)){result.targetX=Math.round(target.x*10)/10;result.targetY=Math.round(target.y*10)/10;}
 return result;
}
