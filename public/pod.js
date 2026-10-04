// Shared footprint for orbital cargo: a square center and four hinged panels.
export const POD = Object.freeze({ impact: 1.35, unfold: 1.75, panelDuration: .85, stagger: .22, exit: 3.65, duration: 4.5 });
export function podCells(x, y, size = 3, length = 4) {
  const cells = [];
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) cells.push({ x: x + dx, y: y + dy, panel: -1, role: 'core' });
  for (let n = 1; n <= length; n++) for (let w = 0; w < size; w++) {
    cells.push({ x: x + w, y: y - n, panel: 0, role: 'floor' });
    cells.push({ x: x + size - 1 + n, y: y + w, panel: 1, role: 'floor' });
    cells.push({ x: x + w, y: y + size - 1 + n, panel: 2, role: 'floor' });
    cells.push({ x: x - n, y: y + w, panel: 3, role: 'floor' });
  }
  return cells;
}
export function podCell(pod, x, y, size = 3) {
  const dx = Math.floor(x) - pod.x, dy = Math.floor(y) - pod.y;
  if (dx >= 0 && dx < size && dy >= 0 && dy < size) return 'core';
  return ((dx >= 0 && dx < size && dy >= -4 && dy < size + 4) || (dy >= 0 && dy < size && dx >= -4 && dx < size + 4)) ? 'floor' : null;
}
