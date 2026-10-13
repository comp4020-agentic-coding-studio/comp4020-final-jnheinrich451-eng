import { POD } from './pod.js';
import { dockRecords } from './shipyard.js';
// All balance values for the first conquest economy live here. Server-owned;
// clients use the same quotes for presentation, never to grant resources.
export const ECONOMY = Object.freeze({ initial: 1200, reserve: 250, capacity: 2000, income: 2,
  emergencyCooldown: 20, salvage: 180, cargo: 180, collectTime: 8, launchTime: 5,
  rocketCycle: 120, processRate: 30, factoryDiscount: .25, factoryTime: 60, maxFacilities: 12, maxRecyclers: 4, remainsValue: 8 });
export const COSTS = Object.freeze({ core: 120, sentry: 25, tank: 100, ship: 240,
  submarine: 280, transport: 200, airbase: 300, artillery: 180, missile: 220, outpost: 80, factory: 150,
  uplink: 100, recycler: 60, builder: 80, aircraft: 100, dockRepair: 90, baseRepair: 150, shipyard: 120, rampRepair: 25 });
export const LOGISTICS_SIZE = Object.freeze({ outpost: 2, factory: 2, uplink: 3, recycler: 1, builder: 1 });
export const FACILITY_HP = Object.freeze({ core: 500, sentry: 140, artillery: 350,
  missile: 320, airbase: 500, dock: 320, ramp: 140, outpost: 250, factory: 400, uplink: 300, recycler: 160 });
export const freshLogistics = () => ({ version: 2, supplies: ECONOMY.initial, groundSupplies: 0, freeBomberUsed: false, time: 0,
  emergency: 0, bridges: [], floors: [], facilities: [], recyclers: [], crates: [], salvage: {}, durability: {},
  jobs: {}, deployments: {}, shipments: 0 });
export const readyFactory = f => ['factory','outpost'].includes(f.kind) && !f.destroyed && !(f.remaining > 0);
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
export function credit(state, amount, pool = 'supplies') {
  const accepted = Math.max(0, Math.min(amount, ECONOMY.capacity - (state[pool] || 0)));
  state[pool] = (state[pool] || 0) + accepted; return accepted;
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
// Corpse salvage is bounded and durable. Merge nearby piles first; once the
// shared 64-pile budget is full, further bodies are cosmetic and grant no cargo.
export function addRemains(state, enemy, id) {
  if (!state || enemy.kind === 'swimmer') return;
  const near=state.crates.find(c=>c.kind==='remains'&&Math.hypot(c.x-enemy.x,c.y-enemy.y)<2);
  if(near){near.amount+=ECONOMY.remainsValue;return;}
  if(state.crates.length>=64)return;
  state.crates.push({id,kind:'remains',x:enemy.x,y:enemy.y,angle:enemy.angle||0,amount:ECONOMY.remainsValue});
}
export function tickLaunch(state, station, dt) {
  const active=station.launch>0||station.cooldown>0;
  station.cooldown=Math.max(0,(station.cooldown||0)-dt);
  if (!(station.launch > 0)) return active;
  // Old in-progress shipments retain their cargo and deliver exactly once.
  if(station.inFlight===undefined){station.inFlight=station.cargo;station.cargo=0;station.cooldown=Math.max(station.cooldown,ECONOMY.rocketCycle);}
  station.launch = Math.max(0, station.launch - dt);
  if (station.launch < 1e-8) {
    station.launch=0;
    const accepted=credit(state,station.inFlight);
    station.cargo+=station.inFlight-accepted;
    station.inFlight=0;
    if(accepted>0)state.shipments++;
  }
  return active;
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
  for (const s of dockRecords(world)) {
    // A hull loss does not destroy its dock; a dock loss does not sink its ship.
    if (!s.dockDestroyed) {
      const proxy = { ...s, destroyed: false };
      add(proxy,'dock',s.dock.x,s.dock.y,Math.abs(Math.cos(s.dock.angle))> .5?3:1,Math.abs(Math.cos(s.dock.angle))> .5?1:3);
      targets[targets.length-1].object = s;
    }
  }
  for (const s of world.ships || []) if(s.ramp && !s.destroyed && s.rampGun && !s.rampGun.destroyed) add(s.rampGun,'ramp',s.ramp.x,s.ramp.y,.6,.6);
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

// Keep the old serialized supplies field as orbital SUP for compatibility.
export function migrateLogistics(state) {
  if(![1,2].includes(state.version))throw new Error('Unsupported logistics save version. Preserve this save and update the server.');
  if(state.version===1){state.groundSupplies=0;state.freeBomberUsed=false;for(const job of Object.values(state.jobs||{}))job.pool='supplies';state.version=2;}
  return state;
}
export const LOCAL_KINDS = ['airbase','ship','submarine','transport','artillery','missile','factory','outpost','uplink','sentry','tank','recycler','builder','shipyard'];
export const poolFor = (kind, local=false) => local || ['dockRepair','baseRepair','rampRepair'].includes(kind) ? 'groundSupplies' : 'supplies';
export const poolLabel = pool => pool==='groundSupplies'?'ground SUP':'orbital SUP';
export function supportSources(world){return [
 ...(world.cores||[]).filter(c=>!c.destroyed&&c.elapsed>=POD.duration).map(c=>({...c,kind:'core',center:{x:c.x+1.5,y:c.y+1.5}})),
 ...(world.logistics?.facilities||[]).filter(f=>readyFactory(f)&&!world.logistics?.jobs?.[f.id]).map(f=>({...f,center:facilityCenter(f)}))
];}
export function salvageReceivers(world){return [
 ...supportSources(world).filter(f=>f.kind!=='factory'),
 ...(world.logistics?.facilities||[]).filter(f=>f.kind==='uplink'&&f.remaining<=0&&!world.logistics.jobs?.[f.id]).map(f=>({...f,center:facilityCenter(f)}))
];}
export function unloadSalvage(world,truck,id,dt){
 const l=world.logistics,receiver=salvageReceivers(world).find(f=>f.id===id);
 if(!receiver||Math.hypot(truck.x-receiver.center.x,truck.y-receiver.center.y)>4)return 0;
 if(receiver.kind==='uplink'){
  const station=l.facilities.find(f=>f.id===id),amount=Math.max(0,Math.min(truck.cargo,ECONOMY.cargo*4-station.cargo-(station.inFlight||0)));
  station.cargo+=amount;truck.cargo-=amount;return amount;
 }
 const amount=credit(l,Math.min(truck.cargo,ECONOMY.processRate*dt),'groundSupplies');truck.cargo-=amount;return amount;
}
export const orbitalDuration = kind => ['airbase','artillery','missile','shipyard'].includes(kind)?12:['factory','uplink','outpost'].includes(kind)?8:4.5;
