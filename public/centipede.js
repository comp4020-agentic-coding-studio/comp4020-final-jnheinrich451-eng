// One authoritative enemy owns every body segment. Segments have no separate
// health, target identity, navigation jobs or damage callbacks.
export const CENTIPEDE = Object.freeze({ segments: 8, spacing: .75, radius: .42,
  length: 5.25, trailLimit: 128, acquire: 24, retain: 32 });
export const isCentipede = enemy => enemy?.kind === 'centipede';
const point = p => ({ x: p.x, y: p.y });
const valid = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function atDistance(trail, wanted) {
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i], d = distance(a, b);
    if (d > 1e-8 && wanted <= d) return { x: a.x + (b.x - a.x) * wanted / d,
      y: a.y + (b.y - a.y) * wanted / d,
      angle: Math.atan2(a.x - b.x, b.y - a.y) };
    wanted -= d;
  }
  const tail = trail.at(-1), previous = trail.at(-2);
  return { ...tail, angle: previous ? Math.atan2(previous.x - tail.x, tail.y - previous.y) : 0 };
}

function trim(trail) {
  const result = [point(trail[0])]; let remaining = CENTIPEDE.length;
  for (let i = 1; i < trail.length && result.length < CENTIPEDE.trailLimit; i++) {
    const a = result.at(-1), b = trail[i], d = distance(a, b);
    if (d < 1e-8) continue;
    if (d >= remaining) { result.push({ x: a.x + (b.x - a.x) * remaining / d, y: a.y + (b.y - a.y) * remaining / d }); break; }
    result.push(point(b)); remaining -= d;
  }
  return result;
}

function sample(enemy) {
  enemy.body = Array.from({ length: CENTIPEDE.segments }, (_, i) => atDistance(enemy.bodyTrail, i * CENTIPEDE.spacing));
  enemy.body[0].angle = enemy.angle || 0;
  return enemy.body;
}

// A spawning caller supplies a clear, head-to-tail corridor. An absent/invalid
// legacy trail unfolds from the actual head as it moves, never through a wall.
export function initializeCentipedeBody(enemy, trail = [], clear = (x, y) => true) {
  if (!isCentipede(enemy)) return [];
  const source = [point(enemy), ...trail.filter(valid).map(point)], accepted = [point(enemy)];
  let remaining = CENTIPEDE.length;
  outer: for (let i = 1; i < source.length && accepted.length < CENTIPEDE.trailLimit; i++) {
    const a = accepted.at(-1), next = source[i], d = distance(a, next);
    if (d < 1e-8) continue;
    const length = Math.min(d, remaining), b = { x: a.x + (next.x - a.x) * length / d, y: a.y + (next.y - a.y) * length / d };
    const steps = Math.max(1, Math.ceil(length / .2));
    for (let n = 1; n <= steps; n++) if (!clear(a.x + (b.x - a.x) * n / steps, a.y + (b.y - a.y) * n / steps)) break outer;
    accepted.push(b); remaining -= length;
    if (remaining < 1e-8) break;
  }
  enemy.bodyTrail = trim(accepted);
  return sample(enemy);
}

// Call after each accepted movement substep. Collinear history is merged
// exactly; bends remain actual travelled corners, rather than a tail shortcut.
// A rejected movement restores the previous head without changing the trail.
export function advanceCentipedeBody(enemy, previousHead, clear = (x, y) => true) {
  if (!isCentipede(enemy)) return true;
  if (!enemy.bodyTrail?.length) {
    const next = point(enemy); Object.assign(enemy, point(previousHead));
    initializeCentipedeBody(enemy); Object.assign(enemy, next);
  }
  const travelled = distance(enemy, previousHead);
  if (travelled < 1e-8) return true;
  const steps = Math.max(1, Math.ceil(travelled / .2));
  for (let n = 1; n <= steps; n++) if (!clear(previousHead.x + (enemy.x - previousHead.x) * n / steps,
    previousHead.y + (enemy.y - previousHead.y) * n / steps)) {
    Object.assign(enemy, point(previousHead)); return false;
  }
  const trail = [point(enemy), ...enemy.bodyTrail.map(point)];
  if (distance(trail[1], previousHead) > 1e-6) trail.splice(1, 0, point(previousHead));
  while (trail.length > 2) {
    const [a, b, c] = trail, ab = distance(a, b), bc = distance(b, c);
    if (Math.abs(ab + bc - distance(a, c)) > 1e-8) break;
    trail.splice(1, 1);
  }
  const shortened = trim(trail);
  const body = Array.from({ length: CENTIPEDE.segments }, (_, i) => atDistance(shortened, i * CENTIPEDE.spacing));
  if (body.some(p => !clear(p.x, p.y))) { Object.assign(enemy, point(previousHead)); return false; }
  enemy.bodyTrail = shortened; sample(enemy); return true;
}

// Ordinary enemies retain center-based blast falloff. Large bodies use their
// nearest armored surface; callers still apply one damage result per enemy ID.
export function enemyDistance(enemy, p) {
  if (!isCentipede(enemy)) return distance(enemy, p);
  return Math.max(0, Math.min(...(enemy.body?.length ? enemy.body : [enemy]).slice(0, CENTIPEDE.segments)
    .map(part => distance(part, p))) - CENTIPEDE.radius);
}

export function enemyHitCircles(enemy, radius = .38) {
  if (!isCentipede(enemy)) return [{ x: enemy.x, y: enemy.y, radius }];
  // A wider caller ray (flame) adds its width, keeping legacy .38 as zero-width.
  return (enemy.body?.length ? enemy.body : [enemy]).slice(0, CENTIPEDE.segments)
    .map(part => ({ x: part.x, y: part.y, radius: CENTIPEDE.radius + Math.max(0, radius - .38) }));
}

// Occupancy consumers receive every occupied body position without multiplying
// actual enemies in the authoritative combat or population arrays.
export function enemyOccupants(enemies) {
  return enemies.flatMap(enemy => {
    if (!isCentipede(enemy)) return [enemy];
    const { body, bodyTrail, ...record } = enemy;
    return (body?.length ? body : [enemy]).slice(0, CENTIPEDE.segments)
      .map(part => ({ ...record, x: part.x, y: part.y }));
  });
}
