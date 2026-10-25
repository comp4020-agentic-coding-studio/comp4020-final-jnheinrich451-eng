import { isCarrier, CARRIER } from './carrier.js';
import { shipDimensions } from './naval-scale.js';
﻿import { POD } from './pod.js';
export const SHIP_REPAIR_DELAY = 5;
export const VEHICLE = Object.freeze({tank:200,ship:300,replacement:12});
export const vehicleKind = v => v.berthX !== undefined ? 'ship' : 'tank';
export const hullMaximum = v => isCarrier(v)?CARRIER.health:VEHICLE[vehicleKind(v)];
export const hullHealth = v => v.health ?? hullMaximum(v);
export const operational = v => !v.destroyed && hullHealth(v)>0 && v.elapsed>=POD.duration;
export function hurtVehicle(v,amount) {
 if(!operational(v)||!Number.isFinite(amount)||amount<=0)return false;
 v.health=Math.max(0,hullHealth(v)-amount);v.hurt=(v.hurt||0)+1;v.damageDirty=true;if(vehicleKind(v)==='ship')v.repairDelay=SHIP_REPAIR_DELAY;
 if(!v.health){v.destroyed=true;v.lossPending=true;v.replacement=VEHICLE.replacement;v.speed=0;}
 return true;
}
// Closest point on an oriented hull. Shared by targeting and strike revalidation.
export function hullPoint(v,p) {
 const ship=vehicleKind(v)==='ship',angle=ship?v.angle:0,c=Math.cos(angle),s=Math.sin(angle),dx=p.x-v.x,dy=p.y-v.y;
 const size=shipDimensions(v),halfWidth=ship?size.width/2:.42,halfLength=ship?size.length/2:.42;
 const x=Math.max(-halfWidth,Math.min(halfWidth,dx*c+dy*s)),y=Math.max(-halfLength,Math.min(halfLength,-dx*s+dy*c));
 return{x:v.x+x*c-y*s,y:v.y+x*s+y*c};
}
export const hullDistance=(v,p)=>{const q=hullPoint(v,p);return Math.hypot(q.x-p.x,q.y-p.y);};
