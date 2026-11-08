// Presentation only: Caldera's blue meadows, after the author's concept art. Tile kinds
// still come from saved terrain; nothing here decides movement, cover or placement.
const hash = (x, y, salt = 0) => { let n = Math.imul(x + 311, 374761393) ^ Math.imul(y + 977, 668265263) ^ Math.imul(salt + 13, 2147483647); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const smooth = t => t * t * (3 - 2 * t);
export function valueNoise(x, y, salt) {
  const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy), at = (a, b) => hash(a, b, salt);
  return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
}
// Broad drifts of light and dark, in tile coordinates and continuous across chunks.
export const meadow = (x, y) => valueNoise(x / 17, y / 17, 1) * .62 + valueNoise(x / 6, y / 6, 2) * .38;
const mixHex = (a, b, t) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - t) + parseInt(b.slice(1 + i, 3 + i), 16) * t).toString(16).padStart(2, '0')).join('');
const LAND = { low: '#1f3a66', mid: '#2b4f82', high: '#3b679e', blade: '#79a6dc', stem: '#172d50' };
const land = shade => shade < .5 ? mixHex(LAND.low, LAND.mid, shade * 2) : mixHex(LAND.mid, LAND.high, (shade - .5) * 2);
const stretch = value => Math.max(0, Math.min(1, (value - .22) / .56));

export const CALDERA = Object.freeze({ deep: '#0d2233', shallow: '#1f5468', ripple: '#bfe0f014', shore: '#c9d6dc', sand: '#a9b5bb', rock: '#515a68', floor: '#798d89' });
// The cached overview shares the meadow drifts, one colour per tile.
export function calderaColor(x, y, kind) {
  return [CALDERA.deep, CALDERA.sand, land(stretch(meadow(x, y))), CALDERA.rock, CALDERA.floor][kind] || CALDERA.deep;
}
// The meadow drift as a continuous colour, for the smooth ground in ground-art.js.
const LAND_RGB = [LAND.low, LAND.mid, LAND.high].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
export function calderaGround(x, y, out) {
  const shade = stretch(meadow(x, y)), [a, b] = shade < .5 ? [LAND_RGB[0], LAND_RGB[1]] : [LAND_RGB[1], LAND_RGB[2]], t = shade < .5 ? shade * 2 : (shade - .5) * 2;
  for (let i = 0; i < 3; i++) out[i] = a[i] + (b[i] - a[i]) * t;
}
// Short tufts leaning every way, so the grass never reads as falling rain. `edges`
// marks sides that meet sand or water (1 west, 2 east, 4 north, 8 south): tufts keep
// back from them, so the blended shore band stays bare.
export function drawCalderaTufts(c, x, y, T, edges = 0) {
  const px = x * T, py = y * T;
  c.lineWidth = 1.2; c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const fx = hash(x, y, 100 + i), fy = hash(x, y, 120 + i);
    if ((edges & 1 && fx < .35) || (edges & 2 && fx > .65) || (edges & 4 && fy < .35) || (edges & 8 && fy > .65)) continue;
    const bx = px + fx * T, by = py + fy * T, lean = hash(x, y, 140 + i) * Math.PI * 2, long = 3 + hash(x, y, 180 + i) * 3;
    c.strokeStyle = hash(x, y, 160 + i) > .5 ? LAND.blade + '30' : LAND.stem + '70';
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(lean) * long, by + Math.sin(lean) * long); c.stroke();
  }
}
// Blue trees gather in groves rather than an even scatter. Cosmetic, so kept small
// enough that walking past one never reads as walking through a wall.
export function treeAt(x, y) {
  const grove = valueNoise(x / 9, y / 9, 5), chance = grove > .66 ? .13 : grove > .5 ? .03 : .004;
  return hash(x, y, 7) < chance ? { x: x + .2 + hash(x, y, 8) * .6, y: y + .2 + hash(x, y, 9) * .6, r: .36 + hash(x, y, 10) * .34 } : null;
}
export function drawCalderaTree(c, tree, T, seed) {
  const x = tree.x * T, y = tree.y * T, r = tree.r * T;
  c.fillStyle = '#0c1c3855'; c.beginPath(); c.ellipse(x - r * .22, y + r * .28, r * 1.05, r * .95, 0, 0, Math.PI * 2); c.fill();
  // A soft canopy of many small leaf dabs, lit from the sun's side (upper right).
  const dabs = 46;
  for (let i = 0; i < dabs; i++) {
    const t = i / dabs, angle = hash(seed, i, 20) * Math.PI * 2, far = r * Math.sqrt(hash(seed, i, 21)) * (.98 - t * .25), size = r * (.13 + hash(seed, i, 22) * .1);
    const dx = Math.cos(angle) * far, dy = Math.sin(angle) * far, light = (dx - dy) / (r * 2) + .5 + t * .28;
    c.fillStyle = light > .95 ? '#6f8fd6' : light > .75 ? '#4f6fbe' : light > .5 ? '#3b56a2' : '#2c4188';
    c.beginPath(); c.arc(x + dx, y + dy, size, 0, Math.PI * 2); c.fill();
  }
}
