// Orthographic globe projection. This changes the overview, never travel rules.
const TAU = 2 * Math.PI;
export const longitude = (x, width) => x / width * TAU - Math.PI;
export const latitude = (y, height) => Math.PI / 2 - y / height * Math.PI;
export function projectPoint(x, y, width, height, lon0, lat0) {
  const lat = latitude(y, height), d = longitude(x, width) - lon0;
  return { x: Math.cos(lat) * Math.sin(d),
    y: Math.sin(lat) * Math.cos(lat0) - Math.cos(lat) * Math.cos(d) * Math.sin(lat0),
    z: Math.sin(lat) * Math.sin(lat0) + Math.cos(lat) * Math.cos(d) * Math.cos(lat0) };
}
export function surfacePoint(nx, ny, width, height, lon0, lat0) {
  const radius = nx * nx + ny * ny;
  if (radius > 1) return null;
  const z = Math.sqrt(1 - radius), lat = Math.asin(Math.max(-1, Math.min(1, ny * Math.cos(lat0) + z * Math.sin(lat0))));
  const lon = lon0 + Math.atan2(nx, z * Math.cos(lat0) - ny * Math.sin(lat0));
  return { x: ((lon + Math.PI) / TAU % 1 + 1) % 1 * width,
    y: Math.min(height - 1e-8, Math.max(0, (.5 - lat / Math.PI) * height)) };
}
