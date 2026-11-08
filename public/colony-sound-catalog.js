// Peaceful activity sounds load separately from the combat catalogue. Explicit
// loop roles and variant counts match the author's supplied recordings.
const profile = (name, count, gain, range, extra = {}) => {
  const files = Object.freeze(Array.from({ length: count }, (_, i) =>
    'colony/sfx_colony_' + name + (extra.loop ? '' : '_' + String(i + 1).padStart(2, '0')) + '.ogg'));
  return Object.freeze({ file: files[0], files, gain, range, priority: 1, maxPerSource: 2, loop: false, selection: 'random', ...extra });
};
const shot = (name, count = 1, gain = .12, range = 16, extra = {}) => profile(name, count, gain, range, extra);
const loop = (name, gain = .035, range = 16, extra = {}) => profile(name + '_loop', 1, gain, range, { loop: true, priority: .3, maxPerSource: 1, ...extra });

export const COLONY_SOUND_PROFILES = Object.freeze({
  'spider-step': shot('spider_step', 2, .045, 9, { selection: 'alternate', priority: .4, maxPerSource: 1 }),
  'spider-curious': shot('spider_curious', 4, .12, 14),
  'spider-purr': shot('spider_purr', 4, .12, 12),
  'spider-happy': shot('spider_happy', 4, .14, 16),
  'spider-eat': shot('spider_eat', 4, .13, 14),
  'fish-cast': shot('fish_cast', 4, .13, 16),
  'fish-bite': shot('fish_bite', 4, .2, 16, { priority: 2 }),
  'fish-reel': loop('fish_reel', .07, 12, { priority: 1 }),
  'fish-catch': shot('fish_catch', 1, .17, 18, { priority: 2 }),
  'fish-escape': shot('fish_escape', 1, .13, 16),
  'printer-work': loop('printer_work', .045, 18),
  'build-ready': shot('build_ready', 1, .12, 18),
  'machine-work': loop('machine_work', .03, 15),
  'bio-generator': loop('bio_generator', .035, 15),
  'sprinkler': loop('sprinkler', .035, 13),
  'harvest': shot('harvest', 1, .12, 16),
  'item-collect': shot('item_collect', 4, .12, 16),
  'drone-hover': loop('drone_hover', .04, 18),
  'drone-pickup': shot('drone_pickup', 4, .11, 16),
  'drone-unload': shot('drone_unload', 4, .12, 16),
  'shuttle-ignition': shot('shuttle_ignition', 1, .15, 28),
  'shuttle-lift': loop('shuttle_lift', .055, 28),
  'shuttle-engine': loop('shuttle_engine', .06, 32),
  'shuttle-touchdown': shot('shuttle_touchdown', 1, .16, 28),
});

export const COLONY_SOUND_FILES = Object.freeze([...new Set(Object.values(COLONY_SOUND_PROFILES).flatMap(profile => profile.files))]);

// Call select only when a cue will actually play, so discarded/distant events
// do not consume a footstep in the audible 01, 02, 01, 02 sequence.
export function createColonyVariantSelector(random = Math.random) {
  const previous = new Map();
  return {
    reset() { previous.clear(); },
    select(kind) {
      const profile = COLONY_SOUND_PROFILES[kind];
      if (!profile) return null;
      const files = profile.files;
      if (files.length === 1) return files[0];
      const last = previous.get(kind);
      let index;
      if (profile.selection === 'alternate') index = last === undefined ? 0 : (last + 1) % files.length;
      else {
        // Uniformly choose among the other takes, avoiding immediate repetition.
        const choices = files.length - (last === undefined ? 0 : 1);
        const value = random();
        index = Math.floor(Math.max(0, Math.min(.999999999999, Number.isFinite(value) ? value : 0)) * choices);
        if (last !== undefined && index >= last) index++;
      }
      previous.set(kind, index);
      return files[index];
    },
  };
}
