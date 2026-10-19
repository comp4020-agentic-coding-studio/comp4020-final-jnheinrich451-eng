import {it,expect} from 'vitest';
import {newAirbase,tickAircraft} from '../public/aircraft.js';
import {helicopterLanding,requestHelicopterLanding,flightBase} from '../public/air-traffic.js';
function field(){
 const b:any=newAirbase('pad','p',30,30,'helicopter','helipad'),p=b.aircraft;
 Object.assign(p,{state:'flying',occupant:'p',leftBase:false,x:31.5,y:31.5,speed:0});
 const w:any={width:100,height:100,airbases:[b],ships:[],logistics:{jobs:{}}};return {b,p,w};
}
it('explicit landing works after hovering in place on takeoff and retains the pilot until disembark',()=>{
 const {b,p,w}=field();expect(requestHelicopterLanding(w,p)).toBeNull();expect(p).toMatchObject({state:'landing',remaining:2,occupant:'p'});
 tickAircraft(w,b,null,2.1);expect(p.state).toBe('parked');expect(p.occupant).toBe('p');expect(p.rearm).toBe(8);
});
it('reports destroyed, incomplete, occupied and reserved helipads without changing aircraft or seat',()=>{
 for(const reason of ['destroyed','building','occupied','reserved']){
  const {b,p,w}=field();
  if(reason==='destroyed')b.destroyed=true;
  if(reason==='building')w.logistics.jobs[b.id]={remaining:10};
  if(['occupied','reserved'].includes(reason)){
   const other=newAirbase('other','friend',50,50,'helicopter','helipad');
   Object.assign(other.aircraft,{baseId:b.id,state:reason==='occupied'?'parked':'landing'});w.airbases.push(other);
  }
  const before=structuredClone(p),error=requestHelicopterLanding(w,p);expect(error).toMatch(/destroyed|construction|occupied or reserved/);expect(p).toEqual(before);
 }
});
it('lands at another free helipad without changing storage identity; rejects speed, distance and runway-only recovery',()=>{
 const {b,p,w}=field();b.destroyed=true;const other:any=newAirbase('other','friend',50,50,'helicopter','helipad');other.aircraft.state='vacant';w.airbases.push(other);
 expect(requestHelicopterLanding(w,p)).toContain('destroyed');Object.assign(p,{x:51.5,y:51.5,speed:3});expect(requestHelicopterLanding(w,p)).toContain('Release WASD');
 p.speed=0;expect(requestHelicopterLanding(w,p)).toBeNull();expect(p.baseId).toBe('other');expect(b.aircraft).toBe(p);
 tickAircraft(w,flightBase(w,b),null,2.1);expect(p).toMatchObject({state:'parked',x:51.5,y:51.5});
 p.state='flying';p.x=70;expect(helicopterLanding(w,p).error).toContain('Hover over');
 w.airbases=[newAirbase('runway','p',65,65)];expect(helicopterLanding(w,p).error).toContain('No intact, free helipad');
});
