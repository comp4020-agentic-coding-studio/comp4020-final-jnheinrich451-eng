import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { shipSite, shipKind, sailStep } from '../public/ship.js';
import { createCombat } from '../public/combat.js';
import { makeSubmarineBarrage, submarineTargetError, SUBMARINE, submarineFireError, submarineReloads, tickSubmarineReloads, submarineGroupsReady, submarineSiloAge } from '../public/submarine.js';
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
 expect(submarineTargetError(s,w,{x:s.x+12,y:s.y})).toContain('12 to 80');expect(submarineTargetError(s,w,{x:90,y:2})).toBeNull();
 expect(submarineTargetError(s,w,{x:NaN,y:20})).toBeTruthy();
 s.x=5;expect(submarineTargetError(s,w,{x:85,y:20})).toBeNull();
});
it('commits six staggered hatch origins and scattered sectors without mutating the land missile pattern',()=>{
 const {s}=fixture(),target={x:90,y:30};const b=makeSubmarineBarrage(s,target,false,42);
 expect(b.missiles).toHaveLength(6);expect(new Set(b.missiles.map(m=>`${m.originX},${m.originY}`)).size).toBe(6);
 expect(b.box).toMatchObject({width:6,height:8});expect(b.missiles.at(-1)?.launch).toBe(1.25);
 for(const m of b.missiles){expect(m.x).toBeGreaterThan(m.sector.x);expect(m.x).toBeLessThan(m.sector.x+m.sector.width);expect(m.y).toBeGreaterThan(m.sector.y);expect(m.y).toBeLessThan(m.sector.y+m.sector.height);}
 expect(makeSubmarineBarrage(s,target,false,42)).toEqual(b);expect(makeSubmarineBarrage(s,target,true,42).box).toMatchObject({width:8,height:6});
});
it('allows launch movement, preserves committed aim/ammunition and rejects cannon or secondary use',()=>{
 const {w,s,c}=fixture();s.ammo='INCENDIARY';expect(c.submarineStrike(s,{x:90,y:30})).toBeNull();expect(s.siloReloads).toEqual([19.25,0,0,0]);expect(s.reload).toBe(0);expect(s.launchRemaining).toBe(1.25);
 const b=c.snapshot().barrages[0];expect(sailStep(w,s,1,1,.5)).toBe(true);
 s.ammo='GAS';s.x-=2;expect(c.snapshot().barrages[0]).toEqual(b);expect(c.submarineStrike(s,{x:100,y:40})).toBeNull();expect(c.snapshot().barrages[1].group).toBe(1);
 expect(c.navalSalvo(s,{x:90,y:30})).toContain('missile');expect(c.navalSecondary(s,{x:62,y:20}).error).toContain('secondary');
 s.launchRemaining=0;expect(sailStep(w,s,0,1,.1)).toBe(true);
});
it('gives submarine volleys a separate bounded budget while keeping land capacity',()=>{
 const {w,s,c}=fixture();expect(c.barrage({id:'land',x:80,y:40,ammo:'HE'},{x:100,y:60},false)).toBeNull();
 for(let i=0;i<4;i++)expect(c.submarineStrike(s,{x:90,y:30})).toBeNull();
 expect(c.submarineStrike(s,{x:90,y:30})).toContain('four');
 expect(c.barrage({id:'land2',x:80,y:40,ammo:'HE'},{x:100,y:60},false)).toBeNull();expect(c.barrage({id:'land3',x:80,y:40,ammo:'HE'},{x:100,y:60},false)).toContain('Two');
 const other={...s,id:'other',siloReloads:[0,0,0,0],reload:0};expect(submarineFireError(other,w,{x:90,y:30},false,Array.from({length:16},()=>({kind:'submarine'})))).toContain('capacity');
 const f=fixture();expect(f.c.submarineStrike(f.s,{x:63,y:21})).toBeTruthy();expect(f.s.reload).toBe(0);expect(f.s.siloReloads).toBeUndefined();expect(f.c.snapshot().barrages).toHaveLength(0);
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

it('launches underwater from the moving hull while preserving accepted targets and launched origins across restart',()=>{
 const {w,s}=fixture();s.depth='submerged';let c=createCombat(w);expect(c.submarineStrike(s,{x:90,y:30})).toBeNull();
 const accepted=c.snapshot().barrages[0];expect(accepted.missiles[0].underwater).toBe(true);
 s.x-=1;c.tick(.3,[]);const fired=c.snapshot().barrages[0];
 expect(fired.missiles[0].originX).toBe(accepted.missiles[0].originX);
 expect(fired.missiles[1].originX).toBeCloseTo(accepted.missiles[1].originX-1);
 expect(fired.missiles[1].launchPending).toBe(false);expect(fired.missiles[5].launchPending).toBe(true);
 c=createCombat(w,JSON.parse(JSON.stringify(c.checkpoint())));s.x-=1;c.tick(1,[]);
 const resumed=c.snapshot().barrages[0];expect(resumed.missiles[1].originX).toBe(fired.missiles[1].originX);
 expect(resumed.missiles.every((m:any)=>!m.launchPending)).toBe(true);
 expect(resumed.missiles.map((m:any)=>[m.x,m.y])).toEqual(accepted.missiles.map((m:any)=>[m.x,m.y]));
 expect(resumed.missiles[5].originX).toBeCloseTo(accepted.missiles[5].originX-2);
});

it('fires four groups of six, independently reloads the first and cycles its matching tubes',()=>{
 const {s,c}=fixture();s.navalScale=2;
 for(let group=0;group<4;group++){
  expect(c.submarineStrike(s,{x:90,y:30})).toBeNull();expect(submarineGroupsReady(s)).toBe(3-group);
  const barrage=c.snapshot().barrages[group];expect(barrage.group).toBe(group);expect(barrage.missiles.map((m:any)=>m.tube)).toEqual(Array.from({length:6},(_,i)=>group*6+i));
  expect(submarineSiloAge(s,group*6)).toBe(0);
  if(group<3){tickSubmarineReloads(s,2);c.tick(2,[]);}
 }
 expect(s.siloReloads).toEqual([13.25,15.25,17.25,19.25]);const before=c.checkpoint(),reloads=[...s.siloReloads];
 expect(c.submarineStrike(s,{x:90,y:30})).toContain('reloading');expect(s.siloReloads).toEqual(reloads);expect(c.checkpoint()).toEqual(before);
 tickSubmarineReloads(s,13.25);c.tick(13.25,[]);expect(s.siloReloads).toEqual([0,2,4,6]);expect(submarineGroupsReady(s)).toBe(1);
 expect(c.submarineStrike(s,{x:90,y:30})).toBeNull();expect(s.siloReloads).toEqual([19.25,2,4,6]);expect(c.snapshot().barrages[0].group).toBe(0);
});
it('restores group cooldowns and correct moving launch origins without resetting pending groups',()=>{
 const {w,s}=fixture();s.navalScale=2;let c=createCombat(w);
 for(let i=0;i<4;i++)expect(c.submarineStrike(s,{x:90,y:30})).toBeNull();
 const accepted=c.snapshot().barrages;expect(new Set(accepted.flatMap((b:any)=>b.missiles.map((m:any)=>m.tube))).size).toBe(24);
 const restored=JSON.parse(JSON.stringify(s));w.ships=[restored];c=createCombat(w,JSON.parse(JSON.stringify(c.checkpoint())));restored.x-=2;c.tick(.3,[]);tickSubmarineReloads(restored,.3);
 expect(restored.siloReloads).toEqual([18.95,18.95,18.95,18.95]);
 for(const [i,b]of c.snapshot().barrages.entries()){expect(b.missiles[0].originX).toBe(accepted[i].missiles[0].originX);expect(b.missiles[1].originX).toBeCloseTo(accepted[i].missiles[1].originX-2);expect(b.missiles[1].tube).toBe(i*6+1);}
 expect(c.submarineStrike(restored,{x:90,y:30})).toContain('reloading');
});
it('adapts old single-reload saves to group one without resetting that reload',()=>{
 const old:any={reload:12};expect(submarineReloads(old)).toEqual([12,0,0,0]);expect(submarineGroupsReady(old)).toBe(3);expect(old.siloReloads).toBeUndefined();tickSubmarineReloads(old,.5);expect(old.siloReloads).toEqual([11.5,0,0,0]);
});
