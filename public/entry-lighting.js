// Cosmetic sky model. +Z faces the camera; a negative-Z sun backlights planets.
const TAU = Math.PI * 2;
const clamp = (v, low = 0, high = 1) => Math.max(low, Math.min(high, v));

export function entrySun(elapsed = 0) {
  const angle = -0.42 + elapsed / 240000 * TAU;
  const x = Math.cos(angle), y = -.32 * Math.cos(angle) + .18 * Math.sin(angle), z = Math.sin(angle);
  const length = Math.hypot(x, y, z);
  const direction = { x: x / length, y: y / length, z: z / length };
  // A sun on the camera's side still lights the globe but is outside the view.
  const visible = 1 - clamp((direction.z + .04) / .34);
  return { ...direction, visible, pulse: .985 + .015 * Math.sin(elapsed * .0008), angle };
}

export function entrySurfaceLight(nx, ny, nz, sun) {
  const diffuse = Math.max(0, nx * sun.x + ny * sun.y + nz * sun.z);
  const limb = Math.pow(1 - nz, 5) * Math.max(0, nx * sun.x + ny * sun.y);
  return { brightness: .022 + Math.pow(diffuse, .83) * 1.12, rim: limb * (1 - .35 * Math.max(0, sun.z)) };
}
