import { expect, it } from 'vitest';
import { createColony, colonyAction, colonyPlacementError, colonyCanStand, tickColony } from '../public/colonization.js';
import { AMBIENCE, environmentAt, decorationItems, cinemaPosition } from '../public/colony-ambience.js';

const host = { id: 'host', isHost: true }, guest = { id: 'guest' };
const garden = (): any => createColony('morrow-v1');

it('derives one shared active-time atmosphere for legacy saves and does not mutate them by viewing', () => {
  const state = garden(), before = JSON.stringify(state);
  const dawn = environmentAt(state, 0), later = environmentAt(state, 400);
  expect(JSON.stringify(state)).toBe(before);
  expect(later.phase).not.toBe(dawn.phase);
  expect(environmentAt(JSON.parse(before), 400)).toEqual(later);
  const { world, ...snapshot } = state;
  expect(environmentAt(snapshot, 400)).toEqual(later);
  expect(environmentAt(state, 400 + AMBIENCE.daySeconds).phase).toBeCloseTo(later.phase);
  expect(environmentAt(state, 400)).toEqual(later);
  expect(decorationItems(state)).toEqual([]);
});

it('varies natural weather across adjacent slots instead of locking whole numeric decades to one sky', () => {
  for (const template of ['morrow-v1', 'nacre-v1', 'aurelia-v1']) {
    const state = { template };
    const samples = Array.from({ length: 24 }, (_,slot) =>
      environmentAt(state, slot * AMBIENCE.weatherSeconds + 20).weather);
    expect(new Set(samples)).toEqual(new Set(['clear', 'cloudy', 'rain']));
    // Each opening hour has some variety; consecutive slots may still share a sky.
    for (let start = 0; start < 20; start += 10)
      expect(new Set(samples.slice(start, start + 10)).size).toBeGreaterThan(1);
    expect(samples.slice(1).filter((value, index) => value !== samples[index]).length).toBeGreaterThan(5);
    expect(Array.from({ length: 24 }, (_,slot) =>
      environmentAt(structuredClone(state), slot * AMBIENCE.weatherSeconds + 20).weather)).toEqual(samples);
    expect(state).toEqual({ template });
  }
});

it('host atmosphere controls are visual-only, validated and persist without moving crop or movie clocks', () => {
  const state = garden(); state.time = 190;
  const before = JSON.stringify(state);
  expect(() => colonyAction(state, guest, 'set-environment', { lighting: 'night', weather: 'rain', isHost: true })).toThrow('Only the expedition host');
  expect(JSON.stringify(state)).toBe(before);
  expect(() => colonyAction(state, host, 'set-environment', { weather: 'storm' })).toThrow('available weather');
  colonyAction(state, host, 'set-environment', { lighting: 'sunset', weather: 'rain' });
  expect(state.time).toBe(190);
  expect(environmentAt(state)).toMatchObject({ phase: .74, weather: 'rain', rain: 1, lightingPreset: 'sunset' });
  const saved = JSON.parse(JSON.stringify(state));
  expect(environmentAt(saved, 900)).toEqual(environmentAt(state, 900));
  colonyAction(state, host, 'set-environment', { lighting: 'natural', weather: 'natural' });
  expect(environmentAt(state).lightingPreset).toBe('natural');
  expect(state.time).toBe(190);
});

it('camp props reserve solid footprints, respect existing construction and do not consume garden supplies', () => {
  const state = garden();
  const built = colonyAction(state, guest, 'build-campfire', { x: 31, y: 34 });
  expect(state.materials).toBe(40);
  expect(colonyCanStand(state, 31.5, 34.5)).toBe(false);
  expect(colonyPlacementError(state, 'bed', 31, 34)).toContain('existing garden');
  expect(colonyPlacementError(state, 'campfire', 36, 31)).toContain('arrival area');
  expect(() => colonyAction(state, { ...host, players: [{ x: 40.8, y: 34.5 }] }, 'build-cinema', { x: 40, y: 34 })).toThrow('worker clear');
  colonyAction(state, host, 'build-cinema', { x: 40, y: 34 });
  for (const x of [39.5, 40.5, 41.5]) expect(colonyCanStand(state, x, 34.5)).toBe(false);
  expect(() => colonyAction(state, host, 'build-cinema', { x: 32, y: 23 })).toThrow('already has');
  expect(() => colonyAction(state, host, 'toggle-campfire', { decorationId: built.targetId, revision: 3 })).toThrow('changed');
  colonyAction(state, host, 'toggle-campfire', { decorationId: built.targetId, revision: 0 });
  expect(decorationItems(state)[0].lit).toBe(false);
  colonyAction(state, host, 'remove-decoration', { decorationId: built.targetId, revision: 1 });
  expect(colonyCanStand(state, 31.5, 34.5)).toBe(true);
});

it('refuses decorative construction that cuts off previously reachable land and invalidates placement cache on removal', () => {
  const state = garden();
  state.world.terrain.fill(0);
  for (let x = 30; x <= 44; x++) state.world.terrain[31 * state.world.width + x] = 2;
  expect(colonyPlacementError(state, 'campfire', 40, 31)).toContain('walking route');
  expect(() => colonyAction(state, host, 'build-campfire', { x: 40, y: 31 })).toThrow('walking route');
  expect(decorationItems(state)).toEqual([]);
  const open = garden();
  const first = colonyAction(open, host, 'build-campfire', { x: 31, y: 34 });
  expect(colonyPlacementError(open, 'campfire', 31, 34)).not.toBeNull();
  colonyAction(open, host, 'remove-decoration', { decorationId: first.targetId, revision: 0 });
  expect(colonyPlacementError(open, 'campfire', 31, 34)).toBeNull();
});

it('bounds free decorative construction and preserves pennants when adding props', () => {
  const state = garden(); state.decorations.pennant = true;
  for (const x of [28, 30, 32, 34]) colonyAction(state, host, 'build-campfire', { x, y: 34 });
  expect(() => colonyAction(state, host, 'build-campfire', { x: 40, y: 34 })).toThrow('four fires');
  expect(state.decorations.pennant).toBe(true);
  expect(state.materials).toBe(40);
});

it('shares durable play/pause/restart timing, rejects stale controls and finishes the entire film', () => {
  const state = garden();
  const screen = colonyAction(state, host, 'build-cinema', { x: 40, y: 34 });
  colonyAction(state, guest, 'cinema-play', { revision: 0 });
  tickColony(state, 20);
  expect(cinemaPosition(state)).toBe(20);
  colonyAction(state, host, 'set-environment', { lighting: 'night' });
  expect(cinemaPosition(state)).toBe(20);
  colonyAction(state, host, 'cinema-pause', { revision: 1 });
  tickColony(state, 15);
  expect(cinemaPosition(state)).toBe(20);
  expect(() => colonyAction(state, guest, 'cinema-play', { revision: 1 })).toThrow('changed');
  const reopened = JSON.parse(JSON.stringify(state));
  colonyAction(reopened, guest, 'cinema-play', { revision: 2 });
  tickColony(reopened, AMBIENCE.movieDuration);
  expect(cinemaPosition(reopened)).toBe(AMBIENCE.movieDuration);
  expect(reopened.cinema.playing).toBe(false);
  colonyAction(reopened, guest, 'cinema-restart', { revision: 4 });
  expect(cinemaPosition(reopened)).toBe(0);
  expect(reopened.cinema.playing).toBe(true);
  colonyAction(reopened, host, 'remove-decoration', { decorationId: screen.targetId, revision: 0 });
  expect(reopened.cinema).toBeNull();
  expect(() => colonyAction(reopened, guest, 'cinema-play', { revision: 5 })).toThrow('screen first');
});
