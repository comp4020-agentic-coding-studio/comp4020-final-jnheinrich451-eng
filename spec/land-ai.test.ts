import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { createEnemyNavigator, NAVIGATION } from '../public/enemy-navigation.js';
import { freshLife } from '../public/survival.js';

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
