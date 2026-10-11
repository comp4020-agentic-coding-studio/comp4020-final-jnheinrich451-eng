export const CONTAMINATOR = Object.freeze({ hp: 600, guards: 3, radius: 16, region: 18, recovery: 8000 });

// Simulation time only: pausing, disconnecting and reduced effects cannot clear fog.
export function fogRadius(site, time) {
  if (site.kind !== 'contaminator') return 0;
  return CONTAMINATOR.radius * (site.state === 'hostile' ? 1
    : Math.max(0, 1 - Math.max(0, time - (site.conqueredAt || 0)) / CONTAMINATOR.recovery));
}
export function concealed(sites, point, time) {
  return !!point && sites.some(s => {
    const r = fogRadius(s, time);
    return r > 0 && Math.hypot(point.x - s.x - 1.5, point.y - s.y - 1.5) <= r;
  });
}
