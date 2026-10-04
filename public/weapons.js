// One definition supplies both authoritative damage and client aiming cues.
export const HE = Object.freeze({ label: 'Cannon', radius: 2.1, lethalRadius: .65, damage: 75, edgeDamage: 12, range: 14, speed: 12, cooldown: 650 });
export const APCR = Object.freeze({ label: 'Machine gun', radius: 0, damage: 18, speed: 28, cooldown: 120, range: 14 });
export const NAVAL_APCR = Object.freeze({label:'Side gun',radius:0,damage:10,speed:36,cooldown:180,range:8});
export const FLAME = Object.freeze({ label: 'Fuel jet', radius: 0, range: 5, speed: 10, cooldown: 100, width: .16 });
export const HEAVY_FLAME = Object.freeze({ ...FLAME, label: 'Heavy fuel jet', range: 8, speed: 14, width: .2 });
export const LASER = Object.freeze({ label: 'Laser rifle', radius: 0, range: 32, damage: 24, cooldown: 300, burnDps: 10, burnDuration: 2400 });
export const MAGNETIC = Object.freeze({ label: 'Magnetic cannon', radius: 0, range: 24, speed: 120, damage: 180, charge: 1000, cooldown: 2500 });
export const WEAPONS = Object.freeze({ HE, APCR, NAVAL_APCR, FLAME, HEAVY_FLAME, LASER, MAGNETIC });
export const ARTILLERY_HE = Object.freeze({ label: 'Heavy HE', radius: 3, lethalRadius: 1.1, damage: 140, edgeDamage: 20, minRange: 6, range: 60, cooldown: 6000, craterSize: 8 });
export const ARTILLERY_SHELLS = Object.freeze({
  HE: ARTILLERY_HE,
  INCENDIARY: Object.freeze({ label: 'Incendiary', radius: 3, heatBand: .75, slow: .55, duration: 18, cooldown: 6000 }),
  GAS: Object.freeze({ label: 'Gas', radius: 2.6, capacity: 6, lureRange: 10, cooldown: 6000 }),
});
const ROVER = Object.freeze({ primary: 'HE', secondary: 'APCR', turnSpeed: Math.PI });
const ROBOT = Object.freeze({ primary: 'FLAME', secondary: 'LASER', turnSpeed: Math.PI * 3 });
export const loadout = (body, tankWeapon = 'HE', tankSecondary = 'APCR') => body === 'robot' ? ROBOT : { ...ROVER, primary: tankWeapon === 'MAGNETIC' ? 'MAGNETIC' : 'HE', secondary: tankSecondary === 'HEAVY_FLAME' ? 'HEAVY_FLAME' : 'APCR' };
export function relativeMovement(angle, vx, vy) {
  return { forward: vx * Math.sin(angle) - vy * Math.cos(angle), right: vx * Math.cos(angle) + vy * Math.sin(angle) };
}
