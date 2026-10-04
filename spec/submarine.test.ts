import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { shipSite, shipKind, sailStep } from '../public/ship.js';
import { createCombat } from '../public/combat.js';
import { makeSubmarineBarrage, submarineTargetError, SUBMARINE } from '../public/submarine.js';
import { contactField, insideField } from '../public/hazards.js';
const coast=()=>({...createWorld(),width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128<64?0:2 as number),ships:[] as any[],tanks:[] as any[],cores:[] as any[],rails:[] as any[],artillery:[] as any[]});
function fixture(){const w=coast(),s:any={...shipSite(w,[],[],60,20,'a','submarine').ship!,id:'sub',elapsed:4.5,health:300};w.ships.push(s);return{w,s,c:createCombat(w)};}
it('permits one submarine alongside a legacy gunship while retaining four total vessels and safe coastal placement',()=>{
 const w=coast(),gun=shipSite(w,[],[],60,20,'a').ship!;delete (gun as any).kind;w.ships.push(gun);expect(shipKind(gun)).toBe('gunship');
 const sub=shipSite(w,[],[],60,40,'a','submarine');expect(sub.error).toBeNull();w.ships.push(sub.ship);
 expect(shipSite(w,[],[],60,60,'a','submarine').error).toContain('One');expect(shipSite(w,[],[],60,60,'a').error).toContain('One');
 expect(shipSite(w,[],[],70,60,'b','submarine').error).toContain('water');
 w.ships.push({...gun,owner:'b'},{...gun,owner:'c'});expect(shipSite(w,[],[],60,70,'d','submarine').error).toContain('four');
});
it('validates the full compact rectangle, not just its center, for both orientations',()=>{
 const {w,s}=fixture();expect(submarineTargetError(s,w,{x:90,y:20})).toBeNull();expect(submarineTargetError(s,w,{x:90,y:20},true)).toBeNull();
 expect(submarineTargetError(s,w,{x:s.x+12,y:s.y})).toContain('12 to 80');expect(submarineTargetError(s,w,{x:90,y:2})).toContain('inside');
 expect(submarineTargetError(s,w,{x:NaN,y:20})).toBeTruthy();
 s.x=5;expect(submarineTargetError(s,w,{x:85,y:20})).toContain('12 to 80');
});
it('commits six staggered hatch origins and scattered sectors without mutating the land missile pattern',()=>{
 const {s}=fixture(),target={x:90,y:30};const b=makeSubmarineBarrage(s,target,false,42);
 expect(b.missiles).toHaveLength(6);expect(new Set(b.missiles.map(m=>`${m.originX},${m.originY}`)).size).toBe(6);
 expect(b.box).toMatchObject({width:6,height:8});expect(b.missiles.at(-1)?.launch).toBe(1.25);
 for(const m of b.missiles){expect(m.x).toBeGreaterThan(m.sector.x);expect(m.x).toBeLessThan(m.sector.x+m.sector.width);expect(m.y).toBeGreaterThan(m.sector.y);expect(m.y).toBeLessThan(m.sector.y+m.sector.height);}
 expect(makeSubmarineBarrage(s,target,false,42)).toEqual(b);expect(makeSubmarineBarrage(s,target,true,42).box).toMatchObject({width:8,height:6});
});
it('locks launch movement, preserves committed aim/ammunition and rejects cannon or secondary use',()=>{
 const {w,s,c}=fixture();s.ammo='INCENDIARY';expect(c.submarineStrike(s,{x:90,y:30})).toBeNull();expect(s.reload).toBe(19.25);expect(s.launchRemaining).toBe(1.25);
 const b=c.snapshot().barrages[0];expect(sailStep(w,s,1,1,.5)).toBe(false);
 s.ammo='GAS';s.x-=2;expect(c.snapshot().barrages[0]).toEqual(b);expect(c.submarineStrike(s,{x:100,y:40})).toContain('reloading');
 expect(c.navalSalvo(s,{x:90,y:30})).toContain('missile');expect(c.navalSecondary(s,{x:62,y:20}).error).toContain('secondary');
 s.launchRemaining=0;expect(sailStep(w,s,0,1,.1)).toBe(true);
});
it('shares volley limits with batteries and rejects invalid strikes without spending reload or reservations',()=>{
 const {s,c}=fixture();expect(c.barrage({id:'land',x:80,y:40,ammo:'HE'},{x:100,y:60},false)).toBeNull();expect(c.submarineStrike(s,{x:90,y:30})).toBeNull();
 const other={...s,id:'other',reload:0};const before=c.snapshot();expect(c.submarineStrike(other,{x:100,y:30})).toContain('Two');expect(other.reload).toBe(0);expect(c.snapshot()).toEqual(before);
 const f=fixture();expect(f.c.submarineStrike(f.s,{x:63,y:21})).toBeTruthy();expect(f.s.reload).toBe(0);expect(f.c.snapshot().barrages).toHaveLength(0);
});
it('accounts for the smaller strike against the same per-type area budget as land batteries',()=>{
 const {s,c}=fixture();expect(c.barrage({id:'land',x:80,y:40,ammo:'INCENDIARY'},{x:100,y:60},false)).toBeNull();s.ammo='INCENDIARY';
 const before=c.snapshot();expect(c.submarineStrike(s,{x:90,y:30})).toContain('area limit');expect(s.reload).toBe(0);expect(c.snapshot()).toEqual(before);
 s.ammo='GAS';expect(c.submarineStrike(s,{x:90,y:30})).toBeNull();expect(c.snapshot().fields.map(f=>f.box.width*f.box.height)).toEqual([216,48]);
});
it('creates bounded lethal fire and nine-charge gas fields, with water impacts and friendly hull immunity',()=>{
 for(const weapon of ['HE','INCENDIARY','GAS']){
  const {s,c}=fixture();s.ammo=weapon;expect(c.submarineStrike(s,{x:35,y:30})).toBeNull();c.tick(12,[]);
  expect(c.snapshot().barrages).toHaveLength(0);expect(c.snapshot().impacts).toHaveLength(6);expect(c.snapshot().impacts.every(i=>i.surface===0)).toBe(true);expect(s.health).toBe(300);
  if(weapon==='HE'){expect(c.snapshot().marks.some(m=>m.kind==='crater')).toBe(false);continue;}
  const field=c.snapshot().fields[0];expect(field.box).toMatchObject({width:6,height:8});expect(field.sectors).toHaveLength(6);expect(field.pending).toBe(0);
  const sector=field.sectors[0];expect(insideField(field,sector.x,sector.y)).toBe(true);expect(insideField(field,field.box.x-1,sector.y)).toBe(false);
  if(weapon==='GAS'){expect(field.capacity).toBe(SUBMARINE.gasCapacity);for(let i=0;i<9;i++)expect(contactField([field],{hp:60,x:sector.x,y:sector.y})).toBe(field);expect(contactField([field],{hp:60,x:sector.x,y:sector.y})).toBeNull();}
  else{c.tick(18,[]);expect(c.snapshot().fields).toHaveLength(0);}
 }
});
