import {it,expect} from 'vitest';
import {freshLogistics} from '../public/logistics.js';
import {createCombat} from '../public/combat.js';
import {newGroundEnemy} from '../public/enemy-profiles.js';
import {tankGuardStep} from '../public/tank-guard.js';
function field(weapon='HE'){
 const tank:any={id:'tank',owner:'owner',x:20.5,y:20.5,angle:0,turret:Math.PI/2,elapsed:99,health:200,weapon,occupant:null};
 const world:any={width:80,height:60,terrain:Array(4800).fill(2),spawn:{x:10,y:10},tanks:[tank],sites:[],cores:[],ships:[],artillery:[],rails:[],airbases:[]};
 const saved=createCombat(world).checkpoint();saved.serial=1;saved.enemies=[{...newGroundEnemy('bulwark',1,{x:26.5,y:20.5}),frenzyRecoveryUntil:1e8}];
 return {world,tank,combat:createCombat(world,saved)};
}
it('an empty HE tank destroys a Bulwark without moving, using normal cannon damage and cadence',()=>{
 const {combat,tank}=field();for(let i=0;i<140;i++)combat.tick(.05,[]);
 expect(combat.snapshot().kills).toBe(1);expect(combat.snapshot().enemies).toHaveLength(0);
 expect(tank).toMatchObject({x:20.5,y:20.5,angle:0,occupant:null});
});
it('prefers visible Bulwarks, rotates before firing and does not shoot through rocks or friendly structures',()=>{
 const {world,tank}=field();tank.turret=0;
 const units=[newGroundEnemy('hunter',2,{x:22.5,y:21.5}),newGroundEnemy('bulwark',1,{x:26.5,y:20.5})];
 expect(tankGuardStep(world,[],tank,units,.05)).toBeNull();expect(tank.guard.targetId).toBe(1);expect(tank.turret).toBeCloseTo(Math.PI*.05);
 world.terrain[20*80+24]=3;tank.guard.search=0;tankGuardStep(world,[],tank,units,.5);expect(tank.guard.targetId).toBe(2);
 world.terrain.fill(2);tank.guard.search=0;tankGuardStep(world,[{x:24,y:20}],tank,[units[1]],.5);expect(tank.guard.targetId).toBeNull();
});
it('magnetic guard charges for a full second and preserves accepted charge progress across restart',()=>{
 const {world,tank,combat}=field('MAGNETIC');combat.tick(.05,[]);expect(combat.snapshot().charges).toHaveLength(1);
 combat.tick(.5,[]);const saved=combat.checkpoint();expect(saved.tankCharges[0].remaining).toBe(500);
 const w2=structuredClone(world),restored=createCombat(w2,structuredClone(saved));
 restored.tick(.45,[]);expect(restored.snapshot().enemies[0].hp).toBe(450);restored.tick(.05,[]);
 expect(restored.snapshot().enemies[0].hp).toBe(270);expect(restored.snapshot().charges).toHaveLength(0);
 expect(w2.tanks[0]).toMatchObject({x:tank.x,y:tank.y});
});
it('boarding cancels automatic charge and the hull retains its reload across manual/automatic handoff',()=>{
 const {combat,tank}=field('MAGNETIC');combat.tick(.05,[]);tank.occupant='pilot';combat.tick(.1,[]);
 expect(combat.snapshot().charges).toHaveLength(0);const source={id:'pilot',x:tank.x,y:tank.y,turret:tank.turret};
 expect(combat.shoot(source,26.5,20.5,'MAGNETIC')).toBe('Weapon reloading.');
 for(let i=0;i<35;i++)combat.tick(.1,[]);
 expect(combat.shoot(source,26.5,20.5,'MAGNETIC')).toBeNull();combat.cancelCharge('pilot');tank.occupant=null;combat.tick(.1,[]);
 expect(combat.snapshot().charges).toHaveLength(0);expect(combat.snapshot().enemies[0].hp).toBe(450);
});
it('blocks arriving, occupied, destroyed, moving, carried or constructing tanks',()=>{
 for(const patch of [{elapsed:0},{occupant:'offline-pilot'},{destroyed:true},{health:0},{speed:1},{carriedBy:'ship'}]){
  const {tank,combat}=field();Object.assign(tank,patch);combat.tick(.1,[]);expect(combat.snapshot().shells).toHaveLength(0);expect(tank.guard.targetId).toBeNull();
 }
 const {world,combat}=field();world.logistics={...freshLogistics(),jobs:{tank:{remaining:30}}};combat.tick(.1,[]);expect(combat.snapshot().shells).toHaveLength(0);
});
it('cancels a magnetic charge if its line is obstructed or its target dies',()=>{
 for(const kill of [false,true]){
  const {world,combat}=field('MAGNETIC');combat.tick(.05,[]);
  if(kill){const saved=combat.checkpoint();saved.enemies[0].hp=0;const restored=createCombat(world,saved);restored.tick(.1,[]);expect(restored.snapshot().charges).toHaveLength(0);}
  else{world.terrain[20*80+24]=3;combat.tick(.1,[]);expect(combat.snapshot().charges).toHaveLength(0);}
 }
});
