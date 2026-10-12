// Presentation-only HUD state. Everything here is derived from the snapshot the
// browser already holds; the server stays authoritative for every placement.
import { tileAt } from './world.js';
import { podCells } from './pod.js';
import { sectorRadius } from './sector-defense.js';

// One state at a time, most specific first. `key` drives CSS and the banner.
/** @param {{ me: any, mode?: string, deploymentKind?: string, gun?: string, ship?: string, aircraft?: string, placingLabel?: string }} state */
export function hudState({ me, mode, deploymentKind, gun, ship, aircraft, placingLabel }) {
  if (!me) return { key: 'connecting', label: 'CONNECTING' };
  if (me.body === 'orbital') return { key: 'orbit', label: 'ORBIT · NO GROUND BODY' };
  if (me.deploying) return { key: 'descent', label: 'ORBITAL DESCENT' };
  if (me.life && me.life !== 'active') return { key: 'disabled', label: me.life === 'arriving' ? 'RECOVERY · LANDING' : 'ROBOT DISABLED · RECOVERY' };
  if (aircraft) return { key: 'aircraft', label: `AIRBORNE · ${aircraft}` };
  if (ship) return { key: 'ship', label: `AT SEA · ${ship}` };
  if (gun) return { key: 'facility', label: `OPERATING · ${gun}` };
  if (me.body === 'rover') return { key: 'vehicle', label: 'IN TANK · CREW' };
  if (mode === 'build') return { key: 'placing', label: `PLACING · ${placingLabel || deploymentKind || 'ASSET'}`.toUpperCase() };
  return { key: 'ground', label: 'ON FOOT · ROBOT' };
}

// Measured facts about an orbital core footprint whose top-left centre block is x, y.
export function coreSiteAnalysis(world, x, y) {
  const cells = podCells(x, y), counts = [0, 0, 0, 0, 0];
  let inside = true;
  for (const c of cells) {
    if (c.x < 0 || c.y < 0 || c.x >= world.width || c.y >= world.height) { inside = false; continue; }
    counts[tileAt(world, c.x, c.y)]++;
  }
  const cx = x + 1.5, cy = y + 1.5;
  let nearest = null, territory = null;
  for (const site of world.sites || []) {
    if (site.state !== 'hostile') continue;
    const d = Math.hypot(site.x + 1.5 - cx, site.y + 1.5 - cy);
    if (!nearest || d < nearest.distance) nearest = { distance: d, kind: site.kind, name: site.name };
    if (d <= sectorRadius(site) && (!territory || d < territory.distance)) territory = { distance: d, kind: site.kind };
  }
  return { cells: cells.length, inside, water: counts[0], sand: counts[1], grass: counts[2], rock: counts[3], floor: counts[4], nearest, territory };
}

// Orbital landing steps: survey -> select a valid site -> confirm the drop.
export function orbitStep({ error, pending }) {
  if (pending) return 3;
  return error ? 2 : 3;
}

// First-landing log items, each ticked from world state or this visit's actions.
export function landingLog({ world, buildings, me, located }) {
  return [
    { id: 'core', label: 'Core landed', done: !!world?.cores?.some(c => c.owner === me?.id) },
    { id: 'sentry', label: 'Place a sentry', key: 'B', done: buildings.some(b => b.owner === me?.id && !b.coreId) },
    { id: 'locate', label: 'Locate a hostile site', key: 'O', done: !!located },
  ];
}
