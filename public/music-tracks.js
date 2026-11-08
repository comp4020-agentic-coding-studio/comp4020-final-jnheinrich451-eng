import { colonySavePlanetId } from './colony-planets.js';

// Browser presentation only: choose from the saved world's template and mode.
const track = (file, title) => Object.freeze({ src: `/audio/${file}.mp3`, title });
export const MUSIC_TRACKS = Object.freeze({
  'caldera-v1': track('Apex_Of_Conquest', 'Apex of Conquest'),
  'sirocco-v1': track('Crimson_Vanguard', 'Crimson Vanguard'),
  'vesper-v1': track('Steel_Wrought_Ascent', 'Steel Wrought Ascent'),
  'morrow-v1': track('Twilight_Over_the_Still_Lake_Colonization', 'Twilight Over the Still Lake'),
  'nacre-v1': track('Harvest_at_Low_Tide_Colonnization', 'Harvest at Low Tide'),
  'aurelia-v1': track('Sun_Drenched_Sanctuary_Colonization', 'Sun Drenched Sanctuary'),
});

export function musicForWorld(world, mode = 'combat') {
  if (!world) return null;
  if (mode === 'colonization') return MUSIC_TRACKS[colonySavePlanetId(world.template)];
  return MUSIC_TRACKS[['caldera-v1', 'sirocco-v1', 'vesper-v1'].includes(world.template) ? world.template : 'caldera-v1'];
}
