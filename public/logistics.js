// All balance values for the first conquest economy live here. Server-owned;
// clients use the same quotes for presentation, never to grant resources.
export const ECONOMY = Object.freeze({ initial: 1200, reserve: 250, capacity: 2000, income: 2,
  emergencyCooldown: 20, salvage: 180, cargo: 180, collectTime: 8, launchTime: 5,
  factoryDiscount: .6, factoryTime: 20, maxFacilities: 12, maxRecyclers: 4 });
export const COSTS = Object.freeze({ core: 120, sentry: 25, tank: 100, ship: 240,
  submarine: 280, airbase: 300, artillery: 180, missile: 220, factory: 150,
  uplink: 100, recycler: 60, aircraft: 100, dockRepair: 90, baseRepair: 150 });
export const LOGISTICS_SIZE = Object.freeze({ factory: 2, uplink: 3, recycler: 1 });
export const FACILITY_HP = Object.freeze({ core: 500, sentry: 140, artillery: 350,
  missile: 320, airbase: 500, dock: 320, factory: 400, uplink: 300, recycler: 160 });
export const freshLogistics = () => ({ version: 1, supplies: ECONOMY.initial, time: 0,
  emergency: 0, floors: [], facilities: [], recyclers: [], crates: [], salvage: {}, durability: {},
  jobs: {}, deployments: {}, shipments: 0 });
export const readyFactory = f => f.kind === 'factory' && !f.destroyed && !(f.remaining > 0);
export const facilityCenter = f => ({ x: f.x + (LOGISTICS_SIZE[f.kind] || 1) / 2, y: f.y + (LOGISTICS_SIZE[f.kind] || 1) / 2 });
export const quote = (kind, local = false) => Math.ceil(COSTS[kind] * (local ? ECONOMY.factoryDiscount : 1));
export function usableExplosives(world) {
  return (world.tanks || []).some(t => !t.destroyed) || (world.artillery || []).some(g => !g.remaining)
    || (world.ships || []).some(s => !s.destroyed) || (world.airbases || []).some(b => !b.destroyed && b.aircraft?.state !== 'destroyed');
}
export function emergencyTankError(world) {
  if (usableExplosives(world)) return 'The room still has an explosive weapon platform. Recover or use it first.';
  if (world.logistics.supplies >= COSTS.tank) return 'Supplies can fund a standard HE tank.';
  if (world.logistics.emergency > .001) return `Emergency HE tank ready in ${Math.ceil(world.logistics.emergency)}s.`;
  return null;
}
export function tickSupplies(state, dt) {
  state.time += dt;
  if (state.supplies < ECONOMY.reserve) state.supplies = Math.min(ECONOMY.reserve, state.supplies + ECONOMY.income * dt);
  state.emergency = Math.max(0, state.emergency - dt);
}
export function credit(state, amount) {
  const accepted = Math.max(0, Math.min(amount, ECONOMY.capacity - state.supplies));
  state.supplies += accepted; return accepted;
}
export function collectSalvage(state, site, truck, dt) {
  if (!site || site.state !== 'conquered' || Math.hypot(truck.x-site.x-1.5, truck.y-site.y-1.5) > 4) return false;
  const remaining = state.salvage[site.id] ?? ECONOMY.salvage;
  if (remaining <= 0 || truck.cargo >= ECONOMY.cargo) return false;
  truck.collecting = (truck.collecting || 0) + dt;
  if (truck.collecting < ECONOMY.collectTime) return true;
  const amount = Math.min(remaining, ECONOMY.cargo - truck.cargo);
  state.salvage[site.id] = remaining - amount; truck.cargo += amount; truck.collecting = 0; truck.task = null;
  return true;
}
export function tickLaunch(state, station, dt) {
  if (!(station.launch > 0)) return false;
  station.launch = Math.max(0, station.launch - dt);
  if (station.launch < 1e-8) {
    station.launch = 0;
    const accepted = credit(state, station.cargo);
    station.cargo -= accepted; // Full storage never silently discards a shipment.
    if (accepted > 0) state.shipments++;
  }
  return true;
}

// Durable HP is separate from legacy table layouts. Only explicitly assembled
// targets can be damaged; terrain, rails and friendly shots are not damage sources.
export function facilityTargets(world, buildings = [], includeDestroyed = false) {
  const l = world.logistics; if (!l) return [];
  const targets = [];
  const add = (object, kind, x, y, w, h) => {
    if (object.destroyed || (kind === 'dock' && object.dockDestroyed)) return;
    const id = kind + ':' + object.id;
    const hp = l.durability[id] ||= { health: FACILITY_HP[kind], max: FACILITY_HP[kind], armor: kind === 'recycler' ? 1 : 2 };
    targets.push({ id, object, kind, x, y, w, h, hp });
  };
  for (const c of world.cores || []) add(c,'core',c.x+1.5,c.y+1.5,3,3);
  for (const b of buildings) if (!b.coreId) add(b,'sentry',b.x+.5,b.y+.5,1,1);
  for (const g of world.artillery || []) add(g,g.kind==='missile'?'missile':'artillery',g.x+(g.kind==='missile'?2:.5),g.y+(g.kind==='missile'?2:.5),g.kind==='missile'?4:3,g.kind==='missile'?4:3);
  for (const b of world.airbases || []) add(b,'airbase',b.x+5,b.y+2.5,2,3);
  for (const s of world.ships || []) {
    // A hull loss does not destroy its dock; a dock loss does not sink its ship.
    if (!s.dockDestroyed) {
      const proxy = { ...s, destroyed: false };
      add(proxy,'dock',s.dock.x,s.dock.y,Math.abs(Math.cos(s.dock.angle))> .5?3:1,Math.abs(Math.cos(s.dock.angle))> .5?1:3);
      targets[targets.length-1].object = s;
    }
  }
  for (const f of l.facilities) { const size=LOGISTICS_SIZE[f.kind]; add(f,f.kind,f.x+size/2,f.y+size/2,size,size); }
  for (const r of l.recyclers) add(r,'recycler',r.x,r.y,.8,.8);
  return includeDestroyed ? targets : targets.filter(t=>t.hp.health>0);
}
export function facilityPoint(f, p) {
  return { x: Math.max(f.x-f.w/2,Math.min(f.x+f.w/2,p.x)), y:Math.max(f.y-f.h/2,Math.min(f.y+f.h/2,p.y)) };
}
export const facilityDistance = (f,p) => { const q=facilityPoint(f,p); return Math.hypot(q.x-p.x,q.y-p.y); };
export function hurtFacility(f, amount, penetration = 2) {
  if (f.hp.health<=0 || penetration < f.hp.armor || !Number.isFinite(amount) || amount<=0) return false;
  f.hp.health=Math.max(0,f.hp.health-amount); return true;
}
