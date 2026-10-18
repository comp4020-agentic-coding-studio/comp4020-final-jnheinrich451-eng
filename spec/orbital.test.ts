import {contactField,insideField,fieldCapacityError,fireBlocked,lureRoute} from '../public/hazards.js';
import {makeSite} from '../public/conquest.js';
import {it,expect} from 'vitest';
import {ORBITAL,orbitalPlan,orbitalState,orbitalActive,orderOrbital,tickOrbital} from '../public/orbital.js';
import {freshLogistics} from '../public/logistics.js';
import {createWorld} from '../public/world.js';
import {createCombat} from '../public/combat.js';
const actor={id:'a',name:'Alpha'};
const request=(sequence=1)=>({orderId:'orbital-order-'+sequence,sequence,payload:'HE',target:{x:60,y:50},bearing:1});
const fixture=():any=>({...createWorld(),width:128,height:96,terrain:Array(128*96).fill(2),sites:[],cores:[],tanks:[],ships:[],airbases:[],logistics:freshLogistics()});
it('previews deterministic advancing rows in four directions with complete damage rings inside the map',()=>{
 const w=fixture();for(let b=0;b<4;b++){const p:any=orbitalPlan(w,{x:60,y:50},b);expect(p.error).toBeUndefined();expect(p.points).toHaveLength(15);expect(p).toEqual(orbitalPlan(w,{x:60,y:50},b));expect(p.points[14].offset).toBeGreaterThan(p.points[0].offset);}
 for(const [target,bearing] of [[{x:2,y:2},0],[{x:120,y:50},1],[{x:NaN,y:50},1],[{x:60,y:50},4]] as const)expect(orbitalPlan(w,target,bearing).error).toBeTruthy();
 const first:any=orbitalPlan(w,{x:60,y:50},1);orderOrbital(w,request(),actor);expect((orbitalPlan(w,{x:60,y:50},1) as any).delay).toBe(ORBITAL.baseDelay);expect(first.delay).toBeGreaterThan(ORBITAL.baseDelay);
});
it('spends ORB once, serializes crew orders and rejects invalid or stale retries without spending GND',()=>{
 const w=fixture();w.logistics.groundSupplies=200;const data=request();expect(orderOrbital(w,data,actor).error).toBeUndefined();data.target.x=2;expect(orbitalState(w).order.target.x).toBe(60);
 expect(w.logistics.supplies).toBe(1200-ORBITAL.cost);expect(orderOrbital(w,data,actor).duplicate).toBe(true);expect(orderOrbital(w,request(2),{id:'b',name:'Bravo'}).error).toContain('executing');expect(w.logistics.groundSupplies).toBe(200);
 tickOrbital(w,100,()=>{});tickOrbital(w,ORBITAL.cooldown,()=>{});expect(orderOrbital(w,request(2),actor).error).toBeUndefined();expect(orderOrbital(w,request(),actor).error).toContain('changed');expect(w.logistics.supplies).toBe(1200-ORBITAL.cost*2);
});
it('rejects unsupported payloads, insufficient funds, forged sequences and out-of-bounds strikes',()=>{
 for(const change of [{payload:'PLASMA'},{sequence:9},{target:{x:1,y:1}},{orderId:'bad'}]){const w=fixture();expect(orderOrbital(w,{...request(),...change},actor).error).toBeTruthy();expect(w.logistics.supplies).toBe(1200);expect(w.logistics.orbital).toBeUndefined();}
 const w=fixture();w.logistics.supplies=119;expect(orderOrbital(w,request(),actor).error).toContain('ORB');
});
it('resumes only unlanded impacts and starts recovery after the final row',()=>{
 const w=fixture();orderOrbital(w,request(),actor);let hits=0;const delay=orbitalState(w).order.delay;
 tickOrbital(w,delay-.01,()=>hits++);expect(hits).toBe(0);tickOrbital(w,.02,()=>hits++);expect(hits).toBe(1);
 const saved=JSON.parse(JSON.stringify(w));expect(orbitalState(saved).cooldown).toBe(0);tickOrbital(saved,0,()=>hits++);expect(hits).toBe(1);
 tickOrbital(saved,20,()=>hits++);expect(hits).toBe(15);expect(orbitalActive(orbitalState(saved))).toBe(false);expect(orbitalState(saved).cooldown).toBe(45);
 tickOrbital(saved,10,()=>hits++);expect(hits).toBe(15);expect(orbitalState(saved).cooldown).toBe(35);
});
it('uses HE conquest and splash outcomes while preserving allies and checkpointed impact progress',()=>{
 const w=fixture();orderOrbital(w,request(),actor);const o=orbitalState(w).order,p=o.points[0];w.sites=[{id:'test',kind:'alert',x:p.x-1.5,y:p.y-1.5,size:3,hp:100,state:'hostile',spawned:true,pending:null}];
 // No friendly weapons or enemies: the only possible damage is the called HE.
 const friend:any={id:'friend',x:p.x,y:p.y,health:100,life:'active',shield:0};
 let c=createCombat(w);c.tick(o.delay+.01,[],[friend],[]);expect(w.sites[0].state).toBe('conquered');expect(friend.health).toBe(100);expect(c.snapshot().impacts).toHaveLength(1);
 const saved=JSON.parse(JSON.stringify({world:w,combat:c.checkpoint()}));c=createCombat(saved.world,saved.combat);c.tick(.01,[],[],[]);expect(c.snapshot().impacts).toHaveLength(0);expect(saved.world.sites[0].state).toBe('conquered');
 saved.world.terrain.fill(0);c.tick(20,[],[],[]);expect(c.snapshot().impacts).toHaveLength(14);expect(c.snapshot().impacts.every(i=>i.surface===0)).toBe(true);expect(c.snapshot().marks).toHaveLength(0);
});

it.each(['INCENDIARY','GAS'])('reserves %s before arrival and restores exactly one field across restart',payload=>{
 const w=fixture();let c=createCombat(w);const data={...request(),payload};expect(c.orbitalOrder(data,actor).error).toBeUndefined();expect(c.orbitalOrder(data,actor).duplicate).toBe(true);
 expect(w.logistics.supplies).toBe(1100);expect(c.snapshot().fields).toHaveLength(1);expect(c.snapshot().fields[0]).toMatchObject({pending:7,sectors:[]});
 const o=orbitalState(w).order;c.tick(o.delay+.01,[],[],[]);expect(c.snapshot().fields[0].pending).toBe(6);expect(c.snapshot().fields[0].sectors).toHaveLength(1);
 const saved=JSON.parse(JSON.stringify({world:w,combat:c.checkpoint()}));expect(saved.combat.fields).toHaveLength(0);c=createCombat(saved.world,saved.combat);c.tick(1,[],[],[]);
 expect(c.snapshot().fields).toHaveLength(1);expect(c.snapshot().fields[0].pending).toBe(0);expect(c.snapshot().fields[0].sectors).toHaveLength(7);
 const field=c.snapshot().fields[0];expect(field.weapon).toBe(payload);expect(insideField(field,o.points[0].x,o.points[0].y)).toBe(true);
 c.tick(3,[],[],[]);expect(c.snapshot().fields[0].sectors).toHaveLength(7);
 if(payload==='INCENDIARY'){expect(fireBlocked(c.snapshot().fields)(o.target.x,o.target.y)).toBe(true);c.tick(18,[],[],[]);expect(c.snapshot().fields).toHaveLength(0);expect(saved.world.logistics.orbitalFields).toHaveLength(0);}
 else expect(c.snapshot().fields[0].capacity).toBe(24);
});
it('shares gas capacity across pods, lures enemies and never refills spent gas on later impacts',()=>{
 const w=fixture(),c=createCombat(w);c.orbitalOrder({...request(),payload:'GAS'},actor);const o=orbitalState(w).order;c.tick(o.delay+.01,[],[],[]);
 const field=w.logistics.orbitalFields[0];expect(lureRoute(w,[],{x:60,y:45},[field],()=>false)).toBeTruthy();
 for(let i=0;i<24;i++)expect(contactField([field],{x:60,y:50,hp:100})).toBe(field);
 expect(field.capacity).toBe(0);expect(contactField([field],{x:60,y:50,hp:100})).toBeNull();
 c.tick(1,[],[],[]);expect(c.snapshot().fields).toHaveLength(0);expect(w.logistics.orbitalFields).toHaveLength(0);
});
it('rejects coastal and water hazard footprints while allowing HE and the beam',()=>{
 const w=fixture();w.terrain[50*w.width+62]=0;
 for(const payload of ['INCENDIARY','GAS'])expect(orbitalPlan(w,{x:60,y:50},1,1,payload).error).toContain('land');
 expect(orbitalPlan(w,{x:60,y:50},1).error).toBeUndefined();expect(orbitalPlan(w,{x:60,y:50},1,1,'BEAM',{x:72,y:50}).error).toBeUndefined();
 for(const end of [{x:60,y:50},{x:90,y:50},{x:NaN,y:50}])expect(orbitalPlan(w,{x:60,y:50},1,1,'BEAM',end).error).toBeTruthy();
});
it('enforces shared hazard limits at acceptance and leaves resources untouched on rejection',()=>{
 const w=fixture(),saved=createCombat(w).checkpoint();saved.fields=Array.from({length:8},(_,id)=>({id:id+1,weapon:'GAS',radius:1,x:5,y:5,capacity:1,initialCapacity:1,at:0}));
 const c=createCombat(w,saved);expect(c.orbitalOrder({...request(),payload:'GAS'},actor).error).toContain('limit');expect(w.logistics.supplies).toBe(1200);expect(w.logistics.orbital).toBeUndefined();
 expect(c.orbitalOrder({...request(),payload:'INCENDIARY'},actor).error).toBeUndefined();expect(fieldCapacityError(c.snapshot().fields,[],'INCENDIARY',200)).toContain('area limit');
});
it.each(['INCENDIARY','GAS'])('%s kills ground enemies on contact without damaging friendly units or hostile buildings',payload=>{
 const w=fixture(),site=makeSite('alert','untouched',59,49);w.sites=[site];let c=createCombat(w);c.orbitalOrder({...request(),payload},actor);const saved=c.checkpoint();
 saved.enemies=[{id:50,x:60,y:50,hp:100,angle:0,behavior:'attacking',path:[],reroute:1e9}];c=createCombat(w,saved);
 const friend:any={id:'friend',x:60,y:50,health:100,life:'active',shield:0};
 c.tick(orbitalState(w).order.delay+.01,[],[friend],[]);expect(c.snapshot().enemies.find(e=>e.id===50)?.hp||0).toBe(0);expect(friend.health).toBe(100);expect(w.sites[0].hp).toBe(420);
});
it('beam contact advances instead of damaging the entire line, persists dose and leaves a bounded scar',()=>{
 const w=fixture();w.sites=[{...makeSite('modifier','start',59,49),hp:2000,maxHp:2000},{...makeSite('modifier','end',77,49),hp:2000,maxHp:2000}];let c=createCombat(w);
 expect(c.orbitalOrder({...request(),payload:'BEAM',end:{x:80,y:50}},actor).error).toBeUndefined();expect(w.logistics.supplies).toBe(1020);const o=orbitalState(w).order;
 c.tick(o.delay+.01,[],[],[]);expect(w.sites[0].hp).toBeLessThan(2000);expect(w.sites[1].hp).toBe(2000);
 const saved=JSON.parse(JSON.stringify({world:w,combat:c.checkpoint()})),prior=w.sites[0].hp;c=createCombat(saved.world,saved.combat);c.tick(.01,[],[],[]);expect(saved.world.sites[0].hp).toBe(prior);
 c.tick(7,[],[],[]);expect(saved.world.sites[1].hp).toBeLessThan(2000);expect(orbitalState(saved.world).scars).toHaveLength(1);expect(c.snapshot().marks).toHaveLength(0);expect(c.snapshot().fields).toHaveLength(0);
});
