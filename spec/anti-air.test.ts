import { it, expect } from 'vitest';
import { ANTI_AIR, tickAntiAir } from '../public/anti-air.js';
import { AIR_HULL, newAirbase, hurtAircraft, tickAircraft, parkingPoint, launchAircraft } from '../public/aircraft.js';
import { makeSite, seedConquest, damageSites } from '../public/conquest.js';
import { createCombat, blastDamage } from '../public/combat.js';
import { ARTILLERY_HE } from '../public/weapons.js';
function fixture() {
  const base = newAirbase('base', 'pilot', 20, 65), p: any = base.aircraft;
  Object.assign(p, { state:'flying', x:90, y:50, speed:6, angle:0, occupant:'pilot' });
  const site: any = makeSite('anti-air','aa',90,30);
  const world: any = {width:128,height:96,terrain:Array(128*96).fill(2),spawn:{x:10,y:10},airbases:[base],sites:[site],cores:[],tanks:[],ships:[],artillery:[],rails:[],fronts:[]};
  return {world,base,p,site};
}
it('warns a predicted fixed burst; steady flight is hit and a turning aircraft escapes', () => {
  for (const dodge of [false,true]) {
    const {world,p,site}=fixture(), shells:any[]=[], events:any[]=[];let id=0;
    const tick=(now:number)=>tickAntiAir(world,shells,now,.05,()=>++id,e=>events.push(e));
    tick(0); expect(site.aa.queue).toHaveLength(3); const first={...site.aa.queue[0]};
    expect(first.y).toBeCloseTo(50-6*2.3);expect(shells).toHaveLength(0);
    tick(899);expect(shells).toHaveLength(0);tick(900);expect(shells).toHaveLength(1);
    Object.assign(p,{x:first.x+(dodge?5:0),y:first.y});tick(first.landAt);
    expect(p.health).toBe(dodge?AIR_HULL.health:AIR_HULL.health-ANTI_AIR.damage);
    expect(shells[0].impacted).toBe(true);tick(first.landAt+1);
    expect(p.health).toBe(dodge?180:140); // Impact cannot apply twice.
    expect(events.filter(e=>e.event==='enemy.weapon.hit')).toHaveLength(dodge?0:1);
  }
});
it('ignores parked aircraft and ground units and bounds simultaneous reserved bursts',()=>{
  const {world,p,site}=fixture(),shells:any[]=[];p.state='parked';
  tickAntiAir(world,shells,0,.1,()=>1);expect(site.aa.queue).toEqual([]);
  p.state='flying';world.sites=Array.from({length:20},(_,i)=>({...makeSite('anti-air','aa'+i,90,30)}));
  tickAntiAir(world,shells,10,.1,()=>1);
  expect(world.sites.reduce((n:number,s:any)=>n+s.aa.queue.length,0)).toBe(ANTI_AIR.maxShells);
  tickAntiAir(world,shells,2000,.1,()=>1);expect(shells).toHaveLength(ANTI_AIR.maxShells);
});
it('HE silences future launches permanently but already launched flak survives checkpoint',()=>{
  const {world,site}=fixture(),c=createCombat(world);c.tick(.1,[]);c.tick(.9,[]);
  expect(c.snapshot().flakShells).toHaveLength(1);
  damageSites(world.sites,91.5,31.5,{...ARTILLERY_HE,damage:10000},1000,blastDamage);
  expect(site.state).toBe('conquered');expect(site.aa.queue).toEqual([]);
  const resumed=createCombat(world,c.checkpoint());expect(resumed.snapshot().flakShells).toHaveLength(1);
  resumed.tick(3,[]);expect(resumed.snapshot().flakShells).toHaveLength(0);expect(site.aa.phase).toBe('silent');
});
it('saves burst prediction without wall-clock catch-up and accepts pre-flak checkpoints',()=>{
  const {world}=fixture(),c=createCombat(world);c.tick(.1,[]);const saved=c.checkpoint();
  const resumed=createCombat({...world},saved);expect(resumed.checkpoint().sites).toEqual(saved.sites);
  resumed.tick(.5,[]);expect(resumed.snapshot().flakShells).toHaveLength(0);
  resumed.tick(.4,[]);expect(resumed.snapshot().flakShells).toHaveLength(1);
  delete saved.flakShells;expect(createCombat({...world},saved).snapshot().flakShells).toEqual([]);
});
it('disables a damaged aircraft, blocks launch, and replaces it at its original base after simulation time',()=>{
  const {world,base,p}=fixture();expect(hurtAircraft(p,180)).toBe(true);
  expect(p).toMatchObject({health:0,state:'destroyed',speed:0,remaining:20});
  expect(launchAircraft(p)).toContain('destroyed');expect(hurtAircraft(p,10)).toBe(false);
  // Server releases the seat and disables the pilot atomically before this tick.
  p.occupant=null;tickAircraft(world,base,null,19);expect(p.state).toBe('destroyed');
  const restored=JSON.parse(JSON.stringify(base));tickAircraft(world,restored,null,1);
  expect(restored.aircraft).toMatchObject({...parkingPoint(base),health:180,state:'parked',occupant:null,runs:2});
  p.state='parked';p.health=40;p.rearm=.1;tickAircraft(world,base,null,.1);expect(p.health).toBe(180);
});
it('places one safe outpost without terrain edits, avoids the existing runway and never overwrites occupied land',()=>{
  const {world}=fixture();world.sites=[];const terrain=[...world.terrain];
  const added=seedConquest(world,[],[],'anti-air');expect(added).toHaveLength(1);
  expect(Math.hypot(added[0].x+1.5-23,added[0].y+1.5-70)).toBeGreaterThan(36);
  expect(world.terrain).toEqual(terrain);world.terrain.fill(0);
  expect(seedConquest(world,[],[],'anti-air')).toEqual([]);
});
