import { ORBITAL, ORBITAL_PAYLOADS } from './orbital.js';
import { CARRIER } from './carrier.js';
// Deployment catalogue: client-only asset codes, tab order and spec sheets.
// Codes never reach the server or saves; requests keep using each asset's kind.
// Every number below is read from the module that owns it, never copied here.
import { COSTS, FACILITY_HP, ECONOMY, LOCAL_KINDS, quote } from './logistics.js';
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
  ...Object.entries(ORBITAL_PAYLOADS).map(([payload, profile], index) => ({
    code: 'S-0' + (index + 2), tab: 'strike', card: index ? 'orbital-' + payload.toLowerCase() + '-card' : 'orbital-card',
    kind: 'orbitalStrike', payload, name: profile.label, footprint: 'Orbital strike',
    specs: [['Recovery', profile.cooldown + ' s']], placement: 'Choose a target on the map', limit: 'One shared orbital weapon',
  })),
  { code: 'L-01', tab: 'logistics', card: 'factory-card', kind: 'factory', cost: 'factory', hp: 'factory', name: 'Factory', footprint: '2 × 2',
    specs: [['Support', `${CONSTRUCTION.radius} t construction radius`], ['Orders', `${Math.round((1 - ECONOMY.factoryDiscount) * 100)}% cheaper · ${ECONOMY.factoryTime} s build`]] },
  { code: 'L-02', tab: 'logistics', card: 'uplink-card', kind: 'uplink', cost: 'uplink', hp: 'uplink', name: 'Launch station', footprint: '3 × 3',
    specs: [['Role', 'Ships salvage cargo to orbit'], ['Launch', `${ECONOMY.rocketCycle} s cycle / reusable rocket`]] },
  { code: 'L-03', tab: 'logistics', card: 'recycler-card', kind: 'recycler', cost: 'recycler', hp: 'recycler', name: 'Recycler', footprint: '1 × 1 pod',
    specs: [['Drive', 'E board / WASD / park to collect'], ['Cargo', `${ECONOMY.cargo} per trip`], ['Collect', `${ECONOMY.collectTime} s at conquered ruins`]] },
  { code: 'L-04', tab: 'logistics', card: 'builder-card', kind: 'builder', cost: 'builder', hp: 'recycler', name: 'Bridge builder', footprint: '1 x 1 pod', specs: [['Role','E board / WASD drive / plan bank endpoints'],['Bridge','3 tiles wide / cables then rolling deck']], limit:'1 per scout' },
  { code: 'L-05', tab: 'logistics', card: 'outpost-card', kind: 'outpost', cost: 'outpost', hp: 'outpost', name: 'Support outpost', footprint: '2 x 2', specs: [['Support','Shared robot respawn and local construction'],['Receiver','Raw salvage to shared ground supplies']] },
  { code: 'N-01', tab: 'navy', card: 'ship-card', kind: 'vessel', cost: 'ship', name: 'Coastal gunship', footprint: '2 x 4 hull / shipyard berth',
    specs: [['Main guns', `${SHIP.minRange}–${SHIP.range} t · ${SHIP.reload} s per turret`], ['Side guns', `${NAVAL_GUN.range} t · ${degrees(NAVAL_GUN.halfArc * 2)}° arcs`]], limit: '1 per dock' },
  { code: 'N-02', tab: 'navy', card: 'submarine-card', kind: 'vessel', cost: 'submarine', name: 'Missile submarine', footprint: '2 x 4 hull / shipyard berth',
    specs: [['Strike', `${SUBMARINE.count} missiles · ${SUBMARINE.width} × ${SUBMARINE.height} area`], ['Range', `${SUBMARINE.minRange}–${SUBMARINE.range} t`], ['Reload', `${SUBMARINE.reload} s`]], limit: '1 per dock' },
  { code: 'N-03', tab: 'navy', card: 'transport-card', kind: 'vessel', cost: 'transport', name: 'Armored transport', footprint: '2 x 4 hull / shipyard berth', specs: [['Cargo','One tank, recycler or builder'],['Weapons','Bow turret + port/starboard side guns'],['Transfer','Drive onto ramp / K drive off']], limit:'1 per dock' },
  { code:'N-04',tab:'navy',card:'carrier-card',kind: 'vessel',cost:'carrier',name:'Aircraft carrier',footprint:'3 x 5 hull / one flight deck',specs:[['Aircraft','One shared fleet and parking slot'],['Defence','Port/starboard side guns'],['Service',CARRIER.supplies+' GND aboard / refill at dock']],limit:'1 per dock' },
  { code:'N-05',tab:'navy',card:'dock-card',kind:'ship',cost:'shipyard',name:'Empty dock',footprint:'3 x 1 shore / 3 x 5 pier',specs:[['Role','One ship slot; build or exchange separately']],limit:'4 per scout / 8 per campaign' },
  { code: 'A-01', tab: 'air', card: 'airbase-card', kind: 'airbase', cost: 'airbase', hp: 'airbase', name: 'Empty airbase', footprint: `${AIR.width} × ${AIR.height}`,
    specs: [['Role', 'Runway, aircraft parking and service'], ['Aircraft', 'Order separately after construction']] },
  { code: 'A-02', tab: 'air', card: 'attack-jet-card', kind: 'aircraft', aircraftKind: 'attack-jet', cost: 'aircraft', name: 'Attack jet', footprint: 'Existing free runway',
    specs: [['Autocannon', JET.ammo + ' HE rounds'], ['Delivery', 'Select a runway on the map']], placement: 'Your completed, empty airbase or carrier' },
  { code: 'A-03', tab: 'air', card: 'bomber-card', kind: 'aircraft', aircraftKind: 'bomber', cost: 'aircraft', name: 'Bomber', footprint: 'Existing free runway',
    specs: [['Payloads', 'HE / heavy HE / fire / gas'], ['Delivery', 'First bomber free per campaign']], placement: 'Your completed, empty airbase or carrier' },
]);

export const assetsIn = tab => ASSETS.filter(a => a.tab === tab);
export const assetByCard = id => ASSETS.find(a => a.card === id);
export const orbitalPrice = asset => asset.payload ? ORBITAL_PAYLOADS[asset.payload].cost : asset.cost ? quote(asset.cost) : 0;
// Factory orders exist only for these kinds (see deliveryData in app.js and the server).
const FACTORY_KINDS = LOCAL_KINDS;
export const factoryPrice = asset => asset.cost && asset.placement === undefined && FACTORY_KINDS.includes(asset.kind) ? quote(asset.cost, true) : null;

// Rows for the spec sheet; HP and support come from the shared rules.
export function specRows(asset) {
  const rows = [['Footprint', asset.footprint], ...asset.specs];
  if (asset.hp) rows.push(['Durability', `${FACILITY_HP[asset.hp]} HP`]);
  if (asset.limit) rows.push(['Limit', asset.limit]);
  rows.push(['Placement', asset.placement || 'Global orbital; local builds need nearby friendly support']);
  const price = orbitalPrice(asset), local = factoryPrice(asset);
  if(asset.kind==='orbitalStrike')rows.push(['Cost',ORBITAL_PAYLOADS[asset.payload].cost + ' ORB']);
  else if(asset.kind==='vessel')rows.push(['Cost',quote(asset.cost,true)+' GND / 60s at an existing dock']);
  else rows.push(['Cost', price ? `${price} ORB orbital${local ? ` · ${local} GND local` : ''}${asset.costNote ? ` · ${asset.costNote}` : ''}` : 'Free']);
  return rows;
}
