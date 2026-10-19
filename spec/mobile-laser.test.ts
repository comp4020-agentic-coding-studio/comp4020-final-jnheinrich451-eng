import { it, expect } from 'vitest';
import { MOBILE_LASERS, tickMobileLaser } from '../public/mobile-laser.js';
import { newGroundEnemy, assignMobileLaserGuards, canDamageEnemy } from '../public/enemy-profiles.js';
import { newAirbase } from '../public/aircraft.js';
import { createCombat } from '../public/combat.js';
import { makeSite, tickSites, ALERT } from '../public/conquest.js';

function fixture(kind='twin-lens') {
  const base=newAirbase('pad','pilot',10,10,'helicopter','helipad'),plane:any=base.aircraft;
  Object.assign(plane,{state:'flying',x:40,y:30,health:180,speed:0});
  const e:any=newGroundEnemy(kind,1,{x:40,y:40});
  const world:any={width:100,height:80,terrain:Array(8000).fill(2),spawn:{x:5,y:5},sites:[],cores:[],airbases:[base],tanks:[],ships:[],artillery:[],rails:[],fronts:[]};
  const events:any[]=[];let now=0;
  const tick=(dt=.05)=>tickMobileLaser(e,[plane],dt,now+=dt*1000,()=>true,event=>events.push(event));
  const fire=()=>{for(let i=0;i<100&&e.airLaser?.phase!=='firing';i++)tick();expect(e.airLaser.phase).toBe('firing');};
  return {e,plane,world,tick,fire,events};
}
for(const kind of ['twin-lens','heavy-lens']) {
  const profile=MOBILE_LASERS[kind as keyof typeof MOBILE_LASERS];
  it(kind+' braces and warns while stationary, then delivers one bounded beam budget',()=>{
    const {e,plane,tick,fire,events}=fixture(kind);tick();expect(e.airLaser.phase).toBe('bracing');
    fire();expect({x:e.x,y:e.y}).toEqual({x:40,y:40});expect(plane.health).toBe(180);
    for(let i=0;i<profile.burst/.05;i++)tick();
    expect(plane.health).toBeCloseTo(180-profile.burst*profile.dps);expect(plane.health).toBeGreaterThan(0);
    expect(e.airLaser.phase).toBe('cooling');expect(events.filter(e=>e.event==='enemy.weapon.hit')).toHaveLength(1);
    const before=plane.health;for(let i=0;i<20;i++)tick();expect(plane.health).toBe(before);expect(e.x!==40||e.y!==40).toBe(true);
  });
  it(kind+' lets lateral helicopter and jet motion outrun angle tracking',()=>{
    for(const [type,speed]of [['helicopter',4],['attack-jet',10]] as const){
      const {e,plane,tick,fire}=fixture(kind);plane.kind=type;fire();
      // Already evading during the telegraph; straight radial motion is not a dodge.
      plane.x+=3;
      for(let i=0;i<40;i++){plane.x+=speed*.05;tick();}
      expect(plane.health).toBe(180);expect(Math.abs(e.airLaser.angle)).toBeLessThanOrEqual(profile.track*2+.001);
    }
  });
  it(kind+' cancels when moved, killed, out of range or landed; does not transfer lock mid-burst',()=>{
    for(const reason of ['move','death','range','land']){
      const {e,plane,tick,fire}=fixture(kind);fire();tick();const hp=plane.health;
      if(reason==='move')e.x+=1;if(reason==='death')e.hp=0;if(reason==='range')plane.x=99;if(reason==='land')plane.state='parked';
      tick();expect(plane.health).toBe(hp);expect(e.airLaser.beam).toBeNull();expect(e.airLaser.targetId).toBeNull();
    }
  });
  it(kind+' hits a hull intersecting the beam, not the locked but dodging aircraft',()=>{
    const {e,plane,fire}=fixture(kind);fire();plane.x+=8;
    const crossing={...plane,id:'crossing',x:40,y:35};
    tickMobileLaser(e,[plane,crossing],.05,5000,()=>true);
    expect(plane.health).toBe(180);expect(crossing.health).toBeLessThan(180);
    expect(e.airLaser.targetId).toBe(plane.id);
  });
  it(kind+' preserves phase, health, bearing and remaining exposure through a combat checkpoint',()=>{
    const {world,e}=fixture(kind),save=createCombat(world).checkpoint();save.enemies=[e];save.serial=1;
    const c=createCombat(world,save);for(let i=0;i<65;i++)c.tick(.05,[]);
    const checkpoint=c.checkpoint(),world2=structuredClone(world),restored=createCombat(world2,structuredClone(checkpoint));
    expect(restored.checkpoint()).toEqual(checkpoint);
    for(let i=0;i<40;i++){c.tick(.05,[]);restored.tick(.05,[]);}
    expect(restored.checkpoint()).toEqual(c.checkpoint());expect(world2.airbases[0].aircraft.health).toBeCloseTo(world.airbases[0].aircraft.health);
    // Snapshot consumers cannot mutate the authoritative beam state.
    restored.snapshot().enemies[0].airLaser.remaining=999;expect(restored.checkpoint().enemies[0].airLaser.remaining).not.toBe(999);
  });
}
it('leaves ground units and parked aircraft alone, obeys terrain and remains vulnerable to ground weapons',()=>{
  const {e,plane,world}=fixture();plane.state='parked';
  const save=createCombat(world).checkpoint();save.enemies=[e];save.serial=1;
  const c=createCombat(world,save),robot:any={id:'robot',x:40.1,y:40.1,life:'active',health:100,shield:0,body:'robot'};
  for(let i=0;i<100;i++)c.tick(.05,[],[robot]);expect(robot.health).toBe(100);expect(plane.health).toBe(180);
  const before={x:e.x,y:e.y};for(let i=0;i<30;i++)tickMobileLaser(e,[],.1,10000,()=>false);expect({x:e.x,y:e.y}).toEqual(before);
  for(const kind of ['twin-lens','heavy-lens'])for(const weapon of ['APCR','LASER','FLAME','GAS','HE'])expect(canDamageEnemy({kind},weapon)).toBe(true);
});
it('upgrades a few unspent guards idempotently, without touching accepted warnings or permanent conquest',()=>{
  const sites=Array.from({length:10},(_,i)=>({...makeSite('anti-air','site'+i,20,20),encounter:{id:'group'+i},guardRoster:['hunter','breaker','hunter'],guardsRemaining:3}));
  sites[0].state='conquered';sites[1].guardsRemaining=0;sites[2].pending={at:100} as any;
  const before=structuredClone(sites);expect(assignMobileLaserGuards(sites)).toBe(4);expect(assignMobileLaserGuards(sites)).toBe(0);
  expect(sites.slice(0,3)).toEqual(before.slice(0,3));expect(sites.every(s=>s.guardRoster.length===3)).toBe(true);
});
it('aircraft wake finite specialist guards; spawning shares the global cap and four-specialist limit',()=>{
  const {world,plane}=fixture(),site:any={...makeSite('anti-air','site',35,35),guardRoster:['twin-lens'],guardsRemaining:1};world.sites=[site];
  const enemies:any[]=[];let id=0;
  tickSites(world.sites,world,[],[],enemies,0,()=>++id,()=>false,ALERT.globalMax);expect(site.awake).toBe(true);expect(site.pending).toBeNull();
  tickSites(world.sites,world,[],[],enemies,100,()=>++id);expect(site.pending.points).toHaveLength(1);
  for(let i=0;i<4;i++)enemies.push(newGroundEnemy('twin-lens',++id,{x:10+i,y:10}));
  tickSites(world.sites,world,[],[],enemies,2400,()=>++id);expect(enemies).toHaveLength(4);expect(site.guardsRemaining).toBe(1);
  enemies[0].hp=0;tickSites(world.sites,world,[],[],enemies,5000,()=>++id);tickSites(world.sites,world,[],[],enemies,7400,()=>++id);
  expect(enemies.filter(e=>e.hp>0&&e.kind==='twin-lens')).toHaveLength(4);expect(site.guardsRemaining).toBe(0);expect(plane.health).toBe(180);
});
