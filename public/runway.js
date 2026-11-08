// Saved runway geometry, as dockScale is for docks. A base built before the second strip
// has neither field and keeps its single 6 x 10 runway.
export const RUNWAY = Object.freeze({ width: 6, length: 10 });
export const doubleRunway = b => b?.runways === 2;
export function runwaySize(b) {
  const length = RUNWAY.length * (doubleRunway(b) ? 2 : 1);
  return b?.turned ? { width: length, height: RUNWAY.width } : { width: RUNWAY.width, height: length };
}
// A strip's own point, x across it and y along it, on the map. A turned base lies with
// the strip's north end to the west, so its saved angle still points down the strip.
export const runwayPoint = (b, x, y) => b?.turned ? { x: b.x + y, y: b.y + RUNWAY.width - x } : { x: b.x + x, y: b.y + y };
export const runwayLayout = b => ({ ...(doubleRunway(b) ? { runways: 2 } : {}), ...(b?.turned ? { turned: true, angle: -Math.PI / 2 } : {}) });
// The second strip gives a visitor somewhere to land. It is a field, like a carrier's
// second deck, and never a production slot: one base still supplies one aircraft.
export const spareRunway = b => ({ ...b, id: b.id + ':2', parent: b.id, spare: true, runways: 1, aircraft: undefined, ...(b.turned ? { x: b.x + RUNWAY.length } : { y: b.y + RUNWAY.length }) });
export const runwayStrips = b => doubleRunway(b) ? [b, spareRunway(b)] : [b];
// Called per tile by ground collision, so it allocates nothing.
export function hangarAt(b, x, y) {
  const dx = x - b.x, dy = y - b.y, along = b.turned ? dx : dy;
  const lane = b.turned ? dy >= 0 && dy < 2 : dx >= 4 && dx < 6;
  const strip = doubleRunway(b) && along >= RUNWAY.length ? along - RUNWAY.length : along;
  return lane && strip >= 1 && strip < 4;
}
// One shared damage box: a blast between the two hangars hits the base once.
export function hangarBox(b) {
  const long = doubleRunway(b) ? RUNWAY.length + 3 : 3, middle = runwayPoint(b, 5, doubleRunway(b) ? 7.5 : 2.5);
  return { ...middle, w: b.turned ? long : 2, h: b.turned ? 2 : long };
}
