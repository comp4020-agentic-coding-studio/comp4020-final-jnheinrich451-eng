// Optional guidance derived from the snapshot. It never gates play and finishing a
// step grants nothing: the server's saved objective roster alone decides conquest.
import { landingLog } from './hud.js';
import { settlements } from './settlement.js';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const centre = site => ({ x: site.x + 1.5, y: site.y + 1.5 });

export function compassBearing(from, to) {
  const angle = Math.atan2(to.x - from.x, -(to.y - from.y)), turn = (angle + Math.PI * 2) % (Math.PI * 2);
  return COMPASS[Math.round(turn / (Math.PI / 4)) % 8];
}
// A compound, or a site outside one, is a single front on the planet.
export function planetFronts(sites = []) {
  const groups = settlements(sites), members = new Set(groups.flatMap(group => group.requiredIds));
  const lone = sites.filter(site => !members.has(site.id));
  return { total: groups.length + lone.length,
    cleared: groups.filter(group => group.state === 'conquered').length + lone.filter(site => site.state === 'conquered').length };
}
export function nearestHostile(sites = [], point) {
  let best = null, distance = Infinity;
  if (point) for (const site of sites) {
    if (site.state !== 'hostile') continue;
    const c = centre(site), d = Math.hypot(c.x - point.x, c.y - point.y);
    if (d < distance) { best = site; distance = d; }
  }
  return best && { site: best, distance, bearing: compassBearing(point, centre(best)) };
}
/** @param {{ world?: any, buildings?: any[], me?: any, located?: any, conquest?: any }} input */
export function missionGuide({ world, buildings = [], me, located, conquest }) {
  const sites = world?.sites || [], fronts = planetFronts(sites), [core, sentry, locate] = landingLog({ world, buildings, me, located });
  const steps = [
    { ...core, doing: 'Land your core' }, { ...sentry, label: 'Sentry placed', doing: 'Place a sentry' }, { ...locate, label: 'Hostile site located', doing: 'Locate a hostile site' },
    { id: 'site', label: 'Hostile site destroyed', doing: 'Destroy a hostile site', done: sites.some(site => site.state === 'conquered') },
    { id: 'compound', label: 'Compound cleared', doing: 'Clear a whole compound', done: settlements(sites).some(group => group.state === 'conquered') },
    { id: 'planet', label: 'Planet conquered', doing: 'Conquer the planet', done: conquest?.state === 'conquered' },
  ];
  // Guidance is never compulsory, so progress past a step also settles it.
  const furthest = steps.findLastIndex(step => step.done);
  steps.forEach((step, index) => { step.done = index <= furthest; });
  const current = steps.find(step => !step.done) || null, target = nearestHostile(sites, me);
  let text = current?.doing || (conquest?.survivors ? `Clear the last ${conquest.survivors}` : 'All threats cleared');
  if (target && ['site', 'compound', 'planet'].includes(current?.id))
    text = `Destroy ${target.site.name || 'the nearest site'} · ${Math.round(target.distance)} t ${target.bearing}`;
  return { steps, current, text, fronts, target };
}
