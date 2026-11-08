// Read-only colony audio transitions. Saved room seconds, never wall time or
// input attempts, decide these cues. The mixer owns audibility and voice limits.
import { INDUSTRY, industryItems, industryWorking } from './colony-industry.js';
import { dronePose } from './colony-crates.js';
import { sprinklerMotion, IRRIGATION } from './colony-machinery.js';
import { cropById, bedReady } from './colony-crops.js';
import { PRINT, printPose, printTimeline } from './colony-print-art.js';
import { SETTLEMENT, settlementSize } from './colony-settlement.js';
import { SHUTTLE_PHASES, shuttleFlightPose } from './colony-shuttle-art.js';

const point = value => Number.isFinite(value?.x) && Number.isFinite(value?.y);
const clamp = value => Math.max(0, Math.min(1, value));
const centre = (item, size = 1) => ({ x: item.x + size / 2, y: item.y + size / 2 });
const reactionKey = pet => pet?.reaction ? `${pet.reaction.kind}:${pet.reaction.until}` : '';
const fishKey = activity => activity?.kind === 'fish' ? `${activity.cast ?? activity.since}` : null;
const objects = colony => [
  ...(colony.beds || []).map(item => ({ item, size: 1 })),
  ...(colony.sprinklers || []).map(item => ({ item, size: 1 })),
  ...(colony.decorations?.items || []).map(item => ({ item, size: item.kind === 'cinema' ? 2 : 1 })),
  ...industryItems(colony).map(item => ({ item, size: INDUSTRY.kinds[item.kind]?.size || 1 })),
];

export class ColonySoundEvents {
  constructor() { this.reset(); }

  reset() {
    this.key = null; this.time = -Infinity; this.pet = null; this.nextStep = -Infinity;
    this.nextNotice = -Infinity; this.players = new Map(); this.prints = new Map();
    this.drones = new Map(); this.shuttle = null; this.shipments = 0;
  }

  /** @param {{epoch:any,time:number,colony:any,players?:any[],localId?:string,world?:any}} packet */
  ingest({ epoch, time, colony, players = [], localId, world }) {
    const events = [], loops = [];
    if (!colony || !Number.isFinite(time)) { this.reset(); return { events, loops }; }
    const region = colony.regionId || world?.regionId || 'home', key = `${epoch}:${region}`;
    const baseline = this.key !== key || time < this.time || time - this.time > 1.5;
    if (baseline) this.reset();
    const previousTime = this.time, advancing = time > previousTime;
    const emit = (kind, id, at, extra = {}) => {
      if (!baseline && point(at)) events.push({ kind, id: String(id), x: at.x, y: at.y, ...extra });
    };
    const loop = (kind, id, at, gain = 1) => {
      if (point(at) && gain > .001) loops.push({ kind, id: String(id), x: at.x, y: at.y, gain: clamp(gain) });
    };
    // Inputs are snapshots, but retain only scalars so a caller mutating a test
    // or renderer object cannot accidentally mutate the preceding observation.
    const pet = region === 'home' && point(colony.pet) ? colony.pet : null;
    if (pet) {
      const previous = this.pet?.id === pet.id ? this.pet : null;
      const freshReaction = pet.reaction?.until > time && reactionKey(pet) !== previous?.reaction;
      if (previous && (pet.fed || 0) > previous.fed) emit('spider-eat', pet.id, pet);
      else if (freshReaction) {
        if (pet.reaction.kind === 'purr') emit('spider-purr', pet.id, pet);
        else if (pet.reaction.kind === 'happy') emit('spider-happy', pet.id, pet);
      }
      if (previous && pet.notice?.until > time && pet.notice.until !== previous.notice && time >= this.nextNotice) {
        emit('spider-curious', pet.id, pet); this.nextNotice = time + 8;
      }
      if (previous && advancing && pet.moving && pet.mode !== 'sit' &&
          Math.hypot(pet.x - previous.x, pet.y - previous.y) > .015 && time >= this.nextStep) {
        emit('spider-step', pet.id, pet); this.nextStep = time + .34;
      }
      this.pet = { id: pet.id, x: pet.x, y: pet.y, fed: pet.fed || 0,
        reaction: reactionKey(pet), notice: pet.notice?.until };
    } else this.pet = null;

    const nextPlayers = new Map();
    for (const player of players) {
      if ((player.regionId || 'home') !== region) continue;
      const activity = player.activity, cast = fishKey(activity), previous = this.players.get(player.id);
      nextPlayers.set(player.id, { cast, bite: !!activity?.bite });
      if (cast === null || !point(activity.spot)) continue;
      // A crew member joining while already fishing must not replay their cast.
      const freshCast = cast !== previous?.cast && (previous || activity.since >= previousTime - .01);
      if (freshCast) emit('fish-cast', `${player.id}:${cast}`, activity.spot);
      if (activity.bite && previous && (!previous.bite || previous.cast !== cast)) {
        emit('fish-bite', `${player.id}:${cast}`, activity.spot, { local: player.id === localId });
      }
    }
    this.players = nextPlayers;

    const nextPrints = new Map(), printing = new Set();
    const observePrint = (id, at, elapsed, duration, readyAt, stamp) => {
      const identity = `${id}:${stamp}`, timeline = printTimeline(duration, readyAt);
      const previous = this.prints.get(identity), pose = printPose(elapsed, duration, readyAt);
      nextPrints.set(identity, elapsed);
      if (pose) printing.add(id);
      if (pose?.stage === 'print') loop('printer-work', identity, at);
      if (previous !== undefined && previous < timeline.fold && elapsed >= timeline.fold) emit('build-ready', identity, at);
    };
    for (const { item, size } of objects(colony)) {
      if (!Number.isFinite(item.builtAt) || !point(item)) continue;
      observePrint(item.id, centre(item, size), time - item.builtAt, PRINT.seconds, PRINT.seconds, item.builtAt);
    }
    const delivery = colony.settlement?.deliveries?.[0];
    const furnishing = delivery && colony.settlement?.items?.find(item => item.id === delivery.itemId);
    if (furnishing && point(furnishing)) {
      const size = settlementSize(furnishing.kind, furnishing.dir);
      observePrint(furnishing.id, { x: furnishing.x + size.width / 2, y: furnishing.y + size.height / 2 },
        delivery.elapsed, delivery.duration, SETTLEMENT.assemblySeconds, delivery.id);
    }
    this.prints = nextPrints;

    const nextDrones = new Map(), crates = new Set((colony.crates || []).map(crate => crate.id));
    for (const machine of industryItems(colony)) {
      if (!point(machine)) continue;
      const at = centre(machine, INDUSTRY.kinds[machine.kind]?.size || 1);
      if (machine.kind === 'warehouse') {
        const task = machine.task, previous = this.drones.get(machine.id), pose = dronePose(colony, machine, time);
        if (machine.enabled && pose) loop('drone-hover', machine.id, pose);
        if (machine.enabled && task?.phase === 'back' && task.crateId && crates.has(task.crateId) &&
            previous?.phase === 'out' && previous.crateId === task.crateId) {
          emit('drone-pickup', `${machine.id}:${task.crateId}`, task.from);
        }
        // Hand collection cannot take a carried crate. A disappearing carried
        // crate therefore confirms delivery, including an immediate next trip.
        if (machine.enabled && previous?.phase === 'back' && previous.crateId && previous.hadCrate &&
            !crates.has(previous.crateId) && task?.crateId !== previous.crateId) {
          emit('drone-unload', `${machine.id}:${previous.crateId}`, at);
        }
        nextDrones.set(machine.id, task ? { phase: task.phase, crateId: task.crateId,
          hadCrate: crates.has(task.crateId) } : null);
      } else if (!printing.has(machine.id) && industryWorking(colony, machine)) {
        if (machine.kind === 'generator') loop('bio-generator', machine.id, at);
        else if (['processor', 'outlet', 'collector'].includes(machine.kind)) loop('machine-work', machine.id, at);
      }
    }
    this.drones = nextDrones;
    for (const sprinkler of colony.sprinklers || []) {
      if (!point(sprinkler) || printing.has(sprinkler.id)) continue;
      const useful = colony.template === 'morrow-v1' || (colony.beds || []).some(bed =>
        cropById(bed.crop) && !bedReady(bed) && Math.hypot(bed.x - sprinkler.x, bed.y - sprinkler.y) <= IRRIGATION.radius);
      if (useful && sprinklerMotion(colony, sprinkler, time).active) loop('sprinkler', sprinkler.id, centre(sprinkler));
    }

    const shipment = region === 'home' ? colony.shipment : null;
    const pose = shipment ? shuttleFlightPose(colony, time) : null;
    if (pose) {
      const previous = this.shuttle?.id === shipment.id ? this.shuttle.f : 0;
      if (pose.f >= previous) {
        if (previous < SHUTTLE_PHASES.ignition[0] && pose.f >= SHUTTLE_PHASES.ignition[0]) emit('shuttle-ignition', shipment.id, pose);
        if (previous < SHUTTLE_PHASES.touchdown[0] && pose.f >= SHUTTLE_PHASES.touchdown[0]) emit('shuttle-touchdown', shipment.id, pose);
      }
      if (pose.visible) {
        loop('shuttle-lift', shipment.id, pose, pose.lift * pose.alpha);
        loop('shuttle-engine', shipment.id, pose, pose.main * pose.alpha);
      }
      this.shuttle = { id: shipment.id, f: pose.f };
    } else {
      if (this.shuttle && this.shuttle.f < SHUTTLE_PHASES.touchdown[0] && (colony.shipments || 0) > this.shipments && point(colony.pad)) {
        emit('shuttle-touchdown', this.shuttle.id, centre(colony.pad));
      }
      this.shuttle = null;
    }
    this.shipments = colony.shipments || 0;
    this.key = key; this.time = time;
    return { events, loops };
  }
}
