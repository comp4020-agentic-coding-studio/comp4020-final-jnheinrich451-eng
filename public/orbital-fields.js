import {orbitalProfile} from './orbital.js';

// One reserved field and one gas budget per order. Logistics owns these fields
// so queued and landed sectors keep the same lifetime across a server restart.
export function makeOrbitalField(order,id,now){
 const p=orbitalProfile(order),box=order.box;
 return {id,orbital:true,orderId:order.id,weapon:order.payload,box:{...box},x:box.x+box.width/2,y:box.y+box.height/2,
  sectors:[],pending:order.points.length,at:now,remaining:0,duration:p.duration||0,capacity:p.capacity||0,initialCapacity:p.capacity||0};
}
export function landOrbitalField(field,point,order,now){
 if(!field)return;const p=orbitalProfile(order);field.pending=Math.max(0,field.pending-1);
 if(field.weapon==='GAS'&&field.capacity<=0)return;
 field.sectors.push({x:point.x,y:point.y,radius:p.radius,at:now,remaining:p.duration||0});
 if(field.weapon==='INCENDIARY')field.remaining=p.duration;
}
