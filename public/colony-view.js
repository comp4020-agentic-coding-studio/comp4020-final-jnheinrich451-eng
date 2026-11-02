// Fixed orthographic camera. Simulation and saved coordinates remain ground tiles.
export const COLONY_VIEW_ANGLE = 55 * Math.PI / 180;
export const COLONY_DEPTH = Math.sin(COLONY_VIEW_ANGLE);
export const COLONY_HEIGHT = Math.cos(COLONY_VIEW_ANGLE);

export const projectColonyPoint = (x, y, z = 0) => ({ x, y: y * COLONY_DEPTH - z * COLONY_HEIGHT });

export function colonyWorldToScreen(point, camera, width, height) {
  const p = projectColonyPoint(point.x - camera.x, point.y - camera.y, point.z || 0);
  return { x: width / 2 + p.x * camera.tile, y: height / 2 + p.y * camera.tile };
}

// Pointer selections resolve onto the ground, never onto an illustrated roof.
export function colonyScreenToWorld(x, y, camera, width, height) {
  return { x: camera.x + (x - width / 2) / camera.tile,
    y: camera.y + (y - height / 2) / (camera.tile * COLONY_DEPTH) };
}

export const colonyScreenDelta = (dx, dy, camera) => ({ x: dx / camera.tile, y: dy / (camera.tile * COLONY_DEPTH) });

export function colonyVisibleBounds(camera, width, height, padding = 3) {
  const near = colonyScreenToWorld(0, 0, camera, width, height);
  const far = colonyScreenToWorld(width, height, camera, width, height);
  return { left: Math.floor(near.x) - padding, right: Math.ceil(far.x) + padding,
    top: Math.floor(near.y) - padding, bottom: Math.ceil(far.y) + padding };
}
