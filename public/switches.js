import { curveBounds, curveEnds, insideBounds, isCurve } from './track.js';
import { gunCells } from './footprints.js';

export const switchAt = (world, rail) => world.switches?.find(s => s.x === rail.x && s.y === rail.y);
export function switchLocked(world, rail) {
  const bounds = curveBounds(rail);
  return (world.artillery || []).some(g => gunCells(g).some(p => insideBounds(bounds, p.x, p.y)));
}
export function switchConnectionError(world, rail, route) {
  if (!rail || !isCurve(rail)) return 'Select a broad curve to make a junction.';
  if (!['curve', 'straight'].includes(route)) return 'Choose the straight or curved route.';
  const [a, b] = curveEnds(rail);
  const centers = route === 'curve' ? [a, b] : [a, { ...a, x: a.x + a.dx, y: a.y + a.dy }];
  for (const p of centers) for (const offset of [-1, 0, 1]) {
    const x = p.x + (p.shape === 'EW' ? offset : 0), y = p.y + (p.shape === 'NS' ? offset : 0);
    if (!world.rails.some(r => r.x === x && r.y === y && r.shape === p.shape)) return `Connect three ${p.shape} support tiles centered at ${p.x}:${p.y} for this route.`;
  }
  return null;
}
// Reject entry from the disconnected leg; never silently run through closed points.
export function switchEntryError(world, gun, dx, dy) {
  for (const rail of world.rails || []) if (isCurve(rail)) {
    const state = switchAt(world, rail); if (!state) continue;
    const [a, b] = curveEnds(rail);
    if (state.route === 'straight' && gun.x === b.x && gun.y === b.y && dx === -b.dx && dy === -b.dy) return 'Junction is set straight. Select the curved route before entering from the branch.';
    if (state.route === 'curve' && gun.x === a.x + a.dx && gun.y === a.y + a.dy && dx === -a.dx && dy === -a.dy) return 'Junction is set curved. Select straight before entering from that leg.';
  }
  return null;
}
