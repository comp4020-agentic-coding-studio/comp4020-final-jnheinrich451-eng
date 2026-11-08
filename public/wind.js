// Cosmetic wind, the same on every client (author, 9 November 2026). It comes only
// from a hash of the world and the server clock in ms (the snapshot's combat.time
// plus its age), so every player sees smoke, flames and gas drift the same way. It
// veers slowly over minutes and gusts over seconds. It has no server state and moves
// nothing in the game: fields, packets and their hits stay exactly where the server
// puts them.
const seedOf = world => {
  let h = 2166136261;
  for (const ch of String(world?.id || world?.name || 'frontier')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
};

/**
 * @param {{id?:string,name?:string}|null|undefined} world
 * @param {number} time server clock in ms
 * @param {boolean} [reduced] reduced effects: the same slow direction, no gusts
 * @returns {{angle:number,strength:number,dx:number,dy:number}}
 */
export function windAt(world, time = 0, reduced = false) {
  const seed = seedOf(world), t = (Number(time) || 0) / 1000;
  const angle = seed * Math.PI * 2 + .9 * Math.sin(t / 97 + seed * 11) + .45 * Math.sin(t / 233 + seed * 5);
  const gust = reduced ? 0 : .2 * Math.sin(t / 3.7 + seed * 17) + .1 * Math.sin(t / 1.3 + seed * 29);
  const strength = Math.min(1, Math.max(0, .45 + .2 * Math.sin(t / 61 + seed * 3) + gust));
  return { angle, strength, dx: Math.cos(angle), dy: Math.sin(angle) };
}
