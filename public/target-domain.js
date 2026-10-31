// Eligibility is separate from armor. Legacy ground/water records retain their
// existing behavior; an air body never intercepts an ineligible ground shot.
export const isAirEnemy = enemy => !!enemy && (enemy.domain === 'air' || enemy.kind === 'skimmer');
export const isGroundEnemy = enemy => !!enemy && !isAirEnemy(enemy);
export const canWeaponTarget = (enemy, weapon) => !!enemy && (!isAirEnemy(enemy) ||
  ['AA35', 'LASER', 'BURN'].includes(weapon));
// BURN is the robot laser's existing attached burn, not a ground fire field.
// Ground flame/fire/gas contact must use isGroundEnemy before applying effects.
