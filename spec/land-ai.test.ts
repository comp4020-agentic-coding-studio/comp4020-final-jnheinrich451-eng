import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { createEnemyNavigator, NAVIGATION } from '../public/enemy-navigation.js';
import { freshLife } from '../public/survival.js';
import { LAND_AI, landTarget, landVisible, landSiegeMembers } from '../public/land-ai.js';

const field=()=>({...createWorld(),width:80,height:60,terrain:Array(80*60).fill(2),sites:[],cores:[],tanks:[]});
function setup(){const world=field(),empty=createCombat(world).checkpoint();empty.enemies=[{id:1,x:20.5,y:20.5,hp:60,path:[],reroute:0,angle:0,siteId:'home',homeX:20.5,homeY:20.5}];empty.serial=1;return {world,combat:createCombat(world,empty)};}
it('acquires at nine tiles, retains beyond the old cutoff and remembers only the last observed point',()=>{
 const {world,combat}=setup(),p={id:'p',x:29.5,y:20.5,...freshLife()};
 combat.tick(.1,[],[p]);expect(combat.snapshot().enemies[0].targetId).toBe('p');
 p.x=33;combat.tick(.1,[],[p]);expect(combat.snapshot().enemies[0].targetId).toBe('p');
 p.x=50;combat.tick(.1,[],[p]);let e=combat.snapshot().enemies[0];expect(e.targetId).toBeNull();expect(e.lastContact.x).toBe(33);
 const saved=combat.checkpoint(),restored=createCombat(world,structuredClone(saved));expect(restored.checkpoint()).toEqual(saved);
 p.x=60;for(let i=0;i<45;i++){combat.tick(.1,[],[p]);restored.tick(.1,[],[p]);}
 e=combat.snapshot().enemies[0];expect(e.lastContact).toBeUndefined();expect(restored.checkpoint()).toEqual(combat.checkpoint());expect(e.hp).toBe(60);
});
it('keeps the home leash and rejects an unreachable island without an endless search',()=>{
 const {world,combat}=setup(),p={id:'p',x:25.5,y:20.5,...freshLife()};
 for(let y=0;y<60;y++)world.terrain[y*80+23]=0;
 for(let i=0;i<30;i++)combat.tick(.1,[],[p]);
 const e=combat.snapshot().enemies[0];expect(e.x).toBeLessThan(23);expect(e.failedTarget?.id).toBe('p');expect(p.health).toBe(100);
 p.x=43;p.y=20.5;combat.tick(.1,[],[p]);expect(combat.snapshot().enemies[0].targetId).toBeNull();
});
it('bounds collective route work and resumes a long route across ticks',()=>{
 const world={...field(),width:512,height:384,terrain:Array(512*384).fill(2)},nav=createEnemyNavigator(world);
 let result:any;
 for(let tick=0;tick<8;tick++){
  nav.begin([],()=>false,tick*100);
  result=nav.route('long',{x:1.5,y:1.5},[{x:500.5,y:1.5}]);
  for(let n=0;n<30;n++)nav.route('other'+n,{x:1.5,y:3.5+n},[{x:500.5,y:3.5+n}]);
  expect(nav.stats().expanded).toBeLessThanOrEqual(NAVIGATION.perTick);expect(nav.stats().nodes).toBeLessThanOrEqual(NAVIGATION.jobs*NAVIGATION.nodes);
  if(result.status==='found')break;
 }
 expect(result.status).toBe('found');expect(result.path).toHaveLength(499);
});
it('honors changed terrain and a completed bridge on a retry',()=>{
 const world=field(),nav=createEnemyNavigator(world);for(let y=0;y<60;y++)world.terrain[y*80+3]=0;
 let result:any;for(let t=0;t<4;t++){nav.begin([],()=>false,t*100);result=nav.route('e',{x:1.5,y:2.5},[{x:5.5,y:2.5}]);if(result.status==='blocked')break;}
 expect(result.status).toBe('blocked');world.terrain[2*80+3]=2;nav.begin([],()=>false,1000);
 expect(nav.route('e',{x:1.5,y:2.5},[{x:5.5,y:2.5}]).status).toBe('found');
});

it('solid cover blocks acquisition and lost sight preserves only the last observed position',()=>{
 const {world,combat}=setup(),p={id:'p',x:29.5,y:20.5,...freshLife()};
 combat.tick(.1,[],[p]);expect(combat.snapshot().enemies[0].targetId).toBe('p');
 for(let y=0;y<60;y++)world.terrain[y*80+24]=3;
 p.x=32.5;combat.tick(.1,[],[p]);
 let e=combat.snapshot().enemies[0];expect(e.targetId).toBeNull();expect(e.lastContact.x).toBe(29.5);expect(e.behavior).toBe('investigating');
 p.y=26.5;
 for(let n=0;n<45;n++)combat.tick(.1,[],[p]);
 e=combat.snapshot().enemies[0];expect(e.lastContact).toBeUndefined();expect(e.x).toBeLessThan(24);expect(p.health).toBe(100);
 // A fresh enemy behind the same cover never acquires the hidden player.
 const saved=createCombat(world).checkpoint();saved.enemies=[{id:2,x:22.5,y:26.5,hp:60,path:[],reroute:0,angle:0,siteId:'home',homeX:22.5,homeY:26.5}];
 const hidden=createCombat(world,saved);p.x=26.5;
 hidden.tick(.1,[],[p]);expect(hidden.snapshot().enemies[0].lastContact).toBeUndefined();
 for(let y=0;y<60;y++)world.terrain[y*80+24]=2;
 for(let n=0;n<3;n++)hidden.tick(.1,[],[p]);
 expect(hidden.snapshot().enemies[0].targetId).toBe('p');
});

it('sees a facility surface without seeing through a rock or Vesper mountain',()=>{
 const world:any=field(),e={x:20.5,y:20.5},target={id:'factory:f',x:25,y:21,facility:{x:25,y:21,w:2,h:2,hp:{armor:2}}};
 const buildings=[{id:'f',x:24,y:20}];
 expect(landVisible(world,buildings,e,target)).toBe(true);
 world.terrain[20*80+22]=3;expect(landVisible(world,buildings,e,target)).toBe(false);
 world.terrain[20*80+22]=2;world.mountains=Array(80*60).fill(0);world.mountains[20*80+22]=2;
 expect(landVisible(world,buildings,e,target)).toBe(false);
});

it('prefers occupied ground vehicles, limits siege priority and bounds acquisition checks',()=>{
 const e:any={id:1,kind:'breaker',hp:180,x:20.5,y:20.5},f:any={id:'factory:f',x:23,y:20.5,facility:{x:23,y:20.5,w:2,h:2,hp:{armor:2}}};
 const driven:any={id:'recycler:r',x:25.5,y:20.5,facility:{x:25.5,y:20.5,w:.8,h:.8,object:{occupant:'pilot',kind:'builder'},hp:{armor:1}}};
 expect(landTarget({...e},[f,driven],0)?.id).toBe(driven.id);
 expect(landTarget({...e},[f,driven],0,()=>true,true)?.id).toBe(f.id);
 const heavy=Array.from({length:8},(_,i)=>({...e,id:i}));expect([...landSiegeMembers(heavy)]).toHaveLength(2);
 expect(landSiegeMembers([{...e,hp:0}]).size).toBe(0);
 const distant={...f,x:35,facility:{...f.facility,x:35}};expect(landTarget({...e},[distant],0)).toBeUndefined();
 let calls=0;const observer={...e},targets=Array.from({length:50},(_,i)=>({id:'p'+i,x:21+i*.05,y:20.5}));
 landTarget(observer,targets,0,()=>{calls++;return false;});expect(calls).toBe(LAND_AI.sightChecks);
 landTarget(observer,targets,100,()=>{calls++;return false;});expect(calls).toBe(LAND_AI.sightChecks);
});

it('patrols locally and resumes the same seeded patrol after a checkpoint without healing',()=>{
 const {world,combat}=setup();for(let i=0;i<25;i++)combat.tick(.1,[],[]);
 const saved=combat.checkpoint(),branch=createCombat(structuredClone(world),structuredClone(saved));
 expect(saved.enemies[0].patrol).toBeDefined();const positions=new Set<string>();
 for(let i=0;i<250;i++){
  combat.tick(.1,[],[]);branch.tick(.1,[],[]);
  const e=combat.snapshot().enemies[0];positions.add(`${e.x.toFixed(1)},${e.y.toFixed(1)}`);
  expect(Math.hypot(e.x-20.5,e.y-20.5)).toBeLessThanOrEqual(LAND_AI.patrolRadius+1);
  expect(e.hp).toBe(60);
 }
 expect(positions.size).toBeGreaterThan(10);expect(branch.checkpoint()).toEqual(combat.checkpoint());
});

it('idle patrol waits on an isolated tile and never crosses water or solid obstacles',()=>{
 const {world,combat}=setup();world.terrain.fill(0);world.terrain[20*80+20]=2;
 for(let i=0;i<100;i++)combat.tick(.1,[],[]);
 expect(combat.snapshot().enemies[0]).toMatchObject({x:20.5,y:20.5,hp:60,behavior:'guarding'});
 expect(combat.checkpoint().enemies[0].path).toEqual([]);
});
