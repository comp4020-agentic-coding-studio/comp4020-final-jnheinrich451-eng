import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { SHIP } from '../public/ship.js';
import { NAVAL_GUN, SIDE_MOUNTS, mainMounts, mainSalvo, sideSolution, stepShipMounts, mountPoint, tickMainReloads, readyMainMounts } from '../public/ship-armament.js';
const vessel=():any=>({id:'ship',x:20,y:20,angle:0,turret:0,elapsed:SHIP.duration,berthX:20,health:300,ammo:'HE'});
const water=()=>({...createWorld(),terrain:Array(48*36).fill(0),ships:[] as any[]});
it('keeps side guns in hull-relative outward arcs through heading wrap and steering',()=>{
 for(const angle of [0,Math.PI/2,Math.PI-.01,-Math.PI+.01]){
  for(const m of SIDE_MOUNTS){
   const s={...vessel(),angle};
   const target=mountPoint(s,m.x*4,0),other=SIDE_MOUNTS.find(v=>v!==m)!;
   expect(sideSolution(s,target,m)).toMatchObject({inArc:true,inRange:true,aligned:true});
   expect(sideSolution(s,target,other).inArc).toBe(false);
   stepShipMounts(s,mountPoint(s,0,-7),.1);
   expect(Math.abs(s[m.key]-m.center)).toBeLessThanOrEqual(NAVAL_GUN.turnSpeed*.1+1e-9);
   stepShipMounts(s,mountPoint(s,0,-7),10);
   expect(Math.abs(s[m.key]-m.center)).toBeLessThanOrEqual(NAVAL_GUN.halfArc);
  }
 }
 const s=vessel(),p={x:16,y:20};expect(sideSolution(s,p,SIDE_MOUNTS[0]).inArc).toBe(true);
 s.angle=Math.PI;expect(sideSolution(s,p,SIDE_MOUNTS[1]).inArc).toBe(true);
});
it('initializes legacy main mounts equally and requires side alignment and range',()=>{
 const s=vessel();stepShipMounts(s,null,.1,Math.PI/2);
 expect(s.turret).toBeCloseTo(SHIP.turretSpeed*.1);expect(s.aftTurret).toBe(s.turret);
 const c=createCombat(water()),target={x:16,y:16};
 expect(c.navalSecondary(s,target).fired).toBe(0);stepShipMounts(s,target,.2);
 expect(c.navalSecondary(s,target).fired).toBe(2);
 expect(c.navalSecondary(s,target).fired).toBe(0); // authoritative per-mount cooldown
 c.tick(.2,[]);expect(c.navalSecondary(s,target).fired).toBe(2);
 expect(c.navalSecondary(s,{x:5,y:20}).fired).toBe(0);
 expect(c.navalSecondary(s,{x:20,y:12}).fired).toBe(0);
 s.reload=6;stepShipMounts(s,{x:24,y:20},1);
 expect(c.navalSecondary(s,{x:24,y:20}).fired).toBe(2); // independent side and main reloads
 expect(c.snapshot().shots.at(-1)?.owner).toMatch(/^ship:starboard(?:-fore|-aft)?:1$/);
 expect(c.navalSecondary({...s,destroyed:true},target).error).toBeTruthy();
});
it('secondary fire can kill a pursuing swimmer inside main-gun minimum range',()=>{
 const w=water(),s=vessel();w.ships.push(s);const c=createCombat(w);expect(c.contact(s)).toBeNull();
 let closeHits=0;
 for(let i=0;i<180&&c.snapshot().kills===0;i++){
  const e=c.snapshot().enemies.find(e=>e.kind==='swimmer');
  if(e){stepShipMounts(s,e,.1);if(Math.hypot(e.x-s.x,e.y-s.y)<6)closeHits+=c.navalSecondary(s,e).fired;}
  c.tick(.1,[]);
 }
 expect(closeHits).toBeGreaterThan(0);expect(c.snapshot().kills).toBeGreaterThan(0);
 expect(c.snapshot().impacts.some(i=>i.weapon==='NAVAL_APCR'&&i.hits.some((h:any)=>h.killed))).toBe(true);
});
it('commits nine distinct main rounds with immutable selected ammunition and actual bearings',()=>{
 const w=water(),s=vessel(),c=createCombat(w);s.ammo='GAS';
 expect(c.navalSalvo(s,{x:30,y:20})).toBeNull();const salvo=c.snapshot().salvos;
 expect(salvo).toHaveLength(9);expect(new Set(salvo.map(v=>v.owner)).size).toBe(9);
 expect(new Set(salvo.map(v=>`${v.x},${v.y}`)).size).toBe(9);
 expect(salvo.every(v=>v.targetY<12&&v.weapon==='GAS')).toBe(true);
 s.ammo='HE';s.turret=Math.PI/2;expect(c.snapshot().salvos).toEqual(salvo);
 c.tick(2,[]);expect(c.snapshot().fields).toHaveLength(9);expect(s.health).toBe(300);
});
it('rejects whole salvos when heavy slots, field counts or actual impact bounds would overflow',()=>{
 for(const kind of ['slots','fields','bounds']){
  const c=createCombat(water()),s=vessel();
  if(kind==='slots')for(let i=0;i<5;i++)expect(c.lob({id:'test',x:20,y:20},20,10)).toBeNull();
  if(kind==='fields'){
   s.ammo='GAS';for(let i=0;i<5;i++){expect(c.lob({id:'test',x:20,y:20},20,10,{duration:.1,verticalSpeed:0,gravity:0,elevation:0},'GAS')).toBeNull();c.tick(.1,[]);}
  }
  if(kind==='bounds')s.y=6;
  const before=c.snapshot();expect(c.navalSalvo(s,{x:s.x+10,y:s.y})).toBeTruthy();
  expect(c.snapshot()).toEqual(before);
 }
});
it('fires one ready triple turret per volley, alternates mounts and reloads independently across ammunition',()=>{
 const c=createCombat(water()),s=vessel(),target={x:20,y:10};
 expect(c.navalSalvo(s,target,'volley')).toBeNull();expect(c.snapshot().salvos.map(r=>r.mount)).toEqual(['fore','fore','fore']);
 expect(s.mainReloads).toEqual({fore:6,raised:0,aft:0});tickMainReloads(s,1);c.tick(1,[]);s.ammo='GAS';
 expect(c.navalSalvo(s,target,'volley')).toBeNull();expect(s.mainReloads).toEqual({fore:5,raised:6,aft:0});
 expect(c.snapshot().salvos.filter(r=>r.mount==='raised')).toHaveLength(3);
 expect(c.snapshot().salvos.filter(r=>r.mount==='raised').every(r=>r.weapon==='GAS')).toBe(true);
 expect(c.navalSalvo(s,target,'volley')).toBeNull();expect(c.snapshot().salvos.filter(r=>r.mount==='aft')).toHaveLength(3);
 expect(c.navalSalvo(s,target,'salvo')).toContain('reloading');
 tickMainReloads(s,5);c.tick(5,[]);expect(readyMainMounts(s).map(m=>m.id)).toEqual(['fore']);
 expect(c.navalSalvo(s,target,'salvo')).toBeNull();expect(c.snapshot().salvos).toHaveLength(3);expect(s.mainReloads).toEqual({fore:6,raised:1,aft:1});
});
it('preserves legacy shared cooldowns and admits only the selected volley against capacity',()=>{
 const c=createCombat(water()),s=vessel(),target={x:20,y:10};s.reload=3;
 expect(c.navalSalvo(s,target,'volley')).toContain('reloading');tickMainReloads(s,1);expect(s.mainReloads).toEqual({fore:2,raised:2,aft:2});
 tickMainReloads(s,2);
 for(let i=0;i<9;i++)expect(c.lob({id:'test',x:20,y:20},20,10)).toBeNull();
 const before=JSON.stringify(s);expect(c.navalSalvo(s,target,'salvo')).toContain('slots');expect(JSON.stringify(s)).toBe(before);
 expect(c.navalSalvo(s,target,'volley')).toBeNull();expect(c.snapshot().salvos).toHaveLength(12);expect(s.mainReloads).toEqual({fore:6,raised:0,aft:0});
 const after=JSON.stringify(s);expect(c.navalSalvo(s,target,'volley')).toContain('slots');expect(JSON.stringify(s)).toBe(after);
});

it('preserves old two-turret timers without granting a free raised turret',()=>{
 const s=vessel();s.reload=4;s.mainReloads={fore:0,aft:4};s.nextMainMount='aft';
 tickMainReloads(s,0);expect(s.mainReloads).toEqual({fore:0,raised:4,aft:4});expect(s.nextMainMount).toBe('aft');
 const c=createCombat(water());expect(c.navalSalvo(s,{x:20,y:10})).toBeNull();expect(c.snapshot().salvos).toHaveLength(3);
 const restored=JSON.parse(JSON.stringify(s));tickMainReloads(restored,2);expect(restored.mainReloads).toEqual({fore:4,raised:2,aft:2});
});
it('uses each actual turret bearing for all three barrels and matches rendered muzzle geometry',()=>{
 const s=vessel();s.turret=0;s.raisedTurret=Math.PI/2;s.aftTurret=Math.PI;
 const rounds=mainSalvo(s,{x:30,y:20});expect(rounds).toHaveLength(9);
 for(const m of mainMounts(s)){
  const group=rounds.filter(r=>r.mount===m.id);expect(group.map(r=>r.barrel)).toEqual([-1,0,1]);
  expect(group.every(r=>r.angle===s[m.key])).toBe(true);
  const p=mountPoint(s,0,m.y);expect(group[1].x).toBeCloseTo(p.x+Math.sin(s[m.key])*.8);expect(group[1].y).toBeCloseTo(p.y-Math.cos(s[m.key])*.8);
 }
});
it('accepts a complete nine-field salvo for fire and gas, but rejects another without spending reloads',()=>{
 for(const ammo of ['INCENDIARY','GAS']){
  const s=vessel(),w=water(),c=createCombat(w);s.ammo=ammo;
  expect(c.navalSalvo(s,{x:20,y:10})).toBeNull();const launched=c.snapshot().salvos;
  expect(launched).toHaveLength(9);s.destroyed=true;
  const resumed=createCombat(w,c.checkpoint());expect(resumed.snapshot().salvos).toEqual(launched);
  resumed.tick(3,[]);expect(resumed.snapshot().fields).toHaveLength(9);
  const other={...vessel(),id:'other',ammo},before=JSON.stringify(other);
  expect(resumed.navalSalvo(other,{x:20,y:10},'volley')).toContain('limit');expect(JSON.stringify(other)).toBe(before);
  expect(resumed.snapshot().salvos).toHaveLength(0);
 }
});
it('shares the twelve-slot admission budget across ships without partial salvos',()=>{
 const c=createCombat(water()),a=vessel(),b={...vessel(),id:'b'};
 expect(c.navalSalvo(a,{x:20,y:10})).toBeNull();const before=JSON.stringify(b);
 expect(c.navalSalvo(b,{x:20,y:10})).toContain('slots');expect(JSON.stringify(b)).toBe(before);
 expect(c.snapshot().salvos).toHaveLength(9);expect(c.navalSalvo(b,{x:20,y:10},'volley')).toBeNull();expect(c.snapshot().salvos).toHaveLength(12);
 expect(c.lob({id:'rail',x:20,y:20},20,10)).toContain('Too many');
});
