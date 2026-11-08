// Each civilian world's connected districts. Exploration is part of the colony save;
// this module has no combat import, account lookup or wall-clock dependency.
import { colonyPlanetById } from './colony-planets.js';
import { grantSettlementFurnishing } from './colony-settlement.js';
const home = name => Object.freeze({ id: 'home', name, label: 'Home garden', description: 'Your garden, workshop and orbital post. Production continues while the expedition explores.', kind: 'home' });
// Region ids are unique across worlds. `water` lists [cx, cy, rx, ry, shore rim];
// `salt` places rocks; terraces and trails are walkable pale bands.
const region = (id, name, label, description, kind, shape) => Object.freeze({ id, name, label, description, kind, ...shape });
const PLANET_REGIONS = Object.freeze({
  'morrow-v1': Object.freeze([
    home('Dawnmeadow Reach'),
    region('blossom-grove', 'Blossom Grove', 'Flowering woodland', 'Petal bells, glasswing visitors and a resonant fallen trunk among the flowering canopy.', 'grove', { water: [[42, 12, 4, 3.4, 1.25]], trail: true, salt: 3 }),
    region('lake-basin', 'Stillwater Basin', 'Freshwater shore', 'Follow the lake edge to mirror reeds, silverfin shoals and the dawnstone overlook.', 'lake', { water: [[28, 21, 9, 7.3, 1.2]], salt: 17 }),
  ]),
  'nacre-v1': Object.freeze([
    home('Pearlwater Basin'),
    region('glowcap-fen', 'Glowcap Fen', 'Fungal wetland', 'Lantern caps, drifting spore veils and a canopy arch between the lavender pools.', 'grove', { water: [[20, 13, 3.6, 2.6, 1.25], [37, 30, 4.2, 3, 1.25], [44, 14, 3.2, 2.4, 1.25], [18, 34, 3, 2.2, 1.25]], salt: 23 }),
    region('pearl-lagoon', 'Pearl Lagoon', 'Sheltered lagoon', 'Follow the pale shore to pearl reeds, a glimmer shoal and the shell bank.', 'lake', { water: [[28, 22, 10, 7, 1.2]], salt: 41 }),
  ]),
  'aurelia-v1': Object.freeze([
    home('Sunfold Terraces'),
    region('fanleaf-uplands', 'Fanleaf Uplands', 'Wind-shaped uplands', 'Fanleaf trees, amber skimmers and a ridge that sings when the wind turns.', 'grove', { water: [[16, 12, 3.6, 3, 1.25]], trail: true, salt: 7 }),
    region('mineral-terraces', 'Mineral Terraces', 'Mineral terraces', 'Climb past banded stone and a blue spring to the old observatory site.', 'lake', { water: [[34, 24, 5.5, 4, 1.2]], terraces: true, salt: 53 }),
  ]),
});
/** A world's own districts, home first; a save from an older template has none. @param {string} template @returns {readonly any[]} */
export const regionsFor = template => Object.hasOwn(PLANET_REGIONS, template) ? PLANET_REGIONS[template] : [];
export const REGIONS = PLANET_REGIONS['morrow-v1'];
export const REGION_SCAN_RADIUS = 2.6;
const discovery = (id, regionId, name, kind, x, y, description, furnishing, giftName) => Object.freeze({ id, regionId, name, kind, x, y, description, reward: 3, furnishing, giftName });
const discoveries = Object.freeze([
  discovery('morrow-petalbell', 'blossom-grove', 'Petal bell', 'flower', 18.5, 18.5, 'A translucent flower that folds around morning dew. Its overlapping petals suggest a sheltered garden lamp.', 'petal-lamp', 'Petal lamp'),
  discovery('morrow-glasswing', 'blossom-grove', 'Glasswing gathering', 'wildlife', 34.5, 14.5, 'Small gliders congregate above the pale blossoms. The journal records their delicate wing pattern.', 'specimen-case', 'Specimen case'),
  discovery('morrow-resonant-log', 'blossom-grove', 'Singing timber', 'landmark', 40.5, 29.5, 'Hollow fibres turn the breeze into a soft chord. A field recording joins the expedition archive.', 'worktable', 'Field worktable'),
  discovery('morrow-mirror-reed', 'lake-basin', 'Mirror reed', 'reed', 14.5, 18.5, 'A waxy silver surface reflects the water. Dense roots shelter small creatures along the freshwater shore.', 'reed-planter', 'Reed planter'),
  discovery('morrow-silverfin', 'lake-basin', 'Silverfin shoal', 'wildlife', 42.5, 20.5, 'A coordinated flash beneath the surface reveals a school of native fish. This observation marks a future fishing spot.', 'pond', 'Garden pond'),
  discovery('morrow-dawnstone', 'lake-basin', 'Dawnstone overlook', 'mineral', 32.5, 34.5, 'Bands of rose-coloured mineral warm in the first sunlight. Their pattern is preserved in the field journal.', 'wind-sculpture', 'Wind sculpture'),
  discovery('nacre-lanterncap', 'glowcap-fen', 'Lantern cap', 'flower', 25.5, 21.5, 'A pale fungal cap glows from its gills at dusk. Its light suggests a string of soft garden lamps.', 'hanging-lights', 'Hanging lights'),
  discovery('nacre-spore-veil', 'glowcap-fen', 'Spore veil', 'wildlife', 44.5, 22.5, 'Drifting motes settle and lift with every breath of wind. The journal keeps a sealed sample of the veil.', 'specimen-case', 'Specimen case'),
  discovery('nacre-canopy-arch', 'glowcap-fen', 'Canopy arch', 'landmark', 30.5, 37.5, 'Two fungal stems have grown together into a natural gateway. Its curve becomes a climbing frame for home.', 'trellis', 'Flower trellis'),
  discovery('nacre-pearl-reed', 'pearl-lagoon', 'Pearl reed', 'reed', 14.5, 18.5, 'Reeds with a nacreous sheen ring the lagoon. A cutting is potted for the home garden.', 'reed-planter', 'Reed planter'),
  discovery('nacre-glimmer-shoal', 'pearl-lagoon', 'Glimmer shoal', 'shoal', 41.5, 22.5, 'Small fish turn together and flash pink beneath the surface. This observation marks a fishing spot.', 'pond', 'Garden pond'),
  discovery('nacre-shell-bank', 'pearl-lagoon', 'Shell bank', 'mineral', 30.5, 34.5, 'Layered shell has built a smooth bank above the tide line. Its curve inspires a broad deck for quiet evenings.', 'observation-deck', 'Observation deck'),
  discovery('aurelia-fanleaf', 'fanleaf-uplands', 'Fanleaf tree', 'flower', 22.5, 17.5, 'Broad leaves open like a fan to shade the grass below. The survey team sketches a canopy to match.', 'pergola', 'Meadow pergola'),
  discovery('aurelia-skimmers', 'fanleaf-uplands', 'Amber skimmers', 'wildlife', 36.5, 14.5, 'Light gliders ride the updraft along the slope. The journal records their amber wing pattern.', 'specimen-case', 'Specimen case'),
  discovery('aurelia-singing-ridge', 'fanleaf-uplands', 'Singing ridge', 'landmark', 42.5, 30.5, 'Wind combs the ridge into a long low chord. A field recording joins the expedition archive.', 'wind-sculpture', 'Wind sculpture'),
  discovery('aurelia-banded-stone', 'mineral-terraces', 'Banded stone', 'mineral', 20.5, 16.5, 'Gold and ivory bands record a long, slow climate. The pattern is copied into the field journal.', 'worktable', 'Field worktable'),
  discovery('aurelia-spring-shoal', 'mineral-terraces', 'Spring shoal', 'shoal', 42.5, 25.5, 'Blue fish hold still in the cold spring, then scatter as one. This observation marks a fishing spot.', 'pond', 'Garden pond'),
  discovery('aurelia-observatory', 'mineral-terraces', 'Observatory site', 'landmark', 28.5, 35.5, 'A flat terrace with a clear view of the sky. Survey crews have marked it for a future observatory.', 'observation-deck', 'Observation deck'),
]);

/** @returns {never} */
const reject = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const definition = (state, id) => regionsFor(state?.template).find(region => region.id === id) || null;
export const regionDiscoveries = id => discoveries.filter(item => item.regionId === id);
export const allRegionDiscoveries = () => discoveries;
export const isRegionAction = action => action === 'travel-region' || action === 'discover-region';
export const hasRegions = state => regionsFor(state?.template).length > 0;

/** @param {any} spec @param {string} template */
function createRegion(spec, template) {
  const width = 56, height = 44, terrain = Array(width * height).fill(0);
  const spawn = { x: 8.5, y: 25.5 };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = x + .5, py = y + .5;
    const edge = Math.hypot((px - 28) / 25.5, (py - 22) / 20);
    const boundary = 1 + .035 * Math.sin(py * .45) + .025 * Math.cos(px * .4);
    let kind = edge < boundary ? edge > boundary - .12 ? 1 : 2 : 0;
    // Broad mineral bands, walkable like Aurelia's home terraces.
    if (kind && spec.terraces && (py + Math.sin(px * .12) * 3.2 + Math.cos(px * .04) * 2.5) % 8.5 < 1.6) kind = 1;
    for (const [cx, cy, rx, ry, rim] of spec.water) {
      const water = Math.hypot((px - cx) / rx, (py - cy) / ry);
      if (water < 1) kind = 0;
      else if (kind && water < rim) kind = 1;
    }
    // A walkable pale trail lends a grove a different silhouette to home.
    if (kind && spec.trail && Math.abs(py - (25 + Math.sin(px * .13) * 4)) < .8) kind = 1;
    if (kind && edge > .72 && (x * 37 + y * 19 + spec.salt) % 131 === 0) kind = 3;
    terrain[y * width + x] = kind;
  }
  // Clear only small arrival/observation spots. The main water remains intact;
  // each region is one connected land ring with authored, reachable landmarks.
  for (const point of [spawn, ...regionDiscoveries(spec.id)]) {
    for (let y = Math.floor(point.y) - 1; y <= Math.floor(point.y) + 1; y++) for (let x = Math.floor(point.x) - 1; x <= Math.floor(point.x) + 1; x++) terrain[y * width + x] = 2;
  }
  const planet = colonyPlanetById(template);
  return { version: 1, id: `colony-${template.replace(/-v\d+$/, '')}-${spec.id}-v1`, regionId: spec.id, template, name: planet?.name || 'Expedition', district: spec.name, width, height, terrain, spawn };
}

/** Existing home geography is always the original object, never regenerated. @param {any} state */
export function regionWorld(state, id = 'home') {
  if (id === 'home') return state.world;
  if (!definition(state, id)) return null;
  return state.exploration?.worlds?.[id] || null;
}

/** Public progress never includes every region's terrain. @param {any} state */
export function explorationSummary(state) {
  if (!hasRegions(state)) return undefined;
  return { version: 1, revision: state.exploration?.revision || 0,
    discoveries: [...(state.exploration?.discoveries || [])], visited: [...(state.exploration?.visited || ['home'])] };
}

/** A region-local view for rendering/collision; shared resources/time stay global. @param {any} state */
export function regionView(state, id = 'home') {
  const world = regionWorld(state, id);
  if (!world) reject('That region has not been surveyed. Return to the home garden.');
  const { exploration, ...base } = state;
  const progress = explorationSummary(state);
  const view = { ...base, world, regionId: id, ...(progress ? { exploration: progress } : {}), regionDiscoveries: regionDiscoveries(id) };
  if (id === 'home') return view;
  // Home remains fully simulated in state. It must never appear in a remote
  // district's drawing, selection, collision or construction preview.
  return { ...view, hub: { x: -1000, y: -1000 }, pad: { x: -1000, y: -1000 }, beds: [], sprinklers: [],
    decorations: { pennant: false, items: [] }, industry: undefined, settlement: undefined, cinema: undefined, shipment: null, ground: undefined, crates: [], pet: null };
}

/**
 * Mutates the cloned authoritative state/person, which runtime commits together.
 * @param {any} state
 * @param {any} person
 * @param {string} action
 * @param {any} data
 */
export function regionAction(state, person, action, data = {}) {
  if (!person || typeof person.id !== 'string' || !person.id.trim()) reject('Join the expedition before exploring.', 403);
  if (!hasRegions(state)) reject('Survey routes open from Morrow, Nacre and Aurelia expeditions.', 400);
  if (!data || typeof data !== 'object' || Array.isArray(data)) reject('Use a valid survey command.', 400);
  const current = person.regionId || 'home';
  if ((data.regionId ?? 'home') !== current) reject('Your location changed. Refresh this region before acting.');
  if (action === 'travel-region') {
    const target = definition(state, data.destination);
    if (!target) reject(`Choose a destination in the ${colonyPlanetById(state.template)?.name || 'expedition'} survey.`, 400);
    if (target.id === current) reject('You are already in this region.');
    if (!state.exploration) state.exploration = { version: 1, revision: 0, discoveries: [], visited: ['home'], worlds: {} };
    if (target.id !== 'home' && !regionWorld(state, target.id)) state.exploration.worlds[target.id] = createRegion(target, state.template);
    const world = regionWorld(state, target.id);
    if (!world) reject('That survey route is unavailable.');
    person.regionId = target.id; person.x = world.spawn.x; person.y = world.spawn.y; person.angle = 0;
    if (!state.exploration.visited.includes(target.id)) state.exploration.visited.push(target.id);
    state.exploration.revision++; state.revision++;
    return { ok: true, message: target.id === 'home' ? 'Welcome back to your garden.' : `Survey shuttle arrived at ${target.name}.`, regionId: target.id, targetId: target.id };
  }
  if (action === 'discover-region') {
    const item = discoveries.find(point => point.id === data.discoveryId && point.regionId === current);
    if (!item || !regionWorld(state, current) || current === 'home') reject('Choose an observation in this region.', 400);
    if (![person.x, person.y].every(Number.isFinite) || Math.hypot(person.x - item.x, person.y - item.y) > REGION_SCAN_RADIUS) reject('Move closer to the observation before recording it.');
    if (state.exploration.discoveries.includes(item.id)) return { ok: true, targetId: item.id, message: `${item.name} is already in the expedition journal.` };
    grantSettlementFurnishing(state, item.furnishing, 1);
    state.exploration.discoveries.push(item.id); state.exploration.revision++;
    state.materials += item.reward; state.revision++;
    return { ok: true, targetId: item.id, message: `${item.name} recorded. ${item.giftName} is stored at home, with ${item.reward} materials from the survey team.`, reward: item.reward, furnishing: item.furnishing };
  }
  return reject('Choose a survey action.', 400);
}
