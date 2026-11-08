import {expect,it} from 'vitest';
import {createWorld} from '../public/world.js';
import {createCombat} from '../public/combat.js';
import {freshLogistics} from '../public/logistics.js';
import {helicopterLoad} from '../public/helicopter.js';
import {SHIP} from '../public/ship.js';
import {stepShipMounts} from '../public/ship-armament.js';
import {newAirbase} from '../public/aircraft.js';

const field=():any=>({...createWorld(),width:128,height:96,terrain:Array(128*96).fill(2),sites:[],cores:[],tanks:[],ships:[],airbases:[],artillery:[],rails:[],logistics:freshLogistics()});
const vessel=(kind='gunship'):any=>({id:'ship',kind,x:40,y:40,angle:0,turret:0,elapsed:SHIP.duration,berthX:40,health:300,ammo:'HE'});

it('labels accepted tank, railway and naval fire separately and keeps impact identity across a checkpoint',()=>{
  const w=field(),c=createCombat(w),tank={id:'tank',x:20,y:20,turret:Math.PI/2};
  expect(c.shoot(tank,23,20)).toBeNull();
  const before=c.snapshot();expect(c.shoot(tank,23,20)).toContain('reloading');expect(c.snapshot()).toEqual(before);
  expect(c.lob({id:'rail',x:20,y:40},20,20)).toBeNull();
  expect(c.navalSalvo(vessel(),{x:40,y:20},'volley')).toBeNull();
  expect(new Set(c.snapshot().shots.map(s=>s.sound))).toEqual(new Set(['tank-shot','railway-shot','naval-main-shot']));
  const saved=c.checkpoint(),restored=createCombat(w,saved);restored.tick(3,[]);
  expect(new Set(restored.snapshot().impacts.map(i=>i.sound))).toEqual(new Set(['tank-impact','railway-impact','naval-main-impact']));
  expect(restored.snapshot().impacts).toHaveLength(5);
  expect(restored.snapshot().impacts.every(i=>i.weapon==='HE')).toBe(true);
});

it.each(['INCENDIARY','GAS'])('keeps %s launcher identity and chooses its own payload impact',weapon=>{
  const w=field(),c=createCombat(w);
  expect(c.lob({id:'rail',x:20,y:40},20,20,null,weapon)).toBeNull();
  expect(c.snapshot().shots[0].sound).toBe('railway-shot');
  const restored=createCombat(w,c.checkpoint());restored.tick(3,[]);
  expect(restored.snapshot().impacts[0]).toMatchObject({weapon,sound:weapon==='GAS'?'gas-impact':'incendiary-impact'});
});

it('distinguishes the twin naval battery from the single side mounts',()=>{
  for(const [kind,sound,count]of [['gunship','naval-secondary-shot',2],['carrier','naval-side-shot',1]] as const){
    const c=createCombat(field()),s=vessel(kind),target={x:45,y:40};
    stepShipMounts(s,target,2);
    expect(c.navalSecondary(s,target).fired).toBe(count);
    expect(c.snapshot().shots.every(shot=>shot.sound===sound)).toBe(true);
  }
});

it('retains aircraft gun calibers and helicopter rocket identity through impact',()=>{
  const w=field(),c=createCombat(w),gunship:any={id:'gunship',kind:'air-gunship',state:'flying',x:60,y:50,angle:0};
  for(const caliber of ['25','40','105'])expect(c.gunshipFire(gunship,{x:50,y:50},caliber)).toBeNull();
  const heli:any={...helicopterLoad(),id:'heli',kind:'helicopter',state:'flying',x:70,y:50,angle:0,turret:0};
  expect(c.helicopterFire(heli,{x:70,y:45})).toBeNull();expect(c.helicopterFire(heli,{x:70,y:45},true)).toBeNull();
  const jet:any={id:'jet',kind:'attack-jet',state:'flying',x:80,y:50,angle:0};
  expect(c.strafe(jet)).toBeNull();expect(c.strafe(jet,true)).toBeNull();
  expect(new Set(c.snapshot().shots.map(s=>s.sound))).toEqual(new Set(['gunship-25-shot','gunship-40-shot','gunship-105-shot','heli-cannon-shot','rocket-shot','jet-40-shot','jet-30-shot']));
  const restored=createCombat(w,c.checkpoint());restored.tick(1,[]);
  expect(new Set(restored.snapshot().impacts.map(i=>i.sound))).toEqual(new Set(['gunship-25-impact','gunship-40-impact','gunship-105-impact','heli-cannon-impact','rocket-impact','jet-40-impact','jet-30-impact']));
  expect(restored.snapshot().impacts).toHaveLength(9);
});

it('marks only the first magnetic travel segment as a discharge, including after restoration',()=>{
  const w=field(),c=createCombat(w),p={id:'tank',x:20,y:20,turret:Math.PI/2,life:'active',body:'rover',tankWeapon:'MAGNETIC'};
  expect(c.shoot(p,40,20,'MAGNETIC')).toBeNull();c.tick(.99,[],[],[p]);expect(c.snapshot().shots).toHaveLength(0);
  c.tick(.01,[],[],[p]);expect(c.snapshot().shots[0]).toMatchObject({first:true,sound:'magnetic-shot'});
  const restored=createCombat(w,c.checkpoint());restored.tick(.01,[]);
  expect(restored.snapshot().shots[0]).toMatchObject({first:false,sound:null});
});

it('marks MAC discharge once while keeping subsequent piercing segments silent',()=>{
  const c=createCombat(field()),gun={id:'mac',kind:'mac',x:20,y:40,angle:Math.PI/2,brace:0,reload:0};
  expect(c.macFire(gun)).toBeNull();c.tick(2.5,[]);expect(c.snapshot().shots).toHaveLength(0);
  c.tick(.01,[]);c.tick(.01,[]);
  expect(c.snapshot().shots.filter(s=>s.sound==='mac-shot')).toHaveLength(1);
  expect(c.snapshot().shots.at(-1)).toMatchObject({first:false,sound:null});
});

it('keeps AA firing separate from repeated tracer presentation records',()=>{
  const w=field(),tank={id:'aa',kind:'aa',occupant:'pilot',x:20,y:20,turret:Math.PI/2,elapsed:99,health:200};
  w.tanks.push(tank);const c=createCombat(w);
  expect(c.shoot({id:'pilot',x:20,y:20,turret:Math.PI/2},40,20,'AA35')).toBeNull();
  c.tick(.05,[]);c.tick(.05,[]);
  expect(c.snapshot().shots.filter(s=>s.sound==='aa-shot')).toHaveLength(1);
  expect(c.snapshot().shots.filter(s=>s.mount==='aa-tracer')).toHaveLength(2);
  expect(c.snapshot().shots.filter(s=>s.mount==='aa-tracer').every(s=>s.sound===null)).toBe(true);
});

it.each(['HE','HEAVY','INCENDIARY','GAS'])('maps bomber %s impacts from their committed payload',payload=>{
  const w=field(),base:any=newAirbase('base','pilot',48,48);w.airbases.push(base);
  Object.assign(base.aircraft,{state:'flying',x:60,y:40,speed:6,angle:Math.PI/2,payload});
  const c=createCombat(w);expect(c.bombRun(base.aircraft)).toBeNull();
  const restored=createCombat(w,c.checkpoint());restored.tick(20,[]);
  const sound=payload==='HEAVY'?'heavy-bomb-impact':payload==='GAS'?'gas-impact':payload==='INCENDIARY'?'incendiary-impact':'bomb-impact';
  expect(restored.snapshot().impacts).toHaveLength(payload==='HEAVY'?1:12);
  expect(restored.snapshot().impacts.every(i=>i.sound===sound)).toBe(true);
});

it('distinguishes land missile and submarine warhead impacts after flight restoration',()=>{
  for(const [kind,sound,count]of [['missile','missile-impact',12],['submarine','submarine-impact',6]] as const){
    const w=field(),c=createCombat(w);
    if(kind==='missile')expect(c.barrage({id:'battery',x:30,y:30,ammo:'HE'},{x:80,y:50},false)).toBeNull();
    else expect(c.submarineStrike(vessel('submarine'),{x:80,y:50})).toBeNull();
    const restored=createCombat(w,c.checkpoint());restored.tick(20,[]);
    expect(restored.snapshot().impacts).toHaveLength(count);
    expect(restored.snapshot().impacts.every(i=>i.sound===sound)).toBe(true);
  }
});

it.each(['HE','HEAVY','CLUSTER','BEAM'])('identifies orbital %s impacts and attaches a stable order source',payload=>{
  const w=field(),c=createCombat(w),id='audio-orbital-'+payload;
  const result=c.orbitalOrder({orderId:id,sequence:1,payload,target:{x:60,y:50},end:{x:72,y:50},bearing:1},{id:'pilot'});
  expect(result.error).toBeUndefined();c.tick(result.order.delay+.2,[]);
  const sound=payload==='HEAVY'?'orbital-heavy-impact':payload==='CLUSTER'?'orbital-cluster-impact':payload==='BEAM'?'orbital-beam':'orbital-impact';
  expect(c.snapshot().impacts.length).toBeGreaterThan(0);
  expect(c.snapshot().impacts.every(i=>i.sound===sound&&i.soundSource==='orbital:'+id)).toBe(true);
});

it('uses a broad legacy impact fallback when a saved artillery shell predates sound labels',()=>{
  const w=field(),c=createCombat(w);c.lob({id:'rail',x:20,y:40},20,20);
  const saved=c.checkpoint();delete saved.salvos[0].impactSound;
  const restored=createCombat(w,saved);restored.tick(3,[]);
  expect(restored.snapshot().impacts[0].sound).toBe('railway-impact');
});
