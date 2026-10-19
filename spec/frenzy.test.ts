import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { freshLife } from '../public/survival.js';
import { freshLogistics } from '../public/logistics.js';
import { FRENZY, tickFrenzy, planFrenzy } from '../public/frenzy.js';

const enemies=()=>Array.from({length:20},(_,id)=>({id:id+1,x:20.5,y:20.5,hp:60,siteId:'home',homeX:20.5,homeY:20.5}));
const event=(units:any[])=>({id:'event',phase:'surge',until:60000,members:units.map(e=>e.id),points:[],orders:{} as Record<string,any>,nextPulse:0,outcome:null});
const player=(id:string,x=40.5)=>({id,x,y:20.5,...freshLife()});
const facility=(id:string,x=35.5)=>({id,x,y:30.5,facility:{kind:'core',hp:{health:500,armor:2}}});

it('assigns 15 hunters and 5 raiders, shares players and holds assignments between pulses',()=>{
 const units=enemies(),f=event(units),players=[player('a'),player('b')],targets=[facility('f1'),facility('f2',55.5)];
 tickFrenzy(f,{},units,players,targets,100,()=>null,()=>{});
 const orders=Object.values(f.orders);expect(orders.filter(o=>o.role==='raid')).toHaveLength(5);expect(orders.filter(o=>o.role==='hunt')).toHaveLength(15);
 expect(Math.abs(orders.filter(o=>o.targetId==='a').length-orders.filter(o=>o.targetId==='b').length)).toBe(1);
 expect(orders.filter(o=>o.targetId==='f1').length).toBeLessThanOrEqual(3);
 const before=structuredClone(f.orders);players[0].x+=8;
 tickFrenzy(f,{},units,players,targets,200,()=>null,()=>{});expect(f.orders).toEqual(before);
 tickFrenzy(f,{},units,players,targets,1100,()=>null,()=>{});
 expect(Object.values(f.orders).map(o=>o.targetId)).toEqual(Object.values(before).map(o=>o.targetId));
 expect(Object.values(f.orders).find(o=>o.targetId==='a')?.x).toBe(players[0].x);
});
it('invalidates dead targets without redirecting all hunters into structures',()=>{
 const units=enemies(),f=event(units),targets=[facility('f1'),facility('f2')];
 tickFrenzy(f,{},units,[player('a')],targets,100,()=>null,()=>{});
 tickFrenzy(f,{},units,[],targets,1100,()=>null,()=>{});
 expect(Object.values(f.orders).filter(o=>o.role==='hunt')).toHaveLength(0);expect(Object.values(f.orders)).toHaveLength(5);
 targets[0].facility.hp.armor=3;tickFrenzy(f,{},units,[],targets,2100,()=>null,()=>{});
 expect(Object.values(f.orders).some(o=>o.targetId==='f1')).toBe(false);
});
it('uses only a finite reserved arrival and restores the same warning and pursuit',()=>{
 const world:any={...createWorld(),width:80,height:60,terrain:Array(4800).fill(2),sites:[],cores:[],tanks:[],logistics:freshLogistics()};
 const combat=createCombat(world),p=player('a',40.5);p.y=30.5;
 expect(combat.startFrenzy(p,[],[p])).toBeNull();expect(combat.startFrenzy(p,[],[p])).toContain('Wait');
 const warned=combat.checkpoint();expect(warned.frenzy.points.length).toBeGreaterThan(4);expect(combat.snapshot().enemies).toHaveLength(0);expect(combat.snapshot().frenzy!.roster).toEqual({hunter:6,breaker:2,bulwark:2,'twin-lens':1,'heavy-lens':1});
 const restored=createCombat(structuredClone(world),structuredClone(warned));expect(restored.checkpoint()).toEqual(warned);
 for(let i=0;i<55;i++){combat.tick(.1,[],[p]);restored.tick(.1,[],[p]);}
 expect(restored.checkpoint()).toEqual(combat.checkpoint());expect(combat.snapshot().frenzy!.phase).toBe('surge');
 const count=combat.snapshot().enemies.length;expect(count).toBeLessThanOrEqual(FRENZY.roster);expect(combat.checkpoint().frenzy.points).toHaveLength(0);
 expect(combat.snapshot().enemies.find((e:any)=>e.kind==='breaker')).toMatchObject({hp:180,maxHp:180});
 expect(combat.snapshot().enemies.find((e:any)=>e.kind==='bulwark')).toMatchObject({hp:450,maxHp:450});
 expect(combat.start([])).toContain('frenzy');
 const after=createCombat(structuredClone(world),structuredClone(combat.checkpoint()));after.tick(.1,[],[p]);expect(after.snapshot().enemies).toHaveLength(count);
});
it('removes home distance only for the assigned surge and preserves survivors on resolution',()=>{
 const world:any={...createWorld(),width:80,height:60,terrain:Array(4800).fill(2),sites:[],cores:[],tanks:[]};
 const saved=createCombat(world).checkpoint(),unit={...enemies()[0],path:[],reroute:0,angle:0};
 saved.enemies=[unit];saved.serial=1;saved.frenzy=event([unit]);
 const combat=createCombat(world,saved),p=player('a',60.5);
 combat.tick(.1,[],[p]);expect(combat.snapshot().enemies[0].targetId).toBe('a');expect(combat.snapshot().enemies[0].x).toBeGreaterThan(20.5);
 const end=structuredClone(combat.checkpoint());end.frenzy.until=end.now+100;
 const resumed=createCombat(world,end);resumed.tick(.1,[],[p]);expect(resumed.snapshot().frenzy!.phase).toBe('cooldown');expect(resumed.snapshot().enemies[0].targetId).toBeNull();expect(resumed.snapshot().enemies[0].hp).toBe(60);
 expect(resumed.startFrenzy(p,[],[p])).toContain('Wait');
});
it('backs off a confirmed unreachable target and resolves once when ground recovery is lost',()=>{
 const units:any[]=enemies(),f=event(units),logs:any[]=[];
 units[0].failedTarget={id:'a',until:5000};
 tickFrenzy(f,{},units,[player('a'),player('b')],[],100,()=>null,(e:any)=>logs.push(e));expect(f.orders[1].targetId).toBe('b');
 tickFrenzy(f,{},units,[],[],200,()=>null,(e:any)=>logs.push(e));expect(f.phase).toBe('cooldown');expect(f.outcome).toBe('no_ground_targets');
 tickFrenzy(f,{},units,[],[],300,()=>null,(e:any)=>logs.push(e));expect(logs).toHaveLength(1);expect(units).toHaveLength(20);
 expect(units.every(e=>e.frenzyRecoveryUntil===f.until)).toBe(true);
});

it('reserves missing heavy roles before borrowing nearby hunters without transforming survivors',()=>{
 const world:any={...createWorld(),width:80,height:60,terrain:Array(4800).fill(2)},p=player('a',40.5);p.y=30.5;
 const units=Array.from({length:22},(_,i)=>({id:i+1,kind:'hunter',hp:17,x:40.5,y:31.5})),before=structuredClone(units);
 const f=planFrenzy(world,[],[p],units,p,0,'mixed',2)!;
 expect(f.points.map((p:any)=>p.kind)).toEqual(['bulwark','breaker']);expect(f.members).toHaveLength(10);
 expect(units).toEqual(before);expect(f.members.length+f.points.length).toBe(12);
 const full=planFrenzy(world,[],[p],units,p,0,'full',0)!;expect(full.points).toHaveLength(0);expect(full.members).toHaveLength(12);
});
it('keeps test arrivals on clear land and does not borrow invisible distant units',()=>{
 const world:any={...createWorld(),width:80,height:60,terrain:Array(4800).fill(0)},p=player('a',40.5);p.y=30.5;
 expect(planFrenzy(world,[],[p],[{id:1,hp:60,x:1,y:1}],p,0,'blocked',24)).toBeNull();
});
