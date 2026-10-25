import { cargoCells } from './cargo-pods.js';
import { placementError } from './world.js';

// Payload admission already validates its centre. Check the four extra walls
// through ordinary land-placement rules on both client and server.
export function cargoPlacementError(world,buildings,occupants,site){
  if(!site)return null;
  // A railway cannon's metal panels may cover its supporting track. All other
  // machinery, bodies and terrain still pass the ordinary placement checks.
  const ground=site.overRails?{...world,rails:[]}:world;
  const bodies=[...occupants,...(world.logistics?.recyclers||[])];
  for(const {x,y} of cargoCells(site,true)){
    const error=placementError(ground,buildings,bodies,x,y);
    if(error)return `Pod wall at ${x}:${y}: ${error}`;
  }
  return null;
}
