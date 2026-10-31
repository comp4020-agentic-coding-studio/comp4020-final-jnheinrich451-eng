import { expect, it } from 'vitest';
import { isAirEnemy, isGroundEnemy, canWeaponTarget } from '../public/target-domain.js';
import { canDamageEnemy, newGroundEnemy } from '../public/enemy-profiles.js';
import { contactField, heatSpeed, lureRoute, makeField } from '../public/hazards.js';

it('defaults old enemy records to the existing surface domain and recognises saved air records', () => {
  for (const enemy of [{}, { kind: 'hunter' }, { kind: 'bulwark' }, { kind: 'swimmer' }]) {
    expect(isAirEnemy(enemy)).toBe(false); expect(isGroundEnemy(enemy)).toBe(true);
  }
  for (const enemy of [{ kind: 'skimmer' }, { domain: 'air', kind: 'future-air' }]) {
    expect(isAirEnemy(enemy)).toBe(true); expect(isGroundEnemy(enemy)).toBe(false);
  }
  expect(isAirEnemy(null)).toBe(false); expect(isGroundEnemy(null)).toBe(false);
});

it('permits only the AA gun and the laser with its attached burn to damage air', () => {
  const air = { kind: 'skimmer', hp: 180, domain: 'air' };
  for (const weapon of ['AA35', 'LASER', 'BURN']) {
    expect(canWeaponTarget(air, weapon)).toBe(true); expect(canDamageEnemy(air, weapon)).toBe(true);
  }
  for (const weapon of ['HE', 'MAGNETIC', 'MAC', 'APCR', 'NAVAL_APCR', 'FLAME', 'HEAVY_FLAME', 'INCENDIARY', 'GAS', 'BEAM', 'unknown']) {
    expect(canWeaponTarget(air, weapon)).toBe(false); expect(canDamageEnemy(air, weapon)).toBe(false);
  }
});

it('retains surface armor rules separately from the AA target-domain allowance', () => {
  const bulwark = { kind: 'bulwark' }, hunter = { kind: 'hunter' };
  expect(canWeaponTarget(bulwark, 'AA35')).toBe(true);
  expect(canDamageEnemy(bulwark, 'AA35')).toBe(false);
  for (const weapon of ['HE', 'MAGNETIC', 'MAC']) expect(canDamageEnemy(bulwark, weapon)).toBe(true);
  expect(canDamageEnemy(hunter, 'AA35')).toBe(true);
  expect(newGroundEnemy('skimmer', 1, { x: 1, y: 1 }).kind).toBe('hunter');
});

it('air cannot consume gas, burn in a ground field, slow in heat or request a lure route', () => {
  const air = { kind: 'future-air', domain: 'air', hp: 100, x: 20, y: 20 };
  const gas = makeField(1, 'GAS', 20, 20, 0), fire = makeField(2, 'INCENDIARY', 20, 20, 0);
  expect(contactField([gas], air)).toBeNull(); expect(gas.capacity).toBe(gas.initialCapacity);
  expect(contactField([fire, gas], air)).toBeNull(); expect(heatSpeed([fire], air)).toBe(1);
  let routed = false;
  expect(lureRoute({} as any, [], air, [gas], () => false, () => { routed = true; return []; })).toBeNull();
  expect(routed).toBe(false);
  expect(contactField([gas], { ...air, kind: 'hunter', domain: 'ground' })).toBe(gas);
  expect(gas.capacity).toBe(gas.initialCapacity! - 1);
});
