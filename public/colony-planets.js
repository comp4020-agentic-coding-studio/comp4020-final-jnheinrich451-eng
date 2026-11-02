// Stable civilian destination IDs. These are independent of combat templates.
// All astronomical values are fictional survey data for the opening scene.
export const COLONY_PLANETS = Object.freeze([
  Object.freeze({
    id: 'morrow-v1', name: 'Morrow', designation: 'MRW / 01', subtitle: 'Meadows after dawn',
    description: 'Flowering woodland and broad meadow valleys around chains of freshwater ponds. A gentle first home beneath ivory clouds.',
    radius: '6,180 km', mass: '5.14 × 10²⁴ kg', position: '+08.4 / −02.1 / +01.6 ly',
    atmosphere: 'N₂ 76% · O₂ 22% · Ar 1% · other 1%', district: 'Dawnmeadow Reach',
    surface: Object.freeze({ water: '#92c4bf', shore: '#ded5ae', land: '#b6cba0', dark: '#7e9f76', leaf: '#71986e', bloom: '#e5b4ad' }),
  }),
  Object.freeze({
    id: 'nacre-v1', name: 'Nacre', designation: 'NCR / 02', subtitle: 'A garden between tides',
    description: 'Turquoise lagoons wind through pale shores and lavender wetlands. Tall fungal canopies shelter a connected inland clearing.',
    radius: '5,720 km', mass: '4.06 × 10²⁴ kg', position: '+08.9 / −01.6 / +02.2 ly',
    atmosphere: 'N₂ 74% · O₂ 21% · H₂O 3% · other 2%', district: 'Pearlwater Basin',
    surface: Object.freeze({ water: '#83c8cc', shore: '#e4dfd1', land: '#bebfd0', dark: '#9296b1', leaf: '#91acb2', bloom: '#d9b7cf' }),
  }),
  Object.freeze({
    id: 'aurelia-v1', name: 'Aurelia', designation: 'AUR / 03', subtitle: 'Fields of golden light',
    description: 'Amber uplands and broad alien canopies above blue lakes. Pale mineral terraces leave wide, warm spaces for cultivation.',
    radius: '6,860 km', mass: '6.21 × 10²⁴ kg', position: '+09.6 / −03.2 / +00.8 ly',
    atmosphere: 'N₂ 77% · O₂ 20% · Ar 2% · other 1%', district: 'Sunfold Terraces',
    surface: Object.freeze({ water: '#8bb9cb', shore: '#e3cfa7', land: '#d9c486', dark: '#b29d62', leaf: '#a8ac70', bloom: '#d3a281' }),
  }),
]);

export const colonyPlanetById = id => COLONY_PLANETS.find(planet => planet.id === id) || null;

// Menu grouping only: these earlier peaceful expeditions keep their original
// saved template and geography. They do not add combat worlds to the selector.
const LEGACY_COLONY_GROUPS = Object.freeze({ 'caldera-v1': 'morrow-v1', 'vesper-v1': 'nacre-v1', 'sirocco-v1': 'aurelia-v1' });
export const colonySavePlanetId = template => colonyPlanetById(template)?.id || LEGACY_COLONY_GROUPS[template] || COLONY_PLANETS[0].id;
