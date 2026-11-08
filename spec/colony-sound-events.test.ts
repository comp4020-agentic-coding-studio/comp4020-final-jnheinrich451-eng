import { expect, it } from 'vitest';
import { ColonySoundEvents } from '../public/colony-sound-events.js';
import { printTimeline, PRINT } from '../public/colony-print-art.js';

const colony = (extra: any = {}) => ({ time: 0, regionId: 'home', template: 'morrow-v1', pad: { x: 10, y: 10 },
  beds: [], sprinklers: [], crates: [], industry: { energy: 10, machines: [], belts: [] }, ...extra });
const packet = (time: number, state: any, extra: any = {}) => ({ epoch: 'colony-room', time, colony: { ...state, time }, players: [], localId: 'me', ...extra });
const kinds = (items: { kind: string }[]) => items.map(item => item.kind);
const pet = (extra: any = {}) => ({ id: 'spider', x: 10, y: 10, moving: false, mode: 'sit', fed: 0, pets: 0, reaction: null, notice: null, ...extra });
const task = (phase: string, crateId: string | null, extra: any = {}) => ({ phase, crateId, elapsed: .1, duration: 1,
  from: { x: phase === 'out' ? 11.5 : 15.5, y: 11.5 }, to: { x: phase === 'out' ? 15.5 : 11.5, y: 11.5 }, ...extra });
const warehouse = (trip: any, extra: any = {}) => ({ id: 'warehouse', kind: 'warehouse', x: 10, y: 10, enabled: true, task: trip, ...extra });

it('does not replay existing reactions, bites, buildings or touchdown on a baseline', () => {
  const feed = new ColonySoundEvents();
  const state = colony({ pet: pet({ reaction: { kind: 'happy', until: 12 }, fed: 5 }),
    shipment: { id: 'old-flight', duration: 14, remaining: .4 }, beds: [{ id: 'old-bed', x: 2, y: 3, builtAt: 0 }] });
  const players = [{ id: 'me', activity: { kind: 'fish', since: 8, bite: true, spot: { x: 9, y: 9 } } }];
  expect(feed.ingest(packet(10, state, { players })).events).toEqual([]);
  expect(feed.ingest(packet(10.1, state, { players })).events).toEqual([]);
});

it('selects one pet reaction for feeding, petting and adoption; ignores an unchanged reaction', () => {
  const feed = new ColonySoundEvents(), state = colony();
  feed.ingest(packet(0, state));
  state.pet = pet({ reaction: { kind: 'happy', until: 2.6 } });
  expect(kinds(feed.ingest(packet(.1, state)).events)).toEqual(['spider-happy']);
  state.pet.fed = 1; state.pet.pets = 1; state.pet.reaction.until = 2.7;
  expect(kinds(feed.ingest(packet(.2, state)).events)).toEqual(['spider-eat']);
  expect(feed.ingest(packet(.3, state)).events).toEqual([]);
  state.pet.reaction = { kind: 'purr', until: 2.9 };
  expect(kinds(feed.ingest(packet(.4, state)).events)).toEqual(['spider-purr']);
});

it('emits restrained strides only for actual movement and keeps noticing sparse', () => {
  const feed = new ColonySoundEvents(), state = colony({ pet: pet() });
  feed.ingest(packet(0, state));
  state.pet.moving = true; state.pet.mode = 'follow';
  expect(feed.ingest(packet(.1, state)).events).toEqual([]);
  state.pet.x += .2;
  expect(kinds(feed.ingest(packet(.2, state)).events)).toEqual(['spider-step']);
  state.pet.x += .2;
  expect(feed.ingest(packet(.3, state)).events).toEqual([]);
  state.pet.x += .4;
  expect(kinds(feed.ingest(packet(.6, state)).events)).toEqual(['spider-step']);
  state.pet.x += .4;
  expect(feed.ingest(packet(.6, state)).events).toEqual([]); // frozen room clock
  state.pet.moving = false; state.pet.mode = 'notice'; state.pet.notice = { until: 5 };
  expect(kinds(feed.ingest(packet(.7, state)).events)).toEqual(['spider-curious']);
  state.pet.notice.until = 6;
  expect(feed.ingest(packet(.8, state)).events).toEqual([]);
  state.pet.mode = 'sit'; state.pet.moving = true; state.pet.x += 1;
  expect(feed.ingest(packet(1, state)).events).toEqual([]);
});

it('tracks public cast/recast timestamps and gives only the local bite an interface cue', () => {
  const feed = new ColonySoundEvents(), state = colony(), players: any[] = [{ id: 'me' }, { id: 'friend' }];
  feed.ingest(packet(0, state, { players }));
  players[0].activity = { kind: 'fish', since: .1, bite: false, spot: { x: 5, y: 6 } };
  expect(kinds(feed.ingest(packet(.1, state, { players })).events)).toEqual(['fish-cast']);
  players[0].activity.bite = true;
  expect(feed.ingest(packet(.2, state, { players })).events).toMatchObject([{ kind: 'fish-bite', local: true }]);
  expect(feed.ingest(packet(.3, state, { players })).events).toEqual([]);
  players[0].activity = { kind: 'fish', since: .4, bite: false, spot: { x: 5, y: 6 } };
  players[1].activity = { kind: 'fish', since: .4, bite: false, spot: { x: 8, y: 9 } };
  expect(kinds(feed.ingest(packet(.4, state, { players })).events)).toEqual(['fish-cast', 'fish-cast']);
  players[1].activity.bite = true;
  expect(feed.ingest(packet(.5, state, { players })).events).toMatchObject([{ kind: 'fish-bite', local: false }]);
  players.push({ id: 'joining', activity: { kind: 'fish', since: -2, bite: true, spot: { x: 9, y: 9 } } });
  expect(feed.ingest(packet(.6, state, { players })).events).toEqual([]);
});

it('plays the printer only during printing and the completion cue once at the visual reveal', () => {
  const feed = new ColonySoundEvents(), state = colony({ beds: [{ id: 'bed', x: 2, y: 3, builtAt: 0 }] });
  const line = printTimeline(PRINT.seconds, PRINT.seconds), events: any[] = [];
  for (let t = 0; t <= 5.2; t += .1) {
    const result = feed.ingest(packet(t, state)); events.push(...result.events);
    expect(kinds(result.loops).includes('printer-work')).toBe(t >= line.unfold && t < line.fold);
  }
  expect(kinds(events)).toEqual(['build-ready']);
  expect(events[0]).toMatchObject({ x: 2.5, y: 3.5 });
});

it('uses the active furnishing delivery and never plays a queued printer early', () => {
  const feed = new ColonySoundEvents(), state = colony({ settlement: {
    items: [{ id: 'chair-a', kind: 'bench', x: 2, y: 2 }, { id: 'chair-b', kind: 'bench', x: 4, y: 4 }],
    deliveries: [{ id: 'delivery-a', itemId: 'chair-a', elapsed: 0, duration: 8 }, { id: 'delivery-b', itemId: 'chair-b', elapsed: 0, duration: 8 }],
  } });
  const events: any[] = [];
  for (let t = 0; t <= 8.1; t += .2) {
    state.settlement.deliveries[0].elapsed = t;
    const result = feed.ingest(packet(t, state)); events.push(...result.events);
    expect(result.loops.every(loop => loop.id.includes('chair-a'))).toBe(true);
  }
  expect(kinds(events)).toEqual(['build-ready']);
});

it('keeps idle, blocked, disabled and still-printing machines quiet', () => {
  const feed = new ColonySoundEvents(), state = colony({ industry: { energy: 10, belts: [], machines: [
    { id: 'generator', kind: 'generator', x: 1, y: 1, enabled: true, fuelEnergy: 2 },
    { id: 'processor', kind: 'processor', x: 3, y: 1, enabled: true, job: { elapsed: 1, seconds: 4 } },
    { id: 'outlet', kind: 'outlet', x: 5, y: 1, enabled: true, harvestMotion: { elapsed: 1, duration: 2 } },
  ] } });
  expect(kinds(feed.ingest(packet(0, state)).loops)).toEqual(['bio-generator', 'machine-work', 'machine-work']);
  state.industry.machines[0].enabled = false;
  state.industry.energy = 0;
  state.industry.machines[2].harvestMotion.elapsed = 2;
  expect(feed.ingest(packet(.1, state)).loops).toEqual([]);
  state.industry.energy = 10; state.industry.machines[1].builtAt = .2;
  expect(feed.ingest(packet(.2, state)).loops).toEqual([]);
});

it('sounds actual irrigation, and does not turn an empty legacy sprinkler into ambient noise', () => {
  const feed = new ColonySoundEvents(), state = colony({ beds: [{ id: 'bed', x: 1, y: 1, crop: 'sundrop', growth: 0, water: 10 }],
    sprinklers: [{ id: 'sprinkler', x: 1, y: 2, irrigation: { remaining: 1, phase: 0, bedIds: ['bed'] } }] });
  expect(kinds(feed.ingest(packet(0, state)).loops)).toEqual(['sprinkler']);
  state.sprinklers[0].irrigation.remaining = 0;
  expect(feed.ingest(packet(.1, state)).loops).toEqual([]);
  state.template = 'nacre-v1'; state.beds = [];
  expect(feed.ingest(packet(.2, state)).loops).toEqual([]);
});

it('sounds loaded drone pickup and delivery once, including a new outbound task in the same tick', () => {
  const feed = new ColonySoundEvents(), state = colony({ crates: [{ id: 'a' }, { id: 'b' }], industry: { energy: 10, belts: [], machines: [warehouse(task('out', 'a'))] } });
  expect(kinds(feed.ingest(packet(0, state)).loops)).toEqual(['drone-hover']);
  state.industry.machines[0].task = task('back', 'a');
  expect(kinds(feed.ingest(packet(.1, state)).events)).toEqual(['drone-pickup']);
  expect(feed.ingest(packet(.2, state)).events).toEqual([]);
  state.crates = [{ id: 'b' }]; state.industry.machines[0].task = task('out', 'b');
  const result = feed.ingest(packet(.3, state));
  expect(result.events).toMatchObject([{ kind: 'drone-unload', x: 11.5, y: 11.5 }]);
  expect(kinds(result.loops)).toEqual(['drone-hover']);
  expect(feed.ingest(packet(.4, state)).events).toEqual([]);
});

it('keeps empty drone returns silent and stops a disabled or parked flight loop', () => {
  const feed = new ColonySoundEvents(), state = colony({ crates: [{ id: 'a' }], industry: { energy: 10, belts: [], machines: [warehouse(task('out', 'a'))] } });
  feed.ingest(packet(0, state));
  state.crates = []; state.industry.machines[0].task = task('back', null);
  expect(feed.ingest(packet(.1, state)).events).toEqual([]);
  state.industry.machines[0].enabled = false;
  expect(feed.ingest(packet(.2, state)).loops).toEqual([]);
  state.industry.machines[0].enabled = true; state.industry.machines[0].task = null;
  expect(feed.ingest(packet(.3, state))).toEqual({ events: [], loops: [] });
});

it('follows both shuttle thrusters and emits one ignition and one touchdown per shipment', () => {
  const feed = new ColonySoundEvents(), state = colony({ shipment: { id: 'flight', duration: 14, remaining: 14 } });
  const events: any[] = [];
  for (let i = 0; i <= 140; i++) {
    const time = i / 10; state.shipment.remaining = 14 - time;
    const result = feed.ingest(packet(time, state)); events.push(...result.events);
    if (i === 30) expect(kinds(result.loops)).toEqual(['shuttle-lift']);
    if (i === 50) expect(kinds(result.loops)).toContain('shuttle-engine');
    if (i === 77) expect(result.loops).toEqual([]); // away
    if (i === 114) expect(kinds(result.loops)).toEqual(['shuttle-lift']);
    if (i === 139) expect(result.loops).toEqual([]); // settled
  }
  expect(kinds(events)).toEqual(['shuttle-ignition', 'shuttle-touchdown']);
  state.shipment = null;
  expect(feed.ingest(packet(14.1, state))).toEqual({ events: [], loops: [] });
});

it('suppresses historical events after gaps, resets, region changes and clock rewinds', () => {
  const feed = new ColonySoundEvents(), state = colony({ pet: pet() });
  feed.ingest(packet(0, state));
  state.pet.reaction = { kind: 'happy', until: 8 };
  expect(feed.ingest(packet(5, state)).events).toEqual([]);
  feed.reset(); state.pet.reaction.until = 8.1;
  expect(feed.ingest(packet(5.1, state)).events).toEqual([]);
  state.regionId = 'lake-basin';
  expect(feed.ingest(packet(5.2, state)).events).toEqual([]);
  state.regionId = 'home'; state.pet.fed++;
  expect(feed.ingest(packet(5.3, state)).events).toEqual([]);
  state.pet.reaction = { kind: 'purr', until: 7 };
  expect(feed.ingest(packet(4, state)).events).toEqual([]);
  state.pet.reaction.until = 7.1;
  expect(feed.ingest(packet(4.1, state, { epoch: 'new-room' })).events).toEqual([]);
});
