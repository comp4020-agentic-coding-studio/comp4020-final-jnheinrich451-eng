import { describe, expect, it } from 'vitest';
import { colonyAction, createColony, tickColony } from '../public/colonization.js';
import { FISHING, activityView, catchName, nearestWater, restAction, standUp, tickActivity } from '../public/colony-rest.js';
import { finishedRecording, FISH_PALETTES, STRUGGLE, fishGenome, simulateStruggle, struggleZone, validStruggle } from '../public/colony-fish.js';
import { PET, petAt, petName, tickPet } from '../public/colony-pet.js';
import { regionAction, regionView } from '../public/colony-regions.js';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function garden(): any {
  const state: any = createColony('morrow-v1'); state.players = []; state.time = 20;
  state.settlement = { version: 1, revision: 0, stored: {}, deliveries: [], completed: [], undo: null, items: [
    { id: 'f-pond', kind: 'pond', x: 40, y: 33, dir: 0, variant: 'ivory', status: 'ready', revision: 0, owner: 'seed' },
  ] };
  return state;
}
const free = () => true;
// A steady angler: holds while the fish is above the middle of the ring. It records
// toggles exactly as the browser does and stops when the fight ends.
function play(seed: string, difficulty: number, skill = true) {
  const toggles: number[] = []; let held = false;
  for (let t = 0; t <= STRUGGLE.limit; t += 1 / 30) {
    const s = simulateStruggle(seed, difficulty, toggles, t);
    if (s.done) return { toggles, until: s.t, done: s.done };
    const want = skill && s.fish > s.y + s.size * .5 + (s.v > 0 ? .06 : -.02);
    if (want !== held) { toggles.push(Math.round(t * 1000) / 1000); held = want; }
  }
  return { toggles, until: STRUGGLE.limit, done: 'escaped' };
}
// A water tile: the generator's lake sits around (55,16) on Morrow.
function shore(state: any) {
  const { world } = state;
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) {
    if (world.terrain[y * world.width + x] !== 0) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ([1, 2].includes(world.terrain[(y + dy) * world.width + x + dx])) return { water: { x, y }, land: { x: x + dx + .5, y: y + dy + .5 } };
  }
  throw new Error('no shore');
}

describe('alien fish', () => {
  it('combines features into named, seeded fish per world', () => {
    const one = fishGenome('angler:1', 'nacre-v1');
    expect(fishGenome('angler:1', 'nacre-v1')).toEqual(one);
    expect(FISH_PALETTES['nacre-v1'].map(p => p.body)).toContain(one.colors.body);
    expect(one.name).toMatch(/^(One-eyed |Three-eyed |Stalk-eyed )?(Lantern )?[A-Z][a-z]+ [A-Z][a-z]+-?[a-z]+$/);
    expect(fishGenome('angler:1', 'unknown-v1').planet).toBe('morrow-v1');
    const many = Array.from({ length: 400 }, (_, i) => fishGenome(`angler:${i}`, 'aurelia-v1'));
    expect(new Set(many.map(f => f.name)).size).toBeGreaterThan(60);
    expect(new Set(many.map(f => f.rarity))).toEqual(new Set([0, 1, 2, 3]));
    for (const fish of many) { expect(fish.difficulty).toBeGreaterThan(0); expect(fish.difficulty).toBeLessThanOrEqual(1); expect(fish.length).toBeGreaterThan(0); }
  });
  it('plays the reel fight deterministically: holding well lands most fish, idling loses them', () => {
    const results = Array.from({ length: 12 }, (_, i) => { const g = fishGenome(`fight:${i}`); return [play(g.seed, g.difficulty), play(g.seed, g.difficulty, false)]; });
    expect(results.filter(([skilled]) => skilled.done === 'landed').length).toBeGreaterThanOrEqual(9);
    expect(results.every(([, idle]) => idle.done === 'escaped')).toBe(true);
    const g = fishGenome('fight:2'), run = play(g.seed, g.difficulty);
    expect(simulateStruggle(g.seed, g.difficulty, run.toggles, run.until)).toEqual(simulateStruggle(g.seed, g.difficulty, [...run.toggles], run.until));
    expect(simulateStruggle(g.seed, g.difficulty, [], 0)).toMatchObject({ progress: STRUGGLE.start, size: struggleZone(g.difficulty), done: null });
    expect(validStruggle(run.toggles, run.until)).toBe(true);
    for (const [toggles, until] of [[[2, 1], 3], [[NaN], 3], [[4], 3], [[], 0], [[], STRUGGLE.limit + 1], ['x', 3], [Array(STRUGGLE.toggles + 1).fill(1), 3]] as any) expect(validStruggle(toggles, until)).toBe(false);
  });
});

describe('fishing', () => {
  it('casts beside water, hooks on a bite, lands a replayed fight into the warehouse and loses a bad one', () => {
    const state = garden(), { land } = shore(state);
    expect(nearestWater(state, 36.5, 31.5)).toBeNull();
    const cast: any = nearestWater(state, land.x, land.y);
    expect(state.world.terrain[Math.floor(cast.y) * state.world.width + Math.floor(cast.x)]).toBe(0);
    expect(Math.max(Math.abs(cast.x - land.x), Math.abs(cast.y - land.y))).toBeLessThanOrEqual(FISHING.reach);
    expect(nearestWater(state, 39.5, 32.5)).toEqual({ x: 40.5, y: 33.5 }); // the pond's nearest cell
    const person: any = { id: 'angler', x: 36.5, y: 31.5, angle: 0, regionId: 'home' };
    expect(() => restAction(state, person, 'fish', {}, free)).toThrow('lake shore or a pond');
    expect(() => restAction(state, person, 'reel', {}, free)).toThrow('Cast a line');
    person.x = land.x; person.y = land.y;
    expect(restAction(state, person, 'fish', {}, free)).toMatchObject({ ok: true, message: 'Line cast. Wait for a bite, then press E.' });
    expect(person.activity).toMatchObject({ kind: 'fish', bite: false, spot: cast, cast: 1 });
    const wait = person.activity.biteAt - state.time;
    expect(wait).toBeGreaterThanOrEqual(FISHING.biteMin); expect(wait).toBeLessThanOrEqual(FISHING.biteMax);
    expect(activityView(person)).toEqual({ kind: 'fish', itemId: null, since: 20, spot: person.activity.spot, bite: false, fight: null });
    expect(() => restAction(state, person, 'reel', {}, free)).toThrow('Nothing on the line');
    expect(() => restAction(state, person, 'land', { toggles: [], until: 1 }, free)).toThrow('No fish on the line');
    // The bite comes on the same deterministic timer as before; E hooks the fish.
    state.time += wait - .1; tickActivity(state, person, .1); expect(person.activity.bite).toBe(false);
    state.time += .2; tickActivity(state, person, .2); expect(person.activity.bite).toBe(true);
    const hooked = restAction(state, person, 'reel', {}, free);
    expect(hooked).toMatchObject({ ok: true, fight: { since: state.time, seed: 'angler:1' } });
    expect(activityView(person)).toMatchObject({ bite: false, fight: { since: state.time, seed: 'angler:1' } });
    // A fight never times out while it is fresh, and the bite timers stand aside.
    state.time += 2; tickActivity(state, person, 2); expect(person.activity.fight).toBeTruthy();
    const genome = fishGenome('angler:1', state.template), won = play('angler:1', genome.difficulty);
    expect(won.done).toBe('landed');
    expect(() => restAction(state, person, 'land', { toggles: [3, 1], until: 4 }, free)).toThrow('not recorded');
    // The room clock must have covered the recording (plus a small grace).
    state.time += won.until;
    const twin = copy(state), twinPerson = copy(person);
    const caught = restAction(state, person, 'land', won, free);
    expect(caught).toMatchObject({ ok: true, landed: true, kept: true, fish: { name: genome.name, seed: 'angler:1', planet: 'morrow-v1', length: genome.length, rarity: genome.rarity } });
    expect(caught.message).toBe(`You caught ${/^[AEIOU]/.test(genome.name) ? 'an' : 'a'} ${genome.name}! Sent to the warehouse.`);
    expect(restAction(twin, twinPerson, 'land', won, free)).toEqual(caught);
    expect(state.fishing).toMatchObject({ treats: 1, record: { [genome.name]: genome.length } });
    expect(state.fishing.catches).toHaveLength(1); expect(catchName(state.fishing.catches[0])).toBe(genome.name);
    expect(catchName({ species: 'silverfin' })).toBe('Silverfin'); expect(catchName({ species: genome.name })).toBe(genome.name);
    // Landing recasts. An idle fight is lost; a recording longer than the clock allows is lost too.
    expect(person.activity).toMatchObject({ kind: 'fish', bite: false, cast: 2 }); expect(person.activity.fight).toBeUndefined();
    const hook = () => { state.time = person.activity.biteAt + .1; tickActivity(state, person, .1); return restAction(state, person, 'reel', {}, free); };
    hook(); state.time += 5;
    const idle = restAction(state, person, 'land', { toggles: [], until: 5 }, free);
    expect(idle).toMatchObject({ ok: true, landed: false }); expect(idle.message).toContain('slipped away');
    const seed = hook().fight.seed, quick = play(seed, fishGenome(seed).difficulty);
    expect(restAction(state, person, 'land', quick, free).landed).toBe(false); // no time has passed on the room clock
    expect(state.fishing).toMatchObject({ treats: 1 }); expect(state.fishing.catches).toHaveLength(1);
    // A fight left unanswered ends on its own and the line goes back in.
    hook(); const casts = state.fishing.casts;
    state.time += STRUGGLE.limit + 6; tickActivity(state, person, STRUGGLE.limit + 6);
    expect(person.activity.fight).toBeUndefined(); expect(state.fishing.casts).toBe(casts + 1);
    // A full warehouse lets the fish swim free; moving ends the session where it stood.
    state.fishing.treats = FISHING.stock; const seed2 = hook().fight.seed, full = play(seed2, fishGenome(seed2).difficulty);
    state.time += full.until;
    if (full.done === 'landed') { const freed = restAction(state, person, 'land', full, free); expect(freed).toMatchObject({ landed: true, kept: false }); expect(state.fishing.treats).toBe(FISHING.stock); }
    standUp(person, free); expect(person.activity).toBeNull(); expect(person.x).toBe(land.x);
  });
});

describe('the companion', () => {
  it('is adopted once for materials, follows the nearest worker, settles beside a resting one and notices the garden', () => {
    const state = garden(), actor = { id: 'keeper', x: 36.5, y: 31.5, regionId: 'home', players: [] };
    expect(() => colonyAction(state, { ...actor, regionId: 'blossom-grove' } as any, 'adopt-pet')).toThrow('home district');
    state.materials = 5; expect(() => colonyAction(state, actor, 'adopt-pet')).toThrow('8 materials');
    state.materials = 40;
    const adopted = colonyAction(state, actor, 'adopt-pet');
    expect(adopted.message).toContain('scuttles down'); expect(state.materials).toBe(32);
    expect(state.pet).toMatchObject({ name: 'Spider', x: state.pad.x + .5, y: state.pad.y + 2.5, mode: 'wander', reaction: { kind: 'happy' } });
    expect(() => colonyAction(state, actor, 'adopt-pet')).toThrow('already here');
    expect(() => colonyAction(state, actor, 'pet-pet')).toThrow('Walk up');
    // Far away: it follows and closes the gap at its own speed, never teleporting.
    // The runtime builds a fresh home view every tick; a captured view would carry a stale clock.
    const view = new Proxy({}, { get: (_, key) => regionView(state, 'home')[key] }) as any, worker = { id: 'keeper', x: 36.5, y: 31.5, angle: 0, regionId: 'home', activity: null };
    const start = Math.hypot(worker.x - state.pet.x, worker.y - state.pet.y);
    tickPet(view, [worker], .5);
    const after = Math.hypot(worker.x - state.pet.x, worker.y - state.pet.y);
    expect(state.pet.mode).toBe('follow'); expect(state.pet.moving).toBe(true);
    expect(after).toBeLessThan(start); expect(start - after).toBeLessThanOrEqual(PET.speed * .5 + 1e-6);
    for (let n = 0; n < 40; n++) tickPet(view, [worker], .1);
    expect(Math.hypot(worker.x - state.pet.x, worker.y - state.pet.y)).toBeLessThanOrEqual(PET.catchUp);
    expect(state.pet.moving).toBe(false);
    // Standing still beside a planted bed: it turns to notice the bed for a while.
    // A planted bed just beyond the spider, on the side away from the worker.
    const away = Math.hypot(state.pet.x - worker.x, state.pet.y - worker.y) || 1, ux = (state.pet.x - worker.x) / away, uy = (state.pet.y - worker.y) / away;
    const bx = Math.round(state.pet.x + ux * 2.2), by = Math.round(state.pet.y + uy * 2.2);
    colonyAction(state, actor, 'build-bed', { x: bx, y: by }); colonyAction(state, actor, 'plant', { bedId: state.beds[0].id, crop: 'sundrop' });
    for (let n = 0; n < 40; n++) { state.time += .1; tickPet(view, [worker], .1); }
    expect(state.pet.mode).toBe('notice');
    expect(Math.hypot(state.pet.notice.x - state.pet.x, state.pet.notice.y - state.pet.y)).toBeLessThanOrEqual(PET.noticeRadius);
    // Petting purrs; a fish in the creel makes it a treat; the friend is remembered.
    const near = { ...actor, x: state.pet.x + .5, y: state.pet.y };
    expect(petAt(state, near.x, near.y)).toBe(state.pet);
    expect(colonyAction(state, near, 'pet-pet')).toMatchObject({ fed: false }); expect(state.pet).toMatchObject({ friend: 'keeper', pets: 1, reaction: { kind: 'purr' } });
    state.fishing = { casts: 1, catches: [], treats: 1, record: {} };
    expect(colonyAction(state, near, 'pet-pet')).toMatchObject({ fed: true }); expect(state.fishing.treats).toBe(0); expect(state.pet.fed).toBe(1);
    state.time += PET.reactionSeconds + .1; tickPet(view, [worker], .1); expect(state.pet.reaction).toBeNull();
    // A resting worker: the spider walks to the seat's side and sits.
    const resting = { ...worker, x: 38, y: 31.5, angle: Math.PI, activity: { kind: 'sit', itemId: 'f-bench', since: 0 } };
    for (let n = 0; n < 40; n++) tickPet(view, [resting], .1);
    expect(state.pet.mode).toBe('sit'); expect(Math.abs(state.pet.x - (38 + PET.sitOffset))).toBeLessThan(.35);
    // Nobody home: it sits and waits. Remote views carry no pet.
    tickPet(view, [], .1); expect(state.pet.mode).toBe('sit');
    regionAction(state, { id: 'surveyor', regionId: 'home', x: 36.5, y: 31.5, angle: 0 }, 'travel-region', { destination: 'blossom-grove' });
    expect(regionView(state, 'blossom-grove').pet).toBeNull(); expect(regionView(state, 'home').pet).toBe(state.pet);
    expect(copy(state).pet).toEqual(state.pet);
    tickColony(state, 1); expect(state.pet.mode).toBe('sit');
  });
});

describe('naming the companion', () => {
  it('lets any crew member rename it, cleaning the name and refusing empty or long ones without change', () => {
    const state = garden(), actor = { id: 'keeper', x: 36.5, y: 31.5, regionId: 'home', players: [] };
    expect(() => colonyAction(state, actor, 'rename-pet', { name: 'Bramble' })).toThrow('Adopt a companion');
    state.materials = 40; colonyAction(state, actor, 'adopt-pet');
    const away = { ...actor, id: 'visitor', regionId: 'blossom-grove' } as any;
    expect(colonyAction(state, away, 'rename-pet', { name: '  Bramble \u0007 the  Brave ' })).toMatchObject({ ok: true, message: 'Your companion is now called Bramble the Brave.' });
    expect(state.pet).toMatchObject({ name: 'Bramble the Brave', reaction: { kind: 'happy' } });
    expect(colonyAction(state, actor, 'rename-pet', { name: 'Bramble the Brave' }).message).toContain('already called');
    expect(colonyAction(state, actor, 'rename-pet', { name: '\u{1F577}\u{FE0F} Pip' }).message).toContain('Pip');
    const named = copy(state);
    for (const name of ['', '   ', '\u200b', 7, null, undefined, 'x'.repeat(PET.nameLength + 1)]) {
      expect(() => colonyAction(state, actor, 'rename-pet', { name })).toThrow();
      expect(state).toEqual(named);
    }
    expect('x'.repeat(PET.nameLength)).toBe(petName('x'.repeat(PET.nameLength)));
    expect(petName('a\nb')).toBe('ab'); expect(petName('a \t b')).toBe('a b');
  });
});

describe('a finished fight recording', () => {
  it('leaves out a hold changed after the fight ended, so the server accepts it with the same result', () => {
    const seed = 'keeper:7', difficulty = fishGenome(seed, 'morrow-v1').difficulty;
    // Hold for the opening second, then release, and press again after the fight has surely ended.
    const toggles = [0.05, 1.05];
    let played = simulateStruggle(seed, difficulty, toggles, STRUGGLE.limit);
    expect(played.done).not.toBeNull();
    const late = [...toggles, Math.round((played.t + .004) * 1000) / 1000];
    expect(validStruggle(late, played.t)).toBe(false);
    const recording = finishedRecording(late, played.t);
    expect(recording.toggles).toEqual(toggles);
    expect(validStruggle(recording.toggles, recording.until)).toBe(true);
    expect(simulateStruggle(seed, difficulty, recording.toggles, recording.until)).toEqual(played);
  });
});
