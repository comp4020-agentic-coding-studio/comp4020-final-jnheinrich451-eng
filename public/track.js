// Curve assemblies join two straight approaches with a radius-three quarter arc.
// Their conservative turning apron also covers the rotating 3x3 carriage.
export const CURVES = Object.freeze({ NE: -Math.PI / 2, SE: 0, SW: Math.PI / 2, NW: Math.PI });
export const isCurve = rail => Object.hasOwn(CURVES, rail.shape);
// Compact tiles expose connected edges; old broad curves keep their saved geometry.
export const PORTS = Object.freeze({ EW: 'EW', NS: 'NS', J: 'NESW', CNE: 'NE', CSE: 'SE', CSW: 'SW', CNW: 'NW' });
export const isCompact = rail => typeof rail?.shape === 'string' && (rail.shape === 'J' || rail.shape.startsWith('C')) && !!PORTS[rail.shape];
export const railPorts = rail => PORTS[rail?.shape] || '';
export function joinedShape(old, shape) {
  if (!old || old.shape === shape) return shape;
  if (!railPorts(old) || !PORTS[shape]) return null;
  // Adding track preserves existing exits; a junction only uses connected neighbors.
  const ports = new Set(railPorts(old) + PORTS[shape]);
  return ports.size > 2 ? 'J' : shape;
}
export function curvePoint(rail, t) {
  const angle = CURVES[rail.shape] + t * Math.PI / 2;
  return { x: rail.x + 3 * Math.cos(angle), y: rail.y + 3 * Math.sin(angle), angle };
}
export function curveEnds(rail) {
  return [0, 1].map(t => {
    const p = curvePoint(rail, t), dx = Math.round(-Math.sin(p.angle)), dy = Math.round(Math.cos(p.angle));
    return { x: Math.round(p.x), y: Math.round(p.y), dx, dy, shape: dx ? 'EW' : 'NS' };
  });
}
export function curveBounds(rail) {
  const [a, b] = curveEnds(rail), extent = Math.SQRT2 * 1.5;
  return { minX: Math.floor(Math.min(a.x, b.x) + .5 - extent), maxX: Math.floor(Math.max(a.x, b.x) + .5 + extent),
    minY: Math.floor(Math.min(a.y, b.y) + .5 - extent), maxY: Math.floor(Math.max(a.y, b.y) + .5 + extent) };
}
export const insideBounds = (b, x, y) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
export function curveCells(rail) {
  const b = curveBounds(rail), cells = [];
  for (let y = b.minY; y <= b.maxY; y++) for (let x = b.minX; x <= b.maxX; x++) cells.push({ x, y });
  return cells;
}
