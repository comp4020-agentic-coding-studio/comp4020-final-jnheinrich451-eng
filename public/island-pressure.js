// Geography is independent of walkability: inland water and mountain chains are
// part of their continent. Constructed floors, rails and bridges never join it.
// Keep the index outside saved worlds and share it across shallow combat views.
const geometryIndexes = new WeakMap();
function buildIndex(world) {
  const { width, height, terrain, waterKinds } = world, size = width * height;
  const labels = new Uint32Array(size), queue = new Uint32Array(size);
  const ocean = i => waterKinds?.[i] === 1 || terrain[i] === 0 && waterKinds?.[i] !== 2 && waterKinds?.[i] !== 3;
  for (let start = 0; start < size; start++) {
    if (labels[start] || ocean(start)) continue;
    // Scanning row by row makes this component's first cell its stable ID.
    const label = start + 1;
    let head = 0, tail = 0;
    queue[tail++] = start; labels[start] = label;
    const visit = i => {
      if (!labels[i] && !ocean(i)) { labels[i] = label; queue[tail++] = i; }
    };
    while (head < tail) {
      const i = queue[head++], x = i % width;
      if (x) visit(i - 1);
      if (x + 1 < width) visit(i + 1);
      if (i >= width) visit(i - width);
      if (i + width < size) visit(i + width);
    }
  }
  return labels;
}
function indexFor(world) {
  let entry = geometryIndexes.get(world.terrain);
  if (!entry) { entry = { plain: new Map(), masks: new WeakMap() }; geometryIndexes.set(world.terrain, entry); }
  let versions = entry.plain;
  if (world.waterKinds) {
    versions = entry.masks.get(world.waterKinds);
    if (!versions) { versions = new Map(); entry.masks.set(world.waterKinds, versions); }
  }
  const key = world.width + ':' + world.height;
  let index = versions.get(key);
  if (!index) { index = buildIndex(world); versions.set(key, index); }
  return index;
}

export function islandAt(world, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= world.width || y >= world.height) return null;
  const label = indexFor(world)[Math.floor(y) * world.width + Math.floor(x)];
  return label ? 'island:' + (label - 1) : null;
}

export function islandMultiplier(count) {
  const players = Number.isFinite(count) ? Math.max(0, Math.min(4, Math.floor(count))) : 0;
  return players ? (10 + 7 * (players - 1)) / 10 : 0;
}

// Call with raidContacts: upstream has already excluded dead, shielded, orbital
// and submerged players and resolved each occupied vehicle's physical location.
export function islandContacts(world, contacts) {
  const groups = new Map(), seen = new Set();
  for (const contact of contacts) {
    if (contact.id == null || seen.has(contact.id)) continue;
    seen.add(contact.id);
    if (contact.medium !== 'ground' && contact.medium !== 'air') continue;
    const id = islandAt(world, contact.x, contact.y);
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(contact);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([id, members]) => ({
    id, contacts: members.sort((a, b) => String(a.id).localeCompare(String(b.id))), multiplier: islandMultiplier(members.length),
  }));
}
