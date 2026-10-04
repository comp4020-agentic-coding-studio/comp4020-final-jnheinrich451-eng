import { operational } from './vehicle.js';

export const DIVE = Object.freeze({transition:2, battery:30, recharge:2, minimum:10});
export const depthState = ship => ship?.kind==='submarine' ? ship.depth||'surfaced' : 'surfaced';
export const surfaced = ship => depthState(ship)==='surfaced';
export const submerged = ship => depthState(ship)==='submerged';
export const diveBattery = ship => ship.diveBattery??DIVE.battery;
export function resetDepth(ship) {
  if(ship.kind==='submarine')Object.assign(ship,{depth:'surfaced',depthRemaining:0,diveBattery:DIVE.battery});
}
export function depthError(ship,action) {
  if(ship?.kind!=='submarine'||!operational(ship))return 'Board a ready submarine first.';
  if(!['dive','surface'].includes(action))return 'Choose dive or surface.';
  const state=depthState(ship);
  if((action==='dive'&&['diving','submerged'].includes(state))||(action==='surface'&&['surfacing','surfaced'].includes(state)))return null;
  if(action==='dive'){
    if(state==='surfacing')return 'Finish surfacing before diving again.';
    if(ship.ramp)return 'Retract the shore ramp before diving.';
    if(ship.launchRemaining>0)return 'Finish launching before diving.';
    if(diveBattery(ship)<DIVE.minimum)return 'Recharge at least 10 seconds of dive battery on the surface.';
  }
  return null;
}
export function requestDepth(ship,action) {
  const error=depthError(ship,action);if(error)return error;
  const state=depthState(ship);
  if(action==='dive'&&state==='surfaced')Object.assign(ship,{depth:'diving',depthRemaining:DIVE.transition});
  if(action==='surface'&&['diving','submerged'].includes(state))Object.assign(ship,{depth:'surfacing',depthRemaining:DIVE.transition});
  return null;
}
// Server simulation time only: no viewers means no drain, recharge or transition.
// Both transitions are vulnerable. Only a fully submerged hull loses detection.
export function tickDepth(ship,dt) {
  if(ship.kind!=='submarine'||!operational(ship)||!Number.isFinite(dt)||dt<=0)return false;
  const before=[depthState(ship),ship.depthRemaining||0,diveBattery(ship)].join('/');
  let left=dt;
  while(left>0){
    const state=depthState(ship);
    if(state==='surfaced'){ship.diveBattery=Math.min(DIVE.battery,diveBattery(ship)+left*DIVE.recharge);break;}
    if(state==='submerged'){
      const used=Math.min(left,diveBattery(ship));ship.diveBattery=diveBattery(ship)-used;left-=used;
      if(ship.diveBattery===0)Object.assign(ship,{depth:'surfacing',depthRemaining:DIVE.transition});
      else break;
    }else{
      const used=Math.min(left,ship.depthRemaining??DIVE.transition);ship.depthRemaining=(ship.depthRemaining??DIVE.transition)-used;left-=used;
      if(ship.depthRemaining<=.000001){ship.depthRemaining=0;ship.depth=state==='diving'?'submerged':'surfaced';}else break;
    }
  }
  return before!==[depthState(ship),ship.depthRemaining||0,diveBattery(ship)].join('/');
}
