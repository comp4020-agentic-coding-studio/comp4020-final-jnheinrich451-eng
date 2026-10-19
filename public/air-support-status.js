import { airfields, flightBase } from './air-traffic.js';
import { airSize, isHelipad, isHelicopter } from './helicopter.js';
import { missionActive } from './bomber-mission.js';
import { isAttackJet } from './attack-jet.js';

export function aircraftStatus(p){
 if(!p)return 'NO AIRCRAFT';
 if(p.state==='destroyed'||p.state==='vacant')return p.state.toUpperCase();
 if(p.state==='delivering')return 'ASSEMBLING';
 if(p.occupant)return 'PILOTED / '+p.state.toUpperCase();
 if(p.state==='parked')return p.rearm>0?'REARMING':'PARKED';
 const phase=missionActive(p)?p.mission.phase:null;
 return ({cruise:'CRUISING',outbound:'ON MISSION',approach:'ON MISSION',dive:'DIVING',release:'ATTACKING',egress:'RELOCATING',return:'RETURNING',landing:'LANDING',service:'REARMING',emergency:'EMERGENCY LANDING',takeoff:'TAKING OFF'})[phase]||p.state.toUpperCase();
}
export const airfieldLabel=b=>!b?'Unavailable base':(b.carrier?'Carrier deck ':isHelipad(b)?'Helipad ':'Runway ')+Math.round(b.x)+':'+Math.round(b.y);
export function aircraftOption(world,b,index){
 const p=b.aircraft,name=isHelicopter(p)?'Helicopter':isAttackJet(p)?'Attack jet':'Bomber';
 return `${name} ${index+1} / ${aircraftStatus(p)} / ${airfieldLabel(flightBase(world,b))}`;
}
export function airfieldAtRobot(world,me){
 if(me?.body!=='robot')return null;
 return airfields(world).find(b=>!b.carrier&&me.x>=b.x&&me.x<b.x+airSize(b).width&&me.y>=b.y&&me.y<b.y+airSize(b).height)||null;
}
