import { SURVIVAL } from './survival.js';

// Role tuning only: no new global armor/damage formula. Legacy crawlers are hunters.
export const ENEMY_ROLES = Object.freeze({
  'twin-lens': Object.freeze({ name:'Twin lens', hp:140, speed:1.4, penetration:0, damage:0, reach:0, radius:0, windup:0, cooldown:0 }),
  'heavy-lens': Object.freeze({ name:'Heavy lens', hp:320, speed:.55, penetration:0, damage:0, reach:0, radius:0, windup:0, cooldown:0 }),
  hunter: Object.freeze({ name: 'Hunter', hp: 60, speed: 2.6, penetration: 2,
    damage: SURVIVAL.damage, reach: SURVIVAL.reach, radius: SURVIVAL.strikeRadius,
    windup: SURVIVAL.windup, cooldown: SURVIVAL.cooldown }),
  breaker: Object.freeze({ name: 'Breaker', hp: 180, speed: .95, penetration: 3,
    damage: 50, reach: 1.3, radius: 1, windup: 1400, cooldown: 2200 }),
  bulwark: Object.freeze({ name: 'Bulwark', hp: 450, speed: .65, penetration: 3,
    damage: 75, reach: 1.4, radius: 1.1, windup: 1800, cooldown: 2800, hazardImmune: true }),
});
export const enemyProfile = enemy => ENEMY_ROLES[enemy.kind] || ENEMY_ROLES.hunter;
export const heavyEnemy = enemy => ['breaker', 'bulwark'].includes(enemy.kind);
export const canDamageEnemy = (enemy, weapon) => enemy.kind !== 'bulwark' || ['HE', 'MAGNETIC', 'MAC'].includes(weapon);
export function newGroundEnemy(kind, id, point) {
  const role = Object.hasOwn(ENEMY_ROLES, kind) ? kind : 'hunter', profile = ENEMY_ROLES[role];
  return { id, kind: role, ...point, hp: profile.hp, maxHp: profile.hp, angle: 0, path: [], reroute: 0 };
}

// Upgrade one unspent guard in mortar-bearing compounds. Never add to a roster,
// revive conquered sites, transform a living enemy or change an accepted warning.
export function assignBulwarkGuards(sites) {
  const bastions = new Set(sites.filter(s => s.encounter && s.kind === 'mortar').map(s => s.encounter.id));
  let changed = 0;
  for (const site of sites) {
    if (!bastions.has(site.encounter?.id) || site.state !== 'hostile' || site.pending || site.guardsRemaining <= 0 || !site.guardRoster?.length || site.guardRoster.includes('bulwark')) continue;
    const index = site.guardRoster.lastIndexOf('hunter');
    if (index < 0) continue;
    site.guardRoster[index] = 'bulwark'; changed++;
  }
  return changed;
}

// Replace finite unspent guards in at most six air-defended compounds. Existing
// warnings, living enemies, exhausted rosters and conquered sites stay intact.
export function assignMobileLaserGuards(sites) {
  const groups=[...new Set(sites.filter(s=>s.kind==='anti-air'&&s.state==='hostile'&&s.encounter).map(s=>s.encounter.id))].sort().slice(0,6);
  let changed=0;
  for(const [i,id] of groups.entries()){
    const members=sites.filter(s=>s.encounter?.id===id);
    if(members.some(s=>s.guardRoster?.some(k=>['twin-lens','heavy-lens'].includes(k))))continue;
    const site=members.find(s=>s.state==='hostile'&&!s.pending&&s.guardsRemaining>0&&s.guardRoster?.includes('hunter'));
    if(!site)continue;
    site.guardRoster[site.guardRoster.lastIndexOf('hunter')]=i%3===2?'heavy-lens':'twin-lens';changed++;
  }
  return changed;
}
