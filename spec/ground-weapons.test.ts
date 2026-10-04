import { expect, it } from 'vitest';
import { createCombat } from '../public/combat.js';
import { createWorld } from '../public/world.js';
import { loadout, FLAME, HEAVY_FLAME } from '../public/weapons.js';

const world = () => ({ ...createWorld(), terrain: Array(48 * 36).fill(2) });
const tank = () => ({ id:'tank', x:10.5,y:10.5,turret:0,life:'active',body:'rover',tankWeapon:'MAGNETIC' });
it('keeps the machine gun default, adds the heavy fuel option and leaves robot weapons alone', () => {
  expect(loadout('rover').secondary).toBe('APCR');
  expect(loadout('rover','MAGNETIC','HEAVY_FLAME')).toMatchObject({primary:'MAGNETIC',secondary:'HEAVY_FLAME'});
  expect(loadout('robot','MAGNETIC','HEAVY_FLAME')).toMatchObject({primary:'FLAME',secondary:'LASER'});
  expect(HEAVY_FLAME.range).toBeGreaterThan(FLAME.range);
});
it('charges before launching along the current turret bearing and stops at a wall without a crater', () => {
  const w=world(), c=createCombat(w), p=tank(); w.terrain[10*48+15]=3;
  expect(c.shoot(p,10.5,5.5,'MAGNETIC')).toBeNull();
  c.tick(.5,[],[],[p]); expect(c.snapshot().shots).toHaveLength(0); expect(c.snapshot().charges).toHaveLength(1);
  p.turret=Math.PI/2; c.tick(.5,[],[],[p]);
  expect(c.snapshot().charges).toHaveLength(0);
  const shot=c.snapshot().shots.find(s=>s.weapon==='MAGNETIC'); expect(shot.angle).toBeCloseTo(Math.PI/2); expect(shot.endX).toBe(15);
  expect(c.snapshot().shells).toHaveLength(0); expect(c.snapshot().marks).toHaveLength(0);
  expect(c.snapshot().impacts[0].radius).toBe(0); expect(c.shoot(p,20,10.5,'MAGNETIC')).toContain('reloading');
});
it('cancels charging when the operator leaves, changes bodies or explicitly cancels', () => {
  for (const kind of ['disconnect','robot','cancel','facility']) {
    const c=createCombat(world()),p=tank(); c.shoot(p,20,10,'MAGNETIC');
    if(kind==='robot')p.body='robot'; if(kind==='cancel')c.cancelCharge(p.id);
    c.tick(1,[],[],kind==='disconnect'?[]:[{...p,operating:kind==='facility'}]);
    expect(c.snapshot().charges).toHaveLength(0);expect(c.snapshot().shots).toHaveLength(0);
  }
});
it('heavy fuel travels farther than robot fuel, stops at obstacles and preserves packet limits', () => {
  const w=world(), c=createCombat(w),p={...tank(),turret:Math.PI/2};
  c.shoot(p,20,10.5,'HEAVY_FLAME');c.tick(.4,[]);expect(c.snapshot().jets[0].x).toBeCloseTo(16.1);expect(c.snapshot().jets[0].remaining).toBeCloseTo(2.4);
  w.terrain[10*48+17]=3;c.tick(.2,[]);expect(c.snapshot().jets).toHaveLength(0);expect(c.snapshot().marks).toHaveLength(0);
});
it('flamethrower sentries fire outside their own footprint and kill without explosive craters', () => {
  const c=createCombat(world()), b={id:'sentry',owner:'owner',x:24,y:14,weapon:'HEAVY_FLAME'};
  c.start([b]);let fuel=false;
  for(let i=0;i<150;i++){c.tick(.1,[b]);fuel ||= c.snapshot().jets.some(j=>j.owner===b.id && j.weapon==='HEAVY_FLAME');}
  expect(fuel).toBe(true);expect(c.snapshot().kills).toBeGreaterThan(0);expect(c.snapshot().marks.some(m=>m.kind==='crater')).toBe(false);
});
