import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { SHIP } from '../public/ship.js';
import { NAVAL_GUN, SIDE_MOUNTS, sideSolution, stepShipMounts, mountPoint, tickMainReloads, readyMainMounts } from '../public/ship-armament.js';
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
 expect(c.navalSecondary(s,target).fired).toBe(1);
 expect(c.navalSecondary(s,target).fired).toBe(0); // authoritative per-mount cooldown
 c.tick(.2,[]);expect(c.navalSecondary(s,target).fired).toBe(1);
 expect(c.navalSecondary(s,{x:5,y:20}).fired).toBe(0);
 expect(c.navalSecondary(s,{x:20,y:12}).fired).toBe(0);
 s.reload=6;stepShipMounts(s,{x:24,y:20},1);
 expect(c.navalSecondary(s,{x:24,y:20}).fired).toBe(1); // independent side and main reloads
 expect(c.snapshot().shots.at(-1)?.owner).toBe('ship:starboard');
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
it('commits four distinct main rounds with immutable selected ammunition and actual bearings',()=>{
 const w=water(),s=vessel(),c=createCombat(w);s.ammo='GAS';
 expect(c.navalSalvo(s,{x:30,y:20})).toBeNull();const salvo=c.snapshot().salvos;
 expect(salvo).toHaveLength(4);expect(new Set(salvo.map(v=>v.owner)).size).toBe(4);
 expect(new Set(salvo.map(v=>`${v.x},${v.y}`)).size).toBe(4);
 expect(salvo.every(v=>v.targetY<12&&v.weapon==='GAS')).toBe(true);
 s.ammo='HE';s.turret=Math.PI/2;expect(c.snapshot().salvos).toEqual(salvo);
 c.tick(2,[]);expect(c.snapshot().fields).toHaveLength(4);expect(s.health).toBe(300);
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
it('fires one ready twin turret per volley, alternates mounts and reloads independently across ammunition',()=>{
 const c=createCombat(water()),s=vessel(),target={x:20,y:10};
 expect(c.navalSalvo(s,target,'volley')).toBeNull();expect(c.snapshot().salvos.map(r=>r.mount)).toEqual(['fore','fore']);
 expect(s.mainReloads).toEqual({fore:6,aft:0});tickMainReloads(s,1);c.tick(1,[]);s.ammo='GAS';
 expect(c.navalSalvo(s,target,'volley')).toBeNull();expect(s.mainReloads).toEqual({fore:5,aft:6});
 expect(c.snapshot().salvos.filter(r=>r.mount==='aft').every(r=>r.weapon==='GAS')).toBe(true);
 expect(c.navalSalvo(s,target,'salvo')).toContain('reloading');
 tickMainReloads(s,5);c.tick(5,[]);expect(readyMainMounts(s).map(m=>m.id)).toEqual(['fore']);
 expect(c.navalSalvo(s,target,'salvo')).toBeNull();expect(c.snapshot().salvos).toHaveLength(2);expect(s.mainReloads).toEqual({fore:6,aft:1});
});
it('preserves legacy shared cooldowns and admits only the selected volley against capacity',()=>{
 const c=createCombat(water()),s=vessel(),target={x:20,y:10};s.reload=3;
 expect(c.navalSalvo(s,target,'volley')).toContain('reloading');tickMainReloads(s,1);expect(s.mainReloads).toEqual({fore:2,aft:2});
 tickMainReloads(s,2);
 for(let i=0;i<6;i++)expect(c.lob({id:'test',x:20,y:20},20,10)).toBeNull();
 const before=JSON.stringify(s);expect(c.navalSalvo(s,target,'salvo')).toContain('slots');expect(JSON.stringify(s)).toBe(before);
 expect(c.navalSalvo(s,target,'volley')).toBeNull();expect(c.snapshot().salvos).toHaveLength(8);expect(s.mainReloads).toEqual({fore:6,aft:0});
 const after=JSON.stringify(s);expect(c.navalSalvo(s,target,'volley')).toContain('slots');expect(JSON.stringify(s)).toBe(after);
});
