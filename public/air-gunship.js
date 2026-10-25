// Game balance for the manual side-firing aircraft; no physical ballistics claim.
export const isAirGunship=p=>p?.kind==='air-gunship';
export const GUNSHIP=Object.freeze({minSpeed:4,maxSpeed:8,acceleration:1.2,braking:1.8,turnSpeed:.45,rollRate:.8,minRange:3,range:18,arc:55*Math.PI/180});
export const GUNSHIP_GUNS=Object.freeze({
 '25':Object.freeze({label:'25 mm',cooldown:.12,flight:.2,radius:.45,lethalRadius:0,damage:12,edgeDamage:2,craterSize:.45}),
 '40':Object.freeze({label:'40 mm',cooldown:.5,flight:.45,radius:1.2,lethalRadius:0,damage:48,edgeDamage:8,craterSize:1.2}),
 '105':Object.freeze({label:'105 mm',cooldown:3,flight:.8,radius:2.8,lethalRadius:0,damage:180,edgeDamage:25,craterSize:3.5}),
});
export const gunshipWeapon=p=>Object.hasOwn(GUNSHIP_GUNS,p?.gunshipWeapon)?p.gunshipWeapon:'25';
export const gunshipCooldown=(p,weapon=gunshipWeapon(p))=>p?.gunshipCooldowns?.[weapon]||0;
export function tickGunshipGuns(p,dt){
 if(!isAirGunship(p))return false;
 p.gunshipCooldowns ||= {};
 let changed=false;for(const key of Object.keys(GUNSHIP_GUNS))if(p.gunshipCooldowns[key]>0){p.gunshipCooldowns[key]=Math.max(0,p.gunshipCooldowns[key]-dt);changed=true;}
 return changed;
}
export const gunshipAim=p=>({x:p.x-Math.cos(p.angle)*10,y:p.y-Math.sin(p.angle)*10});
export function gunshipFireError(world,p,target,weapon=gunshipWeapon(p)){
 if(!isAirGunship(p))return 'Pilot the Aerial gunship to use its side guns.';
 if(!Object.hasOwn(GUNSHIP_GUNS,weapon))return 'Choose 25, 40 or 105 mm.';
 if(p.state!=='flying')return 'Take off before firing.';
 if(p.mission&&!['complete','lost'].includes(p.mission.phase))return 'Automatic recovery is controlling the aircraft.';
 if(p.edgeTurn)return 'Finish the boundary turn before firing.';
 if(!target||![target.x,target.y].every(Number.isFinite))return 'Aim inside the left firing arc.';
 const dx=target.x-p.x,dy=target.y-p.y,distance=Math.hypot(dx,dy),side=p.angle-Math.PI;
 const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-side),Math.cos(Math.atan2(dy,dx)-side));
 if(distance<GUNSHIP.minRange||distance>GUNSHIP.range||Math.abs(delta)>GUNSHIP.arc)return 'Aim within the left firing arc / 3–18 tiles.';
 const radius=GUNSHIP_GUNS[weapon].radius;
 if(target.x<radius||target.y<radius||target.x>world.width-radius||target.y>world.height-radius)return 'Keep the complete impact inside the map.';
 if(gunshipCooldown(p,weapon)>0)return 'Gun cooling / '+gunshipCooldown(p,weapon).toFixed(1)+'s.';
 return null;
}
