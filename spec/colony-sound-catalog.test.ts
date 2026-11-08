import { expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { COLONY_SOUND_FILES, COLONY_SOUND_PROFILES, createColonyVariantSelector } from '../public/colony-sound-catalog.js';

it('covers every supplied colony recording once without loading combat sounds', () => {
  const supplied = readdirSync(new URL('../soundeffect/', import.meta.url)).filter(name => /^sfx_colony_.*\.wav$/.test(name)).sort();
  expect(COLONY_SOUND_FILES.map(file => file.replace(/^colony\//, '').replace(/\.ogg$/, '.wav')).sort()).toEqual(supplied);
  expect(COLONY_SOUND_FILES).toHaveLength(52);
  expect(new Set(COLONY_SOUND_FILES).size).toBe(52);
  const loops = Object.values(COLONY_SOUND_PROFILES).filter(profile => profile.loop);
  expect(loops).toHaveLength(8);
  expect(loops.every(profile => profile.files.length === 1)).toBe(true);
});

it('alternates the two spider footsteps even with other cues between them', () => {
  const selector = createColonyVariantSelector(() => .9), steps = [];
  for (let i = 0; i < 6; i++) {
    steps.push(selector.select('spider-step'));
    selector.select('spider-curious'); selector.select('drone-hover');
  }
  const [first, second] = COLONY_SOUND_PROFILES['spider-step'].files;
  expect(steps).toEqual([first, second, first, second, first, second]);
  selector.reset(); expect(selector.select('spider-step')).toBe(first);
});

it('randomly selects all four supplied takes without immediately repeating one', () => {
  const groups = Object.entries(COLONY_SOUND_PROFILES).filter(([, profile]) => profile.files.length === 4);
  expect(groups).toHaveLength(9);
  for (const [kind, profile] of groups) {
    const draws = [0, 0, .34, .99], selector = createColonyVariantSelector(() => draws.shift() ?? 0);
    const played = Array.from({ length: 4 }, () => selector.select(kind));
    expect(new Set(played)).toEqual(new Set(profile.files));
    for (let i = 0; i < 20; i++) {
      const next = selector.select(kind);
      expect(next).not.toBe(played.at(-1)); played.push(next);
    }
  }
});

it('retains single takes and loop files without consuming random choices', () => {
  let draws = 0;
  const selector = createColonyVariantSelector(() => { draws++; return .5; });
  for (const [kind, profile] of Object.entries(COLONY_SOUND_PROFILES).filter(([, profile]) => profile.files.length === 1)) {
    expect(selector.select(kind)).toBe(profile.file);
    expect(selector.select(kind)).toBe(profile.file);
  }
  expect(draws).toBe(0); expect(selector.select('unknown')).toBeNull();
});
