// The furry mechanical spider: one companion per expedition that follows the
// nearest worker, settles beside a resting one and notices the garden. It is
// shared colony state driven by the server tick; drawing is browser-only.
// It never gathers, spends or blocks anything: a companion, not a chore.
import { colonyCanStand, stepColonyRobot } from './colonization.js';

export const PET = Object.freeze({
  cost: 8, reach: 2, speed: 3.2, nameLength: 18,
  followDistance: 1.4, catchUp: 2.3, sitOffset: .95,
  noticeRadius: 3, stillSeconds: 3, noticeSeconds: 4, reactionSeconds: 2.5,
});
const reject = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
export const isPetAction = action => action === 'adopt-pet' || action === 'pet-pet' || action === 'rename-pet';
/**
 * A companion name as typed: control characters removed, spaces collapsed, trimmed.
 * Returns null when nothing printable is left. Length counts characters, not bytes.
 * @param {unknown} value
 */
export function petName(value) {
  if (typeof value !== 'string') return null;
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  return name ? name : null;
}
/** @param {any} state */
export const petAt = (state, x, y, reach = PET.reach) => state?.pet && [x, y].every(Number.isFinite) && Math.hypot(state.pet.x - x, state.pet.y - y) <= reach ? state.pet : null;

/** Adoption and petting. Petting with a fish in the creel feeds it. @param {any} state @param {any} actor */
export function petAction(state, actor, action, data = {}) {
  if (!actor || typeof actor.id !== 'string' || !actor.id.trim()) reject('Join the expedition before meeting the companion.', 403);
  if (action === 'rename-pet') {
    // Any crew member may name the shared companion, from anywhere; it grants nothing.
    if (!state.pet) reject('Adopt a companion before naming it.', 404);
    const name = petName(data.name);
    if (!name) reject('Give your companion a name.', 400);
    if ([...name].length > PET.nameLength) reject(`Keep the name to ${PET.nameLength} characters.`, 400);
    if (name === state.pet.name) return { ok: true, message: `Your companion is already called ${name}.`, targetId: state.pet.id };
    state.pet.name = name;
    state.pet.reaction = { kind: 'happy', until: (state.time || 0) + PET.reactionSeconds };
    return { ok: true, message: `Your companion is now called ${name}.`, targetId: state.pet.id };
  }
  if ((actor.regionId || 'home') !== 'home') reject('Return to the home district first.');
  const time = state.time || 0;
  if (action === 'adopt-pet') {
    if (state.pet) reject('Your companion is already here.');
    if (state.materials < PET.cost) reject(`Adopting the companion needs ${PET.cost} materials.`);
    state.materials -= PET.cost;
    state.pet = { id: `pet-${state.nextId++}`, name: 'Spider', x: state.pad.x + .5, y: state.pad.y + 2.5, angle: Math.PI, mode: 'wander', moving: false,
      reaction: { kind: 'happy', until: time + PET.reactionSeconds }, friend: null, fed: 0, pets: 0, since: time, stillFor: 0, last: null, notice: null };
    return { ok: true, message: 'A furry mechanical spider scuttles down from the shuttle and looks up at you.', targetId: state.pet.id };
  }
  if (action !== 'pet-pet') reject('Choose a companion action.', 400);
  const pet = petAt(state, actor.x, actor.y);
  if (!pet) reject('Walk up to your companion first.', state.pet ? 409 : 404);
  pet.friend = actor.id; pet.pets++;
  const treats = state.fishing?.treats || 0;
  if (treats > 0) {
    state.fishing.treats = treats - 1; pet.fed++;
    pet.reaction = { kind: 'happy', until: time + PET.reactionSeconds };
    return { ok: true, message: `${pet.name} gobbles the fish and spins with joy.`, targetId: pet.id, fed: true };
  }
  pet.reaction = { kind: 'purr', until: time + PET.reactionSeconds };
  return { ok: true, message: `${pet.name} purrs and leans into your hand.`, targetId: pet.id, fed: false };
}

/** The worker the spider keeps company: its friend when present at home, otherwise the nearest. */
function companion(pet, players) {
  const home = players.filter(p => (p.regionId || 'home') === 'home' && [p.x, p.y].every(Number.isFinite));
  return home.find(p => p.id === pet.friend) || home.sort((a, b) => Math.hypot(a.x - pet.x, a.y - pet.y) - Math.hypot(b.x - pet.x, b.y - pet.y))[0] || null;
}
function walk(view, pet, tx, ty, dt) {
  const dx = tx - pet.x, dy = ty - pet.y, distance = Math.hypot(dx, dy);
  if (distance < .05) return false;
  const step = Math.min(distance, PET.speed * dt), scale = step / Math.max(1e-9, distance) / (3.5 * dt);
  // stepColonyRobot walks at the worker's speed; scaling the direction walks the spider's.
  return stepColonyRobot(view, pet, dx * scale, dy * scale, dt);
}

/** Advance the companion by active room time. `view` is the home region view (its
 * `pet` is the saved one) and `players` are the connected workers. @param {any} view */
export function tickPet(view, players, dt) {
  const pet = view?.pet;
  if (!pet || !Number.isFinite(dt) || dt <= 0) return;
  const time = view.time || 0;
  if (pet.reaction && time >= pet.reaction.until) pet.reaction = null;
  const friend = companion(pet, players || []);
  pet.moving = false;
  if (!friend) { pet.mode = 'sit'; return; }
  const still = pet.last && Math.hypot(friend.x - pet.last.x, friend.y - pet.last.y) < .02;
  pet.stillFor = still ? pet.stillFor + dt : 0; pet.last = { x: friend.x, y: friend.y };
  const distance = Math.hypot(friend.x - pet.x, friend.y - pet.y);
  if (friend.activity) {
    // Settle beside a resting or fishing worker, on whichever side is clear.
    const spots = [[PET.sitOffset, .25], [-PET.sitOffset, .25], [0, PET.sitOffset]].map(([ox, oy]) => ({ x: friend.x + ox, y: friend.y + oy }));
    const spot = spots.find(s => colonyCanStand(view, s.x, s.y)) || spots[0];
    if (Math.hypot(spot.x - pet.x, spot.y - pet.y) > .3) { pet.mode = 'follow'; pet.moving = walk(view, pet, spot.x, spot.y, dt); }
    else { pet.mode = 'sit'; pet.angle = friend.angle || 0; }
    return;
  }
  // Keep close: start walking a little beyond the follow distance, stop at it.
  if (distance > PET.followDistance + .3) {
    const ux = (pet.x - friend.x) / Math.max(1e-9, distance), uy = (pet.y - friend.y) / Math.max(1e-9, distance);
    pet.mode = 'follow'; pet.moving = walk(view, pet, friend.x + ux * PET.followDistance, friend.y + uy * PET.followDistance, dt);
    if (!pet.moving) pet.mode = 'wander';
    return;
  }
  // Close by and the worker is still: notice a growing bed or a furnishing nearby for a while.
  if (pet.notice && time < pet.notice.until) { pet.mode = 'notice'; pet.angle = Math.atan2(pet.notice.y - pet.y, pet.notice.x - pet.x) + Math.PI / 2; return; }
  if (pet.stillFor >= PET.stillSeconds && (!pet.notice || time >= pet.notice.until + PET.noticeSeconds)) {
    const things = [...(view.beds || []).filter(b => b.crop).map(b => ({ x: b.x + .5, y: b.y + .5 })), ...((view.settlement?.items || []).map(i => ({ x: i.x + .5, y: i.y + .5 })))];
    const near = things.filter(t => Math.hypot(t.x - pet.x, t.y - pet.y) <= PET.noticeRadius).sort((a, b) => Math.hypot(a.x - pet.x, a.y - pet.y) - Math.hypot(b.x - pet.x, b.y - pet.y))[0];
    if (near) { pet.notice = { x: near.x, y: near.y, until: time + PET.noticeSeconds }; pet.mode = 'notice'; return; }
  }
  pet.mode = 'wander';
  if (distance > .6) pet.angle = Math.atan2(friend.y - pet.y, friend.x - pet.x) + Math.PI / 2;
}
