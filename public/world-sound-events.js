import { POD } from './pod.js';
import { SURVIVAL } from './survival.js';

const clamp = value => Math.max(0, Math.min(1, value));
const finite = value => Number.isFinite(value);
const alive = item => !item.destroyed && (item.health ?? item.hp ?? 1) > 0 && !['disabled', 'arriving'].includes(item.life);
const ready = item => alive(item) && !(item.elapsed < POD.duration) && !(item.remaining > 0) && !(item.assemblyRemaining > 0);
const point = item => finite(item.x) && finite(item.y);
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const airStates = new Set(['takeoff', 'flying', 'landing']);
// The supplied opening take contains a later impact; keep only its hinge/hiss
// portion, then use the isolated slam when the animated panel reaches ground.
const panelOpeningDuration = .55;

// Read only authoritative snapshots. Loops describe what is happening now;
// one-shots require a fresh observed threshold/transition and never replay joins.
export class WorldSoundEvents {
  constructor() { this.reset(); }
  reset() { this.epoch = null; this.time = -Infinity; this.previous = new Map(); this.loops = []; }
  /** @returns {{events: Array<{id:string,owner:string,kind:string,x:number,y:number,at:number,duration?:number}>, loops: Array<{id:string,kind:string,x:number,y:number,gain:number,rate:number}>}} */
  ingest(state) {
    if (!state.world || !finite(state.time)) { this.reset(); return { events: [], loops: [] }; }
    const baseline = state.epoch !== this.epoch || state.time < this.time;
    if (!baseline && state.time === this.time) return { events: [], loops: this.loops };
    const elapsed = (state.time - this.time) / 1000;
    const dt = !baseline && elapsed > 0 && elapsed <= .5 ? elapsed : 0;
    const previous = baseline ? new Map() : this.previous, next = new Map(), events = [], loops = [];
    const world = state.world;
    const loop = (id, kind, item, gain = 1, rate = 1) => {
      if (point(item) && gain > .005) loops.push({ id: `${id}:${kind}`, kind, x: item.x, y: item.y, gain: clamp(gain), rate: Math.max(.8, Math.min(1.2, rate)) });
    };
    const event = (id, kind, item, age = 0, extra = {}) => {
      if (!baseline && dt && age >= -1e-6 && age <= 350 && point(item))
        events.push({ id: `${id}:${kind}`, owner: id, kind, x: item.x, y: item.y, at: state.time - Math.max(0, age), ...extra });
    };
    const motion = (id, item) => {
      const old = previous.get(id);
      const rotation = finite(item.turret) ? item.turret - (item.angle || 0) : null;
      const speed = finite(item.vx) && finite(item.vy) ? Math.hypot(item.vx, item.vy)
        : finite(item.speed) ? Math.abs(item.speed)
        : old && dt ? Math.hypot(item.x - old.x, item.y - old.y) / dt : 0;
      const turning = old && dt && finite(item.angle) && finite(old.angle) ? Math.abs(angleDelta(item.angle, old.angle)) / dt : 0;
      const traverse = old && dt && finite(rotation) && finite(old.rotation) ? Math.abs(angleDelta(rotation, old.rotation)) / dt : 0;
      next.set(id, { x: item.x, y: item.y, angle: item.angle, rotation, state: item.state, life: item.life, recovery: item.recovery });
      return { old, speed: Math.min(speed, 30), turning: Math.min(turning, 3), traverse };
    };
    const pod = (id, item, age, { stagger = 0, panels = true, size = 1, length = 1, impact = POD.impact, hits = null } = {}) => {
      if (!point(item) || !finite(age) || age < 0) return;
      const old = previous.get(id), before = old && old.age <= age ? old.age : age - dt;
      next.set(id, { age });
      if (age < impact) loop(id, 'pod-descent', item, .55 + .45 * clamp(age / impact));
      const cross = (key, kind, at, location = item, extra = {}) => {
        if (before + 1e-8 < at && age + 1e-8 >= at) event(id + ':' + key, kind, location, (age - at) * 1000, extra);
      };
      cross('impact', 'pod-impact', impact);
      if (!panels) return;
      if (hits) {
        for (const [index, at] of hits.entries()) {
          cross('open:' + index, 'pod-panel-open', at - POD.panelDuration, item, { duration: panelOpeningDuration });
          cross('slam:' + index, 'pod-panel-slam', at);
        }
      } else if (stagger) {
        for (let side = 0; side < 4; side++) {
          const at = POD.unfold + side * stagger, reach = size / 2 + length;
          const location = { x: item.x + [0, reach, 0, -reach][side], y: item.y + [-reach, 0, reach, 0][side] };
          cross('open:' + side, 'pod-panel-open', at, location, { duration: panelOpeningDuration });
          cross('slam:' + side, 'pod-panel-slam', at + POD.panelDuration, location);
        }
      } else {
        // A single crate's panels unfold together: one shared opening/contact.
        cross('open', 'pod-panel-open', POD.unfold, item, { duration: panelOpeningDuration });
        cross('slam', 'pod-panel-slam', POD.unfold + POD.panelDuration);
      }
    };
    for (const core of world.cores || []) if (!core.destroyed)
      pod('core:' + core.id, { x: core.x + 1.5, y: core.y + 1.5 }, core.elapsed, { stagger: POD.stagger, size: 3, length: 4 });
    for (const tank of world.tanks || []) if (!tank.destroyed && finite(tank.podX) && finite(tank.podY))
      pod('tank-pod:' + tank.id, { x: tank.podX + .5, y: tank.podY + .5 }, tank.elapsed, { stagger: POD.stagger });
    for (const cargo of world.logistics?.cargoPods || []) {
      const rail = cargo.layout === 'rail-line';
      pod('cargo:' + cargo.id, { x: cargo.x + (cargo.w || 1) / 2, y: cargo.y + (cargo.h || 1) / 2 }, cargo.duration - cargo.remaining,
        { panels: cargo.layout !== 'rail-crate', ...(rail ? { hits: [POD.unfold + POD.panelDuration, POD.unfold + 2 * POD.panelDuration] } : {}) });
    }
    const ground = (id, item, tracked, occupied = !!item.occupant) => {
      if (!point(item) || !ready(item)) return;
      const { speed, turning, traverse } = motion(id, item);
      const load = clamp(Math.max(speed / 3.5, turning / 2)), moving = speed > .025 || turning > .025;
      if (occupied || moving) loop(id, 'vehicle-idle', item, moving ? .45 * (1 - load) : .65, .9 + .15 * load);
      if (moving) {
        loop(id, 'vehicle-drive', item, .3 + .7 * load, .85 + .3 * load);
        if (tracked) loop(id, 'vehicle-tracks', item, .3 + .7 * load, .85 + .3 * load);
      }
      if (traverse > .025) loop(id, 'mechanical-servo', item, .35 + .3 * clamp(traverse));
    };
    for (const tank of world.tanks || []) {
      // The server drives occupied tanks through their pilot, then copies only
      // pose back to the tank. Cargo transfers can leave zero velocity fields on
      // that tank indefinitely, so read its current pilot's measured velocity.
      const pilot = (state.players || []).find(player => player.id === tank.occupant && player.vehicleId === tank.id);
      const body = pilot && finite(pilot.vx) && finite(pilot.vy) ? { ...tank, vx: pilot.vx, vy: pilot.vy }
        : tank.vx === 0 && tank.vy === 0 && !(tank.speed > 0) ? { ...tank, vx: undefined, vy: undefined, speed: undefined } : tank;
      // When no driver velocity is available, advancing positions can still
      // establish movement despite those persisted cargo/reset zeros.
      ground('tank:' + tank.id, body, true);
    }
    for (const truck of world.logistics?.recyclers || []) ground('utility:' + truck.id, truck, false);
    for (const player of state.players || []) {
      // Legacy scouts are their own rover; pilots inside persistent vehicles
      // already have an emitter at that vehicle and must not double its engine.
      if (player.body === 'rover' && !player.vehicleId && !player.shipId && !player.aircraftId && !player.recyclerId && !player.deploying)
        ground('rover:' + player.id, player, true, true);
      if (player.life === 'arriving') pod('recovery:' + player.id, player, SURVIVAL.arrival - player.recovery, { panels: false, impact: SURVIVAL.arrival * .8 });
    }
    for (const ship of world.ships || []) {
      if (!point(ship) || !ready(ship)) continue;
      const id = 'ship:' + ship.id, { speed, traverse } = motion(id, ship);
      const turning = Math.abs(ship.turnRate || 0), load = clamp(Math.max(speed / 2.5, turning)), moving = speed > .025 || turning > .025;
      const surfaced = ship.kind !== 'submarine' || !ship.depth || ship.depth === 'surfaced';
      if (ship.occupant || moving) loop(id, 'ship-engine', ship, (.35 + .65 * load) * (surfaced ? 1 : .3), .85 + .3 * load);
      if (speed > .025 && surfaced) loop(id, world.template === 'sirocco-v1' ? 'ship-sand' : 'ship-wake', ship, .25 + .75 * load, .9 + .2 * load);
      if (traverse > .025) loop(id, 'mechanical-servo', ship, .35 + .3 * clamp(traverse));
    }
    const holders = [...(world.airbases || []), ...(world.ships || []), ...(world.ships || []).map(ship => ship.wing).filter(Boolean)];
    const planes = new Map(holders.filter(holder => holder.aircraft).map(holder => [holder.aircraft.id, holder.aircraft]));
    for (const plane of planes.values()) {
      if (!point(plane)) continue;
      const id = 'aircraft:' + plane.id, { old, traverse } = motion(id, plane);
      if (plane.state === 'delivering' && plane.deliveryMethod !== 'factory')
        pod('air-pod:' + plane.id, plane, POD.duration - plane.remaining);
      if (!alive(plane) || ['destroyed', 'vacant'].includes(plane.state)) continue;
      if (airStates.has(plane.state)) {
        const kind = plane.kind === 'helicopter' ? 'helicopter-rotor' : plane.kind === 'attack-jet' ? 'jet-engine' : 'heavy-aircraft-engine';
        const load = clamp((plane.speed || 0) / 12);
        loop(id, kind, plane, .6 + .4 * load, .9 + .15 * load);
        if (traverse > .025) loop(id, 'mechanical-servo', plane, .4);
      }
      if (old?.state === 'landing' && plane.state === 'parked') event(id, 'aircraft-touchdown', plane);
    }
    for (const gun of world.artillery || []) {
      if (!point(gun) || !ready(gun)) continue;
      const id = 'artillery:' + gun.id, old = previous.get(id);
      next.set(id, { angle: gun.angle, elevation: gun.elevation });
      if (old && dt && ((finite(gun.angle) && finite(old.angle) && Math.abs(angleDelta(gun.angle, old.angle)) / dt > .025)
        || (finite(gun.elevation) && finite(old.elevation) && Math.abs(gun.elevation - old.elevation) / dt > .1)))
        loop(id, 'mechanical-servo', gun, .55);
    }
    this.previous = next; this.epoch = state.epoch; this.time = state.time; this.loops = loops;
    return { events, loops };
  }
}
