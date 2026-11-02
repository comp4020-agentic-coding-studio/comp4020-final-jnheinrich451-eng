import { expect, it } from 'vitest';
import { COLONY_ENTRY, COLONY_TRAVEL, COLONY_REST_ANGLE, COLONY_SPRITES, colonyBayPose, colonyCamera, colonyCarrierPose, colonyEntryState, colonyExhaustPoses, colonyShuttlePose, colonyTravelPose, colonyTravelState, paintColonyVessels } from '../public/colony-entry-ship.js';

const globe = { x: 600, y: 400, r: 330 };

it('holds the docked shuttle indefinitely until admission, including a slow response', () => {
  for (const age of [0, 1299, 3000, 15000, 120000]) {
    const waiting = colonyEntryState(age, false);
    expect(waiting).toMatchObject({ phase: 'zoom', release: 0, dive: 0, done: false });
    expect(colonyShuttlePose(colonyCarrierPose(globe, 0), waiting)).toEqual(colonyBayPose(colonyCarrierPose(globe, 0)));
  }
});

it('separates approach, gentle release and controlled atmospheric flight', () => {
  const { zoom, release, dive, total } = COLONY_ENTRY;
  expect(zoom + release + dive).toBe(total);
  expect(colonyEntryState(-100)).toMatchObject({ phase: 'zoom', zoom: 0 });
  expect(colonyEntryState(zoom)).toMatchObject({ phase: 'release', zoom: 1, release: 0, dive: 0 });
  expect(colonyEntryState(zoom + release)).toMatchObject({ phase: 'dive', release: 1, dive: 0 });
  expect(colonyEntryState(total - 1).done).toBe(false);
  expect(colonyEntryState(total + 10000)).toMatchObject({ phase: 'dive', dive: 1, done: true });
});

it('follows the selected globe at a readable desktop and phone size', () => {
  for (const compact of [false, true]) for (let time = 0; time <= 60000; time += 1000) {
    const world = compact ? { x: 195, y: 250, r: 172 } : globe;
    const pose = colonyCarrierPose(world, time, compact);
    expect(pose.length).toBeGreaterThanOrEqual(compact ? 120 : 224);
    expect(pose.length).toBeLessThanOrEqual(compact ? 168 : 360);
    expect(pose.y).toBeGreaterThan(world.y + world.r * .3);
    expect(pose.angle).toBeCloseTo(-Math.PI / 2 + Math.PI / 12);
    const shifted = colonyCarrierPose({ ...world, x: world.x + 32, y: world.y - 40 }, time, compact);
    expect(shifted.x - pose.x).toBeCloseTo(32); expect(shifted.y - pose.y).toBeCloseTo(-40);
  }
});

it('scales the carrier and docked craft to eighty percent without moving their orbit', () => {
  const carrier = colonyCarrierPose(globe, 0), previousLength = 389.4;
  expect(carrier.length).toBeCloseTo(previousLength * .8);
  const previous = { ...carrier, length: previousLength };
  for (const index of [0, 1]) {
    const bay = colonyBayPose(carrier, index), oldBay = colonyBayPose(previous, index);
    expect(bay.length / oldBay.length).toBeCloseTo(.8);
    expect(bay.x - carrier.x).toBeCloseTo((oldBay.x - carrier.x) * .8);
    expect(bay.y - carrier.y).toBeCloseTo((oldBay.y - carrier.y) * .8);
  }
});

it('keeps the three exhausts behind the aft nozzles through steering and scaling', () => {
  const carrier = { x: 20, y: 30, length: 320, angle: 0 }, jets = colonyExhaustPoses(carrier);
  const turned = colonyExhaustPoses({ ...carrier, angle: Math.PI / 2 });
  const smaller = colonyExhaustPoses({ ...carrier, length: 160 });
  expect(jets).toHaveLength(3);
  expect(new Set(jets.map(jet => jet.y)).size).toBe(3);
  for (const [i, jet] of jets.entries()) {
    expect(jet.x).toBeLessThan(carrier.x - carrier.length * .45);
    expect(Math.cos(jet.angle)).toBeCloseTo(-1);
    expect(turned[i].x - carrier.x).toBeCloseTo(-(jet.y - carrier.y));
    expect(turned[i].y - carrier.y).toBeCloseTo(jet.x - carrier.x);
    expect(Math.sin(turned[i].angle)).toBeCloseTo(-1);
    expect(smaller[i].length).toBeCloseTo(jet.length / 2);
    expect(smaller[i].radius).toBeCloseTo(jet.radius / 2);
  }
});

it('pulses bounded jets from the scene clock and eases thrust with the voyage', () => {
  const carrier = colonyCarrierPose(globe, 0);
  const idle = colonyExhaustPoses(carrier, { time: 3000 });
  const departing = colonyExhaustPoses(carrier, { time: 3000, travel: { phase: 'depart', progress: 1 } });
  const arrived = colonyExhaustPoses(carrier, { time: 3000, travel: { phase: 'arrive', progress: 1 } });
  for (const [i, jet] of arrived.entries()) {
    expect(jet.length).toBeCloseTo(idle[i].length);
    expect(jet.alpha).toBeCloseTo(idle[i].alpha);
  }
  expect(colonyExhaustPoses(carrier, { time: 3033 })).not.toEqual(idle);
  // Pause/reduced motion reuse the frozen scene clock, including forced redraws.
  expect(colonyExhaustPoses(carrier, { time: 3000 })).toEqual(idle);
  for (const [i, jet] of departing.entries()) {
    expect(jet.length).toBeGreaterThan(idle[i].length * 2);
    expect(jet.alpha).toBeGreaterThan(idle[i].alpha);
  }
  for (let time = 0; time < 10000; time += 137) for (const jet of colonyExhaustPoses(carrier, { time, travel: { phase: 'depart', progress: 1 } })) {
    expect(jet.length).toBeGreaterThan(0);
    expect(jet.length).toBeLessThan(carrier.length * .15);
    expect(jet.alpha).toBeGreaterThan(0); expect(jet.alpha).toBeLessThanOrEqual(1);
  }
});

it('keeps both bow berths attached in any carrier orientation', () => {
  const carrier = { x: 20, y: 30, length: 400, angle: 0 }, plain = colonyBayPose(carrier);
  const turned = colonyBayPose({ ...carrier, angle: Math.PI / 2 });
  expect(turned.x - carrier.x).toBeCloseTo(-(plain.y - carrier.y));
  expect(turned.y - carrier.y).toBeCloseTo(plain.x - carrier.x);
  expect(plain.length).toBeCloseTo(carrier.length * COLONY_SPRITES.shuttle.lengthRatio);
  const other = colonyBayPose(carrier, 1);
  expect(other.x).toBeCloseTo(plain.x);
  expect(other.y).toBeGreaterThan(plain.y + plain.length * .7);
  expect(plain.x).toBeGreaterThan(carrier.x + carrier.length * .2);
});

it('clears the bow before flying ahead with shallow banks, independent of screen direction', () => {
  const carrier = colonyCarrierPose(globe, 0), bay = colonyBayPose(carrier);
  const cleared = colonyShuttlePose(carrier, { release: 1, dive: 0 });
  expect(Math.hypot(cleared.x - bay.x, cleared.y - bay.y)).toBeGreaterThan(carrier.length * .2);
  const forward = (pose: { x: number; y: number }) => (pose.x - bay.x) * Math.cos(carrier.angle) + (pose.y - bay.y) * Math.sin(carrier.angle);
  let previous = cleared;
  for (let p = .02; p <= 1; p += .02) {
    const next = colonyShuttlePose(carrier, { release: 1, dive: p });
    expect(forward(next)).toBeGreaterThan(forward(previous));
    expect(Math.abs(next.angle - carrier.angle)).toBeLessThanOrEqual(.25);
    expect(Math.hypot(next.x - previous.x, next.y - previous.y)).toBeLessThan(carrier.length * .04);
    previous = next;
  }
});

it('starts with an identical camera and then follows the shuttle on desktop and phone', () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const carrier = colonyCarrierPose(globe, 0, width <= 760);
    const initial = colonyCamera(carrier, colonyEntryState(0), width, height);
    expect(initial.z).toBe(1); expect(initial.x).toBe(initial.fx); expect(initial.y).toBe(initial.fy);
    const cruising = colonyEntryState(COLONY_ENTRY.zoom + COLONY_ENTRY.release + 2000);
    const camera = colonyCamera(carrier, cruising, width, height), shuttle = colonyShuttlePose(carrier, cruising);
    expect(camera.fx).toBe(shuttle.x); expect(camera.fy).toBe(shuttle.y);
    expect(camera.x).toBeCloseTo(width * .49); expect(camera.y).toBeCloseTo(height * .49);
  }
});

it('shows two bow shuttles but sends only one into the atmosphere', () => {
  const draws: unknown[][] = [], order: unknown[] = [];
  const ctx = { globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient() { return { addColorStop() {} }; }, beginPath() {}, moveTo() {}, quadraticCurveTo() {}, closePath() {},
    fill() { order.push('exhaust'); }, drawImage(...args: unknown[]) { draws.push(args); order.push(args[0]); } };
  const images = { carrier: { name: 'empty carrier' }, shuttle: { name: 'shuttle' } }, carrier = colonyCarrierPose(globe, 0);
  paintColonyVessels(ctx, images, carrier);
  expect(draws.map(call => call[0])).toEqual([images.carrier, images.shuttle, images.shuttle]);
  expect(order.slice(0, order.indexOf(images.carrier))).toEqual(Array(6).fill('exhaust'));
  draws.length = 0; order.length = 0;
  paintColonyVessels(ctx, images, carrier, { release: 1, dive: .6 });
  expect(draws.map(call => call[0])).toEqual([images.shuttle]);
  expect(order).toEqual([images.shuttle]);
});

const startPose = { x: 550, y: 450, length: 350, angle: COLONY_REST_ANGLE };
const endPose = { x: 600, y: 460, length: 355, angle: COLONY_REST_ANGLE };
const travelRoute = { departureAngle: -Math.PI * .75, arrivalAngle: Math.PI * .25, distance: 2000 };

it('exchanges the worlds only while the travelling ship is offscreen, without a jump flash', () => {
  const { turn, depart, exchange, arrive, settle, total } = COLONY_TRAVEL;
  expect(turn + depart + exchange + arrive + settle).toBe(total);
  expect(colonyTravelState(turn + depart - 1)).toMatchObject({ phase: 'depart', sceneMix: 0, swapped: false });
  const halfway = colonyTravelState(turn + depart + exchange / 2);
  expect(halfway).toMatchObject({ phase: 'exchange', sceneMix: .5, swapped: true, done: false });
  expect(colonyTravelPose(startPose, endPose, halfway, travelRoute).alpha).toBe(0);
  expect(colonyTravelState(turn + depart + exchange)).toMatchObject({ phase: 'arrive', sceneMix: 1 });
  expect(colonyTravelState(total)).toMatchObject({ phase: 'done', sceneMix: 1, done: true });
});

it('turns the short way toward either chosen planet before accelerating', () => {
  for (const angle of [-Math.PI * .75, Math.PI * .25]) {
    const route = { ...travelRoute, departureAngle: angle };
    const initial = colonyTravelPose(startPose, endPose, colonyTravelState(0), route);
    expect(initial).toMatchObject(startPose);
    const halfway = colonyTravelPose(startPose, endPose, colonyTravelState(COLONY_TRAVEL.turn / 2), route);
    const turned = colonyTravelPose(startPose, endPose, colonyTravelState(COLONY_TRAVEL.turn), route);
    expect(halfway.x).toBe(startPose.x); expect(halfway.y).toBe(startPose.y);
    expect(Math.abs(halfway.angle - initial.angle)).toBeLessThan(Math.PI / 2);
    expect(Math.cos(turned.angle - angle)).toBeCloseTo(1);
  }
});

it('accelerates away and decelerates on arrival, with continuous endpoints', () => {
  const { turn, depart, exchange, arrive, total } = COLONY_TRAVEL;
  const pose = (age: number) => colonyTravelPose(startPose, endPose, colonyTravelState(age), travelRoute);
  const step = 100, distance = (a: typeof startPose, b: typeof startPose) => Math.hypot(a.x - b.x, a.y - b.y);
  expect(distance(pose(turn + step), pose(turn))).toBeLessThan(distance(pose(turn + depart), pose(turn + depart - step)));
  // The middle is deliberately omitted offscreen. Arrival starts outside the
  // destination from the old planet side, with the same direction as its travel.
  const begins = turn + depart + exchange;
  expect(distance(pose(begins + step), pose(begins))).toBeGreaterThan(distance(pose(begins + arrive), pose(begins + arrive - step)));
  const afterArrival = pose(begins + arrive);
  expect(afterArrival.x).toBeCloseTo(endPose.x); expect(afterArrival.y).toBeCloseTo(endPose.y);
  expect(distance(pose(turn - .001), pose(turn + .001))).toBeLessThan(.001);
  expect(distance(pose(begins + arrive - .001), pose(begins + arrive + .001))).toBeLessThan(.001);
  expect(pose(total)).toMatchObject(endPose);
  expect(Math.cos(pose(total - .001).angle - endPose.angle)).toBeCloseTo(1);
});
