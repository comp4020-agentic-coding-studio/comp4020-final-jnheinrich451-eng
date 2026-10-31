// Presentation only. Sand seas deliberately keep the existing naval terrain and
// saved depth states; this module never changes navigation or damage eligibility.
export const isSandSeaWorld = world => world?.template === 'sirocco-v1';
export function sandSeaAt(world, x, y) {
  if (!isSandSeaWorld(world) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
  const i = y * world.width + x;
  return world.terrain?.[i] === 0 && (world.waterKinds?.[i] || 1) === 1;
}

export function submarineDepthLabel(world, state) {
  if (!isSandSeaWorld(world)) return state;
  return ({ surfaced: 'surface', diving: 'burrowing', submerged: 'under sand', surfacing: 'emerging' })[state] || state;
}

const SAND_TERMS = { shipyard: 'sandport', shipyards: 'sandports', dock: 'sandport', docks: 'sandports',
  ocean: 'sand sea', sea: 'sand sea', water: 'loose sand', shore: 'firm edge', offshore: 'sand-sea',
  coast: 'desert edge', coastal: 'desert', sail: 'skim', sailing: 'skimming', sunk: 'buried',
  dive: 'burrow', diving: 'burrowing', submerged: 'under sand' };
// Apply to player-facing naval sentences only, never IDs, commands or HTML.
export function navalText(world, text) {
  if (!isSandSeaWorld(world) || typeof text !== 'string') return text;
  return text.replace(/\b(shipyards?|docks?|ocean|(?<!sand[ -])sea|water|shore|offshore|coast|coastal|sail|sailing|sunk|dive|diving|submerged)\b/gi, word => {
    const replacement = SAND_TERMS[word.toLowerCase()];
    return word === word.toUpperCase() ? replacement.toUpperCase()
      : word[0] === word[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
  });
}
