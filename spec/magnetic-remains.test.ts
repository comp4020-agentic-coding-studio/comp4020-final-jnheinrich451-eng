import {expect,it} from 'vitest';
import {createCombat} from '../public/combat.js';
import {createWorld} from '../public/world.js';
import {freshLogistics,ECONOMY} from '../public/logistics.js';
import {newGroundEnemy} from '../public/enemy-profiles.js';
import {parkedTask} from '../public/recycler.js';

it.each(['hunter','bulwark','heavy-lens'])('magnetic kills leave saved, recyclable %s remains exactly once',kind=>{
 const world:any={...createWorld(),width:48,height:36,terrain:Array(48*36).fill(2),logistics:freshLogistics()};
 const saved=createCombat(world).checkpoint();saved.serial=1;
 saved.enemies=[{...newGroundEnemy(kind,1,{x:20.5,y:18.5}),hp:180,frenzyRecoveryUntil:1e6}];
 const combat=createCombat(world,saved),gun={id:'tank',x:17.5,y:18.5,turret:Math.PI/2,life:'active',body:'rover',tankWeapon:'MAGNETIC'};
 expect(combat.shoot(gun,20.5,18.5,'MAGNETIC')).toBeNull();combat.tick(1,[],[],[gun]);
 expect(combat.snapshot().kills).toBe(1);expect(combat.snapshot().enemies).toHaveLength(0);
 expect(world.logistics.crates).toHaveLength(1);
 expect(world.logistics.crates[0]).toMatchObject({kind:'remains',enemyKind:kind,x:20.5,y:18.5,amount:ECONOMY.remainsValue});
 combat.tick(.1,[],[],[gun]);expect(world.logistics.crates[0].amount).toBe(ECONOMY.remainsValue);
 const restored=JSON.parse(JSON.stringify(world));createCombat(restored,combat.checkpoint()).tick(.1,[],[],[gun]);
 expect(parkedTask(restored,{x:20.5,y:18.5,cargo:0})).toEqual({action:'recover',id:restored.logistics.crates[0].id});
 expect(restored.logistics.crates[0]).toMatchObject({enemyKind:kind,amount:ECONOMY.remainsValue});
});
it('retains magnetic-kill salvage when the shared cargo-pile limit is full',()=>{
 const world:any={...createWorld(),width:48,height:36,terrain:Array(48*36).fill(2),logistics:freshLogistics()};
 world.logistics.crates=Array.from({length:64},(_,i)=>({id:'old-'+i,kind:'remains',x:1+(i%16)*2.5,y:1+Math.floor(i/16)*2.5,amount:8}));
 const saved=createCombat(world).checkpoint();saved.serial=1;
 saved.enemies=[{...newGroundEnemy('hunter',1,{x:20.5,y:18.5}),frenzyRecoveryUntil:1e6}];
 const combat=createCombat(world,saved),gun={id:'tank',x:17.5,y:18.5,turret:Math.PI/2,life:'active',body:'rover',tankWeapon:'MAGNETIC'};
 expect(combat.shoot(gun,20.5,18.5,'MAGNETIC')).toBeNull();combat.tick(1,[],[],[gun]);
 expect(combat.snapshot().kills).toBe(1);expect(world.logistics.crates).toHaveLength(64);
 expect(world.logistics.crates.reduce((n:number,c:any)=>n+c.amount,0)).toBe(65*ECONOMY.remainsValue);
});
