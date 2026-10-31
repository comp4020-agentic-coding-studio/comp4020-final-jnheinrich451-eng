// A separate, deterministic new-campaign template. Never repaint saved planets.
// Loose sand seas retain the naval terrain class; firm plateaus are ground.
// Oasis water is genuinely inland water, so ships cannot enter its small lakes.
export const SIROCCO_SEED = 7311026;
const hash = (x, y) => {
  let n = Math.imul(x + SIROCCO_SEED, 374761393) ^ Math.imul(y - SIROCCO_SEED, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return (n ^ n >>> 16) >>> 0;
};

export function createSirocco() {
  const width = 512, height = 384, terrain = Array(width * height).fill(0),
    mountains = Array(width * height).fill(0), waterKinds = Array(width * height).fill(1);
  const plateaus = [[128, 94, 100, 70], [384, 94, 100, 70], [128, 290, 100, 70], [384, 290, 100, 70]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let edge = Infinity;
    for (const [cx, cy, rx, ry] of plateaus) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, angle = Math.atan2(dy, dx);
      // Broad interiors fit bases and cities; shallow erosion keeps readable coasts.
      edge = Math.min(edge, (dx ** 4 + dy ** 4) ** .25 - 1 - .025 * Math.sin(angle * 5) - .012 * Math.cos(angle * 9));
    }
    if (edge >= 0) continue;
    const i = y * width + x;
    terrain[i] = edge > -.075 || Math.sin(x * .038 + y * .026) > .87 ? 1 : 2;
    waterKinds[i] = 0;
  }
  const ellipse = (cx, cy, rx, ry, paint) => {
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(height - 1, cy + ry); y++)
      for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(width - 1, cx + rx); x++)
        if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) paint(y * width + x, x, y);
  };
  // Broken mesa chains leave wide gaps; cosmetic dunes do not alter collision.
  for (const [cx, cy] of [[128, 94], [384, 94], [128, 290], [384, 290]]) {
    for (const [dx, dy, rx, ry] of [[-65, -28, 12, 7], [48, -32, 17, 6], [64, 12, 9, 15]])
      ellipse(cx + dx, cy + dy, rx, ry, (i, x, y) => {
        if (waterKinds[i] === 0) { terrain[i] = 3; mountains[i] = 1 + hash(x >> 2, y >> 2) % 3; }
      });
  }
  for (const [cx, cy] of [[112, 65], [400, 65], [112, 319], [400, 319]]) {
    // A broad firm collar supports oasis palms and readable lake access.
    ellipse(cx, cy, 18, 14, i => { terrain[i] = 2; waterKinds[i] = 0; mountains[i] = 0; });
    ellipse(cx, cy, 12, 8, i => { terrain[i] = 0; waterKinds[i] = 3; mountains[i] = 0; });
  }
  const anchors = [[112, 128], [400, 128], [112, 256], [400, 256]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    // Sparse rocks only: open corridors are important to the siege centipede.
    if (terrain[i] === 2 && hash(x, y) % 491 === 0 && anchors.every(([ax, ay]) => Math.hypot(x - ax, y - ay) > 30)) terrain[i] = 3;
  }
  for (const [cx, cy] of anchors)
    for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 24; x <= cx + 24; x++) {
      const i = y * width + x; terrain[i] = 2; waterKinds[i] = 0; mountains[i] = 0;
    }
  // Four authored sandport shores face the same broad central sea. Reserve the
  // full large pier, side berth and swept carrier departure, not just one cell.
  for (const cx of [112, 400]) for (const north of [true, false]) {
    for (let y = north ? 147 : 192; y <= (north ? 192 : 237); y++) for (let x = cx - 40; x <= cx + 40; x++) {
      const i = y * width + x, land = north ? y <= 164 : y >= 220;
      terrain[i] = land ? (north ? y > 160 : y < 224) ? 1 : 2 : 0;
      waterKinds[i] = land ? 0 : 1; mountains[i] = 0;
    }
  }
  // A useful heavy-bridge strait between the western plateaus: firm five-wide
  // banks at (200,180)/(200,221), with 40 naval rows below the eventual deck.
  // Tapering promontories keep the central shipping lane broad and leave all
  // four sandport approaches untouched. Nothing here joins the island budgets.
  for (const north of [true, false]) {
    for (let y = north ? 145 : 221; y <= (north ? 180 : 239); y++) {
      const distance = north ? 180 - y : y - 221, half = 4 + Math.floor(15 * distance / (north ? 35 : 18));
      for (let x = 200 - half; x <= 200 + half; x++) {
        const i = y * width + x;
        terrain[i] = 1; waterKinds[i] = 0; mountains[i] = 0;
      }
    }
  }
  return { version: 3, id: 'sirocco-01', template: 'sirocco-v1', name: 'Sirocco', designation: 'SRC / 03',
    seed: SIROCCO_SEED, width, height, terrain, mountains, waterKinds,
    spawn: { x: 112.5, y: 128.5 }, orbitalOrigin: { x: 112, y: 128 },
    fronts: [{ id: 'landing', label: 'Sirocco landing', x: 112, y: 128 },
      { id: 'mesa', label: 'Crown of glass', x: 400, y: 128 }, { id: 'oasis', label: 'Southern oasis', x: 112, y: 256 }],
    regions: [{ id: 'landing', label: 'Sirocco / western shelf', x: 112, y: 128 },
      { id: 'aurora', label: 'Sunspire / eastern shelf', x: 400, y: 128 },
      { id: 'haven', label: 'Mirage basin / southern oasis', x: 112, y: 256 },
      { id: 'meridian', label: 'Ember reach / southern mesa', x: 400, y: 256 },
      { id: 'lake', label: 'Glasswater / oasis lake', x: 112, y: 65 },
      { id: 'ocean', label: 'The flowing sands / navigable sand sea', x: 256, y: 192 }] };
}
