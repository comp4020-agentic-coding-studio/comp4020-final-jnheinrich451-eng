import { POD } from './pod.js';
export const VEHICLE = Object.freeze({tank:200,ship:300,replacement:12});
export const vehicleKind = v => v.berthX !== undefined ? 'ship' : 'tank';
export const hullHealth = v => v.health ?? VEHICLE[vehicleKind(v)];
export const operational = v => !v.destroyed && hullHealth(v)>0 && v.elapsed>=POD.duration;
export function hurtVehicle(v,amount) {
 if(!operational(v)||!Number.isFinite(amount)||amount<=0)return false;
 v.health=Math.max(0,hullHealth(v)-amount);v.hurt=(v.hurt||0)+1;v.damageDirty=true;
 if(!v.health){v.destroyed=true;v.lossPending=true;v.replacement=VEHICLE.replacement;v.speed=0;}
 return true;
}
// Closest point on an oriented hull. Shared by targeting and strike revalidation.
export function hullPoint(v,p) {
 const ship=vehicleKind(v)==='ship',angle=ship?v.angle:0,c=Math.cos(angle),s=Math.sin(angle),dx=p.x-v.x,dy=p.y-v.y;
 const x=Math.max(-(ship?1:.42),Math.min(ship?1:.42,dx*c+dy*s)),y=Math.max(-(ship?2:.42),Math.min(ship?2:.42,-dx*s+dy*c));
 return{x:v.x+x*c-y*s,y:v.y+x*s+y*c};
}
export const hullDistance=(v,p)=>{const q=hullPoint(v,p);return Math.hypot(q.x-p.x,q.y-p.y);};
