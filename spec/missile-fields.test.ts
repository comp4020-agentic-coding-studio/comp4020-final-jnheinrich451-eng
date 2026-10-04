import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { makeBarrage, missileFireError } from '../public/missile.js';
import { makeBarrageField, landBarrageSector, tickField, keepField } from '../public/missile-fields.js';
import { insideField, contactField, fireBlocked, heatSpeed, lureRoute, fieldCapacityError, makeField } from '../public/hazards.js';

const world = () => ({ ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2) });
const gun = (ammo: string) => ({ id: 'battery', x: 64, y: 24, ammo, reload: 0, rotated: false });
const target = { x: 24.5, y: 18.5 };
const advance = (c: ReturnType<typeof createCombat>, seconds: number) => { for (let i = 0; i < Math.round(seconds * 10); i++) c.tick(.1, []); };
const region = (ammo: string, rotated = false, id = 1) => {
  const volley = makeBarrage(gun(ammo), target, rotated, id), field = makeBarrageField(volley, 0);
  return { volley, field };
};

it('reserves the full incoming area once, preserves cannon limits and rejects without spending reload', () => {
  const c = createCombat(world()), g = gun('GAS');
  expect(c.barrage(g, target, false)).toBeNull();
  const state = c.snapshot(); expect(state.fields).toHaveLength(1); expect(state.fields[0].sectors).toHaveLength(0);
  expect(missileFireError(g, world(), target, false, state.barrages, state.fields, state.salvos)).toContain('area limit'); expect(g.reload).toBe(0);
  expect(c.barrage(g, target, false)).toContain('area limit');
  expect(c.barrage(gun('INCENDIARY'), target, false)).toBeNull();
  expect(c.snapshot().fields).toHaveLength(2);
  expect(fieldCapacityError(c.snapshot().fields, [], 'GAS')).toBeNull(); // One small cloud still fits.
  const clouds = [makeField(9, 'GAS', 10, 10, 0), makeField(10, 'GAS', 10, 10, 0)];
  expect(fieldCapacityError([...c.snapshot().fields, ...clouds], [], 'GAS')).toContain('area limit');
  expect(fieldCapacityError(c.snapshot().fields, [], 'HE')).toBeNull();
  c.start([]); expect(c.snapshot().fields).toHaveLength(2);
});

it('activates scattered round patches with matching collision, clipped to the rotated target box', () => {
  for (const rotated of [false, true]) {
    const { volley, field } = region('GAS', rotated);
    expect(insideField(field, target.x, target.y)).toBe(false);
    landBarrageSector(field, volley.missiles[0], 1);
    const first = volley.missiles[0], last = volley.missiles[11];
    expect(insideField(field, first.x + .5, first.y + .5)).toBe(true);
    expect(insideField(field, last.x + .5, last.y + .5)).toBe(false);
    for (const m of volley.missiles.slice(1)) landBarrageSector(field, m, 2);
    expect(field.pending).toBe(0); expect(field.sectors).toHaveLength(12);
    field.sectors.forEach((s, i) => { expect([s.x, s.y]).toEqual([volley.missiles[i].x, volley.missiles[i].y]); expect(s.radius).toBeCloseTo(volley.missiles[i].craterSize * .45); });
    for (let y = volley.box.y + .25; y < volley.box.y + volley.box.height; y += .5) for (let x = volley.box.x + .25; x < volley.box.x + volley.box.width; x += .5) expect(insideField(field, x, y)).toBe(field.sectors.some(s => Math.hypot(x - s.x, y - s.y) <= s.radius));
    expect(insideField(field, volley.box.x - .01, target.y)).toBe(false);
    expect(insideField(field, target.x, volley.box.y + volley.box.height + .01)).toBe(false);
  }
});

it('gas has one 18-kill pool; exhaustion cannot refill from later missiles and holds its reservation until final impact', () => {
  const { volley, field } = region('GAS'); landBarrageSector(field, volley.missiles[0], 1);
  const point = volley.missiles[0];
  for (let i = 0; i < 18; i++) {
    const enemy = { x: point.x, y: point.y, hp: 60 };
    expect(contactField([field], enemy)?.id).toBe(field.id); enemy.hp = 0; expect(contactField([field], enemy)).toBeNull();
  }
  expect(field.capacity).toBe(0); expect(keepField(field)).toBe(true);
  expect(contactField([field], { x: point.x, y: point.y, hp: 60 })).toBeNull();
  for (const m of volley.missiles.slice(1)) landBarrageSector(field, m, 2);
  expect(field.sectors).toHaveLength(1); expect(field.capacity).toBe(0); expect(keepField(field)).toBe(false);
});

it('fire wins overlaps without spending gas, with heat and avoidance outside the lethal boundary', () => {
  const fire = region('INCENDIARY', false, 1), gas = region('GAS', false, 2);
  for (const group of [fire, gas]) for (const m of group.volley.missiles) landBarrageSector(group.field, m, 0);
  expect(contactField([gas.field, fire.field], { ...target, hp: 60 })?.weapon).toBe('INCENDIARY'); expect(gas.field.capacity).toBe(18);
  const near = { x: fire.volley.box.x - .5, y: target.y, hp: 60 };
  expect(contactField([fire.field], near)).toBeNull(); expect(heatSpeed([fire.field], near)).toBe(.55); expect(fireBlocked([fire.field])(near.x, near.y)).toBe(true);
  const blocked = fireBlocked([fire.field]), route = lureRoute(world(), [], { x: near.x - 2, y: near.y }, [fire.field, gas.field], blocked);
  if (route) expect(route.path.every(p => !blocked(p.x, p.y))).toBe(true);
});

it('each fire sector gets 18 seconds from its impact, while gas has no timer', () => {
  const { volley, field } = region('INCENDIARY'); landBarrageSector(field, volley.missiles[0], 0);
  tickField(field, 3); landBarrageSector(field, volley.missiles[1], 3000);
  expect(field.sectors.map(s => s.remaining)).toEqual([15, 18]);
  tickField(field, 15); expect(field.sectors).toHaveLength(1); expect(field.remaining).toBe(3);
  tickField(field, 3); expect(field.sectors).toHaveLength(0); expect(keepField(field)).toBe(true); // Unlanded reservation.
  const gas = region('GAS'); landBarrageSector(gas.field, gas.volley.missiles[0], 0); tickField(gas.field, 1000); expect(gas.field.capacity).toBe(18);
});

it('commits warheads, shares immutable snapshots and removes expired fire while keeping cosmetic craters and friendly immunity', () => {
  const w = world(), c = createCombat(w), g = gun('INCENDIARY'); expect(c.barrage(g, target, false)).toBeNull(); g.ammo = 'GAS';
  advance(c, 12); const state = c.snapshot(); expect(state.fields[0].weapon).toBe('INCENDIARY'); expect(state.fields[0].sectors).toHaveLength(12);
  state.fields[0].sectors[0].remaining = 0; expect(c.snapshot().fields[0].sectors[0].remaining).toBeGreaterThan(0);
  c.start([]); const robot = { id: 'friendly', ...target, life: 'active', health: 100, shield: 10 };
  c.tick(.1, [], [robot]); expect(c.snapshot().kills).toBe(3); expect(robot.health).toBe(100);
  expect(c.snapshot().marks.filter(m => m.kind === 'remains').every(m => m.charred)).toBe(true);
  expect(c.snapshot().marks.filter(m => m.kind === 'crater')).toHaveLength(12);
  advance(c, 18); expect(c.snapshot().fields).toHaveLength(0); expect(createCombat(w).snapshot().fields).toHaveLength(0);
});

it('gas lures from a landed sector and consumes exactly 18 kills across repeated drills', () => {
  const c = createCombat(world()); const area = { x: 33.5, y: 18.5 };
  expect(c.barrage(gun('GAS'), area, false)).toBeNull(); advance(c, 12);
  let lured = false;
  for (let drill = 0; drill < 6; drill++) {
    expect(c.start([])).toBeNull();
    for (let i = 0; i < 400 && c.snapshot().status === 'active'; i++) { c.tick(.1, []); lured ||= c.snapshot().enemies.some(e => e.behavior === 'lured'); }
    expect(c.snapshot().kills).toBe(3);
  }
  expect(lured).toBe(true); expect(c.snapshot().fields).toHaveLength(0);
});

it('overlapping landed missile patches apply fire first even when gas was launched first', () => {
  const c = createCombat(world());
  expect(c.barrage(gun('GAS'), target, false)).toBeNull(); expect(c.barrage(gun('INCENDIARY'), target, false)).toBeNull();
  advance(c, 12); c.start([]); c.tick(.1, []);
  expect(c.snapshot().kills).toBe(3); expect(c.snapshot().fields.find(f => f.weapon === 'GAS').capacity).toBe(18);
  expect(c.snapshot().marks.filter(m => m.kind === 'remains').every(m => m.charred)).toBe(true);
});

it('monsters avoid the missile fire rectangle, then resume their approach after sector expiry', () => {
  const c = createCombat(world()); c.barrage(gun('INCENDIARY'), { x: target.x, y: target.y + 5 }, false); advance(c, 12); c.start([]);
  for (let i = 0; i < 100; i++) {
    c.tick(.1, []);
    for (const e of c.snapshot().enemies) expect(c.snapshot().fields.some(f => insideField(f, e.x, e.y))).toBe(false);
  }
  expect(c.snapshot().kills).toBe(0); expect(c.snapshot().health).toBe(100);
  advance(c, 30); expect(c.snapshot().fields).toHaveLength(0); expect(c.snapshot().health).toBeLessThan(100);
});
