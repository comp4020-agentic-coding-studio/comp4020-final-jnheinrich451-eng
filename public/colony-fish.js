// Alien fish of the colony waters. Every catch is a combination of features
// (body, fins, tail, eyes, pattern, colours), so the lake keeps surprising.
// Everything here is a pure function of a seed: no randomness and no wall clock.
// The server decides catches with it and the browser draws and plays the same fish.

// FNV-1a, the same small hash the rest module uses for bites.
const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const unit = (seed, salt) => (hash(`${seed}:${salt}`) % 10007) / 10007;
/** @template {{weight:number}} T @param {string} seed @param {string} salt @param {readonly T[]} options @returns {T} */
function choose(seed, salt, options) {
  let roll = unit(seed, salt) * options.reduce((sum, option) => sum + option.weight, 0);
  for (const option of options) { roll -= option.weight; if (roll < 0) return option; }
  return options[options.length - 1];
}
/** @template T @param {T[]} list @returns {readonly Readonly<T>[]} */
const freeze = list => Object.freeze(list.map(item => Object.freeze(item)));

export const FISH_PARTS = Object.freeze({
  // agility: how hard the fish pulls in a fight. Lengths in centimetres.
  bodies: freeze([
    { id: 'glider', noun: 'glider', weight: 8, min: 18, max: 42, agility: .55, rare: 0 },
    { id: 'darter', noun: 'darter', weight: 8, min: 12, max: 28, agility: .8, rare: 0 },
    { id: 'disc', noun: 'disc', weight: 6, min: 16, max: 36, agility: .35, rare: 0 },
    { id: 'puff', noun: 'puff', weight: 5, min: 10, max: 26, agility: .25, rare: 1 },
    { id: 'ribbon', noun: 'ribbon', weight: 3, min: 40, max: 95, agility: .65, rare: 2 },
  ]),
  // sail: long swept-back streamers, as in the author's sketch.
  fins: freeze([
    { id: 'sail', word: 'Sail', weight: 7, rare: 0 },
    { id: 'frill', word: 'Frill', weight: 6, rare: 0 },
    { id: 'spine', word: 'Spine', weight: 5, rare: 0 },
    { id: 'wing', word: 'Wing', weight: 3, rare: 1 },
  ]),
  tails: freeze([
    { id: 'fork', weight: 7, rare: 0 }, { id: 'fan', weight: 6, rare: 0 },
    { id: 'whip', weight: 3, rare: 1 }, { id: 'twin', weight: 2, rare: 1 },
  ]),
  eyes: freeze([
    { id: 'pair', count: 2, word: '', weight: 10, rare: 0 },
    { id: 'single', count: 1, word: 'One-eyed ', weight: 4, rare: 1 },
    { id: 'triple', count: 3, word: 'Three-eyed ', weight: 2, rare: 2 },
    { id: 'stalk', count: 2, word: 'Stalk-eyed ', weight: 2, rare: 2 },
  ]),
  patterns: freeze([
    { id: 'plain', weight: 6, rare: 0 }, { id: 'stripes', weight: 5, rare: 0 },
    { id: 'spots', weight: 5, rare: 0 }, { id: 'glowline', weight: 2, rare: 1 },
  ]),
});
// Each world's water has its own colours: body, belly, fins, accent (pattern and outline detail).
const palette = (id, word, body, belly, fin, accent, weight = 4) => ({ id, word, body, belly, fin, accent, weight });
export const FISH_PALETTES = Object.freeze({
  'morrow-v1': freeze([
    palette('amber', 'Amber', '#e3a956', '#f6e3b4', '#f0c27a', '#8a5a2b', 6), palette('teal', 'Teal', '#4fa3a0', '#d7efe6', '#7fcfc3', '#24585c', 5),
    palette('moss', 'Moss', '#7d9b5a', '#e3ecc6', '#a9c47c', '#3f5a2c', 4), palette('coral', 'Coral', '#e07f6a', '#fbe0d2', '#f2a58f', '#8a3b30', 3),
    palette('silver', 'Silver', '#aab8bf', '#f1f4f2', '#cfdbe0', '#56656e', 5),
  ]),
  'nacre-v1': freeze([
    palette('pearl', 'Pearl', '#e8dfe8', '#fbf7f4', '#f3d8e4', '#8b7a93', 6), palette('rose', 'Rose', '#e59bb0', '#fbe3ea', '#f4bfd0', '#8a4a63', 5),
    palette('aqua', 'Aqua', '#6cc4d6', '#e2f6f8', '#9fe0e8', '#2d6b7a', 5), palette('lilac', 'Lilac', '#ae9bd8', '#efe9fa', '#cbbcef', '#544582', 4),
    palette('ink', 'Ink', '#3e4f6b', '#c9d3e6', '#6f86ad', '#1d2638', 2),
  ]),
  'aurelia-v1': freeze([
    palette('violet', 'Violet', '#8d6cc8', '#e8def8', '#b49ae6', '#3f2b6b', 5), palette('ember', 'Ember', '#d9643f', '#fbd9c4', '#f08f62', '#6f2a17', 4),
    palette('gold', 'Gold', '#d8b04a', '#faefc7', '#ecd27b', '#7a5d16', 5), palette('dusk', 'Dusk', '#5b5f9e', '#d9dbf2', '#8a8fd0', '#262a57', 4),
    palette('frost', 'Frost', '#9fd3e0', '#f2fbfd', '#c6eaf2', '#3d7586', 3),
  ]),
});
export const FISH_RARITY = Object.freeze(['Common', 'Uncommon', 'Rare', 'Legendary']);
const GLOW = Object.freeze({ 'morrow-v1': '#c8fff0', 'nacre-v1': '#ffd8f0', 'aurelia-v1': '#ffe6a8' });
/** @param {string} name */
export const fishArticle = name => /^[AEIOU]/i.test(name) ? 'an' : 'a';

/**
 * The fish on the end of one cast. `seed` is the angler and cast count; `planet` the
 * expedition template (unknown worlds use Morrow's water). The name is the species:
 * eyes, glow, colour, fins and body. Tail, pattern and proportions vary per fish.
 * @param {string} seed @param {string} [planet]
 */
export function fishGenome(seed, planet = 'morrow-v1') {
  const water = Object.hasOwn(FISH_PALETTES, planet) ? planet : 'morrow-v1';
  const body = choose(seed, 'body', FISH_PARTS.bodies), fins = choose(seed, 'fins', FISH_PARTS.fins);
  const tail = choose(seed, 'tail', FISH_PARTS.tails), eyes = choose(seed, 'eyes', FISH_PARTS.eyes);
  const pattern = choose(seed, 'pattern', FISH_PARTS.patterns), colors = choose(seed, 'colour', FISH_PALETTES[water]);
  const glow = unit(seed, 'glow') < .12;
  const points = body.rare + fins.rare + tail.rare + eyes.rare + pattern.rare + (glow ? 2 : 0);
  const rarity = points >= 6 ? 3 : points >= 4 ? 2 : points >= 2 ? 1 : 0;
  const difficulty = Math.min(1, .12 + body.agility * .5 + points * .055);
  const length = Math.round((body.min + unit(seed, 'length') * (body.max - body.min)) * (rarity === 3 ? 1.15 : 1));
  const joined = fins.word.slice(-1).toLowerCase() === body.noun[0] ? `${fins.word}-${body.noun}` : fins.word + body.noun;
  const name = `${eyes.word}${glow ? 'Lantern ' : ''}${colors.word} ${joined}`;
  return Object.freeze({
    seed, planet: water, name, rarity, rarityName: FISH_RARITY[rarity], difficulty, length,
    body: body.id, fins: fins.id, tail: tail.id, eyes: eyes.id, eyeCount: eyes.count, pattern: pattern.id, glow,
    colors: Object.freeze({ body: colors.body, belly: colors.belly, fin: colors.fin, accent: colors.accent, glow: GLOW[water] }),
    // Individual proportions, each 0..1: body stretch, fin size, pattern count, eye size.
    stretch: unit(seed, 'stretch'), finScale: unit(seed, 'fin-scale'), marks: unit(seed, 'marks'), eyeSize: unit(seed, 'eye-size'),
  });
}

// The reel fight: a fish darts up and down a vertical track while the angler holds
// to lift a catch zone (gravity pulls it down when released). Progress fills while
// the fish is inside the zone and drains outside; full lands the fish, empty or the
// time limit loses it. The browser plays it live; the server replays the angler's
// recorded hold toggles through this same function to decide the catch. Only + - * /
// floor, min and max are used, so every engine computes the same result.
export const STRUGGLE = Object.freeze({ step: 1 / 60, limit: 30, start: .3, fill: .34, drain: .24, lift: 3.4, gravity: 2.7, maxSpeed: 1.6, toggles: 900, grace: 1.5 });
/** @param {number} difficulty */
export const struggleZone = difficulty => .34 - .12 * difficulty;
const smooth = n => n * n * (3 - 2 * n);
/**
 * The fish's path: eased moves between hashed heights, some of them quick darts. The
 * segments are built once and walked forward, so a whole fight costs one pass.
 * @param {string} seed @param {number} difficulty @returns {(t: number) => number}
 */
export function fishPath(seed, difficulty) {
  /** @type {{start: number, duration: number, from: number, to: number}[]} */
  const segments = [];
  let index = 0;
  const extend = () => {
    const k = segments.length, previous = segments[k - 1];
    let duration = .45 + unit(seed, `d${k}`) * (1.3 - .7 * difficulty);
    if (unit(seed, `dart${k}`) < .3 * difficulty) duration *= .45;
    segments.push({ start: previous ? previous.start + previous.duration : 0, duration, from: previous ? previous.to : .5, to: .08 + unit(seed, `y${k}`) * .84 });
  };
  return t => {
    if (!segments.length) extend();
    if (t < segments[index].start) index = 0;
    for (;;) {
      const segment = segments[index];
      if (t < segment.start + segment.duration) {
        const wave = t * 3 - Math.floor(t * 3), wiggle = ((wave < .5 ? wave : 1 - wave) * 4 - 1) * .015 * difficulty;
        return Math.max(0, Math.min(1, segment.from + (segment.to - segment.from) * smooth((t - segment.start) / segment.duration) + wiggle));
      }
      if (index + 1 >= segments.length) { if (segments.length >= 400) return segment.to; extend(); }
      index++;
    }
  };
}
/** The fish's height on the track (0 bottom, 1 top) at time t. @param {string} seed @param {number} difficulty @param {number} t */
export const fishTrack = (seed, difficulty, t) => fishPath(seed, difficulty)(t);
/**
 * Plays the fight up to `until` seconds (or until it ends) for a sorted list of hold
 * toggle times (seconds from the hook; held after an odd number of toggles).
 * @param {string} seed @param {number} difficulty @param {readonly number[]} toggles @param {number} until
 */
export function simulateStruggle(seed, difficulty, toggles, until) {
  const size = struggleZone(difficulty), last = Math.round(STRUGGLE.limit / STRUGGLE.step);
  const steps = Math.max(0, Math.min(Math.floor(until / STRUGGLE.step + 1e-9), last));
  const path = fishPath(seed, difficulty);
  let y = .5 - size / 2, v = 0, progress = STRUGGLE.start, toggled = 0, held = false, inside = false, fish = path(0), i = 0;
  /** @type {null | 'landed' | 'escaped'} */
  let done = null;
  for (; i < steps && !done; i++) {
    const t = i / 60;
    while (toggled < toggles.length && toggles[toggled] <= t) toggled++;
    held = toggled % 2 === 1;
    v = Math.max(-STRUGGLE.maxSpeed, Math.min(STRUGGLE.maxSpeed, v + (held ? STRUGGLE.lift : -STRUGGLE.gravity) * STRUGGLE.step));
    y += v * STRUGGLE.step;
    if (y < 0) { y = 0; v = v < -.4 ? -v * .25 : 0; }
    if (y > 1 - size) { y = 1 - size; v = 0; }
    fish = path((i + 1) / 60);
    inside = fish >= y && fish <= y + size;
    progress += (inside ? STRUGGLE.fill * (1 - .35 * difficulty) : -STRUGGLE.drain * (.75 + .5 * difficulty)) * STRUGGLE.step;
    if (progress >= 1) { progress = 1; done = 'landed'; }
    else if (progress <= 0) { progress = 0; done = 'escaped'; }
    else if (i + 1 >= last) done = 'escaped';
  }
  return { t: i / 60, y, v, size, fish, progress, inside, held, done };
}
/**
 * The recording sent when a fight ends at simulation time `until`. A hold changed
 * between that step and the frame that noticed the end cannot alter the result,
 * and would fall after `until`, so it is left out.
 * @param {number[]} toggles @param {number} until
 */
export function finishedRecording(toggles, until) {
  return { toggles: toggles.filter(value => value <= until), until };
}
/** A recorded fight the server will accept: sorted, finite, bounded. @param {unknown} toggles @param {unknown} until */
export function validStruggle(toggles, until) {
  if (!Array.isArray(toggles) || toggles.length > STRUGGLE.toggles || typeof until !== 'number' || !Number.isFinite(until) || until <= 0 || until > STRUGGLE.limit + STRUGGLE.step) return false;
  let previous = 0;
  for (const value of toggles) { if (typeof value !== 'number' || !Number.isFinite(value) || value < previous || value > until) return false; previous = value; }
  return true;
}
