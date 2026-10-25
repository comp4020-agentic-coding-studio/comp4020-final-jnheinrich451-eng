import {expect,it} from 'vitest';
import {createWorld} from '../public/world.js';
import {createCombat} from '../public/combat.js';
import {MAC} from '../public/weapons.js';
import {freshLogistics} from '../public/logistics.js';
import {newGroundEnemy} from '../public/enemy-profiles.js';
import {tickCarriage,driveCarriage,artilleryFireError,railSegment} from '../public/rail.js';
import {fieldCapacityError} from '../public/hazards.js';

function fixture(hp=450){
 const gun:any={id:'mac',kind:'mac',owner:'pilot',x:10,y:40,angle:Math.PI/2,aim:Math.PI/2,shape:'EW',reload:0,brace:0,move:null};
 const world:any={...createWorld(),width:256,height:128,terrain:Array(256*128).fill(2),sites:[],cores:[],artillery:[gun],rails:railSegment(10,40,'EW'),logistics:freshLogistics()};
 const saved=createCombat(world).checkpoint();saved.serial=100;
 saved.enemies=[20.5,30.5,40.5,50.5].map((x,i)=>({...newGroundEnemy('bulwark',i+1,{x,y:40.5}),hp,maxHp:hp,frenzyRecoveryUntil:1e9}));
 return {world,gun,combat:createCombat(world,saved)};
}
const advance=(c:any,n:number)=>{for(let i=0;i<n;i++)c.tick(.1,[]);};

it('charges before damaging three armored enemies, leaves salvage and spares the fourth',()=>{
 const {world,gun,combat}=fixture();expect(combat.macFire(gun)).toBeNull();
 advance(combat,24);expect(combat.snapshot().kills).toBe(0);
 gun.angle=0;gun.x=80; // Accepted trajectory cannot follow later platform changes.
 advance(combat,10);
 expect(combat.snapshot().kills).toBe(3);expect(combat.snapshot().enemies.map((e:any)=>e.id)).toEqual([4]);
 expect(world.logistics.crates.filter((c:any)=>c.kind==='remains')).toHaveLength(3);
 expect(combat.snapshot().marks.filter((m:any)=>m.kind==='mac-blood')).toHaveLength(3);
 expect(combat.snapshot().marks.filter((m:any)=>m.kind==='mac-blood').every((m:any)=>Math.abs(m.angle-Math.PI/2)<.001)).toBe(true);
 expect(combat.snapshot().salvos).toHaveLength(0);
});
it('restores both charging and partially penetrated shots without repeating a hit',()=>{
 const {world,gun,combat}=fixture(2000);combat.macFire(gun);advance(combat,12);
 let c=createCombat(world,combat.checkpoint());advance(c,14);
 expect(c.snapshot().enemies[0].hp).toBe(1100);expect(c.snapshot().enemies[1].hp).toBe(1100);
 expect(c.snapshot().salvos[0].hitIds).toEqual([1,2]);
 c=createCombat(world,c.checkpoint());advance(c,8);
 expect(c.snapshot().enemies.map((e:any)=>e.hp)).toEqual([1100,1100,1100,2000]);
});
it('stops at intervening rock after penetrating the first two enemies',()=>{
 const {world,gun,combat}=fixture();world.terrain[40*256+35]=3;combat.macFire(gun);advance(combat,34);
 expect(combat.snapshot().kills).toBe(2);expect(combat.snapshot().enemies.map((e:any)=>e.id)).toEqual([3,4]);
});
it('damages only the first hostile facility and emits no biological stain for machinery',()=>{
 const {world,gun,combat}=fixture();const save=combat.checkpoint();save.enemies=[];
 save.sites=[{id:'target',x:30,y:39,state:'hostile',hp:1200,maxHp:1200},{id:'behind',x:40,y:39,state:'hostile',hp:1200,maxHp:1200}];
 const c=createCombat(world,save);c.macFire(gun);advance(c,34);
 expect(world.sites.map((s:any)=>s.hp)).toEqual([300,1200]);expect(c.snapshot().marks).toHaveLength(0);
});
it('solid friendly machinery blocks the shot without receiving damage',()=>{
 const {world,gun,combat}=fixture();world.logistics.facilities=[{id:'friend',kind:'factory',x:25,y:40,remaining:0}];
 combat.macFire(gun);advance(combat,34);expect(combat.snapshot().kills).toBe(1);
 expect(world.logistics.durability['factory:friend'].health).toBe(400);
});
it('locks movement and bearing during charge, then resumes normal cooldown and travel',()=>{
 const {world,gun}=fixture();gun.reload=MAC.charge+MAC.cooldown;gun.operator='pilot';gun.lease=5;gun.inputTime=.35;gun.input={mode:'pointer',x:1,y:0};gun.target={x:10.5,y:60};
 expect(driveCarriage(gun,1,0,world,[],[])).toContain('charging');expect(artilleryFireError(gun,world)).toContain('charging');
 tickCarriage(gun,.1);expect(gun.angle).toBe(Math.PI/2);expect(gun.move).toBeNull();
 tickCarriage(gun,2.5);expect(artilleryFireError(gun,world)).toContain('reloading');
 expect(driveCarriage(gun,1,0,world,[],[])).toBeNull();expect(gun.move).toBeTruthy();
});
it('does not reserve hazard area, accepts no personal-weapon MAC and rolls back failed acceptance',()=>{
 const {gun,combat}=fixture(),undo=combat.strikeRollback();combat.macFire(gun);
 expect(fieldCapacityError([],combat.snapshot().salvos,'GAS')).toBeNull();undo();expect(combat.snapshot().salvos).toHaveLength(0);
 expect(combat.shoot({id:'pilot',x:10,y:40},30,40,'MAC')).toContain('Unknown');
});
