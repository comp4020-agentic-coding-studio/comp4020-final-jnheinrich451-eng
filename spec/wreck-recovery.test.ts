import {it,expect} from 'vitest';
import {freshLogistics,unloadSalvage,tickLaunch} from '../public/logistics.js';
import {recordPayment,rememberRecovery,nearbyRecovery,collectRecovery,tickSeaRecovery} from '../public/wreck-recovery.js';
import {parkedTask} from '../public/recycler.js';

const world=():any=>({width:64,height:64,terrain:Array(4096).fill(2),cores:[],ships:[],tanks:[],airbases:[],logistics:freshLogistics()});
const entries=(w:any):any[]=>Object.values(w.logistics.recovery||{});
it.each(['tank','sentry','factory','builder','shipyard','helipad','aircraft'])('records actual %s payment and never refills an exhausted wreck',kind=>{
 const w=world(),v={id:'asset',kind,x:20,y:20};
 recordPayment(w.logistics,kind,v,{id:'receipt',paid:25,pool:'groundSupplies'});
 expect(rememberRecovery(w,kind,v)).toBe(true);const r=entries(w)[0];expect(r.amount).toBe(12.5);
 const truck={cargo:0};collectRecovery(w,truck,r,.5);collectRecovery(w,truck,r,.5);
 expect(truck.cargo).toBe(12.5);expect(r.amount).toBe(0);
 const restored=JSON.parse(JSON.stringify(w));expect(rememberRecovery(restored,kind,v)).toBe(false);expect(entries(restored)[0].amount).toBe(0);
});
it('does not invent value for free or unknown purchases and separates repeated aircraft deliveries',()=>{
 const w=world(),plane:any={id:'base:bomber',x:10,y:10};
 rememberRecovery(w,'aircraft',plane);expect(entries(w)[0].amount).toBe(0);
 for(const [id,paid] of [['free',0],['paid',100]] as const){recordPayment(w.logistics,'aircraft',plane,{id,paid,pool:'supplies'});rememberRecovery(w,'aircraft',plane);}
 expect(entries(w).map(r=>r.amount)).toEqual([0,0,50]);
});
it('shares one finite balance between collectors, respects cargo capacity and processes either supply branch',()=>{
 const w=world(),v={id:'tank',x:20,y:20,purchase:{paid:100,pool:'supplies'}};rememberRecovery(w,'tank',v);
 const r=entries(w)[0],a={x:20,y:20,cargo:179},b={x:20,y:20,cargo:0};
 expect(parkedTask(w,a)).toEqual({action:'wreck',id:r.id});
 collectRecovery(w,a,r,.5);expect(a.cargo).toBe(180);
 for(let i=0;i<10;i++)collectRecovery(w,b,r,.5);
 expect(b.cargo).toBe(49);expect(r.amount).toBe(0);
 w.logistics.facilities=[{id:'core',kind:'outpost',x:20,y:20,remaining:0}];
 unloadSalvage(w,b,'core',2);expect(w.logistics.groundSupplies).toBe(49);expect(b.cargo).toBe(0);
 const rocket={id:'rocket',kind:'uplink',x:20,y:20,cargo:0,launch:0,remaining:0};w.logistics.facilities.push(rocket);
 unloadSalvage(w,a,'rocket',1);expect(rocket.cargo).toBe(180);rocket.launch=1;tickLaunch(w.logistics,rocket,1);expect(w.logistics.supplies).toBe(1380);
});
function sea(){
 const w=world();w.terrain.fill(0);
 rememberRecovery(w,'ship',{id:'lost',x:20,y:20,purchase:{paid:200,pool:'groundSupplies'}});
 const ship:any={id:'transport',kind:'transport',x:20,y:20,elapsed:99,throttle:0,speed:0,cargo:{kind:'utility',vehicle:{id:'r',cargo:0,kind:'recycler'}}};w.ships=[ship];return {w,ship,r:entries(w)[0]};
}
it('collects at sea only from a stopped transport with a recycler, and retains partial progress after reload',()=>{
 const {w,ship,r}=sea();expect(nearbyRecovery(w,ship,'land')).toBeUndefined();
 for(const change of [{speed:1},{throttle:1},{kind:'carrier'}]){
  Object.assign(ship,{speed:0,throttle:0,kind:'transport'},change);for(let i=0;i<20;i++)tickSeaRecovery(w,.1);expect(r.amount).toBe(100);
 }
 Object.assign(ship,{speed:0,throttle:0,kind:'transport'});ship.cargo.vehicle.kind='builder';for(let i=0;i<20;i++)tickSeaRecovery(w,.1);expect(r.amount).toBe(100);
 ship.cargo.vehicle.kind='recycler';for(let i=0;i<15;i++)tickSeaRecovery(w,.1);
 expect(r.amount).toBeLessThan(100);expect(r.amount+ship.cargo.vehicle.cargo).toBe(100);
 const restored=JSON.parse(JSON.stringify(w));for(let i=0;i<70;i++)tickSeaRecovery(restored,.1);
 expect(entries(restored)[0].amount).toBe(0);expect(restored.ships[0].cargo.vehicle.cargo).toBe(100);
});
it('rolls back both sea balances if committing the transfer fails',()=>{
 const {w,ship,r}=sea();const t=ship.cargo.vehicle;t.recoveryIdle=1;t.recoveryWork=.5;
 expect(()=>tickSeaRecovery(w,.1,()=>{throw Error('disk full');})).toThrow('disk full');
 expect(r.amount).toBe(100);expect(t.cargo).toBe(0);
});
it('does not double count a legacy bundled ship receipt as a dock and keeps stored cargo distinct',()=>{
 const w=world(),v={id:'old',x:10,y:10,purchase:{paid:240,pool:'supplies',kind:'gunship'}};
 rememberRecovery(w,'ship',v);rememberRecovery(w,'dock',v);expect(entries(w).map(r=>r.amount)).toEqual([120,0]);
 rememberRecovery(w,'recycler',{id:'cargo',x:10,y:10},undefined,73);expect(entries(w)[2].amount).toBe(73);
});
