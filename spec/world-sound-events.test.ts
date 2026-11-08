import { expect, it } from 'vitest';
import { WorldSoundEvents } from '../public/world-sound-events.js';
import { POD } from '../public/pod.js';

const world = (extra: object = {}) => ({ cores: [], tanks: [], ships: [], airbases: [], artillery: [], logistics: { cargoPods: [], recyclers: [] }, ...extra });
const packet = (time: number, extra: object = {}, overrides: object = {}) => ({ epoch: 'room', time, world: world(extra), players: [], ...overrides });
const tank = (extra: object = {}) => ({ id: 'tank', x: 10, y: 10, podX: 9, podY: 9, elapsed: POD.duration, health: 200, occupant: 'pilot', angle: 0, turret: 0, vx: 0, vy: 0, ...extra });
const ship = (extra: object = {}) => ({ id: 'ship', x: 20, y: 20, elapsed: POD.duration, health: 300, occupant: 'pilot', speed: 0, turnRate: 0, ...extra });
const plane = (extra: object = {}) => ({ id: 'plane', x: 30, y: 30, kind: 'attack-jet', state: 'flying', speed: 8, health: 180, ...extra });
const kinds = (values: { kind: string }[]) => values.map(value => value.kind);

it('keeps baseline and completed deployments silent, but starts current engine/descent loops', () => {
  const feed = new WorldSoundEvents();
  const result = feed.ingest(packet(9000, { cores: [{ id: 'old', x: 5, y: 5, elapsed: 4.5 }, { id: 'new', x: 2, y: 2, elapsed: .4 }], tanks: [tank()] }));
  expect(result.events).toEqual([]);
  expect(kinds(result.loops)).toEqual(['pod-descent', 'vehicle-idle']);
  expect(feed.ingest(packet(9100, { cores: [{ id: 'old', x: 5, y: 5, elapsed: 4.5 }] })).events).toEqual([]);
});

it('times one landing, four individual core panel openings and four ground strikes', () => {
  const feed = new WorldSoundEvents(), events: any[] = [];
  for (let i = 0; i <= 46; i++) events.push(...feed.ingest(packet(i * 100, { cores: [{ id: 'c', x: 10, y: 20, elapsed: Math.min(4.5, i / 10) }] })).events);
  expect(events.filter(e => e.kind === 'pod-impact')).toMatchObject([{ x: 11.5, y: 21.5 }]);
  expect(events.find(e => e.kind === 'pod-impact').at).toBeCloseTo(1350);
  const opens = events.filter(e => e.kind === 'pod-panel-open'), slams = events.filter(e => e.kind === 'pod-panel-slam');
  expect(opens).toHaveLength(4); expect(slams).toHaveLength(4);
  opens.forEach((event, i) => { expect(event.at).toBeCloseTo((POD.unfold + i * POD.stagger) * 1000); expect(event.duration).toBe(.55); });
  slams.forEach((event, i) => expect(event.at).toBeCloseTo((POD.unfold + i * POD.stagger + POD.panelDuration) * 1000));
  expect(slams.map(e => [e.x, e.y])).toEqual([[11.5, 16], [17, 21.5], [11.5, 27], [6, 21.5]]);
  expect(feed.ingest(packet(4600, { cores: [{ id: 'c', x: 10, y: 20, elapsed: 4.5 }] })).events).toEqual([]);
});

it('suppresses old impacts after gaps, reconnects and reset; a new deployment can sound', () => {
  const feed = new WorldSoundEvents();
  const core = (elapsed: number) => ({ cores: [{ id: 'c', x: 10, y: 10, elapsed }] });
  feed.ingest(packet(0, core(0)));
  expect(feed.ingest(packet(4000, core(4))).events).toEqual([]);
  expect(feed.ingest(packet(4100, core(1.4), { epoch: 'restarted' })).events).toEqual([]);
  feed.reset(); expect(feed.ingest(packet(4200, core(2.7))).events).toEqual([]);
  feed.ingest(packet(4300, core(.1)));
  for (let i = 2; i <= 13; i++) feed.ingest(packet(4200 + i * 100, core(i / 10)));
  expect(kinds(feed.ingest(packet(5600, core(1.4))).events)).toEqual(['pod-impact']);
});

it('uses tank pod coordinates, groups simultaneous cargo doors and omits nonexistent rail-crate doors', () => {
  const feed = new WorldSoundEvents();
  const state = (age: number) => ({ tanks: [tank({ x: 50, y: 50, elapsed: age })], logistics: { cargoPods: [
    { id: 'crate', x: 20, y: 20, w: 2, h: 2, duration: 3.6, remaining: 3.6 - age },
    { id: 'rail', x: 25, y: 25, w: 1, h: 1, layout: 'rail-crate', duration: 2.25, remaining: 2.25 - age },
  ] } });
  feed.ingest(packet(0, state(1.3)));
  const impact = feed.ingest(packet(100, state(1.4))).events;
  expect(impact).toHaveLength(3); expect(impact[0]).toMatchObject({ x: 9.5, y: 9.5, kind: 'pod-impact' });
  feed.ingest(packet(400, state(1.7)));
  const openings = feed.ingest(packet(500, state(1.8))).events;
  expect(openings).toHaveLength(2); expect(kinds(openings)).toEqual(['pod-panel-open', 'pod-panel-open']);
});

it('blends occupied tank idle and actual travel, sounds pivoting tracks, and stops destroyed/parked vehicles', () => {
  const feed = new WorldSoundEvents();
  expect(kinds(feed.ingest(packet(0, { tanks: [tank()] })).loops)).toEqual(['vehicle-idle']);
  const moving = feed.ingest(packet(100, { tanks: [tank({ x: 10.2, vx: 2 })] })).loops;
  expect(kinds(moving)).toEqual(['vehicle-idle', 'vehicle-drive', 'vehicle-tracks']);
  expect(moving.every(loop => loop.rate >= .8 && loop.rate <= 1.2 && loop.gain <= 1)).toBe(true);
  expect(kinds(feed.ingest(packet(200, { tanks: [tank({ angle: .1, turret: .1 })] })).loops)).toContain('vehicle-tracks');
  expect(feed.ingest(packet(300, { tanks: [tank({ occupant: null, angle: .1, turret: .1 })] })).loops).toEqual([]);
  expect(feed.ingest(packet(400, { tanks: [tank({ destroyed: true, vx: 3 })] })).loops).toEqual([]);
  expect(feed.ingest(packet(500, { tanks: [tank({ elapsed: 2 })] })).loops.every(loop => loop.kind === 'pod-descent')).toBe(true);
});

it('infers motion only from advancing positions, avoids carried/duplicate pilot engines, and keeps utility wheels free of tank tracks', () => {
  const feed = new WorldSoundEvents();
  const truck = (x: number) => ({ id: 'truck', x, y: 10, health: 100, remaining: 0, occupant: null });
  const state = (x: number) => ({ logistics: { recyclers: [truck(x)] }, ships: [{ ...ship({ occupant: null }), cargo: { kind: 'tank', vehicle: tank({ vx: 2 }) } }] });
  const pilots = [{ id: 'p', x: 10, y: 10, body: 'rover', vehicleId: 'tank', health: 100 }];
  feed.ingest(packet(0, state(10), { players: pilots }));
  const result = feed.ingest(packet(100, state(10.2), { players: pilots }));
  expect(kinds(result.loops)).toEqual(['vehicle-idle', 'vehicle-drive']);
  expect(feed.ingest(packet(200, state(10.2), { players: pilots })).loops).toEqual([]);
});

it('uses the current tank pilot after cargo resets leave stale zero tank velocity', () => {
  const feed = new WorldSoundEvents();
  const resetTank = (x: number) => ({ tanks: [tank({ x, vx: 0, vy: 0, speed: 0, driveSpeed: 0 })] });
  const driver = (vx: number) => [{ id: 'pilot', body: 'rover', vehicleId: 'tank', x: 10, y: 10, vx, vy: 0, health: 100 }];
  feed.ingest(packet(0, resetTank(10), { players: driver(0) }));
  const moving = feed.ingest(packet(100, resetTank(10.2), { players: driver(2) }));
  expect(kinds(moving.loops)).toEqual(['vehicle-idle', 'vehicle-drive', 'vehicle-tracks']);
  expect(moving.loops.every(loop => loop.id.startsWith('tank:tank:'))).toBe(true);
  // Driver velocity controls stopping even if the last interval included travel.
  expect(kinds(feed.ingest(packet(200, resetTank(10.3), { players: driver(0) })).loops)).toEqual(['vehicle-idle']);
  // Older/partial snapshots without driver velocity still expose actual poses.
  expect(kinds(feed.ingest(packet(300, resetTank(10.5))).loops)).toEqual(['vehicle-idle', 'vehicle-drive', 'vehicle-tracks']);
  expect(kinds(feed.ingest(packet(400, resetTank(10.5))).loops)).toEqual(['vehicle-idle']);
});

it('selects water versus sand movement, mutes surface wake underwater and stops unoccupied ships', () => {
  const feed = new WorldSoundEvents();
  expect(kinds(feed.ingest(packet(0, { ships: [ship()] })).loops)).toEqual(['ship-engine']);
  expect(kinds(feed.ingest(packet(100, { ships: [ship({ speed: 1 })] })).loops)).toEqual(['ship-engine', 'ship-wake']);
  expect(kinds(feed.ingest(packet(200, { template: 'sirocco-v1', ships: [ship({ speed: 1 })] })).loops)).toEqual(['ship-engine', 'ship-sand']);
  expect(kinds(feed.ingest(packet(300, { ships: [ship({ kind: 'submarine', depth: 'submerged', speed: 1 })] })).loops)).toEqual(['ship-engine']);
  expect(feed.ingest(packet(400, { ships: [ship({ occupant: null })] })).loops).toEqual([]);
});

it('runs flying aircraft and carrier wings, stops engines on landing and plays touchdown once', () => {
  const feed = new WorldSoundEvents();
  const flight = (state: string) => ({ airbases: [{ aircraft: plane({ state }) }], ships: [{ id: 'carrier', occupant: null,
    aircraft: plane({ id: 'bomber', kind: 'bomber' }), wing: { aircraft: plane({ id: 'heli', kind: 'helicopter' }) } }] });
  expect(kinds(feed.ingest(packet(0, flight('flying'))).loops)).toEqual(['jet-engine', 'heavy-aircraft-engine', 'helicopter-rotor']);
  feed.ingest(packet(100, flight('landing')));
  const landed = feed.ingest(packet(200, flight('parked')));
  expect(kinds(landed.events)).toEqual(['aircraft-touchdown']);
  expect(kinds(landed.loops)).not.toContain('jet-engine');
  expect(feed.ingest(packet(300, flight('parked'))).events).toEqual([]);
  expect(feed.ingest(packet(400, flight('parked'), { epoch: 'rejoined' })).events).toEqual([]);
});

it('does not treat factory assembly as an orbital drop, and follows actual turret/elevation changes', () => {
  const feed = new WorldSoundEvents();
  const state = (turret: number, elevation: number) => ({ tanks: [tank({ occupant: null, turret })],
    airbases: [{ aircraft: plane({ state: 'delivering', deliveryMethod: 'factory', remaining: 1.2 }) }],
    artillery: [{ id: 'gun', x: 20, y: 20, angle: 0, elevation }] });
  expect(feed.ingest(packet(0, state(0, 45)))).toEqual({ events: [], loops: [] });
  expect(kinds(feed.ingest(packet(100, state(.1, 46))).loops)).toEqual(['mechanical-servo', 'mechanical-servo']);
  expect(feed.ingest(packet(200, state(.1, 46))).loops).toEqual([]);
});

it('follows the visible recovery-pod contact instead of replaying the finished revival', () => {
  const feed = new WorldSoundEvents();
  const players = (recovery: number) => [{ id: 'p', x: 5, y: 6, life: 'arriving', recovery }];
  const first = feed.ingest(packet(0, {}, { players: players(.5) }));
  expect(kinds(first.loops)).toEqual(['pod-descent']); expect(first.events).toEqual([]);
  const landed = feed.ingest(packet(200, {}, { players: players(.3) }));
  expect(kinds(landed.events)).toEqual(['pod-impact']); expect(landed.loops).toEqual([]);
  expect(feed.ingest(packet(500, {}, { players: [{ id: 'p', x: 5, y: 6, life: 'active', recovery: 0 }] })).events).toEqual([]);
});
