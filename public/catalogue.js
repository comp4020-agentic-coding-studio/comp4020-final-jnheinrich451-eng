// Deployment catalogue: client-only asset codes, tab order and spec sheets.
// Codes never reach the server or saves; requests keep using each asset's kind.
// Every number below is read from the module that owns it, never copied here.
import { COSTS, FACILITY_HP, ECONOMY, quote } from './logistics.js';
import { CONSTRUCTION, needsConstruction } from './construction.js';
import { HE, APCR, HEAVY_FLAME, MAGNETIC, ARTILLERY_HE } from './weapons.js';
import { MISSILE } from './missile.js';
import { SHIP } from './ship.js';
import { NAVAL_GUN } from './ship-armament.js';
import { SUBMARINE } from './submarine.js';
import { AIR } from './aircraft.js';
import { JET } from './attack-jet.js';
import { CORE } from './core.js';
import { SENTRY_TURRET } from './turret.js';

export const TABS = Object.freeze([
  { id: 'ground', label: 'Ground' }, { id: 'rail', label: 'Rail' }, { id: 'strike', label: 'Strike' },
  { id: 'logistics', label: 'Logistics' }, { id: 'navy', label: 'Naval' }, { id: 'air', label: 'Air' },
]);

const degrees = radians => Math.round(radians * 180 / Math.PI);

// Order inside a tab is fixed by the code number; it also gives the 1-9 hotkey.
// Codes are never reused or renumbered. New assets take the next free number.
export const ASSETS = Object.freeze([
  { code: 'G-01', tab: 'ground', card: 'sentry-card', kind: 'sentry', cost: 'sentry', hp: 'sentry', name: 'APCR sentry', footprint: '1 × 1 tile',
    specs: [['Weapon', `APCR ${APCR.range} t or heavy fuel ${HEAVY_FLAME.range} t`], ['Traverse', `${degrees(SENTRY_TURRET.speed)}°/s, fires when aligned`]] },
  { code: 'G-02', tab: 'ground', card: 'core-card', kind: 'core', cost: 'core', hp: 'core', name: 'Orbital core', footprint: '57-cell cross',
    specs: [['Delivers', 'Robot · core sentry · flooring'], ['Support', `${CONSTRUCTION.radius} t construction radius`]], limit: `1 per scout · ${CORE.max} per world`, costNote: 'first landing free' },
  { code: 'G-03', tab: 'ground', card: 'tank-card', kind: 'tank', cost: 'tank', name: 'Tank drop pod', footprint: '17-cell cross',
    specs: [['Cannon', `HE ${HE.range} t or magnetic ${MAGNETIC.range} t`], ['Secondary', `APCR ${APCR.range} t or fuel ${HEAVY_FLAME.range} t`]], limit: '1 per scout' },
  { code: 'R-01', tab: 'rail', card: 'rail-card', kind: 'rail', name: 'Rail track', footprint: '1 tile · corners · junctions',
    specs: [['Corridor', '3 tiles wide'], ['Lay', '1 or 5 tiles per order']] },
  { code: 'R-02', tab: 'rail', card: 'artillery-card', kind: 'artillery', cost: 'artillery', hp: 'artillery', name: 'Railway cannon', footprint: '3 × 3 on track',
    specs: [['Range', `${ARTILLERY_HE.minRange}–${ARTILLERY_HE.range} t`], ['Shells', 'HE · Fire · Gas'], ['Reload', `${ARTILLERY_HE.cooldown / 1000} s`]] },
  { code: 'S-01', tab: 'strike', card: 'missile-card', kind: 'missile', cost: 'missile', hp: 'missile', name: 'Missile battery', footprint: `${MISSILE.size} × ${MISSILE.size} fixed`,
    specs: [['Strike', `${MISSILE.count} missiles · ${MISSILE.width} × ${MISSILE.height} area`], ['Range', `${MISSILE.minRange}–${MISSILE.range} t`], ['Reload', `${MISSILE.reload} s after last launch`]] },
  { code: 'L-01', tab: 'logistics', card: 'factory-card', kind: 'factory', cost: 'factory', hp: 'factory', name: 'Factory', footprint: '2 × 2',
    specs: [['Support', `${CONSTRUCTION.radius} t construction radius`], ['Orders', `${Math.round((1 - ECONOMY.factoryDiscount) * 100)}% cheaper · ${ECONOMY.factoryTime} s build`]] },
  { code: 'L-02', tab: 'logistics', card: 'uplink-card', kind: 'uplink', cost: 'uplink', hp: 'uplink', name: 'Launch station', footprint: '3 × 3',
    specs: [['Role', 'Ships salvage cargo to orbit'], ['Launch', `${ECONOMY.launchTime} s`]] },
  { code: 'L-03', tab: 'logistics', card: 'recycler-card', kind: 'recycler', cost: 'recycler', hp: 'recycler', name: 'Recycler', footprint: '1 × 1 pod',
    specs: [['Cargo', `${ECONOMY.cargo} per trip`], ['Collect', `${ECONOMY.collectTime} s at conquered ruins`]] },
  { code: 'N-01', tab: 'navy', card: 'ship-card', kind: 'ship', cost: 'ship', name: 'Coastal gunship', footprint: 'Shore 3 × 1 · dock 3 × 5',
    specs: [['Main guns', `${SHIP.minRange}–${SHIP.range} t · ${SHIP.reload} s per turret`], ['Side guns', `${NAVAL_GUN.range} t · ${degrees(NAVAL_GUN.halfArc * 2)}° arcs`]], limit: '1 per scout' },
  { code: 'N-02', tab: 'navy', card: 'submarine-card', kind: 'ship', cost: 'submarine', name: 'Missile submarine', footprint: 'Shore 3 × 1 · dock 3 × 5',
    specs: [['Strike', `${SUBMARINE.count} missiles · ${SUBMARINE.width} × ${SUBMARINE.height} area`], ['Range', `${SUBMARINE.minRange}–${SUBMARINE.range} t`], ['Reload', `${SUBMARINE.reload} s`]], limit: '1 per scout' },
  { code: 'A-01', tab: 'air', card: 'airbase-card', kind: 'airbase', cost: 'airbase', hp: 'airbase', name: 'Airbase + bomber', footprint: `${AIR.width} × ${AIR.height}`,
    specs: [['Bomber', `${AIR.count} HE × ${AIR.runs} runs`], ['Speed', `${AIR.minSpeed}–${AIR.maxSpeed} t/s`], ['Rearm', `${AIR.rearm} s`]] },
  { code: 'A-02', tab: 'air', card: 'attack-jet-card', kind: 'airbase', cost: 'aircraft', name: 'Orbital attack jet', footprint: 'Delivered to an airbase',
    specs: [['Autocannon', `${JET.ammo} HE rounds · ${JET.range} t`], ['Delivery', `Exchange at your base, or new airbase ${COSTS.airbase} SUP`]], placement: 'Your airbase, or a new airbase site' },
]);

export const assetsIn = tab => ASSETS.filter(a => a.tab === tab);
export const assetByCard = id => ASSETS.find(a => a.card === id);
export const orbitalPrice = asset => asset.cost ? quote(asset.cost) : 0;
// Factory orders exist only for these kinds (see deliveryData in app.js and the server).
const FACTORY_KINDS = ['airbase', 'ship', 'artillery', 'missile'];
export const factoryPrice = asset => asset.cost && asset.placement === undefined && FACTORY_KINDS.includes(asset.kind) ? quote(asset.cost, true) : null;

// Rows for the spec sheet; HP and support come from the shared rules.
export function specRows(asset) {
  const rows = [['Footprint', asset.footprint], ...asset.specs];
  if (asset.hp) rows.push(['Durability', `${FACILITY_HP[asset.hp]} HP`]);
  if (asset.limit) rows.push(['Limit', asset.limit]);
  rows.push(['Placement', asset.placement || (needsConstruction(asset.kind) ? `Within ${CONSTRUCTION.radius} t of a completed core or factory` : 'Any clear site')]);
  const price = orbitalPrice(asset), local = factoryPrice(asset);
  rows.push(['Cost', price ? `${price} SUP orbital${local ? ` · ${local} SUP at a factory` : ''}${asset.costNote ? ` · ${asset.costNote}` : ''}` : 'Free']);
  return rows;
}
